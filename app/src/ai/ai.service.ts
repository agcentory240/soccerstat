import { Injectable, Logger, Inject } from '@nestjs/common';
import OpenAI from 'openai';
import * as aiConfig from './ai.config.js';
import {
  ChatMessage,
  ChatCompletionOptions,
  ChatCompletionResult,
} from './interfaces/ai-provider.interface.js';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly client: OpenAI;

  constructor(@Inject(aiConfig.AI_CONFIG) private readonly config: aiConfig.AiProviderConfig) {
    this.client = new OpenAI({
      baseURL: this.config.baseUrl,
      apiKey: this.config.apiKey,
      timeout: this.config.timeout ?? 120000, // увеличен для thinking-режима
      maxRetries: this.config.maxRetries ?? 3,
    });
    this.logger.log(`AI provider initialized: ${this.config.baseUrl} (model: ${this.config.defaultModel})`);
  }

  /**
   * Отправляет чат-запрос к AI-провайдеру.
   */
  async chat(
    messages: ChatMessage[],
    options: ChatCompletionOptions = {},
  ): Promise<ChatCompletionResult> {
    const model = options.model ?? this.config.defaultModel;
    const maxTokens = options.maxTokens ?? this.config.maxTokens ?? 4096;
    const temperature = options.temperature ?? this.config.temperature ?? 1.0;

    // Формируем тело запроса
    const body: Record<string, any> = {
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
    };

    // DeepSeek-специфичный параметр thinking
    // Передаётся через extra_body для совместимости с OpenAI SDK
    if (options.thinking !== undefined) {
      body.thinking = options.thinking ? { type: 'enabled' } : { type: 'disabled' };
    }

    // reasoning_effort — управление глубиной размышлений
    // В thinking-режиме DeepSeek поддерживает "high" и "max" [citation:9]
    if (options.reasoningEffort) {
      body.reasoning_effort = options.reasoningEffort;
    }

    this.logger.debug(
      `AI request: model=${model}, messages=${messages.length}, ` +
      `thinking=${options.thinking ?? 'default'}, ` +
      `reasoning_effort=${options.reasoningEffort ?? 'default'}, ` +
      `maxTokens=${maxTokens}`,
    );

    try {
      const completion = await this.client.chat.completions.create(body as any);

      const choice = completion.choices[0];
      
      // === КЛЮЧЕВОЙ ФИКС БАГА DeepSeek V4 ===
      // При thinking-режиме модель может вернуть весь ответ в reasoning_content,
      // а content оставить пустым. Это известный баг [citation:7][citation:16].
      let content = choice.message.content ?? '';
      const reasoningContent = (choice.message as any).reasoning_content as string | undefined;
      const finishReason = choice.finish_reason;

      // Если content пустой, но есть reasoning_content — используем его
      if (!content.trim() && reasoningContent?.trim()) {
        this.logger.warn(
          `⚠️ DeepSeek вернул пустой content, используем reasoning_content (${reasoningContent.length} символов). finish_reason=${finishReason}`,
        );
        content = reasoningContent;
      }

      const usage = completion.usage
        ? {
            promptTokens: completion.usage.prompt_tokens,
            completionTokens: completion.usage.completion_tokens,
            totalTokens: completion.usage.total_tokens,
          }
        : undefined;

      if (usage) {
        this.logger.debug(
          `AI response: tokens=${usage.totalTokens} (prompt=${usage.promptTokens}, completion=${usage.completionTokens}), finish_reason=${finishReason}`,
        );
      }

      // Логируем предупреждение при обрезке
      if (finishReason === 'length') {
        this.logger.warn(
          `⚠️ Ответ обрезан по max_tokens (completion=${usage?.completionTokens}). Рекомендуется увеличить maxTokens.`,
        );
      }

      return { content, reasoningContent, usage, finishReason };
    } catch (error: any) {
      this.logger.error(`AI request failed: ${error.status} ${error.message}`);

      // Специфичные для DeepSeek ошибки
      if (error.status === 402) {
        throw new Error('AI provider: insufficient balance');
      }
      if (error.status === 429) {
        throw new Error('AI provider: rate limit exceeded');
      }
      if (error.status === 401) {
        throw new Error('AI provider: invalid API key');
      }

      throw error;
    }
  }

  /**
   * Отправляет запрос с JSON-ответом.
   * Полезно для структурированной фильтрации.
   * 
   * ВАЖНО: при thinking-режиме ответ может прийти в reasoning_content,
   * поэтому сначала промоутим его в content (в методе chat),
   * а затем извлекаем JSON.
   */
  async chatJson<T>(
    messages: ChatMessage[],
    options: ChatCompletionOptions = {},
  ): Promise<T> {
    const result = await this.chat(messages, options);

    if (!result.content || result.content.trim() === '') {
      this.logger.error(
        `Empty content after promotion. reasoning=${result.reasoningContent?.substring(0, 200)}, finish_reason=${result.finishReason}`,
      );
      throw new Error('AI provider: empty response');
    }

    // 1. Убираем markdown-обёртку ```json ... ```
    let cleaned = result.content
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    // 2. Убираем невидимые символы в начале (BOM, zero-width)
    cleaned = cleaned.replace(/^[\u200B-\u200D\uFEFF]+/, '');

    // 3. Пробуем распарсить как есть
    try {
      return JSON.parse(cleaned) as T;
    } catch (e1) {
      this.logger.warn(`Direct parse failed: ${(e1 as Error).message}`);

      // 4. Ищем JSON-объект в тексте (для случая, когда reasoning_content содержит размышления + JSON)
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return JSON.parse(match[0]) as T;
        } catch (e2) {
          this.logger.warn(`Regex extract failed: ${(e2 as Error).message}`);
        }
      }

      // 5. Пытаемся восстановить обрезанный JSON
      const recovered = this.recoverTruncatedJson(cleaned);
      if (recovered) {
        this.logger.warn('⚠️ Recovered truncated JSON');
        return recovered as T;
      }

      this.logger.error(
        `Failed to parse AI JSON response. finish_reason=${result.finishReason}, ` +
        `preview=${cleaned.substring(0, 300)}`,
      );
      throw new Error('AI provider: invalid JSON response');
    }
  }

  /**
   * Восстановление обрезанного JSON:
   * находим последний закрытый объект/массив и закрываем скобки.
   */
  private recoverTruncatedJson(text: string): any {
    // Ищем начало JSON
    const start = text.indexOf('{');
    if (start === -1) return null;

    let truncated = text.substring(start);

    // Ищем последний закрытый объект внутри массива
    const lastCloseBrace = truncated.lastIndexOf('}');
    if (lastCloseBrace === -1) return null;

    truncated = truncated.substring(0, lastCloseBrace + 1);

    // Закрываем оставшиеся скобки
    const openBraces = (truncated.match(/\{/g) || []).length;
    const closeBraces = (truncated.match(/\}/g) || []).length;
    const openBrackets = (truncated.match(/\[/g) || []).length;
    const closeBrackets = (truncated.match(/\]/g) || []).length;

    // Добавляем недостающие закрывающие символы
    truncated += ']'.repeat(Math.max(0, openBrackets - closeBrackets));
    truncated += '}'.repeat(Math.max(0, openBraces - closeBraces));

    try {
      return JSON.parse(truncated);
    } catch {
      return null;
    }
  }
}