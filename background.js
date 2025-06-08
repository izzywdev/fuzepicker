// FuzePicker Background Script - Service Worker for Manifest V3
const API_BASE_URL = 'http://localhost:3001/api'; // Backend API URL

// Store for current sessions and selections
let currentSelections = new Map();
let aiTaskQueue = [];

// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  try {
    // Toggle picker in current tab
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'togglePicker' });
    console.log('Picker toggled:', response);
  } catch (error) {
    console.error('Error toggling picker:', error);
  }
});

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'elementSelected':
      handleElementSelected(request, sender);
      break;
    case 'aiTask':
      handleAiTask(request, sender);
      break;
    case 'openPopup':
      openPopup();
      break;
    case 'getSelections':
      sendResponse({ selections: Array.from(currentSelections.values()) });
      break;
    case 'saveComment':
      handleSaveComment(request, sendResponse);
      break;
    default:
      console.log('Unknown action:', request.action);
  }
  
  return true; // Keep message channel open for async response
});

async function handleElementSelected(request, sender) {
  const { element, pageUrl } = request;
  const tabId = sender.tab.id;
  
  // Store selection locally
  const selectionId = `${tabId}_${Date.now()}`;
  currentSelections.set(selectionId, {
    id: selectionId,
    element,
    pageUrl,
    tabId,
    timestamp: Date.now(),
    comments: [],
    aiOutputs: {}
  });
  
  try {
    // Send to backend API
    await saveElementToBackend(element, pageUrl);
    console.log('Element saved to backend');
  } catch (error) {
    console.error('Failed to save element to backend:', error);
  }
}

async function handleAiTask(request, sender) {
  const { task, element, pageUrl } = request;
  const tabId = sender.tab.id;
  
  console.log(`Processing AI task: ${task}`);
  
  try {
    // Add to queue and process
    const taskId = `${tabId}_${task}_${Date.now()}`;
    aiTaskQueue.push({ taskId, task, element, pageUrl, tabId });
    
    const result = await processAiTask(task, element, pageUrl);
    
    // Store result
    const selection = Array.from(currentSelections.values())
      .find(s => s.tabId === tabId && s.element.html === element.html);
    
    if (selection) {
      selection.aiOutputs[task] = result;
      currentSelections.set(selection.id, selection);
    }
    
    // Notify popup if open
    notifyPopupUpdate();
    
  } catch (error) {
    console.error(`AI task ${task} failed:`, error);
  }
}

async function processAiTask(task, element, pageUrl) {
  const prompt = generateAiPrompt(task, element, pageUrl);
  
  try {
    // Call backend API for AI processing
    const response = await fetch(`${API_BASE_URL}/ai-task`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        task,
        element,
        pageUrl,
        prompt
      })
    });
    
    if (!response.ok) {
      throw new Error(`API call failed: ${response.status}`);
    }
    
    const result = await response.json();
    return result;
    
  } catch (error) {
    console.error('API call failed, using fallback:', error);
    return getFallbackAiResponse(task, element);
  }
}

function generateAiPrompt(task, element, pageUrl) {
  const baseInfo = `
    Element: ${element.tag}
    Classes: ${element.classes.join(', ')}
    Text: ${element.text}
    Page: ${pageUrl}
    Styles: ${JSON.stringify(element.styles, null, 2)}
  `;
  
  switch (task) {
    case 'discuss':
      return `Analyze this DOM element for design, accessibility, structure, and usability. Suggest improvements or ask questions for team feedback.\n\n${baseInfo}`;
    
    case 'figma':
      return `Convert this DOM element and its styles into a Figma-compatible JSON structure using auto layout, text layers, fills, and borders.\n\n${baseInfo}`;
    
    case 'playwright':
      return `Generate a Playwright test for this DOM element. Include visibility check, interaction, and accessibility check.\n\n${baseInfo}`;
    
    case 'react':
      return `Generate a functional React component that visually replicates this DOM element. Use Tailwind CSS for styling.\n\n${baseInfo}`;
    
    default:
      return `Analyze this DOM element:\n\n${baseInfo}`;
  }
}

function getFallbackAiResponse(task, element) {
  // Fallback responses when API is not available
  const responses = {
    discuss: {
      task: 'discuss',
      output: `**Element Analysis: ${element.tag}**

**Design Assessment:**
- Element appears to be a ${element.tag} with ${element.classes.length} CSS classes
- Text content: "${element.text}"
- Current styling includes: ${Object.keys(element.styles).join(', ')}

**Suggestions:**
- Consider accessibility improvements (ARIA labels, semantic markup)
- Evaluate responsive design across different screen sizes
- Check color contrast ratios for text readability
- Ensure proper focus management for keyboard navigation

**Questions for Team:**
- Does this element align with the design system?
- Are there any specific interaction requirements?
- Should this component be reusable across other pages?`
    },
    
    figma: {
      task: 'figma',
      output: `**Figma Component Structure:**

\`\`\`json
{
  "type": "FRAME",
  "name": "${element.tag.toUpperCase()}_Component",
  "fills": [{"type": "SOLID", "color": {"r": 1, "g": 1, "b": 1}}],
  "children": [
    {
      "type": "TEXT",
      "name": "Text_Layer",
      "characters": "${element.text}",
      "style": {
        "fontSize": ${element.styles.fontSize || "16"},
        "fontFamily": "${element.styles.fontFamily || 'Inter'}",
        "fontWeight": ${element.styles.fontWeight || "400"}
      }
    }
  ],
  "layoutMode": "VERTICAL",
  "primaryAxisSizingMode": "AUTO",
  "counterAxisSizingMode": "AUTO"
}
\`\`\`

**Implementation Notes:**
- Convert CSS styles to Figma properties
- Use Auto Layout for responsive behavior
- Apply component variants for different states`
    },
    
    playwright: {
      task: 'playwright',
      output: `**Playwright Test:**

\`\`\`typescript
import { test, expect } from '@playwright/test';

test('${element.tag} element interactions', async ({ page }) => {
  await page.goto('${pageUrl}');
  
  // Locate element
  const element = page.locator('${element.selector}');
  
  // Visibility check
  await expect(element).toBeVisible();
  
  // Text content check
  ${element.text ? `await expect(element).toContainText('${element.text}');` : '// No text content to verify'}
  
  // Accessibility check
  await expect(element).toBeAttached();
  
  // Interaction test (if applicable)
  ${element.tag === 'button' || element.tag === 'a' ? `
  await element.click();
  // Add assertions for post-click behavior
  ` : '// No standard interactions for this element type'}
  
  // Style verification
  await expect(element).toHaveCSS('display', '${element.styles.display}');
});
\`\`\`

**Additional Test Considerations:**
- Add responsive design tests
- Include keyboard navigation tests
- Test with screen readers
- Verify loading states if applicable`
    },
    
    react: {
      task: 'react',
      output: `**React Component:**

\`\`\`tsx
import React from 'react';

interface ${element.tag.charAt(0).toUpperCase() + element.tag.slice(1)}ComponentProps {
  children?: React.ReactNode;
  className?: string;
  ${element.text ? 'text?: string;' : ''}
}

const ${element.tag.charAt(0).toUpperCase() + element.tag.slice(1)}Component: React.FC<${element.tag.charAt(0).toUpperCase() + element.tag.slice(1)}ComponentProps> = ({
  children,
  className = '',
  ${element.text ? `text = '${element.text}',` : ''}
  ...props
}) => {
  return (
    <${element.tag}
      className={\`${element.classes.join(' ')} \${className}\`}
      {...props}
    >
      ${element.text ? '{text}' : '{children}'}
    </${element.tag}>
  );
};

export default ${element.tag.charAt(0).toUpperCase() + element.tag.slice(1)}Component;
\`\`\`

**Usage Example:**
\`\`\`tsx
<${element.tag.charAt(0).toUpperCase() + element.tag.slice(1)}Component${element.text ? ` text="${element.text}"` : ''} />
\`\`\`

**Tailwind Classes (equivalent styles):**
${generateTailwindClasses(element.styles)}`
    }
  };
  
  return responses[task] || { task, output: 'Task not supported in fallback mode.' };
}

function generateTailwindClasses(styles) {
  const tailwindMap = {
    'display: flex': 'flex',
    'justify-content: center': 'justify-center',
    'align-items: center': 'items-center',
    'padding: 8px': 'p-2',
    'padding: 16px': 'p-4',
    'margin: 8px': 'm-2',
    'margin: 16px': 'm-4',
    'border-radius: 4px': 'rounded',
    'border-radius: 8px': 'rounded-lg',
    'background-color: rgb(59, 130, 246)': 'bg-blue-500',
    'color: rgb(255, 255, 255)': 'text-white',
    'font-weight: bold': 'font-bold',
    'font-size: 14px': 'text-sm',
    'font-size: 16px': 'text-base',
    'font-size: 18px': 'text-lg'
  };
  
  const suggestions = [];
  Object.entries(styles).forEach(([prop, value]) => {
    const cssDeclaration = `${prop}: ${value}`;
    if (tailwindMap[cssDeclaration]) {
      suggestions.push(tailwindMap[cssDeclaration]);
    }
  });
  
  return suggestions.length > 0 ? suggestions.join(' ') : 'Custom styles needed - see original CSS';
}

async function saveElementToBackend(element, pageUrl) {
  try {
    const response = await fetch(`${API_BASE_URL}/elements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: 'user_1', // TODO: Implement proper auth
        pageUrl,
        element
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Backend save failed:', error);
    throw error;
  }
}

async function handleSaveComment(request, sendResponse) {
  const { elementId, comment } = request;
  
  try {
    const response = await fetch(`${API_BASE_URL}/discussions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        elementId,
        userId: 'user_1', // TODO: Implement proper auth
        comment,
        timestamp: Date.now()
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      sendResponse({ success: true, data: result });
    } else {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  } catch (error) {
    console.error('Save comment failed:', error);
    sendResponse({ success: false, error: error.message });
  }
}

function openPopup() {
  chrome.action.openPopup();
}

function notifyPopupUpdate() {
  // Notify popup of updates if it's open
  chrome.runtime.sendMessage({ action: 'dataUpdated' }).catch(() => {
    // Popup might not be open, ignore error
  });
}

// Initialize on startup
chrome.runtime.onStartup.addListener(() => {
  console.log('FuzePicker extension started');
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('FuzePicker extension installed');
}); 