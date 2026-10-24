export interface TableRow {
  /** Место в таблице */
  position: number;
  /** Название команды */
  teamName: string;
  /** Игр */
  played: number;
  /** Побед */
  wins: number;
  /** Ничьих */
  draws: number;
  /** Поражений */
  losses: number;
  /** Голы: "забито:пропущено" */
  goals: string;
  /** Очки */
  points: number;
  /** Это команда хозяев (team1)? */
  isHome: boolean;
  /** Это команда гостей (team2)? */
  isAway: boolean;
}

export interface LeagueTable {
  /** Название турнира/лиги (если есть в контексте) */
  title: string | null;
  /** Строки таблицы */
  rows: TableRow[];
}

/**
 * Извлекает турнирную таблицу со вкладки «Таблица».
 *
 * Ищет <a> с 8 дочерними <div>:
 *   [место, команда(img+span), И, В, Н, П, Голы, О]
 *
 * @param doc - Document
 * @param homeTeam - название команды хозяев (для пометки team1)
 * @param awayTeam - название команды гостей (для пометки team2)
 */
export function extractLeagueTable(
  doc: Document,
  homeTeam?: string,
  awayTeam?: string,
): LeagueTable | null {
  // 1. Находим заголовок «Таблица»
  const header = findHeader(doc, 'Таблица');
  if (!header) return null;

  // 2. Контейнер — родитель заголовка
  const container = header.closest('div')?.parentElement;
  if (!container) return null;

  // 3. Ищем строки таблицы
  const rows = findTableRows(container, homeTeam, awayTeam);
  if (rows.length === 0) return null;

  return { title: null, rows };
}

function findHeader(doc: Document, text: string): Element | null {
  const headers = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
  for (const h of Array.from(headers)) {
    if (extractDirectText(h) === text) return h;
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
 * Ищет строки таблицы.
 * Признак: <a>, у которого ровно 8 дочерних <div>,
 * первый из которых — число, а во втором есть <span> с названием.
 */
function findTableRows(
  container: Element,
  homeTeam?: string,
  awayTeam?: string,
): TableRow[] {
  const rows: TableRow[] = [];
  const links = container.querySelectorAll('a');

  for (const link of Array.from(links)) {
    const row = tryParseTableRow(link, homeTeam, awayTeam);
    if (row) rows.push(row);
  }

  return rows;
}

function tryParseTableRow(
  link: Element,
  homeTeam?: string,
  awayTeam?: string,
): TableRow | null {
  // 1. Ровно 8 дочерних <div>
  const children = Array.from(link.children).filter(
    (c) => c.tagName === 'DIV',
  );
  if (children.length !== 8) return null;

  // 2. Первый div — место (число)
  const positionText = (children[0].textContent ?? '').trim();
  const position = Number(positionText);
  if (!Number.isInteger(position) || position < 1) return null;

  // 3. Второй div — команда: <img> + <span>
  const teamSpan = children[1].querySelector('span');
  const teamName = (teamSpan?.textContent ?? '').trim();
  if (!teamName) return null;

  // 4. Остальные 6 — числа (И, В, Н, П, Голы, О)
  const values = children.slice(2).map((c) => (c.textContent ?? '').trim());

  // Проверяем, что все значения — числа или "X:Y"
  const isNumber = (s: string) => /^\d+$/.test(s);
  const isGoals = (s: string) => /^\d+:\d+$/.test(s);

  if (
    !isNumber(values[0]) || // И
    !isNumber(values[1]) || // В
    !isNumber(values[2]) || // Н
    !isNumber(values[3]) || // П
    !isGoals(values[4]) ||  // Голы
    !isNumber(values[5])    // О
  ) {
    return null;
  }

  // 5. Определяем, чья это команда
  const isHome = !!homeTeam && teamName === homeTeam;
  const isAway = !!awayTeam && teamName === awayTeam;

  return {
    position,
    teamName,
    played: Number(values[0]),
    wins: Number(values[1]),
    draws: Number(values[2]),
    losses: Number(values[3]),
    goals: values[4],
    points: Number(values[5]),
    isHome,
    isAway,
  };
}