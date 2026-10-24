export interface MotivationOdd {
  /** Название (команда или «Ничья») */
  label: string;
  /** Коэффициент или «–», если матч ещё не оценён */
  odd: string;
}

export interface MotivationBlock {
  /** Заголовок блока: «Прошлый матч», «Статус в текущем матче», «Следующий матч» */
  title: string;
  /** Описание: «21 день назад, победа в статусе явного фаворита» */
  description: string;
  /** Коэффициенты (3 штуки: П1, X, П2) */
  odds: MotivationOdd[];
}

export interface MotivationTeam {
  /** Название команды */
  teamName: string;
  /** Счёт мотивации, например «6/10» */
  score: string | null;
  /** Подблоки */
  blocks: MotivationBlock[];
}

export interface Motivation {
  /** Команды */
  teams: MotivationTeam[];
}

/**
 * Извлекает блок «Мотивация» из вкладки предматчевых фактов.
 *
 * Ожидает, что DOM подготовлен:
 * - активна вкладка «Мотивация»
 *
 * @param doc - Document
 * @returns Motivation или null, если блок не найден
 */
export function extractMotivation(doc: Document): Motivation | null {
  // 1. Находим заголовок «Предматчевые факты»
  const header = findHeader(doc, 'Предматчевые факты');
  if (!header) return null;

  const container = header.parentElement;
  if (!container) return null;

  // 2. Ищем блоки команд — <h4> с <img> и <span>
  const teamHeaders = findTeamHeaders(container);
  if (teamHeaders.length === 0) return null;

  // 3. Парсим каждую команду
  const teams: MotivationTeam[] = [];
  for (const h4 of teamHeaders) {
    const team = parseTeamBlock(h4);
    if (team) teams.push(team);
  }

  if (teams.length === 0) return null;

  return { teams };
}

/**
 * Ищет <h4> с <img> внутри — это заголовки команд.
 */
function findTeamHeaders(container: Element): Element[] {
  const result: Element[] = [];
  const h4s = container.querySelectorAll('h4');

  for (const h4 of Array.from(h4s)) {
    // Признак команды: внутри есть <img> и <span>
    if (h4.querySelector('img') && h4.querySelector('span')) {
      result.push(h4);
    }
  }

  return result;
}

/**
 * Парсит блок одной команды.
 */
function parseTeamBlock(h4: Element): MotivationTeam | null {
  // 1. Название команды и счёт из <span>
  const span = h4.querySelector('span');
  const spanText = (span?.textContent ?? '').trim();
  if (!spanText) return null;

  // Формат: "Comerciantes - 6/10" или "Спорт Уанкайо 2 - 7/10"
  const match = spanText.match(/^(.+?)\s*-\s*(\d+\/\d+)$/);
  const teamName = match ? match[1].trim() : spanText;
  const score = match ? match[2] : null;

  // 2. Родитель h4 — контейнер команды
  const teamContainer = h4.parentElement;
  if (!teamContainer) return null;

  // 3. Ищем подблоки внутри контейнера
  const blocks = findMotivationBlocks(teamContainer);

  return { teamName, score, blocks };
}

/**
 * Ищет подблоки мотивации внутри контейнера команды.
 *
 * Признак подблока: div, у которого есть описание с ключевым словом
 * («Прошлый матч», «текущем матче», «Следующий матч») и рядом блок
 * с коэффициентами (3 пары <span>текст</span>число).
 */
function findMotivationBlocks(container: Element): MotivationBlock[] {
  const blocks: MotivationBlock[] = [];

  // Ищем все div, содержащие описание + блок коэффициентов
  const candidates = container.querySelectorAll('div');

  for (const div of Array.from(candidates)) {
    const block = tryParseBlock(div);
    if (block) blocks.push(block);
  }

  return blocks;
}

/**
 * Пытается распарсить div как подблок мотивации.
 * Возвращает null, если div не похож на подблок.
 */
function tryParseBlock(div: Element): MotivationBlock | null {
  // 1. Ищем первый <div> с текстом описания
  const descDiv = div.querySelector(':scope > div');
  if (!descDiv) return null;

  const descText = (descDiv.textContent ?? '').trim();
  if (!descText) return null;

  // 2. Проверяем ключевые слова в описании
  const title = detectBlockTitle(descText);
  if (!title) return null;

  // 3. Ищем блок с коэффициентами — div, содержащий 3 пары <span>+число
  const oddsDiv = findOddsContainer(div);
  if (!oddsDiv) return null;

  const odds = parseOdds(oddsDiv);
  if (odds.length !== 3) return null;

  // 4. Убираем заголовок из описания
  const description = descText
    .replace(/Прошлый матч\s*-?\s*/i, '')
    .replace(/Статус в текущем матче\s*-?\s*/i, '')
    .replace(/Следующий матч\s*-?\s*/i, '')
    .trim();

  return { title, description, odds };
}

/**
 * Определяет тип подблока по тексту описания.
 */
function detectBlockTitle(text: string): string | null {
  if (/прошлый матч/i.test(text)) return 'Прошлый матч';
  if (/статус в текущем матче/i.test(text)) return 'Статус в текущем матче';
  if (/следующий матч/i.test(text)) return 'Следующий матч';
  return null;
}

/**
 * Ищет контейнер с коэффициентами.
 * Признак: div, содержащий ровно 3 дочерних div,
 * каждый из которых содержит <span> и текст с числом или «–».
 */
function findOddsContainer(parent: Element): Element | null {
  const divs = parent.querySelectorAll(':scope > div, :scope > div > div');

  for (const div of Array.from(divs)) {
    const children = Array.from(div.children).filter((c) => c.tagName === 'DIV');
    if (children.length !== 3) continue;

    const isOdds = children.every((child) => {
      const span = child.querySelector('span');
      if (!span) return false;
      const text = (child.textContent ?? '').trim();
      // После span идёт число или «–»
      return /[\d.–-]/.test(text);
    });

    if (isOdds) return div;
  }

  return null;
}

/**
 * Парсит коэффициенты из контейнера.
 * Каждый ребёнок: <div><span>Label</span>Odd</div>
 */
function parseOdds(container: Element): MotivationOdd[] {
  const odds: MotivationOdd[] = [];

  for (const child of Array.from(container.children)) {
    if (child.tagName !== 'DIV') continue;

    const span = child.querySelector('span');
    if (!span) continue;

    const label = (span.textContent ?? '').trim();
    if (!label) continue;

    // Коэффициент — текст после span
    const fullText = (child.textContent ?? '').trim();
    const oddText = fullText.replace(label, '').trim();
    const odd = oddText || '–';

    odds.push({ label, odd });
  }

  return odds;
}

/**
 * Ищет заголовок (h4) с указанным текстом.
 */
function findHeader(doc: Document, text: string): Element | null {
  const headers = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
  for (const header of Array.from(headers)) {
    const directText = extractDirectText(header);
    if (directText === text) return header;
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