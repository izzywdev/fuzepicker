// Icon Creation Script for FuzePicker Chrome Extension
// This script generates simple SVG icons that can be used as Chrome extension icons

const fs = require('fs');
const path = require('path');

// SVG icon template
const createIcon = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Background circle -->
  <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 2}" fill="url(#gradient)" stroke="#fff" stroke-width="2"/>
  
  <!-- Main icon - target/picker symbol -->
  <g transform="translate(${size/2}, ${size/2})">
    <!-- Center dot -->
    <circle cx="0" cy="0" r="${size/12}" fill="#fff"/>
    
    <!-- Inner circle -->
    <circle cx="0" cy="0" r="${size/6}" fill="none" stroke="#fff" stroke-width="${size/32}"/>
    
    <!-- Outer circle -->
    <circle cx="0" cy="0" r="${size/3.5}" fill="none" stroke="#fff" stroke-width="${size/48}"/>
    
    <!-- Crosshairs -->
    <line x1="-${size/2.5}" y1="0" x2="-${size/4}" y2="0" stroke="#fff" stroke-width="${size/48}"/>
    <line x1="${size/4}" y1="0" x2="${size/2.5}" y2="0" stroke="#fff" stroke-width="${size/48}"/>
    <line x1="0" y1="-${size/2.5}" x2="0" y2="-${size/4}" stroke="#fff" stroke-width="${size/48}"/>
    <line x1="0" y1="${size/4}" x2="0" y2="${size/2.5}" stroke="#fff" stroke-width="${size/48}"/>
  </g>
  
  <!-- AI indicator - small sparkle -->
  <g transform="translate(${size*0.75}, ${size*0.25})">
    <path d="M0,-3 L1,0 L0,3 L-1,0 Z" fill="#ffd700"/>
    <path d="M-3,0 L0,1 L3,0 L0,-1 Z" fill="#ffd700"/>
  </g>
</svg>
`;

// Create icons directory if it doesn't exist
if (!fs.existsSync('icons')) {
  fs.mkdirSync('icons');
}

// Generate icons for different sizes
const sizes = [16, 48, 128];

sizes.forEach(size => {
  const svgContent = createIcon(size);
  fs.writeFileSync(`icons/icon${size}.svg`, svgContent.trim());
  console.log(`Created icon${size}.svg`);
});

console.log('\nIcon files created successfully!');
console.log('Note: These are SVG files. For Chrome extension, you may need to convert them to PNG format.');
console.log('You can use online tools like https://cloudconvert.com/svg-to-png to convert them.');

// Create a simple HTML file to preview the icons
const previewHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FuzePicker Icons Preview</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            padding: 20px; 
            background: #f5f5f5; 
        }
        .icon-container { 
            display: flex; 
            gap: 20px; 
            align-items: center; 
            margin: 20px 0; 
            background: white; 
            padding: 20px; 
            border-radius: 8px; 
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .icon-info { 
            display: flex; 
            flex-direction: column; 
            gap: 5px; 
        }
        h1 { color: #333; }
        .size { color: #666; font-weight: bold; }
        .usage { color: #888; font-size: 14px; }
    </style>
</head>
<body>
    <h1>FuzePicker Chrome Extension Icons</h1>
    
    <div class="icon-container">
        <img src="icon16.svg" alt="16x16 icon" width="16" height="16">
        <div class="icon-info">
            <div class="size">16x16 pixels</div>
            <div class="usage">Used in: Extension toolbar, favicon</div>
        </div>
    </div>
    
    <div class="icon-container">
        <img src="icon48.svg" alt="48x48 icon" width="48" height="48">
        <div class="icon-info">
            <div class="size">48x48 pixels</div>
            <div class="usage">Used in: Extension management page, permissions dialog</div>
        </div>
    </div>
    
    <div class="icon-container">
        <img src="icon128.svg" alt="128x128 icon" width="128" height="128">
        <div class="icon-info">
            <div class="size">128x128 pixels</div>
            <div class="usage">Used in: Chrome Web Store, installation</div>
        </div>
    </div>
    
    <div style="margin-top: 30px; padding: 20px; background: #e3f2fd; border-radius: 8px;">
        <h3>Design Elements:</h3>
        <ul>
            <li><strong>Target Symbol:</strong> Represents element selection/picking functionality</li>
            <li><strong>Gradient Background:</strong> Modern, professional appearance</li>
            <li><strong>AI Sparkle:</strong> Indicates AI-powered features</li>
            <li><strong>Color Scheme:</strong> Blue-purple gradient for tech/AI association</li>
        </ul>
    </div>
</body>
</html>
`;

fs.writeFileSync('icons/preview.html', previewHtml.trim());
console.log('Created preview.html to view the icons in a browser'); 