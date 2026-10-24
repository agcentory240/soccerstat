export interface PrematchFact {
  /** Текст факта (markdown) */
  text: string;
  /** Событие букмекера: метка и коэффициент */
  event: {
    label: string;
    odd: string;
  } | null;
}

export interface PrematchFacts {
  /** Вкладка: 'Основные' или 'Мотивация' */
  tab: string;
  /** Список фактов */
  facts: PrematchFact[];
}

/**
 * Извлекает предматчевые факты из блока «Предматчевые факты».
 *
 * Ожидает, что DOM уже подготовлен:
 * - активна нужная вкладка (Основные / Мотивация)
 * - нажата кнопка «Больше фактов» (если была)
 *
 * @param doc - Document
 * @param tabName - название вкладки ('Основные' или 'Мотивация')
 * @returns PrematchFacts или null, если блок не найден
 */
export function extractPrematchFacts(
  doc: Document,
  tabName: string = 'Основные',
): PrematchFacts | null {
  // 1. Находим заголовок «Предматчевые факты»
  const header = findHeader(doc, 'Предматчевые факты');
  if (!header) {
    return null;
  }

  // 2. Контейнер — родитель заголовка
  const container = header.parentElement;
  if (!container) {
    return null;
  }

  // 3. Ищем строки фактов
  const facts = findFactRows(container);
  if (facts.length === 0) {
    return null;
  }

  return { tab: tabName, facts };
}

/**
 * Ищет заголовок (h4) с указанным текстом.
 */
function findHeader(doc: Document, text: string): Element | null {
  const headers = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
  for (const header of Array.from(headers)) {
    const directText = extractDirectText(header);
    if (directText === text) {
      return header;
    }
  }
  return null;
}

function extractDirectText(el: Element): string {
  const parts: string[] = [];
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeName === '#text') {
      const t = (node.textContent ?? '').trim();
      if (t) parts.push(t);
    }
  }
  return parts.join(' ').trim();
}

/**
 * Ищет строки фактов.
 * Строка факта — div с классом dBwdRO, содержащий span с текстом факта
 * и span с событием букмекера (метка + коэффициент).
 */
function findFactRows(container: Element): PrematchFact[] {
  const facts: PrematchFact[] = [];

  // Ищем все div, содержащие span с текстом факта
  // Признак: span с классом QxqVM (текст факта)
  const factSpans = container.querySelectorAll('span.QxqVM, span[class*="QxqVM"]');

  for (const span of Array.from(factSpans)) {
    const text = (span.textContent ?? '').trim();
    if (!text) continue;

    // Родитель — строка факта (div dBwdRO)
    const row = span.parentElement;
    if (!row) continue;

    // Ищем событие букмекера в этой строке
    const event = findBookieEvent(row);

    facts.push({ text, event });
  }

  return facts;
}

/**
 * Ищет событие букмекера в строке факта.
 * Метка — span с классом kjpaij, коэффициент — число после неё.
 */
function findBookieEvent(row: Element): { label: string; odd: string } | null {
  // Ищем span с меткой события
  const labelSpan = row.querySelector('span.kjpaij, span[class*="kjpaij"]');
  if (!labelSpan) return null;

  const label = (labelSpan.textContent ?? '').trim();
  if (!label) return null;

  // Коэффициент — число в родителе метки
  const parent = labelSpan.parentElement;
  if (!parent) return null;

  const parentText = (parent.textContent ?? '').trim();
  // Ищем последнее число с точкой (например, 4.9, 3.54, 1.71)
  const match = parentText.match(/(\d+\.\d+)\s*$/);
  const odd = match ? match[1] : null;

  if (!odd) return null;

  return { label, odd };
}