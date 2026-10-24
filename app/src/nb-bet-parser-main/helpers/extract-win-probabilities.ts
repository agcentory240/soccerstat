export interface WinProbabilities {
  /** Вероятность победы хозяев (П1), % */
  home: number;
  /** Вероятность ничьей (X), % */
  draw: number;
  /** Вероятность победы гостей (П2), % */
  away: number;
  /** Название хозяев (для справки) */
  homeTeam: string | null;
  /** Название гостей (для справки) */
  awayTeam: string | null;
}

/**
 * Извлекает вероятности выигрыша (П1, X, П2) со страницы матча.
 *
 * Ищет блок с маркером «Вероятность выигрыша», затем — три строки
 * с процентами. Соответствие: green → хозяева, gray → ничья, blue → гости.
 *
 * @param doc - Document (JSDOM или браузерный)
 * @returns WinProbabilities или null, если блок не найден
 */
export function extractWinProbabilities(doc: Document): WinProbabilities | null {
  // 1. Находим элемент с текстом «Вероятность выигрыша»
  const marker = findMarker(doc, 'Вероятность выигрыша');
  if (!marker) {
    return null;
  }

  // 2. Поднимаемся до контейнера, содержащего строки с процентами
  const container = findProbabilitiesContainer(marker);
  if (!container) {
    return null;
  }

  // 3. Ищем строки с процентами
  const rows = findPercentageRows(container);
  if (rows.length !== 3) {
    return null;
  }

  // 4. Определяем цвета и парсим проценты
  const result: Partial<WinProbabilities> = {
    homeTeam: null,
    awayTeam: null,
  };

  for (const row of rows) {
    const color = detectColor(row);
    const parsed = parseRow(row);

    if (!parsed) continue;

    if (color === 'green') {
      result.home = parsed.percent;
      result.homeTeam = parsed.label;
    } else if (color === 'gray') {
      result.draw = parsed.percent;
    } else if (color === 'blue') {
      result.away = parsed.percent;
      result.awayTeam = parsed.label;
    }
  }

  // 5. Проверяем, что все три значения найдены
  if (result.home == null || result.draw == null || result.away == null) {
    return null;
  }

  return {
    home: result.home,
    draw: result.draw,
    away: result.away,
    homeTeam: result.homeTeam ?? null,
    awayTeam: result.awayTeam ?? null,
  };
}

/**
 * Ищет элемент, содержащий указанный текст (точное совпадение).
 */
function findMarker(doc: Document, text: string): Element | null {
  const elements = doc.querySelectorAll('h1, h2, h3, h4, h5, h6, span, div');
  for (const el of Array.from(elements)) {
    // Проверяем только "прямой" текст элемента, без учёта детей
    const directText = Array.from(el.childNodes)
      .filter((n) => n.nodeName === '#text')  // ← вместо Node.TEXT_NODE
      .map((n) => n.textContent?.trim() ?? '')
      .join(' ')
      .trim();

    if (directText === text || directText.startsWith(text)) {
      return el;
    }
  }
  return null;
}

/**
 * Поднимается от маркера вверх до контейнера, содержащего строки с процентами.
 */
function findProbabilitiesContainer(marker: Element): Element | null {
  let current: Element | null = marker;
  let depth = 0;

  while (current && depth < 10) {
    const rows = findPercentageRows(current);
    if (rows.length === 3) {
      return current;
    }
    current = current.parentElement;
    depth++;
  }
  return null;
}

/**
 * Ищет три строки с процентами внутри контейнера.
 * Строка — div, содержащий число с знаком %.
 */
function findPercentageRows(container: Element): Element[] {
  const result: Element[] = [];
  const divs = container.querySelectorAll('div');

  for (const div of Array.from(divs)) {
    // Проверяем "прямой" текст: должен заканчиваться на %
    const text = (div.textContent ?? '').trim();
    if (!/ - \d+%$/.test(text)) continue;

    // Пропускаем контейнеры, внутри которых есть другие строки с % (берём только листья)
    const innerDivs = div.querySelectorAll('div');
    const hasInnerPercent = Array.from(innerDivs).some((inner) =>
      / - \d+%$/.test((inner.textContent ?? '').trim()),
    );
    if (hasInnerPercent) continue;

    result.push(div);
  }

  return result;
}

/**
 * Определяет цвет строки: green, gray, blue.
 * Цвет — это класс на div-индикаторе внутри строки.
 */
function detectColor(row: Element): string | null {
  const colored = row.querySelector('.green, .gray, .blue');
  if (!colored) return null;

  if (colored.classList.contains('green')) return 'green';
  if (colored.classList.contains('gray')) return 'gray';
  if (colored.classList.contains('blue')) return 'blue';
  return null;
}

/**
 * Парсит строку: извлекает название и процент.
 * Пример: "Эспаньол - 52%" → { label: "Эспаньол", percent: 52 }
 *          "Ничья - 26%"    → { label: "Ничья", percent: 26 }
 */
function parseRow(row: Element): { label: string; percent: number } | null {
  const text = (row.textContent ?? '').trim();
  const match = text.match(/^(.+?)\s*-\s*(\d+)%$/);
  if (!match) return null;

  return {
    label: match[1].trim(),
    percent: Number(match[2]),
  };
}