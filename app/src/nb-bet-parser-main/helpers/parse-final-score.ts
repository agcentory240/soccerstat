import type {
  ParsedFinalScore,
  ScorePair,
} from '../../matches/bet-check.interface.js';

/** Одна пара счёта вида `2:0`. */
const SCORE_PAIR_REGEX = /(\d+)\s*:\s*(\d+)/g;

/**
 * Разбирает финальный счёт матча из поля `finalScore`.
 *
 * Формат источника: `3:1 (2:0, 1:1)` — итоговый счёт и счёт по таймам
 * в скобках. Скобки и таймы опциональны (`3:1` тоже валидно).
 *
 * @returns разобранный счёт или `null`, если строку распознать не удалось
 */
export function parseFinalScore(
  raw: string | null | undefined,
): ParsedFinalScore | null {
  if (!raw) return null;

  const source = raw.trim();
  if (!source) return null;

  const [totalPart, periodsPart] = source.split('(');

  const total = parseFirstPair(totalPart);
  if (!total) return null;

  const periods = parsePairs(periodsPart?.replace(')', '') ?? '');

  return { total, periods, raw: source };
}

/** Число голов в виде строки `2:1`. */
export function formatScorePair(pair: ScorePair): string {
  return `${pair.home}:${pair.away}`;
}

function parseFirstPair(part: string): ScorePair | null {
  SCORE_PAIR_REGEX.lastIndex = 0;
  const match = SCORE_PAIR_REGEX.exec(part);
  if (!match) return null;

  return { home: Number(match[1]), away: Number(match[2]) };
}

function parsePairs(part: string): ScorePair[] {
  const pairs: ScorePair[] = [];

  SCORE_PAIR_REGEX.lastIndex = 0;
  for (const match of part.matchAll(SCORE_PAIR_REGEX)) {
    pairs.push({ home: Number(match[1]), away: Number(match[2]) });
  }

  return pairs;
}
