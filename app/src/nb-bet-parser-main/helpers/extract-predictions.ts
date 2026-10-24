export interface Prediction {
  /** Текст прогноза (например, "Обе забьют - Да", "П1") */
  text: string;
  /** Коэффициент (например, "1.666"), или null */
  odd: string | null;
}

export interface Predictions {
  /** Математический прогноз (может отсутствовать) */
  math: Prediction | null;
  /** Прогноз пользователей (может отсутствовать) */
  users: Prediction | null;
}

/**
 * Извлекает прогнозы со страницы матча.
 *
 * Ищет два блока:
 * - «Математический прогноз: <текст>» → math
 * - «Прогноз пользователей: <текст>» → users
 *
 * Каждый блок может отсутствовать. Если оба отсутствуют — возвращает null.
 *
 * @param doc - Document
 * @returns Predictions или null, если ни одного прогноза нет
 */
export function extractPredictions(doc: Document): Predictions | null {
  const math = findPrediction(doc, 'Математический прогноз');
  const users = findPrediction(doc, 'Прогноз пользователей');

  // Если ни одного — вернуть null
  if (!math && !users) {
    return null;
  }

  return { math, users };
}

/**
 * Ищет блок прогноза по маркеру и извлекает текст + коэффициент.
 */
function findPrediction(doc: Document, marker: string): Prediction | null {
  // 1. Находим <strong> с маркером
  const strongs = doc.querySelectorAll('strong');
  const strong = Array.from(strongs).find((el) => {
    const text = (el.textContent ?? '').trim();
    // Убираем двоеточие в конце, если есть
    return text.replace(/:\s*$/, '') === marker;
  });

  if (!strong) {
    return null;
  }

  // 2. Родитель <strong> — обычно <span>, содержащий текст прогноза
  const span = strong.parentElement;
  if (!span) {
    return null;
  }

  // 3. Извлекаем текст прогноза: убираем <strong> и берём остаток
  const predictionText = extractTextAfterStrong(span, marker);
  if (!predictionText) {
    return null;
  }

  // 4. Ищем коэффициент в соседнем блоке
  //    Обычно <span> обёрнут в <div>, и рядом есть <div> с коэффициентом
  const odd = findOddNear(span);

  return {
    text: predictionText,
    odd,
  };
}

/**
 * Извлекает текст прогноза из <span>, убирая часть с <strong>.
 *
 * Пример: <span><strong>Математический прогноз: </strong>Обе забьют - Да</span>
 *         → "Обе забьют - Да"
 */
function extractTextAfterStrong(span: Element, marker: string): string | null {
  // Обходим дочерние узлы span
  const parts: string[] = [];
  let foundMarker = false;

  for (const node of Array.from(span.childNodes)) {
    if (node.nodeName === 'STRONG') {
      const text = (node.textContent ?? '').trim();
      if (text.replace(/:\s*$/, '') === marker) {
        foundMarker = true;
      }
      continue; // пропускаем сам <strong>
    }

    if (foundMarker) {
      const text = (node.textContent ?? '').trim();
      if (text) parts.push(text);
    }
  }

  const result = parts.join(' ').trim();
  return result || null;
}

/**
 * Ищет коэффициент рядом со <span> прогноза.
 *
 * Логика: поднимается от <span> до родителя, ищет в нём элемент
 * с классом, содержащим число-коэффициент (например, "1.666").
 *
 * ВАЖНО: точный селектор коэффициента зависит от вёрстки.
 * Здесь — эвристика: ищем текст, начинающийся с числа и содержащий точку.
 */
function findOddNear(span: Element): string | null {
  // Поднимаемся до родителя (обычно div, содержащий и span, и блок с коэффициентом)
  let container: Element | null = span.parentElement;
  let depth = 0;

  while (container && depth < 5) {
    // Ищем внутри контейнера элемент с текстом-коэффициентом
    // Коэффициент — число вида "1.666", "10.5", "2.0"
    // Обычно он лежит в div с классом sc-6eaa4faa-8 (индикатор)
    const candidates = container.querySelectorAll('div');

    for (const div of Array.from(candidates)) {
      const text = (div.textContent ?? '').trim();

      // Пропускаем большие блоки — коэффициент короткий
      if (text.length > 20) continue;

      // Коэффициент: число с точкой, опционально со знаком +
      const match = text.match(/([+-]?\d+\.\d+)/);
      if (match) {
        // Исключаем блоки с движением коэффициента ("+0.01", "-0.01")
        // — они тоже содержат числа с точкой, но нам нужен "текущий" коэффициент
        // Проверяем, что рядом нет слов "Текущий", "Начальный"
        const parentText = (div.parentElement?.textContent ?? '').trim();
        if (/Текущий|Начальный|Движение/.test(parentText)) {
          continue;
        }

        return match[1];
      }
    }

    container = container.parentElement;
    depth++;
  }

  return null;
}