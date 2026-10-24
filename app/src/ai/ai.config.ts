export interface AiProviderConfig {
  /** Базовый URL API (для DeepSeek: https://api.deepseek.com) */
  baseUrl: string;
  /** API-ключ */
  apiKey: string;
  /** Модель по умолчанию */
  defaultModel: string;
  /** Максимальное количество токенов в ответе */
  maxTokens?: number;
  /** Температура (0-2) */
  temperature?: number;
  /** Таймаут запроса в мс */
  timeout?: number;
  /** Количество повторных попыток при ошибке */
  maxRetries?: number;
}

export const AI_CONFIG = 'AI_CONFIG';

export const defaultAiConfig: AiProviderConfig = {
  baseUrl: process.env.AI_BASE_URL || 'https://api.deepseek.com',
  apiKey: process.env.AI_API_KEY || '',
  defaultModel: process.env.AI_MODEL || 'deepseek-flash',
  maxTokens: 4096,
  temperature: 1.0,
  timeout: 60000,
  maxRetries: 3,
};