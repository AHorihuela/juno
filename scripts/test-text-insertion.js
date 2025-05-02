/**
 * Test Script for Text Insertion Functionality
 * 
 * This script tests the text insertion service with various scenarios
 * to ensure that the pasting functionality works correctly.
 */

const { app, clipboard } = require('electron');
const path = require('path');
const os = require('os');
const { exec, execFile } = require('child_process');
const { promisify } = require('util');

// Promisify exec function
const execPromise = promisify(exec);
const execFilePromise = promisify(execFile);

// Import key services
const ServiceRegistry = require('../src/main/services/ServiceRegistry');
const configService = require('../src/main/services/configService');
const textInsertionService = require('../src/main/services/textInsertionService');
const notificationService = require('../src/main/services/notificationService');
const LogManager = require('../src/main/utils/LogManager');

// Set up logger
LogManager.initialize({
  logLevel: 'DEBUG'
});
const logger = LogManager.getLogger('TextInsertionTest');

// Set up service registry
const registry = new ServiceRegistry();

async function runTests() {
  console.log('\n=== Text Insertion Service Test ===\n');
  
  try {
    // Initialize minimal services
    console.log('Initializing services...');
    registry
      .register('config', configService())
      .register('notification', notificationService())
      .register('textInsertion', textInsertionService());
    
    await registry.initialize();
    console.log('Services initialized successfully');
    
    // Get the text insertion service
    const insertionService = registry.get('textInsertion');
    
    // Original clipboard content
    const originalClipboard = clipboard.readText();
    console.log(`Original clipboard content: "${originalClipboard.substring(0, 30)}${originalClipboard.length > 30 ? '...' : ''}"`);
    
    // Test cases
    const testCases = [
      { 
        name: 'Short text', 
        text: 'This is a simple test of text insertion functionality.',
        replaceHighlight: false
      },
      { 
        name: 'Medium text', 
        text: 'This test contains a medium-length paragraph that should be inserted correctly. It has multiple sentences and should test the clipboard functionality with a slightly longer text than the previous test.',
        replaceHighlight: false
      },
      { 
        name: 'Text with special characters', 
        text: 'Special chars: !@#$%^&*()_+-=[]\\{}|;\':",./<>?€£¥©®™',
        replaceHighlight: false
      }
    ];
    
    // Run the tests sequentially
    for (const [index, test] of testCases.entries()) {
      console.log(`\n[${index + 1}/${testCases.length}] Running test: ${test.name}`);
      
      // Save initial clipboard content
      const beforeTest = clipboard.readText();
      
      try {
        // Try to insert the text
        console.log(`Inserting text: "${test.text.substring(0, 30)}${test.text.length > 30 ? '...' : ''}"`);
        
        // Confirm active application
        const frontApp = await getCurrentFrontmostApp();
        console.log(`Current active application: ${frontApp}`);
        
        // Prompt user to get ready
        console.log('\n⚠️  ATTENTION: Please open a text editor and place your cursor where text should be inserted.');
        console.log('You have 5 seconds to focus the target application...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Insert the text
        const result = await insertionService.insertText(test.text, test.replaceHighlight);
        
        // Check the result
        console.log(`Insertion result: ${result ? 'SUCCESS' : 'FAILED'}`);
        
        // Ask user to verify
        console.log('\n✏️  Please verify if the text was inserted correctly');
        console.log('If not, check the app logs for error details');
        
        // Wait for visual confirmation
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`Test failed:`, error);
      }
      
      // Check clipboard after test
      const afterTest = clipboard.readText();
      const clipboardChanged = beforeTest !== afterTest;
      console.log(`Clipboard ${clipboardChanged ? 'changed' : 'was restored'} after test`);
      
      // Pause between tests
      if (index < testCases.length - 1) {
        console.log('\nWaiting 3 seconds before next test...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    // Restore original clipboard if needed
    if (clipboard.readText() !== originalClipboard) {
      clipboard.writeText(originalClipboard);
      console.log('Restored original clipboard content');
    }
    
    // Test aggressive paste methods directly
    console.log('\n=== Testing Aggressive Paste Methods ===\n');
    
    console.log('Testing menu-based paste (may work in apps where keystroke paste fails)');
    console.log('Please focus the target application...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    try {
      const menuPasteScript = `
        delay 0.5
        tell application "System Events"
          tell process (name of first process whose frontmost is true)
            try
              click menu item "Paste" of menu "Edit" of menu bar 1
            on error
              keystroke "v" using command down
            end try
          end tell
        end tell
      `;
      
      // Set test content to clipboard
      const testText = "This text was inserted via menu-based paste";
      clipboard.writeText(testText);
      
      // Execute the aggressive paste script
      console.log('Executing menu-based paste AppleScript...');
      await execFilePromise('osascript', ['-e', menuPasteScript]);
      
      console.log('Menu-based paste completed. Please verify if text was inserted.');
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error('Menu-based paste test failed:', error);
    }
    
    // Final cleanup
    console.log('\nShutting down services...');
    await registry.shutdown();
    console.log('Test completed');
  } catch (error) {
    console.error('Test script failed:', error);
  }
}

/**
 * Get the current frontmost application
 */
async function getCurrentFrontmostApp() {
  try {
    const script = 'tell application "System Events" to get name of first process whose frontmost is true';
    const { stdout } = await execFilePromise('osascript', ['-e', script]);
    return stdout.trim();
  } catch (error) {
    console.error('Error getting frontmost app:', error);
    return 'unknown';
  }
}

// Run tests when Electron app is ready
app.whenReady().then(runTests).catch(error => {
  console.error('Failed to run tests:', error);
}).finally(() => {
  // Delay exit to ensure logs are written
  setTimeout(() => app.exit(), 1000);
}); 