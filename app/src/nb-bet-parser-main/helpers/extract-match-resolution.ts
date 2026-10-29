import { extractDirectText } from './extract-final-score.js';

/** Исход матча, который отменяет дальнейший разбор счёта. */
export type MatchResolution = 'postponed' | 'canceled';

/**
 * Текст статуса в карточке перенесённого матча, например:
 * `<div class="...">Перенесён</div>`.
 * Встречаются оба написания — «Перенесён» и «Перенесен».
 */
const POSTPONED_PATTERN = /^(перенес[её]н|postponed)/i;

/**
 * Текст статуса в карточке отменённого матча.
 */
const CANCELED_PATTERN = /^(отмен[её]н|cancel(?:ed|led))/i;

/**
 * Определяет, что матч перенесён или отменён, по его детальной странице.
 *
 * На странице nb-bet такие матчи содержат отдельный узел с прямым текстом
 * «Перенесён» или «Отменён» (счёт при этом обычно `0:0`, поэтому счёт
 * нельзя считать финальным). Поиск идёт по прямому тексту `div`/`span`/`p`,
 * чтобы не срабатывать на составные контейнеры.
 *
 * @returns `'postponed'`, `'canceled'` или `null`, если матч не отменён/не перенесён.
 */
export function extractMatchResolution(doc: Document): MatchResolution | null {
  const all = doc.querySelectorAll('div, span, p');

  for (const el of Array.from(all)) {
    const text = extractDirectText(el);
    if (!text) continue;

    if (POSTPONED_PATTERN.test(text)) return 'postponed';
    if (CANCELED_PATTERN.test(text)) return 'canceled';
  }

  return null;
}
