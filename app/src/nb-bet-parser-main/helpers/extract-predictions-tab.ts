export interface SystemPrediction {
  type: 'math' | 'popular';
  text: string;
  odd: string | null;
}

export interface UserPrediction {
  author: string;
  rank: string | null;
  profit: string | null;
  addedAt: string | null;
  text: string;
  odd: string | null;
  hasDescription: boolean;
}

export interface PredictionsTab {
  system: SystemPrediction[];
  users: UserPrediction[];
}

export function extractPredictionsTab(doc: Document): PredictionsTab | null {
  const root = doc.querySelector('#match-tabs');
  if (!root) return null;

  const system = extractSystemPredictions(root);
  const users = extractUserPredictions(root);

  if (system.length === 0 && users.length === 0) return null;
  return { system, users };
}

// ===== СИСТЕМНЫЕ ПРОГНОЗЫ =====

function extractSystemPredictions(root: Element): SystemPrediction[] {
  const result: SystemPrediction[] = [];

  // Ищем контейнеры с классом mathUserTip (по подстроке)
  const containers = root.querySelectorAll('[class*="mathUserTip"]');
  for (const c of Array.from(containers)) {
    const sys = parseSystemContainer(c);
    if (sys) result.push(sys);
  }

  return dedupeSystem(result);
}

function parseSystemContainer(container: Element): SystemPrediction | null {
  // 1. Тип: span "Математический" / "Популярный" или img с "robot"/"star"
  let type: 'math' | 'popular' | null = null;
  const spans = container.querySelectorAll('span');
  for (const span of Array.from(spans)) {
    const t = (span.textContent ?? '').trim();
    if (t === 'Математический') type = 'math';
    if (t === 'Популярный') type = 'popular';
  }
  if (!type) {
    const img = container.querySelector('img');
    const src = img?.getAttribute('src') ?? '';
    if (src.includes('robot')) type = 'math';
    if (src.includes('star')) type = 'popular';
  }
  if (!type) return null;

  // 2. Текст прогноза — ищем div, который содержит ТОЛЬКО текст прогноза
  //    (без дочерних span с коэффициентом)
  const text = findSystemText(container);
  if (!text) return null;

  // 3. Коэффициент — span с числом
  const odd = findOddInElement(container);

  return { type, text, odd };
}

/**
 * Ищет текст системного прогноза.
 * Признак: div, в котором прямой текст = прогноз, и нет span внутри.
 */
function findSystemText(container: Element): string | null {
  const divs = container.querySelectorAll('div');
  for (const div of Array.from(divs)) {
    // Пропускаем div, внутри которых есть другие div (только листья)
    const innerDivs = div.querySelectorAll('div');
    if (innerDivs.length > 0) continue;

    // Пропускаем span
    if (div.querySelector('span')) continue;

    const t = extractDirectText(div);
    if (t && isPredictionText(t)) return t;
  }
  return null;
}

/**
 * Извлекает ТОЛЬКО прямой текст (без детей).
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

function isPredictionText(text: string): boolean {
  if (!text || text.length < 2 || text.length > 80) return false;
  return /(П1|П2|\bX\b|1X|2X|ТБ|ТМ|ИТ|Ф1|Ф2|Обе забьют|Ничья|Точный счет|Угловые|тайм)/i.test(text);
}

/**
 * Ищет коэффициент в span (число с точкой).
 */
function findOddInElement(el: Element): string | null {
  const spans = el.querySelectorAll('span');
  for (const span of Array.from(spans)) {
    const t = (span.textContent ?? '').trim();
    if (/^\d+\.\d+$/.test(t)) return t;
  }
  return null;
}

// ===== ПОЛЬЗОВАТЕЛЬСКИЕ ПРОГНОЗЫ =====

function extractUserPredictions(root: Element): UserPrediction[] {
  const result: UserPrediction[] = [];

  // Ищем контейнеры прогнозов: class содержит "predictions"
  const containers = root.querySelectorAll('[class*="predictions"]');
  for (const c of Array.from(containers)) {
    const user = parseUserContainer(c);
    if (user) result.push(user);
  }

  return dedupeUsers(result);
}

function parseUserContainer(container: Element): UserPrediction | null {
  // 1. Имя: div с классом hHvCKY (или подобным) внутри <a href="/profile/...">
  const profileLink = container.querySelector('a[href*="/profile/"]');
  if (!profileLink) return null;

  const author = findAuthor(profileLink);
  if (!author) return null;

  // 2. Текст прогноза: div без вложенных div/span, с текстом прогноза
  const text = findUserText(container);
  if (!text) return null;

  // 3. Остальное
  return {
    author,
    rank: findRank(container),
    profit: findProfit(container),
    addedAt: findAddedAt(container),
    text,
    odd: findOddInElement(container),
    hasDescription: (container.textContent ?? '').includes('Показать ещё'),
  };
}

/**
 * Ищет имя каппера: последний div с текстом без цифр внутри ссылки на профиль.
 */
function findAuthor(profileLink: Element): string | null {
  const divs = profileLink.querySelectorAll('div');
  let candidate: string | null = null;

  for (const d of Array.from(divs)) {
    // Только листья
    if (d.querySelector('div')) continue;

    const t = (d.textContent ?? '').trim();
    if (!t) continue;
    if (/[\d%]/.test(t)) continue;      // без цифр и %
    if (t.includes('место')) continue;
    if (t.length < 2 || t.length > 40) continue;

    candidate = t;
  }
  return candidate;
}

/**
 * Ищет текст пользовательского прогноза.
 * Это div с классом CNvjS или подобным, содержащий текст ставки.
 */
function findUserText(container: Element): string | null {
  const divs = container.querySelectorAll('div');
  for (const div of Array.from(divs)) {
    // Только листья без вложенных div/span
    if (div.querySelector('div') || div.querySelector('span')) continue;

    const t = extractDirectText(div);
    if (t && isPredictionText(t)) return t;
  }
  return null;
}

function findRank(container: Element): string | null {
  const text = (container.textContent ?? '').trim();
  const m = text.match(/(\d+\+?)\s*место в рейтинге/);
  return m ? `${m[1]} место в рейтинге` : null;
}

function findProfit(container: Element): string | null {
  const text = (container.textContent ?? '').trim();
  const m = text.match(/([+-]\d+\.?\d*)%/);
  return m ? m[1] + '%' : null;
}

function findAddedAt(container: Element): string | null {
  const text = (container.textContent ?? '').trim();
  const m = text.match(/(\d+\s*(?:минут|час|часа|часов|день|дня|дней)\s*назад)/i);
  return m ? m[1] : null;
}

// ===== ДЕДУП =====

function dedupeSystem(items: SystemPrediction[]): SystemPrediction[] {
  const seen = new Set<string>();
  return items.filter((p) => {
    const key = `${p.type}|${p.text}|${p.odd}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeUsers(items: UserPrediction[]): UserPrediction[] {
  const seen = new Set<string>();
  return items.filter((u) => {
    const key = `${u.author}|${u.text}|${u.odd}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}