// FuzePicker Content Script - Element Picker Tool
let isPickerActive = false;
let highlightedElement = null;
let selectedElement = null;
let shadowRoot = null;
let toolbar = null;

// Initialize picker when extension is loaded
initializePicker();

function initializePicker() {
  createShadowDom();
  setupEventListeners();
  
  // Listen for messages from popup/background
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'togglePicker') {
      togglePicker();
      sendResponse({ status: 'toggled', active: isPickerActive });
    } else if (request.action === 'getSelectedElement') {
      sendResponse({ element: selectedElement });
    }
  });
}

function createShadowDom() {
  // Create shadow DOM container to avoid CSS conflicts
  const shadowHost = document.createElement('div');
  shadowHost.id = 'fuzepicker-shadow-host';
  shadowHost.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 999999;
  `;
  
  document.body.appendChild(shadowHost);
  shadowRoot = shadowHost.attachShadow({ mode: 'open' });
  
  // Inject styles into shadow DOM
  const style = document.createElement('style');
  style.textContent = `
    .fuzepicker-highlight {
      position: absolute;
      pointer-events: none;
      border: 2px solid #3b82f6;
      background: rgba(59, 130, 246, 0.1);
      border-radius: 4px;
      z-index: 999998;
      transition: all 0.15s ease;
    }
    
    .fuzepicker-toolbar {
      position: absolute;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      padding: 8px;
      display: flex;
      gap: 8px;
      z-index: 999999;
      pointer-events: auto;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 12px;
    }
    
    .fuzepicker-btn {
      padding: 8px 12px;
      border: none;
      border-radius: 6px;
      background: #f3f4f6;
      color: #374151;
      cursor: pointer;
      transition: all 0.2s ease;
      white-space: nowrap;
    }
    
    .fuzepicker-btn:hover {
      background: #3b82f6;
      color: white;
    }
    
    .fuzepicker-btn.primary {
      background: #3b82f6;
      color: white;
    }
    
    .fuzepicker-close {
      position: absolute;
      top: -8px;
      right: -8px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #ef4444;
      color: white;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
    }
  `;
  shadowRoot.appendChild(style);
}

function setupEventListeners() {
  document.addEventListener('mouseover', handleMouseOver);
  document.addEventListener('mouseout', handleMouseOut);
  document.addEventListener('click', handleClick);
  document.addEventListener('keydown', handleKeyDown);
}

function togglePicker() {
  isPickerActive = !isPickerActive;
  
  if (!isPickerActive) {
    clearHighlight();
    hideToolbar();
  }
  
  document.body.style.cursor = isPickerActive ? 'crosshair' : 'default';
}

function handleMouseOver(event) {
  if (!isPickerActive || event.target.closest('#fuzepicker-shadow-host')) return;
  
  highlightElement(event.target);
}

function handleMouseOut(event) {
  if (!isPickerActive || event.target.closest('#fuzepicker-shadow-host')) return;
  
  clearHighlight();
}

function handleClick(event) {
  if (!isPickerActive || event.target.closest('#fuzepicker-shadow-host')) return;
  
  event.preventDefault();
  event.stopPropagation();
  
  selectElement(event.target);
  showToolbar(event.target);
}

function handleKeyDown(event) {
  if (event.key === 'Escape') {
    if (isPickerActive) {
      togglePicker();
    }
    hideToolbar();
  }
}

function highlightElement(element) {
  clearHighlight();
  highlightedElement = element;
  
  const rect = element.getBoundingClientRect();
  const highlight = document.createElement('div');
  highlight.className = 'fuzepicker-highlight';
  highlight.style.cssText = `
    top: ${rect.top + window.scrollY}px;
    left: ${rect.left + window.scrollX}px;
    width: ${rect.width}px;
    height: ${rect.height}px;
  `;
  
  shadowRoot.appendChild(highlight);
}

function clearHighlight() {
  const highlight = shadowRoot.querySelector('.fuzepicker-highlight');
  if (highlight) {
    highlight.remove();
  }
  highlightedElement = null;
}

function selectElement(element) {
  selectedElement = extractElementData(element);
  
  // Store selection in Chrome storage
  chrome.storage.local.set({
    selectedElement: selectedElement,
    pageUrl: window.location.href,
    timestamp: Date.now()
  });
  
  // Send to background script
  chrome.runtime.sendMessage({
    action: 'elementSelected',
    element: selectedElement,
    pageUrl: window.location.href
  });
}

function extractElementData(element) {
  const rect = element.getBoundingClientRect();
  const computedStyles = window.getComputedStyle(element);
  
  // Extract relevant CSS properties
  const relevantStyles = {};
  const stylesToCapture = [
    'color', 'backgroundColor', 'fontSize', 'fontFamily', 'fontWeight',
    'padding', 'margin', 'border', 'borderRadius', 'display', 'position',
    'width', 'height', 'flexDirection', 'justifyContent', 'alignItems'
  ];
  
  stylesToCapture.forEach(prop => {
    relevantStyles[prop] = computedStyles.getPropertyValue(prop);
  });
  
  return {
    id: element.id || null,
    tag: element.tagName.toLowerCase(),
    classes: Array.from(element.classList),
    text: element.innerText?.trim() || '',
    html: element.outerHTML,
    styles: relevantStyles,
    attributes: Array.from(element.attributes).reduce((acc, attr) => {
      acc[attr.name] = attr.value;
      return acc;
    }, {}),
    boundingBox: {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      top: rect.top,
      left: rect.left,
      bottom: rect.bottom,
      right: rect.right
    },
    xpath: getXPath(element),
    selector: generateSelector(element)
  };
}

function getXPath(element) {
  if (element.id) {
    return `//*[@id="${element.id}"]`;
  }
  
  const parts = [];
  while (element && element.nodeType === Node.ELEMENT_NODE) {
    let nbOfPreviousSiblings = 0;
    let hasNextSiblings = false;
    let sibling = element.previousSibling;
    
    while (sibling) {
      if (sibling.nodeType === Node.ELEMENT_NODE && sibling.nodeName === element.nodeName) {
        nbOfPreviousSiblings++;
      }
      sibling = sibling.previousSibling;
    }
    
    sibling = element.nextSibling;
    while (sibling) {
      if (sibling.nodeType === Node.ELEMENT_NODE && sibling.nodeName === element.nodeName) {
        hasNextSiblings = true;
        break;
      }
      sibling = sibling.nextSibling;
    }
    
    const index = nbOfPreviousSiblings || hasNextSiblings ? `[${nbOfPreviousSiblings + 1}]` : '';
    parts.unshift(element.nodeName.toLowerCase() + index);
    element = element.parentNode;
  }
  
  return parts.length ? '/' + parts.join('/') : null;
}

function generateSelector(element) {
  if (element.id) {
    return `#${element.id}`;
  }
  
  let selector = element.tagName.toLowerCase();
  
  if (element.className) {
    const classes = Array.from(element.classList).join('.');
    selector += `.${classes}`;
  }
  
  // Make it more specific if needed
  let parent = element.parentElement;
  if (parent && parent.tagName !== 'BODY') {
    const parentSelector = parent.id ? `#${parent.id}` : parent.tagName.toLowerCase();
    selector = `${parentSelector} > ${selector}`;
  }
  
  return selector;
}

function showToolbar(element) {
  hideToolbar();
  
  const rect = element.getBoundingClientRect();
  toolbar = document.createElement('div');
  toolbar.className = 'fuzepicker-toolbar';
  
  // Position toolbar
  const toolbarWidth = 400;
  const toolbarHeight = 50;
  let top = rect.bottom + window.scrollY + 10;
  let left = rect.left + window.scrollX;
  
  // Adjust if toolbar would go off screen
  if (left + toolbarWidth > window.innerWidth) {
    left = window.innerWidth - toolbarWidth - 20;
  }
  
  if (top + toolbarHeight > window.innerHeight + window.scrollY) {
    top = rect.top + window.scrollY - toolbarHeight - 10;
  }
  
  toolbar.style.cssText = `
    top: ${top}px;
    left: ${left}px;
  `;
  
  toolbar.innerHTML = `
    <button class="fuzepicker-close">×</button>
    <button class="fuzepicker-btn" data-action="discuss">💬 Discuss</button>
    <button class="fuzepicker-btn" data-action="figma">🎨 Figma</button>
    <button class="fuzepicker-btn" data-action="playwright">🧪 Test</button>
    <button class="fuzepicker-btn" data-action="react">⚛️ React</button>
  `;
  
  // Add event listeners
  toolbar.querySelector('.fuzepicker-close').addEventListener('click', hideToolbar);
  
  toolbar.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const action = e.target.dataset.action;
      handleToolbarAction(action);
    });
  });
  
  shadowRoot.appendChild(toolbar);
}

function hideToolbar() {
  if (toolbar) {
    toolbar.remove();
    toolbar = null;
  }
}

function handleToolbarAction(action) {
  // Send action to background script for AI processing
  chrome.runtime.sendMessage({
    action: 'aiTask',
    task: action,
    element: selectedElement,
    pageUrl: window.location.href
  });
  
  // Show loading state
  const btn = toolbar.querySelector(`[data-action="${action}"]`);
  if (btn) {
    const originalText = btn.textContent;
    btn.textContent = '⏳ Processing...';
    btn.disabled = true;
    
    setTimeout(() => {
      btn.textContent = originalText;
      btn.disabled = false;
    }, 3000);
  }
  
  // Hide toolbar and open popup
  hideToolbar();
  chrome.runtime.sendMessage({ action: 'openPopup' });
} 