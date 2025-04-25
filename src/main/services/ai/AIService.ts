import { AIProvider, AIResult } from './AIProvider';
import { OpenAIProvider } from './providers/OpenAIProvider';

export class AIService {
  private provider: AIProvider;

  constructor(openAIApiKey: string) {
    this.provider = new OpenAIProvider(openAIApiKey);
  }

  async processWithAI(prompt: string, selectedText?: string): Promise<AIResult> {
    return this.provider.processText(prompt, selectedText);
  }
} 