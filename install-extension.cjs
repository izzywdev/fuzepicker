#!/usr/bin/env node

// FuzePicker Chrome Extension Installation Script
// Automates the development installation process

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const os = require('os');

console.log(`
🚀 FuzePicker Chrome Extension Installer
========================================

This script will prepare and guide you through installing FuzePicker
as a Chrome extension in developer mode.

`);

// Configuration
const EXTENSION_NAME = 'FuzePicker';
const TEMP_DIR = path.join(os.tmpdir(), 'fuzepicker-extension');
const PACKAGE_DIR = path.join(process.cwd(), 'extension-package');

// Required extension files
const REQUIRED_FILES = [
  'manifest.json',
  'content.js',
  'content.css',
  'background.js',
  'popup.html',
  'popup.css',
  'popup.js'
];

// Icon files (will be converted if needed)
const ICON_FILES = [
  'icons/icon16.svg',
  'icons/icon48.svg',
  'icons/icon128.svg'
];

class ExtensionInstaller {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  // Step 1: Validate required files
  validateFiles() {
    console.log('📋 Step 1: Validating Extension Files\n');
    
    let allValid = true;
    
    REQUIRED_FILES.forEach(file => {
      if (fs.existsSync(file)) {
        console.log(`✅ ${file}`);
      } else {
        console.log(`❌ ${file} - MISSING`);
        this.errors.push(`Missing required file: ${file}`);
        allValid = false;
      }
    });
    
    // Check icons (SVG is okay for dev mode)
    ICON_FILES.forEach(file => {
      if (fs.existsSync(file)) {
        console.log(`✅ ${file}`);
      } else {
        console.log(`⚠️  ${file} - Missing (will generate fallback)`);
        this.warnings.push(`Icon file missing: ${file}`);
      }
    });
    
    if (!allValid) {
      throw new Error('Missing required extension files. Please ensure all files are present.');
    }
    
    console.log('\n✅ All required files validated!\n');
    return true;
  }

  // Step 2: Create package directory
  createPackage() {
    console.log('📦 Step 2: Creating Extension Package\n');
    
    // Clean and create package directory
    if (fs.existsSync(PACKAGE_DIR)) {
      fs.rmSync(PACKAGE_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(PACKAGE_DIR, { recursive: true });
    
    // Copy required files
    REQUIRED_FILES.forEach(file => {
      const src = path.join(process.cwd(), file);
      const dest = path.join(PACKAGE_DIR, file);
      
      // Create directory if needed
      const destDir = path.dirname(dest);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      
      fs.copyFileSync(src, dest);
      console.log(`📄 Copied ${file}`);
    });
    
    // Copy icons if they exist
    if (!fs.existsSync(path.join(PACKAGE_DIR, 'icons'))) {
      fs.mkdirSync(path.join(PACKAGE_DIR, 'icons'));
    }
    
    ICON_FILES.forEach(file => {
      const src = path.join(process.cwd(), file);
      const dest = path.join(PACKAGE_DIR, file);
      
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log(`🎨 Copied ${file}`);
      }
    });
    
    // Generate fallback icons if missing
    this.generateFallbackIcons();
    
    console.log(`\n✅ Extension package created at: ${PACKAGE_DIR}\n`);
  }

  // Generate simple fallback icons if SVG icons are missing
  generateFallbackIcons() {
    const iconSizes = [16, 48, 128];
    const iconsDir = path.join(PACKAGE_DIR, 'icons');
    
    iconSizes.forEach(size => {
      const iconPath = path.join(iconsDir, `icon${size}.svg`);
      
      if (!fs.existsSync(iconPath)) {
        const simpleSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#667eea"/>
  <text x="50%" y="50%" text-anchor="middle" dy="0.3em" fill="white" font-family="Arial" font-size="${Math.floor(size/4)}">FP</text>
</svg>`;
        
        fs.writeFileSync(iconPath, simpleSvg);
        console.log(`🎨 Generated fallback ${path.basename(iconPath)}`);
      }
    });
  }

  // Step 3: Validate manifest and update if needed
  validateManifest() {
    console.log('📄 Step 3: Validating Manifest\n');
    
    const manifestPath = path.join(PACKAGE_DIR, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    
    // Ensure manifest is valid for dev installation
    let updated = false;
    
    // Check manifest version
    if (manifest.manifest_version !== 3) {
      console.log('⚠️  Warning: Not using Manifest V3');
    } else {
      console.log('✅ Manifest V3 compliant');
    }
    
    // Check required fields
    const requiredFields = ['name', 'version', 'description'];
    requiredFields.forEach(field => {
      if (manifest[field]) {
        console.log(`✅ ${field}: ${manifest[field]}`);
      } else {
        console.log(`❌ Missing required field: ${field}`);
        this.errors.push(`Manifest missing field: ${field}`);
      }
    });
    
    // Ensure proper permissions for development
    if (!manifest.permissions) {
      manifest.permissions = [];
    }
    
    // Add development-friendly permissions if not present
    const devPermissions = ['activeTab', 'storage'];
    devPermissions.forEach(perm => {
      if (!manifest.permissions.includes(perm)) {
        manifest.permissions.push(perm);
        updated = true;
        console.log(`➕ Added permission: ${perm}`);
      }
    });
    
    if (updated) {
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      console.log('📝 Updated manifest.json');
    }
    
    console.log('\n✅ Manifest validated!\n');
  }

  // Step 4: Check Chrome installation
  checkChrome() {
    console.log('🌐 Step 4: Checking Chrome Installation\n');
    
    const chromePaths = {
      win32: [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        path.join(os.homedir(), 'AppData\\Local\\Google\\Chrome\\Application\\chrome.exe')
      ],
      darwin: [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      ],
      linux: [
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chrome'
      ]
    };
    
    const platform = os.platform();
    const possiblePaths = chromePaths[platform] || [];
    
    let chromePath = null;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        chromePath = p;
        break;
      }
    }
    
    if (chromePath) {
      console.log(`✅ Chrome found at: ${chromePath}`);
      this.chromePath = chromePath;
    } else {
      console.log('⚠️  Chrome not found in standard locations');
      console.log('Please ensure Google Chrome is installed');
    }
    
    console.log('\n');
  }

  // Step 5: Open Chrome extensions page
  openExtensionsPage() {
    console.log('🔧 Step 5: Opening Chrome Extensions Page\n');
    
    try {
      const url = 'chrome://extensions/';
      
      if (this.chromePath) {
        console.log('🚀 Opening Chrome extensions page...');
        spawn(this.chromePath, [url], { detached: true, stdio: 'ignore' });
      } else {
        console.log('📋 Please manually open Chrome and navigate to: chrome://extensions/');
      }
      
      console.log('\n');
    } catch (error) {
      console.log('⚠️  Could not automatically open Chrome');
      console.log('Please manually open: chrome://extensions/');
    }
  }

  // Step 6: Provide installation instructions
  showInstallationInstructions() {
    console.log('📖 Step 6: Installation Instructions\n');
    
    console.log('🎯 Follow these steps to install FuzePicker:\n');
    
    console.log('1. 🔧 Enable Developer Mode:');
    console.log('   - In Chrome, go to chrome://extensions/');
    console.log('   - Toggle "Developer mode" ON (top-right corner)\n');
    
    console.log('2. 📦 Load Unpacked Extension:');
    console.log('   - Click "Load unpacked" button');
    console.log(`   - Navigate to: ${PACKAGE_DIR}`);
    console.log('   - Select this folder and click "Select Folder"\n');
    
    console.log('3. ✅ Verify Installation:');
    console.log('   - FuzePicker should appear in your extensions list');
    console.log('   - You should see the FuzePicker icon in your Chrome toolbar');
    console.log('   - Click the icon to open the popup interface\n');
    
    console.log('4. 🧪 Test the Extension:');
    console.log('   - Go to any website');
    console.log('   - Click the FuzePicker icon');
    console.log('   - Try selecting an element on the page');
    console.log('   - Verify the AI tools are working\n');
    
    if (this.warnings.length > 0) {
      console.log('⚠️  Warnings:');
      this.warnings.forEach(warning => console.log(`   - ${warning}`));
      console.log('');
    }
  }

  // Step 7: Create uninstall script
  createUninstallScript() {
    console.log('🗑️  Step 7: Creating Uninstall Script\n');
    
    const uninstallScript = `#!/usr/bin/env node

// FuzePicker Extension Uninstaller
const fs = require('fs');
const path = require('path');

const PACKAGE_DIR = '${PACKAGE_DIR}';

console.log('🗑️  FuzePicker Extension Uninstaller\\n');

// Remove package directory
if (fs.existsSync(PACKAGE_DIR)) {
  fs.rmSync(PACKAGE_DIR, { recursive: true, force: true });
  console.log('✅ Removed extension package directory');
} else {
  console.log('⚠️  Extension package directory not found');
}

console.log('\\n📖 To complete uninstallation:');
console.log('1. Go to chrome://extensions/');
console.log('2. Find FuzePicker extension');
console.log('3. Click "Remove" button');
console.log('4. Confirm removal\\n');

console.log('✅ FuzePicker extension uninstalled!');
`;
    
    const uninstallPath = path.join(process.cwd(), 'uninstall-extension.cjs');
    fs.writeFileSync(uninstallPath, uninstallScript);
    
    console.log(`📄 Created uninstall script: ${uninstallPath}\n`);
  }

  // Main installation process
  async install() {
    try {
      console.log('🚀 Starting FuzePicker installation...\n');
      
      // Run all installation steps
      this.validateFiles();
      this.createPackage();
      this.validateManifest();
      this.checkChrome();
      this.openExtensionsPage();
      this.showInstallationInstructions();
      this.createUninstallScript();
      
      console.log('🎉 Installation preparation complete!\n');
      console.log('📂 Extension package location:');
      console.log(`   ${PACKAGE_DIR}\n`);
      
      console.log('⚡ Quick Install Command:');
      console.log('   1. Open chrome://extensions/');
      console.log('   2. Enable Developer mode');
      console.log('   3. Click "Load unpacked"');
      console.log(`   4. Select: ${PACKAGE_DIR}\n`);
      
      console.log('🎯 Ready to use FuzePicker! 🎯');
      
    } catch (error) {
      console.error('\n❌ Installation failed:', error.message);
      
      if (this.errors.length > 0) {
        console.log('\nErrors found:');
        this.errors.forEach(err => console.log(`  - ${err}`));
      }
      
      process.exit(1);
    }
  }
}

// Run the installer
if (require.main === module) {
  const installer = new ExtensionInstaller();
  installer.install();
}

module.exports = ExtensionInstaller; 