# Juno Text Insertion Test Plan

## Issue Summary
After examining the logs, we identified that the transcription process successfully:
1. Records audio
2. Sends to Whisper API
3. Gets transcribed text: "now I'm testing a transcription hello one two three"
4. Processes the text through TextProcessingService

But it fails during the text insertion phase with a generic error that doesn't provide specific details.

## Test Objectives
1. Isolate the component causing the text insertion failure
2. Verify permissions and AppleScript functionality
3. Identify solutions to make the text insertion more robust

## Test Cases

### 1. Basic Text Insertion Test
**Description**: Directly test the TextInsertionService with a simple string
**Steps**:
1. Create a simple test script that:
   - Gets the TextInsertionService
   - Attempts to insert "Test text" into a text editor
   - Logs detailed error information
2. Run the test with the debugger attached

```javascript
// Save as scripts/test-text-insertion.js
const ServiceRegistry = require('../src/main/services/ServiceRegistry');

async function testTextInsertion() {
  console.log('Starting text insertion test');
  
  // Initialize services
  const registry = ServiceRegistry.getInstance();
  await registry.initialize();
  
  const textInsertionService = await registry.getService('textInsertion');
  
  try {
    // Open a text editor first (TextEdit, VS Code, etc.)
    console.log('Please open a text editor and place cursor where text should be inserted');
    console.log('Waiting 5 seconds before insertion...');
    
    // Wait for 5 seconds
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Try text insertion
    console.log('Attempting to insert text...');
    const result = await textInsertionService.insertText('Test text insertion via direct call');
    
    console.log('Insertion result:', result);
  } catch (error) {
    console.error('Error during text insertion test:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
  } finally {
    await registry.shutdown();
  }
}

testTextInsertion()
  .then(() => console.log('Test completed'))
  .catch(err => console.error('Test failed with error:', err))
  .finally(() => process.exit(0));
```

### 2. Clipboard Functionality Test
**Description**: Verify clipboard operations are working correctly
**Steps**:
1. Create a test script that:
   - Saves current clipboard content
   - Writes new content
   - Verifies content was written
   - Restores original content
2. Run test and verify each step

```javascript
// Save as scripts/test-clipboard.js
const { clipboard } = require('electron');
const { app } = require('electron');

async function testClipboard() {
  // Ensure Electron app is ready
  if (!app.isReady()) {
    await new Promise(resolve => app.on('ready', resolve));
  }
  
  console.log('Starting clipboard test');
  
  // Save original clipboard content
  const originalText = clipboard.readText();
  console.log('Original clipboard content length:', originalText.length);
  
  try {
    // Write new content
    const testText = 'Test clipboard functionality ' + Date.now();
    console.log('Writing to clipboard:', testText);
    clipboard.writeText(testText);
    
    // Verify content
    const verifyText = clipboard.readText();
    console.log('Read from clipboard:', verifyText);
    
    if (verifyText === testText) {
      console.log('✅ Clipboard test PASSED');
    } else {
      console.log('❌ Clipboard test FAILED - content mismatch');
      console.log('Expected:', testText);
      console.log('Actual:', verifyText);
    }
  } finally {
    // Restore original content
    console.log('Restoring original clipboard content');
    clipboard.writeText(originalText);
    console.log('Clipboard test completed');
  }
}

testClipboard()
  .then(() => console.log('All tests completed'))
  .catch(err => console.error('Test failed with error:', err))
  .finally(() => setTimeout(() => process.exit(0), 1000));
```

### 3. AppleScript Execution Test
**Description**: Verify AppleScript execution is working
**Steps**:
1. Create a test script to run a simple AppleScript command
2. Verify permission issues aren't blocking execution

```javascript
// Save as scripts/test-applescript.js
const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

async function testAppleScript() {
  console.log('Starting AppleScript test');
  
  // Create a test script file
  const scriptPath = path.join(os.tmpdir(), 'test_script.scpt');
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
    console.log('Test script created at:', scriptPath);
    
    // Execute the script
    console.log('Executing AppleScript...');
    const result = await executeAppleScript(scriptPath);
    console.log('AppleScript execution result:', result);
    console.log('✅ AppleScript test PASSED');
  } catch (error) {
    console.error('❌ AppleScript test FAILED:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
  } finally {
    // Clean up
    if (fs.existsSync(scriptPath)) {
      fs.unlinkSync(scriptPath);
      console.log('Test script removed');
    }
  }
}

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

testAppleScript()
  .then(() => console.log('All tests completed'))
  .catch(err => console.error('Test failed with error:', err))
  .finally(() => process.exit(0));
```

### 4. TextProcessingService Verification
**Description**: Verify the TextProcessingService outputs expected results
**Steps**:
1. Create a test script to process sample transcribed text
2. Verify the output is correctly formatted

```javascript
// Save as scripts/test-text-processing.js
const ServiceRegistry = require('../src/main/services/ServiceRegistry');

async function testTextProcessing() {
  console.log('Starting text processing test');
  
  // Initialize services
  const registry = ServiceRegistry.getInstance();
  await registry.initialize();
  
  const textProcessingService = await registry.getService('textProcessing');
  
  try {
    const testCases = [
      "now I'm testing a transcription hello one two three",
      "hello world. testing some punctuation issues",
      "i'd like to ensure contractions are handled correctly"
    ];
    
    for (const [index, text] of testCases.entries()) {
      console.log(`\nTest case ${index + 1}:`);
      console.log('Input:', text);
      
      const processed = textProcessingService.processText(text);
      console.log('Output:', processed);
      
      if (processed) {
        console.log('✅ Processing test PASSED');
      } else {
        console.log('❌ Processing test FAILED - empty output');
      }
    }
  } catch (error) {
    console.error('Error during text processing test:', error);
  } finally {
    await registry.shutdown();
  }
}

testTextProcessing()
  .then(() => console.log('All tests completed'))
  .catch(err => console.error('Test failed with error:', err))
  .finally(() => process.exit(0));
```

## Suggested Improvements

Based on the test results, we should implement the following improvements:

1. Enhance error logging in the TextInsertionService to capture specific error details
2. Add a retry mechanism for failed text insertions
3. Add fallback methods for text insertion when AppleScript fails
4. Add more detailed logs in the TranscriptionService's processAndInsertText method

## Implementation Plan

1. First run all tests to identify the specific failure point
2. Add improved error logging to the identified failure point
3. Implement the first fallback/retry mechanism
4. Test the complete workflow again

Once these tests are complete, we can determine if we need to:
1. Modify the TextProcessingService
2. Improve the TextInsertionService with better error handling
3. Or simply fix permission issues with AppleScript 