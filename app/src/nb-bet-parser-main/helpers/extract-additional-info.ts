export interface AdditionalInfoItem {
  /** Ключ (например, "Стадион", "Погода") */
  label: string;
  /** Значение (например, "РДЦЕ (Барселона)", "Ясно, +22°C") */
  value: string;
}

export interface AdditionalInfo {
  /** Список пар ключ-значение */
  items: AdditionalInfoItem[];
}

/**
 * Извлекает блок «Доп. информация» со страницы матча.
 *
 * Ищет заголовок «Доп. информация», затем собирает все пары
 * «<strong>ключ:</strong><span>значение</span>» внутри блока.
 *
 * @param doc - Document
 * @returns AdditionalInfo или null, если блок не найден
 */
export function extractAdditionalInfo(doc: Document): AdditionalInfo | null {
  // 1. Находим заголовок «Доп. информация»
  const header = findHeader(doc, 'Доп. информация');
  if (!header) {
    return null;
  }

  // 2. Контейнер — родитель заголовка (обычно div, содержащий h4 + пары)
  const container = header.parentElement;
  if (!container) {
    return null;
  }

  // 3. Собираем пары ключ-значение
  const items = findInfoItems(container);
  if (items.length === 0) {
    return null;
  }

  return { items };
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

/**
 * Извлекает "прямой" текст элемента (без текста детей).
 * Нужно, потому что <h4> может содержать вложенные элементы.
 */
function extractDirectText(el: Element): string {
  const parts: string[] = [];
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeName === '#text') {
      const text = (node.textContent ?? '').trim();
      if (text) parts.push(text);
    }
  }
  return parts.join(' ').trim();
}

/**
 * Собирает пары ключ-значение из контейнера.
 *
 * Ищет элементы вида:
 * <div><strong>Ключ:</strong><span>Значение</span></div>
 */
function findInfoItems(container: Element): AdditionalInfoItem[] {
  const items: AdditionalInfoItem[] = [];

  // Проходим по всем div внутри контейнера
  const divs = container.querySelectorAll('div');
  for (const div of Array.from(divs)) {
    // Ищем <strong> и <span> как прямых детей
    const strong = findDirectChild(div, 'STRONG');
    const span = findDirectChild(div, 'SPAN');

    if (!strong || !span) continue;

    const label = (strong.textContent ?? '').trim().replace(/:\s*$/, '');
    const value = (span.textContent ?? '').trim();

    if (!label || !value) continue;

    items.push({ label, value });
  }

  return items;
}

/**
 * Ищет прямого ребёнка с указанным тегом.
 */
function findDirectChild(parent: Element, tagName: string): Element | null {
  for (const child of Array.from(parent.children)) {
    if (child.tagName === tagName) {
      return child;
    }
  }
  return null;
}