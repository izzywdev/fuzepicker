// FuzePicker Popup Script
let currentElement = null;
let isPickerActive = false;

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', initializePopup);

async function initializePopup() {
  setupEventListeners();
  await loadSelectedElement();
  await loadSelections();
  updateUI();
}

function setupEventListeners() {
  // Tab navigation
  document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', (e) => {
      switchTab(e.target.dataset.tab);
    });
  });

  // Picker toggle
  document.getElementById('togglePicker').addEventListener('click', togglePicker);

  // Copy buttons
  document.querySelectorAll('.copy-btn').forEach(button => {
    button.addEventListener('click', handleCopy);
  });

  // Comment form
  document.getElementById('addComment').addEventListener('click', addComment);
  document.getElementById('commentInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      addComment();
    }
  });

  // AI action buttons
  document.querySelectorAll('.ai-btn').forEach(button => {
    button.addEventListener('click', (e) => {
      const action = e.currentTarget.dataset.action;
      triggerAiAction(action);
    });
  });

  // Listen for background messages
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'dataUpdated') {
      loadSelections();
      updateUI();
    }
  });
}

function switchTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

  // Update tab panels
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.remove('active');
  });
  document.getElementById(`${tabName}-tab`).classList.add('active');

  // Load tab-specific data
  if (tabName === 'discuss') {
    loadComments();
  } else if (tabName === 'ai-tools') {
    loadAiOutputs();
  }
}

async function togglePicker() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'togglePicker' });
    
    isPickerActive = response.active;
    updatePickerButton();
    updateStatus(isPickerActive ? 'Picker active - Click any element' : 'Picker disabled');
    
  } catch (error) {
    console.error('Failed to toggle picker:', error);
    updateStatus('Failed to toggle picker');
  }
}

function updatePickerButton() {
  const button = document.getElementById('togglePicker');
  const text = button.querySelector('.picker-text');
  
  if (isPickerActive) {
    button.classList.add('active');
    text.textContent = 'Stop Picking';
  } else {
    button.classList.remove('active');
    text.textContent = 'Pick Element';
  }
}

async function loadSelectedElement() {
  try {
    // Get from Chrome storage first
    const result = await chrome.storage.local.get('selectedElement');
    if (result.selectedElement) {
      currentElement = result.selectedElement;
      return;
    }

    // Fallback to content script
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getSelectedElement' });
    
    if (response && response.element) {
      currentElement = response.element;
    }
  } catch (error) {
    console.error('Failed to load selected element:', error);
  }
}

async function loadSelections() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getSelections' });
    if (response && response.selections) {
      // For now, use the most recent selection
      const latestSelection = response.selections[response.selections.length - 1];
      if (latestSelection) {
        currentElement = latestSelection.element;
      }
    }
  } catch (error) {
    console.error('Failed to load selections:', error);
  }
}

function updateUI() {
  if (currentElement) {
    showElementDetails();
  } else {
    showEmptyState();
  }
}

function showElementDetails() {
  document.getElementById('noSelection').style.display = 'none';
  document.getElementById('elementDetails').style.display = 'block';

  // Populate element info
  document.getElementById('elementTag').textContent = currentElement.tag;
  document.getElementById('elementClasses').textContent = 
    currentElement.classes.length > 0 ? currentElement.classes.join(', ') : 'None';
  document.getElementById('elementId').textContent = currentElement.id || 'None';
  document.getElementById('elementText').textContent = 
    currentElement.text || 'No text content';

  // Populate styles
  populateStyles();

  // Populate selectors
  document.getElementById('cssSelector').textContent = currentElement.selector;
  document.getElementById('xpathSelector').textContent = currentElement.xpath;

  updateStatus('Element selected');
}

function showEmptyState() {
  document.getElementById('noSelection').style.display = 'flex';
  document.getElementById('elementDetails').style.display = 'none';
  updateStatus('No element selected');
}

function populateStyles() {
  const container = document.getElementById('stylesContainer');
  container.innerHTML = '';

  Object.entries(currentElement.styles).forEach(([prop, value]) => {
    if (value && value !== 'none' && value !== 'auto') {
      const styleRow = document.createElement('div');
      styleRow.className = 'style-row';
      styleRow.innerHTML = `
        <span class="style-prop">${prop}:</span>
        <span class="style-value">${value}</span>
      `;
      container.appendChild(styleRow);
    }
  });
}

async function handleCopy(event) {
  const copyType = event.target.dataset.copy;
  let textToCopy = '';

  if (copyType === 'css') {
    textToCopy = currentElement.selector;
  } else if (copyType === 'xpath') {
    textToCopy = currentElement.xpath;
  }

  try {
    await navigator.clipboard.writeText(textToCopy);
    
    // Visual feedback
    const originalText = event.target.textContent;
    event.target.textContent = '✓';
    setTimeout(() => {
      event.target.textContent = originalText;
    }, 1000);
    
    updateStatus(`${copyType.toUpperCase()} selector copied`);
  } catch (error) {
    console.error('Failed to copy:', error);
    updateStatus('Failed to copy');
  }
}

async function addComment() {
  const input = document.getElementById('commentInput');
  const comment = input.value.trim();

  if (!comment || !currentElement) {
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'saveComment',
      elementId: currentElement.selector, // Using selector as ID for now
      comment: comment
    });

    if (response.success) {
      input.value = '';
      loadComments();
      updateStatus('Comment added');
    } else {
      updateStatus('Failed to save comment');
    }
  } catch (error) {
    console.error('Failed to add comment:', error);
    updateStatus('Failed to add comment');
  }
}

function loadComments() {
  const commentsList = document.getElementById('commentsList');
  
  // For now, show placeholder comments
  // In a real implementation, this would load from the backend
  commentsList.innerHTML = `
    <div class="comment-item">
      <div class="comment-meta">
        <span>You</span>
        <span>2 minutes ago</span>
      </div>
      <div class="comment-text">This element could benefit from better accessibility labels.</div>
    </div>
    <div class="comment-item">
      <div class="comment-meta">
        <span>Team Member</span>
        <span>5 minutes ago</span>
      </div>
      <div class="comment-text">Should we make the padding consistent with other buttons?</div>
    </div>
  `;
}

async function triggerAiAction(action) {
  if (!currentElement) {
    updateStatus('No element selected');
    return;
  }

  const button = document.querySelector(`[data-action="${action}"]`);
  button.classList.add('loading');
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    await chrome.runtime.sendMessage({
      action: 'aiTask',
      task: action,
      element: currentElement,
      pageUrl: tab.url
    });

    updateStatus(`${action} task started`);
    
    // Switch to AI tools tab to show progress
    switchTab('ai-tools');
    
    // Reload outputs after a short delay
    setTimeout(loadAiOutputs, 2000);
    
  } catch (error) {
    console.error(`Failed to trigger ${action}:`, error);
    updateStatus(`Failed to start ${action} task`);
  } finally {
    button.classList.remove('loading');
  }
}

async function loadAiOutputs() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getSelections' });
    const outputsList = document.getElementById('outputsList');
    
    if (!response || !response.selections || response.selections.length === 0) {
      outputsList.innerHTML = '<p class="empty-state">No AI outputs yet. Use the action buttons above to generate insights.</p>';
      return;
    }

    const latestSelection = response.selections[response.selections.length - 1];
    const outputs = latestSelection.aiOutputs || {};
    
    if (Object.keys(outputs).length === 0) {
      outputsList.innerHTML = '<p class="empty-state">No AI outputs yet. Use the action buttons above to generate insights.</p>';
      return;
    }

    outputsList.innerHTML = '';
    
    Object.entries(outputs).forEach(([task, output]) => {
      const outputItem = document.createElement('div');
      outputItem.className = 'output-item';
      
      const iconMap = {
        discuss: '💬',
        figma: '🎨',
        playwright: '🧪',
        react: '⚛️'
      };
      
      outputItem.innerHTML = `
        <div class="output-header">
          <div class="output-title">
            ${iconMap[task]} ${task.charAt(0).toUpperCase() + task.slice(1)}
          </div>
          <div class="output-timestamp">${formatTimestamp(Date.now())}</div>
        </div>
        <div class="output-content">${formatOutput(output.output)}</div>
      `;
      
      outputsList.appendChild(outputItem);
    });
    
  } catch (error) {
    console.error('Failed to load AI outputs:', error);
    document.getElementById('outputsList').innerHTML = '<p class="empty-state">Failed to load outputs.</p>';
  }
}

function formatOutput(output) {
  // Convert markdown-like content to HTML
  let formatted = output
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/```([\s\S]*?)```/g, '<pre>$1</pre>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
  
  return formatted;
}

function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) { // Less than 1 minute
    return 'Just now';
  } else if (diff < 3600000) { // Less than 1 hour
    const minutes = Math.floor(diff / 60000);
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else if (diff < 86400000) { // Less than 1 day
    const hours = Math.floor(diff / 3600000);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else {
    return date.toLocaleDateString();
  }
}

function updateStatus(message) {
  document.getElementById('statusBar').textContent = message;
} 