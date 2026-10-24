export interface SeriesValue {
  /** Количество матчей подряд — "10", "7", "3" */
  count: string;
  /** Коэффициент, если есть */
  odd: string | null;
}

export interface SeriesRow {
  /** Название серии, например "Тотал Больше (2.5)" */
  name: string;
  /** Значение для хозяев */
  home: SeriesValue | null;
  /** Значение для гостей */
  away: SeriesValue | null;
}

export interface TeamSeries {
  series: SeriesRow[];
}

/**
 * Парсер серий команд со страницы матча (вкладка "Серии").
 *
 * Структура HTML:
 * - две select-панели (фильтры) сверху
 * - таблица строк с классом "dMchYu wide laconic"
 * - каждая строка: три прямых div (название, значение хозяев, значение гостей)
 * - значения — одно число (не "X / Y", как в трендах)
 * - в конце — "Смоллмаркеты" (другой формат, отсекаем)
 *
 * ВАЖНО: перед парсингом надо нажать вкладку "Серии" на странице.
 */

export interface SeriesValue {
  /** Количество матчей подряд — "10", "7", "3" */
  count: string;
  /** Коэффициент, если есть */
  odd: string | null;
}

export interface SeriesRow {
  /** Название серии, например "Тотал Больше (2.5)" */
  name: string;
  /** Значение для хозяев */
  home: SeriesValue | null;
  /** Значение для гостей */
  away: SeriesValue | null;
}

export interface TeamSeries {
  /** Строки серий */
  series: SeriesRow[];
}

/**
 * Извлекает серии команд со страницы матча (вкладка "Серии").
 *
 * @param doc - Document (JSDOM или браузерный)
 * @returns TeamSeries или null, если блок не найден
 */
export function extractTeamSeries(doc: Document): TeamSeries | null {
  // 1. Находим контейнер со строками серий.
  //    Признак: div'ы с классом "dMchYu" (хеш-классы рядом меняются,
  //    но "dMchYu" — стабильный якорь для таблиц серий/трендов).
  const rows = doc.querySelectorAll('div.dMchYu.wide.laconic');
  if (rows.length === 0) return null;

  // 2. Находим разделитель "Смоллмаркеты" — чтобы отсечь смоллмаркеты
  const smallMarketsDivider = findDividerByText(doc.body, 'Смоллмаркеты');

  // 3. Собираем строки
  const series: SeriesRow[] = [];
  for (const row of Array.from(rows)) {
    // Пропускаем header (у него нет названия тренда — только логотипы)
    // Пропускаем строки после "Смоллмаркеты"
    if (smallMarketsDivider && isAfter(row, smallMarketsDivider)) continue;

    const parsed = parseSeriesRow(row);
    if (parsed) series.push(parsed);
  }

  if (series.length === 0) return null;

  return { series };
}

/**
 * Парсит одну строку серии.
 *
 * Ожидает структуру:
 * <div class="... dMchYu wide laconic">
 *   <div>Название серии</div>       ← name
 *   <div>...</div>                  ← home value
 *   <div>...</div>                  ← away value
 * </div>
 */
function parseSeriesRow(row: Element): SeriesRow | null {
  // 1. Прямые div-дети
  const children = Array.from(row.children).filter(
    (c) => c.tagName === 'DIV',
  );
  if (children.length !== 3) return null;

  // 2. Название серии — текст первого div
  const name = extractDirectText(children[0]) || (children[0].textContent ?? '').trim();
  if (!name) return null;

  // 3. Значения хозяев и гостей
  const home = parseSeriesValue(children[1]);
  const away = parseSeriesValue(children[2]);

  // Если ни одного значения нет — строка бесполезна
  if (!home && !away) return null;

  return { name, home, away };
}

/**
 * Парсит значение серии (одно число + коэффициент).
 *
 * В сериях значение — одно число (например "10"), а не "10 / 10".
 * Если значение отсутствует — в div стоит "—".
 */
function parseSeriesValue(el: Element): SeriesValue | null {
  // 1. Ищем span с числом (только цифры)
  const spans = el.querySelectorAll('span');
  let count: string | null = null;

  for (const span of Array.from(spans)) {
    const t = (span.textContent ?? '').trim();
    if (/^\d+$/.test(t)) {
      count = t;
      break;
    }
  }

  // 2. Если числа нет — значения нет
  if (!count) return null;

  // 3. Ищем коэффициент — число с точкой в конце
  const odd = findOdd(el);

  return { count, odd };
}

/**
 * Ищет коэффициент — число с точкой в конце текста элемента.
 */
function findOdd(el: Element): string | null {
  const fullText = (el.textContent ?? '').trim();
  const match = fullText.match(/(\d+\.\d+)\s*$/);
  return match ? match[1] : null;
}

/**
 * Ищет div-разделитель по точному тексту (только листья).
 */
function findDividerByText(root: Element, text: string): Element | null {
  const divs = root.querySelectorAll('div');
  for (const d of Array.from(divs)) {
    if (d.querySelector('div')) continue;
    if (extractDirectText(d) === text) return d;
  }
  return null;
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