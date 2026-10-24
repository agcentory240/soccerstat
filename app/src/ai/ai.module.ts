import { Module, DynamicModule } from '@nestjs/common';
import { AiService } from './ai.service.js';
import { AI_CONFIG, AiProviderConfig, defaultAiConfig } from './ai.config.js';

@Module({})
export class AiModule {
  /**
   * Регистрирует AI-модуль с конфигурацией.
   * Если config не передан — используются значения из переменных окружения.
   */
  static register(config?: Partial<AiProviderConfig>): DynamicModule {
    const finalConfig: AiProviderConfig = {
      ...defaultAiConfig,
      ...config,
    };

    return {
      module: AiModule,
      providers: [
        {
          provide: AI_CONFIG,
          useValue: finalConfig,
        },
        AiService,
      ],
      exports: [AiService],
    };
  }
}