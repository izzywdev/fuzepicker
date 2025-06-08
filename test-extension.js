// FuzePicker Extension Test Script
// Validates that all required files are present and properly structured

const fs = require('fs');
const path = require('path');

console.log('🧪 FuzePicker Extension Validation Test\n');

// Required files for Chrome extension
const requiredFiles = [
  'manifest.json',
  'content.js',
  'content.css', 
  'background.js',
  'popup.html',
  'popup.css',
  'popup.js'
];

// Required icon files
const requiredIcons = [
  'icons/icon16.svg',
  'icons/icon48.svg', 
  'icons/icon128.svg'
];

// Backend files
const backendFiles = [
  'backend/server.js',
  'backend/package.json',
  'backend/models/Element.js',
  'backend/models/Discussion.js',
  'backend/models/AiOutput.js',
  'backend/routes/elements.js',
  'backend/routes/discussions.js',
  'backend/routes/ai.js',
  'backend/routes/auth.js',
  'backend/middleware/auth.js',
  'backend/middleware/errorHandler.js',
  'backend/services/aiService.js'
];

let allTestsPassed = true;

// Test 1: Check required extension files
console.log('📋 Test 1: Extension Files');
requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - MISSING`);
    allTestsPassed = false;
  }
});

// Test 2: Check icon files
console.log('\n🎨 Test 2: Icon Files');
requiredIcons.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - MISSING`);
    allTestsPassed = false;
  }
});

// Test 3: Check backend files
console.log('\n🔧 Test 3: Backend Files');
backendFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - MISSING`);
    allTestsPassed = false;
  }
});

// Test 4: Validate manifest.json
console.log('\n📄 Test 4: Manifest Validation');
try {
  const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
  
  // Check required manifest fields
  const requiredFields = ['manifest_version', 'name', 'version', 'permissions', 'background', 'content_scripts', 'action'];
  
  requiredFields.forEach(field => {
    if (manifest[field]) {
      console.log(`✅ manifest.${field}`);
    } else {
      console.log(`❌ manifest.${field} - MISSING`);
      allTestsPassed = false;
    }
  });
  
  // Check manifest version
  if (manifest.manifest_version === 3) {
    console.log('✅ Manifest V3 compliant');
  } else {
    console.log('❌ Not Manifest V3 compliant');
    allTestsPassed = false;
  }
  
} catch (error) {
  console.log('❌ manifest.json - Invalid JSON');
  allTestsPassed = false;
}

// Test 5: Check package.json
console.log('\n📦 Test 5: Backend Package Validation');
try {
  const packageJson = JSON.parse(fs.readFileSync('backend/package.json', 'utf8'));
  
  const requiredDeps = ['express', 'mongoose', 'cors', 'helmet', 'joi', 'winston'];
  
  requiredDeps.forEach(dep => {
    if (packageJson.dependencies && packageJson.dependencies[dep]) {
      console.log(`✅ dependency: ${dep}`);
    } else {
      console.log(`❌ dependency: ${dep} - MISSING`);
      allTestsPassed = false;
    }
  });
  
} catch (error) {
  console.log('❌ backend/package.json - Invalid or missing');
  allTestsPassed = false;
}

// Test 6: File size checks (basic validation)
console.log('\n📏 Test 6: File Size Validation');
const fileSizeChecks = [
  { file: 'content.js', minSize: 5000 },
  { file: 'background.js', minSize: 5000 },
  { file: 'popup.js', minSize: 5000 },
  { file: 'popup.css', minSize: 3000 },
  { file: 'backend/server.js', minSize: 2000 }
];

fileSizeChecks.forEach(({ file, minSize }) => {
  try {
    const stats = fs.statSync(file);
    if (stats.size >= minSize) {
      console.log(`✅ ${file} (${stats.size} bytes)`);
    } else {
      console.log(`⚠️  ${file} (${stats.size} bytes) - Smaller than expected`);
    }
  } catch (error) {
    console.log(`❌ ${file} - Cannot read file`);
    allTestsPassed = false;
  }
});

// Final result
console.log('\n' + '='.repeat(50));
if (allTestsPassed) {
  console.log('🎉 ALL TESTS PASSED!');
  console.log('✅ FuzePicker extension is ready to load in Chrome');
  console.log('\nNext steps:');
  console.log('1. Go to chrome://extensions/');
  console.log('2. Enable Developer mode');
  console.log('3. Click "Load unpacked"');
  console.log('4. Select this directory');
  console.log('5. Start using FuzePicker!');
} else {
  console.log('❌ SOME TESTS FAILED');
  console.log('Please check the missing files above');
}

console.log('\n📊 Test Summary:');
console.log(`- Extension files: ${requiredFiles.length} required`);
console.log(`- Icon files: ${requiredIcons.length} required`);
console.log(`- Backend files: ${backendFiles.length} required`);
console.log(`- Total components tested: ${requiredFiles.length + requiredIcons.length + backendFiles.length}`);

// Additional info
console.log('\n📚 Additional Resources:');
console.log('- README.md: Complete setup and usage guide');
console.log('- PROJECT_STATUS.md: Current project status');
console.log('- setup.js: Interactive setup wizard');
console.log('- icons/preview.html: Icon preview in browser'); 