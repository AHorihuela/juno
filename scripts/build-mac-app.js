/**
 * Script to build the macOS application
 * 
 * This script:
 * 1. Temporarily removes the robotjs dependency from package.json
 * 2. Builds the application with webpack
 * 3. Packages the application with electron-builder
 * 4. Restores the robotjs dependency
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Paths
const packageJsonPath = path.join(__dirname, '..', 'package.json');

// Read package.json
console.log('Reading package.json...');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Store original dependencies
const originalDependencies = { ...packageJson.dependencies };

// Check if robotjs is in dependencies
if (packageJson.dependencies.robotjs) {
  console.log('Temporarily removing robotjs dependency...');
  delete packageJson.dependencies.robotjs;
  
  // Write modified package.json
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
}

try {
  // Build the application
  console.log('Building the application...');
  execSync('npm run build', { stdio: 'inherit' });
  
  // Package the application
  console.log('Packaging the application...');
  execSync('npm run dist', { stdio: 'inherit' });
  
  console.log('Build completed successfully!');
  console.log('You can find the packaged application in:');
  console.log('- DMG installer: dist/Juno-*.dmg');
  console.log('- ZIP archive: dist/Juno-*-mac.zip');
  console.log('- Application bundle: dist/mac-arm64/Juno.app');
} catch (error) {
  console.error('Build failed:', error);
} finally {
  // Restore original dependencies
  console.log('Restoring original dependencies...');
  packageJson.dependencies = originalDependencies;
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
} 