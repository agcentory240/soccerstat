/**
 * Ищет предполагаемый счёт на странице.
 * Возвращает { home, away } или null.
 */
export function extractPredictedScore(doc: Document): { home: number; away: number } | null {
  // 1. Находим span с текстом «Прогноз»
  const spans = Array.from(doc.querySelectorAll('span'));
  const predictionSpan = spans.find(
    (span) => span.textContent?.trim() === 'Прогноз',
  );

  if (!predictionSpan) {
    return null;
  }

  // 2. Поднимаемся вверх до контейнера, содержащего блок счёта
  let current: Element | null = predictionSpan.parentElement;
  let depth = 0;

  while (current && depth < 10) {
    const score = findScoreInElement(current);
    if (score) return score;
    current = current.parentElement;
    depth++;
  }

  return null;
}

/**
 * Ищет счёт внутри указанного элемента:
 * div с двумя div-детьми, содержащими только цифры.
 */
function findScoreInElement(el: Element): { home: number; away: number } | null {
  const divs = el.querySelectorAll('div');
  for (const div of Array.from(divs)) {
    const children = Array.from(div.children).filter(
      (c) => c.tagName === 'DIV',
    );
    if (children.length !== 2) continue;

    const text1 = children[0].textContent?.trim() ?? '';
    const text2 = children[1].textContent?.trim() ?? '';

    if (/^\d+$/.test(text1) && /^\d+$/.test(text2)) {
      return {
        home: Number(text1),
        away: Number(text2),
      };
    }
  }
  return null;
}