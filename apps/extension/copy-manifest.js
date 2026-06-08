const fs = require('fs');
const path = require('path');

const srcDir = __dirname;
const distDir = path.join(srcDir, 'dist');

// Ensure dist/icons directory exists
const distIconsDir = path.join(distDir, 'icons');
if (!fs.existsSync(distIconsDir)) {
  fs.mkdirSync(distIconsDir, { recursive: true });
}

// Generate simple solid color icons if they don't exist in source icons folder
const srcIconsDir = path.join(srcDir, 'icons');
if (!fs.existsSync(srcIconsDir)) {
  fs.mkdirSync(srcIconsDir, { recursive: true });
}

// Helper to write a basic 1x1 pixel PNG fallback if files don't exist
// A valid minimal 1x1 transparent PNG base64
const minimalPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const minimalPngBuffer = Buffer.from(minimalPngBase64, 'base64');

const iconSizes = [16, 48, 128];
iconSizes.forEach((size) => {
  const iconPath = path.join(srcIconsDir, `icon-${size}.png`);
  if (!fs.existsSync(iconPath)) {
    fs.writeFileSync(iconPath, minimalPngBuffer);
  }
  // Copy to dist/icons
  fs.copyFileSync(iconPath, path.join(distIconsDir, `icon-${size}.png`));
});

// Load, modify, and write manifest.json to dist
const manifestPath = path.join(srcDir, 'manifest.json');
if (fs.existsSync(manifestPath)) {
  let manifestText = fs.readFileSync(manifestPath, 'utf8');
  
  // Replace references pointing to 'dist/' since the manifest will now be inside 'dist/'
  manifestText = manifestText.replace(/"dist\/service-worker\.js"/g, '"service-worker.js"');
  manifestText = manifestText.replace(/"dist\/content\/autofill\.js"/g, '"content/autofill.js"');
  
  fs.writeFileSync(path.join(distDir, 'manifest.json'), manifestText);
  console.log('Successfully copied manifest.json and icons to dist/');
} else {
  console.error('manifest.json not found in apps/extension!');
}
