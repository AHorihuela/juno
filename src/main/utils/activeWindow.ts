import { clipboard } from 'electron';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';

const execAsync = promisify(exec);

/**
 * Gets the currently selected text from the active window using OS-specific methods
 */
export async function getSelectedText(): Promise<string> {
  try {
    if (process.platform === 'darwin') {
      // Save current clipboard content
      const originalClipboard = clipboard.readText();
      
      // Use AppleScript to copy selected text
      await runAppleScript('tell application "System Events" to keystroke "c" using command down');
      
      // Give some time for clipboard operation to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Get new clipboard content
      const selectedText = clipboard.readText();
      
      // Restore original clipboard content
      clipboard.writeText(originalClipboard);
      
      return selectedText;
    } else if (process.platform === 'win32') {
      // Windows implementation would go here
      return '';
    } else {
      // Linux implementation would go here
      return '';
    }
  } catch (error) {
    console.error('Error getting selected text:', error);
    return '';
  }
}

/**
 * Inserts text at the current cursor position using OS-specific methods
 */
export async function insertTextAtCursor(text: string): Promise<void> {
  try {
    if (!text) return;
    
    if (process.platform === 'darwin') {
      // Save current clipboard content
      const originalClipboard = clipboard.readText();
      
      // Set clipboard to our text
      clipboard.writeText(text);
      
      // Use AppleScript to paste text
      await runAppleScript('tell application "System Events" to keystroke "v" using command down');
      
      // Give some time for paste to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Restore original clipboard
      clipboard.writeText(originalClipboard);
    } else if (process.platform === 'win32') {
      // Windows implementation would go here
    } else {
      // Linux implementation would go here
    }
  } catch (error) {
    console.error('Error inserting text at cursor:', error);
    throw error;
  }
}

/**
 * Helper to execute AppleScript on macOS
 */
export async function runAppleScript(script: string): Promise<string> {
  try {
    const { stdout } = await execAsync(`osascript -e '${script}'`);
    return stdout.trim();
  } catch (error) {
    console.error('Error running AppleScript:', error);
    throw error;
  }
} 