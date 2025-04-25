// Test script for AppleScript execution
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
    
    // Test inline script execution
    console.log('\nTesting inline AppleScript execution...');
    const inlineResult = await executeInlineAppleScript(`tell application "System Events" to return "Hello from inline AppleScript"`);
    console.log('Inline AppleScript result:', inlineResult);
    console.log('✅ Inline AppleScript test PASSED');
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

function executeInlineAppleScript(script) {
  return new Promise((resolve, reject) => {
    execFile('osascript', ['-e', script], (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Inline AppleScript execution error: ${error.message}\nStderr: ${stderr}`));
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