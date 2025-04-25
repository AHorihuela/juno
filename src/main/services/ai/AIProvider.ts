export interface AIResult {
  text: string;
  error: string | null;
}

export interface AIProvider {
  processText(prompt: string, selectedText?: string): Promise<AIResult>;
}