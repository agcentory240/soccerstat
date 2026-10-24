export interface MatchOverview {
  /** Текст описания матча (markdown) */
  text: string;
}

/**
 * Извлекает краткое описание матча.
 *
 * Ищет кнопку «Фильтры», поднимается на 2 уровня вверх,
 * берёт следующий sibling — это блок с описанием.
 *
 * @param doc - Document
 * @returns MatchOverview или null, если блок не найден
 */
export function extractMatchOverview(doc: Document): MatchOverview | null {
  // 1. Находим кнопку «Фильтры»
  const filterButton = findFilterButton(doc);
  if (!filterButton) {
    return null;
  }

  // 2. Поднимаемся на 2 уровня вверх
  //    button → div (sc-15ca7a30-2) → div → ... ? 
  //    Судя по HTML: button → div → div → div (с margin) → дед
  //    Нужно подняться до родителя, у которого есть nextSibling с описанием
  const container = findOverviewContainer(filterButton);
  if (!container) {
    return null;
  }

  // 3. Берём следующий sibling
  const overview = container.nextElementSibling;
  if (!overview) {
    return null;
  }

  // 4. Извлекаем текст
  const text = (overview.textContent ?? '').trim();
  if (!text) {
    return null;
  }

  return { text };
}

/**
 * Ищет кнопку с текстом «Фильтры».
 */
function findFilterButton(doc: Document): Element | null {
  const buttons = doc.querySelectorAll('button');
  for (const button of Array.from(buttons)) {
    const text = (button.textContent ?? '').trim();
    if (text === 'Фильтры') {
      return button;
    }
  }
  return null;
}

/**
 * Поднимается от кнопки до контейнера, у которого следующий sibling
 * содержит текст описания матча.
 *
 * Идём вверх, пока не найдём элемент, у которого nextElementSibling
 * содержит достаточно длинный текст (> 100 символов) — это описание.
 */
function findOverviewContainer(button: Element): Element | null {
  let current: Element | null = button;
  let depth = 0;

  while (current && depth < 10) {
    const next = current.nextElementSibling;
    if (next) {
      const text = (next.textContent ?? '').trim();
      // Описание — длинный текст
      if (text.length > 100) {
        return current;
      }
    }
    current = current.parentElement;
    depth++;
  }

  return null;
}