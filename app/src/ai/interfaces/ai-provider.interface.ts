export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  thinking?: boolean;
  reasoningEffort?: 'none' | 'high' | 'max';
}

export interface ChatCompletionResult {
  content: string;
  /** При включённом thinking — трейс размышлений */
  reasoningContent?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: string | null;
}