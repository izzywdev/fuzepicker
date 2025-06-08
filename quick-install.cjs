#!/usr/bin/env node

// FuzePicker Quick Install Script
// Fast installation for Chrome extension in dev mode

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

console.log('⚡ FuzePicker Quick Install\n');

// Configuration
const PACKAGE_DIR = path.join(process.cwd(), 'extension-package');

// Required files
const requiredFiles = [
  'manifest.json', 'content.js', 'background.js', 'popup.html', 'popup.css', 'popup.js'
];

async function quickInstall() {
  try {
    // Check if files exist
    console.log('📋 Checking files...');
    const missingFiles = requiredFiles.filter(file => !fs.existsSync(file));
    
    if (missingFiles.length > 0) {
      console.log('❌ Missing files:', missingFiles.join(', '));
      console.log('Run: node install-extension.cjs for full setup');
      return;
    }
    
    // Create package directory
    console.log('📦 Creating package...');
    if (fs.existsSync(PACKAGE_DIR)) {
      fs.rmSync(PACKAGE_DIR, { recursive: true });
    }
    fs.mkdirSync(PACKAGE_DIR, { recursive: true });
    
    // Copy files
    requiredFiles.forEach(file => {
      fs.copyFileSync(file, path.join(PACKAGE_DIR, file));
    });
    
    // Copy icons if they exist
    if (fs.existsSync('icons')) {
      fs.mkdirSync(path.join(PACKAGE_DIR, 'icons'), { recursive: true });
      fs.readdirSync('icons').forEach(file => {
        if (file.endsWith('.svg') || file.endsWith('.png')) {
          fs.copyFileSync(
            path.join('icons', file), 
            path.join(PACKAGE_DIR, 'icons', file)
          );
        }
      });
    }
    
    // Copy content.css if it exists
    if (fs.existsSync('content.css')) {
      fs.copyFileSync('content.css', path.join(PACKAGE_DIR, 'content.css'));
    }
    
    console.log('✅ Package created!');
    console.log(`📂 Location: ${PACKAGE_DIR}`);
    
    // Try to open Chrome extensions page
    console.log('\n🚀 Opening Chrome...');
    
    const chromePaths = {
      win32: [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
      ],
      darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'],
      linux: ['/usr/bin/google-chrome', '/usr/bin/chromium-browser']
    };
    
    const platform = os.platform();
    const paths = chromePaths[platform] || [];
    const chromePath = paths.find(p => fs.existsSync(p));
    
    if (chromePath) {
      spawn(chromePath, ['chrome://extensions/'], { detached: true, stdio: 'ignore' });
      console.log('✅ Chrome extensions page opened!');
    } else {
      console.log('⚠️  Please manually open: chrome://extensions/');
    }
    
    console.log('\n📖 Next steps:');
    console.log('1. Enable "Developer mode" (toggle in top-right)');
    console.log('2. Click "Load unpacked"');
    console.log(`3. Select folder: ${PACKAGE_DIR}`);
    console.log('4. Start using FuzePicker! 🎉');
    
  } catch (error) {
    console.error('❌ Installation failed:', error.message);
    console.log('Try running: node install-extension.cjs');
  }
}

quickInstall(); 