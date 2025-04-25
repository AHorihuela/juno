import OpenAI from 'openai';
import { AIProvider, AIResult } from '../AIProvider';

export class OpenAIProvider implements AIProvider {
  private client: OpenAI;
  
  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey,
    });
  }

  async processText(prompt: string, selectedText?: string): Promise<AIResult> {
    try {
      const messages = [];
      
      // Add system message
      messages.push({
        role: 'system',
        content: 'You are a helpful AI assistant integrated with a text editor. Provide concise, relevant responses.'
      });
      
      // Add user message with context if provided
      if (selectedText) {
        messages.push({
          role: 'user',
          content: `${prompt}\n\nHere is the selected text:\n\n${selectedText}`
        });
      } else {
        messages.push({
          role: 'user',
          content: prompt
        });
      }
      
      const response = await this.client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: messages as any,
        temperature: 0.7,
        max_tokens: 1000,
      });
      
      const content = response.choices[0]?.message?.content || '';
      
      return {
        text: content,
        error: null,
      };
    } catch (error: any) {
      console.error('OpenAI API error:', error);
      return {
        text: '',
        error: error.message || 'Unknown error occurred with OpenAI API',
      };
    }
  }
} 