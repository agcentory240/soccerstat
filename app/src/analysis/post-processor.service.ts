// src/analysis/post-processor.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { DeepAnalysisResult } from '../ai/ai-prompts.js';

/**
 * Результат постобработки: переопределённое решение + список нарушений.
 */
export interface PostProcessResult {
  finalDecision: 'СТАВИТЬ' | 'ПРОПУСТИТЬ' | 'НАБЛЮДАТЬ';
  mainBet: string | null;
  violations: string[];
  originalDecision: 'СТАВИТЬ' | 'ПРОПУСТИТЬ' | 'НАБЛЮДАТЬ';
  reasoning: string;
}

@Injectable()
export class PostProcessorService {
  private readonly logger = new Logger(PostProcessorService.name);

  /**
   * Проверяет результат глубокого анализа по правилам и возвращает
   * переопределённое решение.
   *
   * Правила:
   *  1. «забивает» (и синонимы) в risks при ставке на «низ» → ПРОПУСТИТЬ
   *  2. «противоречивый» / «конфликт» в risks → ПРОПУСТИТЬ
   *  6. Больше 1 alternative_bets → ПРОПУСТИТЬ
   *  8. Запрещённые рынки («Обе-Да», «1-й тайм — ИТ2Б 0.5», «2-й тайм — П2/X») → ПРОПУСТИТЬ
   *
   * Фильтр по коэффициенту (правило 9) намеренно не применяется:
   * цена ставки не должна подменять содержательную проверку.
   */
  process(result: DeepAnalysisResult): PostProcessResult {
    const pred = result.prediction ?? ({} as any);
    const mainBet = pred.main_bet ?? '';
    const risksText = (result.risks ?? []).join(' ').toLowerCase();
    const alternatives = result.alternative_bets ?? [];

    const violations: string[] = [];

    // === Правило 1: признаки «верха» в risks при ставке на «низ» ===
    const isLowBet = /ТМ|ИТ1М|ИТ2М|Обе.*Нет/i.test(mainBet);
    const highRiskTriggers = [
      'забивает', 'забивают', 'забить', 'забьют',
      'результатив', 'атак', 'голевая',
      'пропускает в первом тайме', 'быстрый гол', 'ранний гол',
      'высокий средний тотал', 'тотал матча 3.5', 'средний тотал 3',
      'в отличной форме', 'может легко забить', 'в форме', 'на ходу',
      'забивают обе команды', 'обе команды забивают', 'обе забьют',
    ];
    if (isLowBet && highRiskTriggers.some((t) => risksText.includes(t))) {
      violations.push('Правило 1: риск «верха» в risks при ставке на «низ»');
    }

    // === Правило 2: «противоречивый» / «конфликт» в risks ===
    if (
      risksText.includes('противоречив') ||
      risksText.includes('конфликт')
    ) {
      violations.push('Правило 2: противоречивый тренд в risks');
    }

    // === Правило 6: максимум 1 альтернатива ===
    if (alternatives.length > 1) {
      violations.push(
        `Правило 6: ${alternatives.length} альтернатив (макс 1)`,
      );
    }

    // === Правило 8: запрещённые рынки ===
    const forbiddenMarkets = [
      'Обе забьют — Да',
      'Обе забьют - Да',
      '1-й тайм - ИТ2Б (0.5)',
      '1-й тайм — ИТ2Б (0.5)',
      '2-й тайм - П2',
      '2-й тайм — П2',
      '2-й тайм - X',
      '2-й тайм — X',
    ];
    if (forbiddenMarkets.some((m) => mainBet.includes(m))) {
      violations.push(`Правило 8: запрещённый рынок «${mainBet}»`);
    }

    // === Переопределение решения ===
    const originalDecision = result.final_decision;
    let finalDecision = originalDecision;
    let reasoning = result.reasoning ?? '';

    if (violations.length > 0 && finalDecision === 'СТАВИТЬ') {
      finalDecision = 'ПРОПУСТИТЬ';
      reasoning = `[ПОСТПРОЦЕССОР] ${violations.join('; ')}. Исходное: ${reasoning}`;
      this.logger.warn(
        `🚫 Постпроцессор отклонил ставку «${mainBet}»: ${violations.join('; ')}`,
      );
    }

    return {
      finalDecision,
      mainBet:
        finalDecision === 'ПРОПУСТИТЬ' ? null : (pred.main_bet ?? null),
      violations,
      originalDecision,
      reasoning,
    };
  }
}