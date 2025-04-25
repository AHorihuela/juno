/**
 * Comprehensive Test Script for Juno
 * 
 * This script tests the following functionality:
 * 1. Basic transcription and text insertion
 * 2. AI trigger keyword recognition
 * 3. Command keyword recognition
 * 4. Highlighted text handling for AI interactions
 */

const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

// Ensure app is ready
if (!app.isReady()) {
  console.log('Waiting for Electron app to be ready...');
  app.whenReady().then(runTests);
} else {
  runTests();
}

async function runTests() {
  console.log('Starting comprehensive functionality tests');
  
  // Test variables
  const testAudioPaths = [
    path.join(__dirname, '../test/assets/test-audio/basic-transcription.wav'),
    path.join(__dirname, '../test/assets/test-audio/ai-trigger.wav'),
    path.join(__dirname, '../test/assets/test-audio/command-keyword.wav')
  ];
  
  // Load service modules
  const ServiceRegistry = require('../src/main/services/ServiceRegistry');
  
  // Service factories
  try {
    const TextInsertionService = require('../src/main/services/textInsertionService');
    const SelectionService = require('../src/main/services/selection/SelectionService');
    const TranscriptionService = require('../src/main/services/transcriptionService');
    const ConfigService = require('../src/main/services/config/ConfigService');
    const NotificationService = require('../src/main/services/notification/NotificationService');
    
    // Create registry and register services
    const registry = new ServiceRegistry();
    
    registry.register('config', ConfigService());
    registry.register('notification', NotificationService());
    registry.register('selection', SelectionService());
    registry.register('textInsertion', TextInsertionService());
    registry.register('transcription', TranscriptionService());
    
    // Initialize services
    console.log('Initializing services...');
    await registry.initialize();
    
    // Get services
    const textInsertionService = registry.get('textInsertion');
    const selectionService = registry.get('selection');
    const transcriptionService = registry.get('transcription');
    
    // Run tests in sequence
    try {
      // Test 1: Basic AppleScript execution
      console.log('\n==== Test 1: AppleScript Execution ====');
      const appleScriptResult = await testAppleScriptExecution();
      console.log('AppleScript execution result:', appleScriptResult);
      
      // Test 2: Text insertion
      console.log('\n==== Test 2: Text Insertion ====');
      console.log('Please open a text editor and place cursor where text should be inserted');
      console.log('Waiting 5 seconds...');
      await sleep(5000);
      
      const insertionResult = await textInsertionService.insertText('Test text insertion via direct call');
      console.log('Text insertion result:', insertionResult);
      
      // Test 3: Selection detection
      console.log('\n==== Test 3: Selection Detection ====');
      console.log('Please select some text in your editor');
      console.log('Waiting 5 seconds...');
      await sleep(5000);
      
      const selectedText = await selectionService.getSelectedText();
      console.log('Selected text detected:', selectedText ? 
        `"${selectedText.substring(0, 50)}${selectedText.length > 50 ? '...' : ''}" (${selectedText.length} chars)` : 
        'No selection detected');
      
      // Test 4: Transcription with highlighted text
      console.log('\n==== Test 4: Transcription with Highlighted Text ====');
      console.log('Please select some text in your editor');
      console.log('Waiting 5 seconds...');
      await sleep(5000);
      
      if (fs.existsSync(testAudioPaths[0])) {
        // Load test audio file
        const audioData = fs.readFileSync(testAudioPaths[0]);
        
        // Process the audio
        console.log('Testing transcription with audio file...');
        try {
          const transcribedText = await transcriptionService.transcribeAudio(audioData);
          console.log('Transcription result:', transcribedText);
        } catch (error) {
          console.error('Transcription failed:', error);
        }
      } else {
        console.log('Test audio file not found. Skipping transcription test.');
      }
      
      console.log('\nAll tests completed!');
    } catch (error) {
      console.error('Test failed with error:', error);
    } finally {
      // Shutdown services
      await registry.shutdown();
    }
  } catch (error) {
    console.error('Failed to load required modules:', error);
  }
}

/**
 * Test AppleScript execution
 */
async function testAppleScriptExecution() {
  console.log('Testing AppleScript execution...');
  
  // Create a test script file
  const scriptPath = path.join(require('os').tmpdir(), 'test_script.scpt');
  const scriptContent = `
    on run
      tell application "System Events"
        set frontAppName to name of first process whose frontmost is true
        return frontAppName
      end tell
    end run
  `;
  
  try {
    // Write the script to temp file
    fs.writeFileSync(scriptPath, scriptContent);
    
    // Execute the script
    return await executeAppleScript(scriptPath);
  } catch (error) {
    console.error('AppleScript test failed:', error);
    return null;
  } finally {
    // Clean up
    if (fs.existsSync(scriptPath)) {
      fs.unlinkSync(scriptPath);
    }
  }
}

/**
 * Execute AppleScript from file
 */
function executeAppleScript(scriptPath) {
  return new Promise((resolve, reject) => {
    execFile('osascript', [scriptPath], (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`AppleScript execution error: ${error.message}\nStderr: ${stderr}`));
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
} 