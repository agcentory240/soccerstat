export interface StatRow {
  label: string;
  home: string;
  away: string;
}

export interface TeamStats {
  main: StatRow[];
  small: StatRow[];
}

interface StatRowWithEl {
  row: StatRow;
  el: Element;
}

export function extractTeamStats(doc: Document): TeamStats | null {
  const header = findHeader(doc, 'Сводная статистика');
  if (!header) return null;

  const container = findStatsContainer(header);
  if (!container) return null;

  const allRows = findStatRows(container);
  if (allRows.length === 0) return null;

  const smallDivider = findSmallMarketsDivider(container);
  const main: StatRow[] = [];
  const small: StatRow[] = [];

  for (const item of allRows) {
    if (smallDivider && isAfter(item.el, smallDivider)) {
      small.push(item.row);
    } else {
      main.push(item.row);
    }
  }

  return { main, small };
}

function findHeader(doc: Document, text: string): Element | null {
  const headers = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
  for (const h of Array.from(headers)) {
    if (extractDirectText(h) === text) return h;
  }
  return null;
}

function findStatsContainer(header: Element): Element | null {
  let current: Element | null = header;
  let depth = 0;

  while (current && depth < 10) {
    const rows = findStatRows(current);
    if (rows.length >= 3) return current;
    current = current.parentElement;
    depth++;
  }
  return null;
}

function findSmallMarketsDivider(container: Element): Element | null {
  const divs = container.querySelectorAll('div');
  for (const d of Array.from(divs)) {
    if (d.querySelector('div')) continue;
    const t = extractDirectText(d);
    if (t === 'Смоллмаркеты') return d;
  }
  return null;
}

const DOCUMENT_POSITION_FOLLOWING = 4;

function isAfter(a: Element, b: Element): boolean {
  return !!(b.compareDocumentPosition(a) & DOCUMENT_POSITION_FOLLOWING);
}
function findStatRows(container: Element): StatRowWithEl[] {
  const result: StatRowWithEl[] = [];
  const candidates = container.querySelectorAll('div');

  for (const div of Array.from(candidates)) {
    const row = tryParseStatRow(div);
    if (row) result.push({ row, el: div });
  }

  return dedupeRows(result);
}

/**
 * Пытается распарсить div как строку статистики.
 *
 * Работает в двух случаях:
 * 1. Прямой текст в div — это label, а span'ы — значения.
 * 2. Прямого текста нет, но есть дочерний div с текстом — это label,
 *    а span'ы в этом же div — значения.
 */
function tryParseStatRow(div: Element): StatRow | null {
  const spans = div.querySelectorAll('span');
  const values: string[] = [];
  for (const span of Array.from(spans)) {
    const t = (span.textContent ?? '').trim();
    if (t) values.push(t);
  }

  // Ровно 2 значения — обязательное условие
  if (values.length !== 2) return null;

  // Случай 1: прямой текст в div
  const label = extractDirectText(div);
  if (label && label.length <= 60 && !/^(Смоллмаркеты|Показатель)$/i.test(label)) {
    return { label, home: values[0], away: values[1] };
  }

  // Случай 2: label в дочернем div
  const childDivs = div.querySelectorAll(':scope > div');
  for (const child of Array.from(childDivs)) {
    // Пропускаем, если внутри уже есть span — это не label
    if (child.querySelector('span')) continue;

    const childLabel = extractDirectText(child);
    if (childLabel && childLabel.length <= 60 && !/^(Смоллмаркеты|Показатель)$/i.test(childLabel)) {
      return { label: childLabel, home: values[0], away: values[1] };
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

function dedupeRows(items: StatRowWithEl[]): StatRowWithEl[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.row.label}|${item.row.home}|${item.row.away}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}