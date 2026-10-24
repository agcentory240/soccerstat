/**
 * Парсер трендов команд со страницы матча.
 *
 * Структура HTML:
 * - h3 "Тренды команд" — заголовок
 * - div[cursor="pointer"] — строка тренда (повторяется)
 *   - внутри: три div (название, значение хозяев, значение гостей)
 * - div с текстом "Смоллмаркеты" — разделитель (после него — другой формат)
 *
 * Классы — хеши (sc-*, fVJoni), поэтому завязываемся на структурные признаки.
 */

export interface TrendValue {
  /** Счёт вида "10 / 10" — сколько раз тренд сработал */
  score: string;
  /** Коэффициент, если есть */
  odd: string | null;
}

export interface TrendRow {
  /** Название тренда, например "Тотал Больше (2.5)" */
  name: string;
  /** Значение для хозяев */
  home: TrendValue | null;
  /** Значение для гостей */
  away: TrendValue | null;
}

export interface TeamTrends {
  /** Строки трендов */
  trends: TrendRow[];
}

/**
 * Извлекает тренды команд со страницы матча.
 *
 * @param doc - Document (JSDOM или браузерный)
 * @returns TeamTrends или null, если блок не найден
 */
export function extractTeamTrends(doc: Document): TeamTrends | null {
  // 1. Находим заголовок "Тренды команд"
  const header = findHeader(doc, 'Тренды команд');
  if (!header) return null;

  // 2. Находим контейнер, внутри которого есть строки трендов и разделитель
  const container = findTrendsContainer(header);
  if (!container) return null;

  // 3. Находим разделитель "Смоллмаркеты" (чтобы отсечь смоллмаркеты)
  const smallMarketsDivider = findDividerByText(container, 'Смоллмаркеты');

  // 4. Собираем строки трендов
  const rows = container.querySelectorAll('div[cursor="pointer"]');
  const trends: TrendRow[] = [];

  for (const row of Array.from(rows)) {
    // Пропускаем строки после "Смоллмаркеты"
    if (smallMarketsDivider && isAfter(row, smallMarketsDivider)) continue;

    const parsed = parseTrendRow(row);
    if (parsed) trends.push(parsed);
  }

  if (trends.length === 0) return null;

  return { trends };
}

/**
 * Ищет заголовок (h1-h6) с указанным текстом (точное совпадение прямого текста).
 */
function findHeader(doc: Document, text: string): Element | null {
  const headers = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
  for (const h of Array.from(headers)) {
    if (extractDirectText(h) === text) return h;
  }
  return null;
}

/**
 * Поднимается от заголовка вверх до контейнера, содержащего строки трендов.
 *
 * Признак контейнера: внутри есть div[cursor="pointer"] и текст "Смоллмаркеты".
 */
function findTrendsContainer(header: Element): Element | null {
  let current: Element | null = header;
  let depth = 0;

  while (current && depth < 12) {
    const hasRows = current.querySelector('div[cursor="pointer"]');
    if (hasRows) return current;
    current = current.parentElement;
    depth++;
  }
  return null;
}

/**
 * Ищет div-разделитель по точному тексту (только листья).
 */
function findDividerByText(container: Element, text: string): Element | null {
  const divs = container.querySelectorAll('div');
  for (const d of Array.from(divs)) {
    // Только листья — без вложенных div
    if (d.querySelector('div')) continue;
    if (extractDirectText(d) === text) return d;
  }
  return null;
}

/**
 * Парсит одну строку тренда.
 *
 * Ожидает структуру:
 * <div cursor="pointer">
 *   <div>                        ← wrapper
 *     <div>Название тренда</div> ← name
 *     <div>...</div>             ← home value
 *     <div>...</div>             ← away value
 *   </div>
 * </div>
 */
function parseTrendRow(row: Element): TrendRow | null {
  // 1. Находим wrapper — прямой ребёнок с div-детьми
  const wrapper = findWrapper(row);
  if (!wrapper) return null;

  // 2. Прямые div-дети wrapper
  const children = Array.from(wrapper.children).filter(
    (c) => c.tagName === 'DIV',
  );
  if (children.length < 3) return null;

  // 3. Название тренда — текст первого div
  const name = extractDirectText(children[0]) || (children[0].textContent ?? '').trim();
  if (!name) return null;

  // 4. Значения хозяев и гостей — второй и третий div
  const home = parseTrendValue(children[1]);
  const away = parseTrendValue(children[2]);

  // Если ни одного значения нет — строка бесполезна
  if (!home && !away) return null;

  return { name, home, away };
}

/**
 * Ищет wrapper — div, внутри которого ровно 3 прямых div-ребёнка
 * (название, значение хозяев, значение гостей).
 */
function findWrapper(row: Element): Element | null {
  const divs = row.querySelectorAll('div');
  for (const div of Array.from(divs)) {
    const directDivChildren = Array.from(div.children).filter(
      (c) => c.tagName === 'DIV',
    );
    if (directDivChildren.length === 3) return div;
  }
  return null;
}

/**
 * Парсит значение тренда (счёт + коэффициент).
 *
 * Счёт — span с текстом вида "10 / 10" или "16 / 22".
 * Коэффициент — последнее число с точкой в конце (например, "1.288").
 * Если значения нет — в div стоит "—" (тире).
 */
function parseTrendValue(el: Element): TrendValue | null {
  // 1. Ищем span со счётом
  const spans = el.querySelectorAll('span');
  let score: string | null = null;

  for (const span of Array.from(spans)) {
    const t = (span.textContent ?? '').trim();
    if (/^\d+\s*\/\s*\d+$/.test(t)) {
      score = t;
      break;
    }
  }

  // 2. Если счёта нет — проверяем, нет ли тире (значение отсутствует)
  if (!score) {
    const text = (el.textContent ?? '').trim();
    if (text === '—' || text === '-') return null;
    return null;
  }

  // 3. Ищем коэффициент — число с точкой в конце текста
  const odd = findOdd(el);

  return { score, odd };
}

/**
 * Ищет коэффициент — число с точкой в конце текста элемента.
 * Исключает блоки с движением коэффициента (up/down).
 */
function findOdd(el: Element): string | null {
  const fullText = (el.textContent ?? '').trim();
  const match = fullText.match(/(\d+\.\d+)\s*$/);
  return match ? match[1] : null;
}

/**
 * Извлекает "прямой" текст элемента (без текста детей).
 */
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

const DOCUMENT_POSITION_FOLLOWING = 4;

function isAfter(a: Element, b: Element): boolean {
  return !!(b.compareDocumentPosition(a) & DOCUMENT_POSITION_FOLLOWING);
}