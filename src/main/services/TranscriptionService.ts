import { BrowserWindow, clipboard, ipcMain } from 'electron';
import { getSelectedText, insertTextAtCursor } from '../utils/activeWindow';
import { AIService } from './ai/AIService';

export class TranscriptionService {
  private window: BrowserWindow;
  private aiService: AIService;
  private isProcessingCommand: boolean = false;

  constructor(window: BrowserWindow, openAIApiKey: string) {
    this.window = window;
    this.aiService = new AIService(openAIApiKey);
    this.setupEventListeners();
  }

  private setupEventListeners() {
    ipcMain.on('transcription-result', (_, text: string) => {
      this.processTranscription(text);
    });
  }

  private async processTranscription(text: string) {
    try {
      // Check if text starts with AI trigger words
      if (this.startsWithAITrigger(text) && !this.isProcessingCommand) {
        this.isProcessingCommand = true;
        await this.processAICommand(text);
        this.isProcessingCommand = false;
        return;
      }

      // Check for command keywords
      if (this.isCommandKeyword(text) && !this.isProcessingCommand) {
        this.isProcessingCommand = true;
        await this.processCommand(text);
        this.isProcessingCommand = false;
        return;
      }

      // Normal text transcription
      await insertTextAtCursor(text);
    } catch (error) {
      console.error('Error processing transcription:', error);
      this.window.webContents.send('transcription-error', 'Failed to process transcription');
    }
  }

  private startsWithAITrigger(text: string): boolean {
    const triggers = ['ai', 'hey ai', 'hey a i', 'hey juno', 'juno'];
    const lowerText = text.toLowerCase().trim();
    
    return triggers.some(trigger => lowerText.startsWith(trigger));
  }

  private isCommandKeyword(text: string): boolean {
    const commands = ['select all', 'copy', 'paste', 'cut', 'undo', 'redo'];
    const lowerText = text.toLowerCase().trim();
    
    return commands.some(command => lowerText === command);
  }

  private async processAICommand(text: string) {
    try {
      // Remove the trigger word from the beginning
      const triggers = ['ai', 'hey ai', 'hey a i', 'hey juno', 'juno'];
      let prompt = text.toLowerCase().trim();
      
      for (const trigger of triggers) {
        if (prompt.startsWith(trigger)) {
          prompt = prompt.substring(trigger.length).trim();
          break;
        }
      }

      // Get selected text if any
      const selectedText = await getSelectedText();
      
      // Process with AI
      const result = await this.aiService.processWithAI(prompt, selectedText);
      
      if (result.error) {
        this.window.webContents.send('transcription-error', `AI Error: ${result.error}`);
        return;
      }
      
      // Insert the AI response
      await insertTextAtCursor(result.text);
      
    } catch (error) {
      console.error('Error processing AI command:', error);
      this.window.webContents.send('transcription-error', 'Failed to process AI command');
    }
  }

  private async processCommand(text: string) {
    const command = text.toLowerCase().trim();
    
    try {
      switch (command) {
        case 'select all':
          // Simulate Cmd+A or Ctrl+A
          break;
          
        case 'copy':
          // Copy selected text to clipboard
          const textToCopy = await getSelectedText();
          if (textToCopy) {
            clipboard.writeText(textToCopy);
          }
          break;
          
        case 'paste':
          // Paste from clipboard
          const clipboardText = clipboard.readText();
          await insertTextAtCursor(clipboardText);
          break;
          
        case 'cut':
          // Cut selected text to clipboard
          const textToCut = await getSelectedText();
          if (textToCut) {
            clipboard.writeText(textToCut);
            await insertTextAtCursor(''); // Replace with empty string
          }
          break;
          
        case 'undo':
          // Simulate Cmd+Z or Ctrl+Z
          break;
          
        case 'redo':
          // Simulate Cmd+Shift+Z or Ctrl+Y
          break;
          
        default:
          break;
      }
    } catch (error) {
      console.error('Error processing command:', error);
      this.window.webContents.send('transcription-error', 'Failed to process command');
    }
  }
} 