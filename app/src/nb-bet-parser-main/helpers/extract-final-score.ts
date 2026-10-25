export interface FinalScore {
  total: string           // "2:0"
  byPeriods: string | null // "(2:0, 0:0)" или null
}

/**
 * Извлекает финальный счёт матча.
 * Ищет блок с текстом «Завершён», поднимается до контейнера матча,
 * внутри находит общий счёт и счёт по таймам.
 */
export function extractFinalScore(doc: Document): FinalScore | null {
  // 1. Находим элемент с текстом «Завершён»
  const statusEl = findElementByText(doc, 'Завершён')
  if (!statusEl) return null

  // 2. Поднимаемся до контейнера матча
  const container = findMatchContainer(statusEl)
  if (!container) return null

  // 3. Ищем общий счёт (два div с цифрами внутри одного div)
  const total = findTotalScore(container)
  if (!total) return null

  // 4. Ищем счёт по таймам (текст в скобках)
  const byPeriods = findPeriodsScore(container)

  return { total, byPeriods }
}

/**
 * Ищет элемент, чей прямой текст совпадает с искомым.
 */
function findElementByText(doc: Document, text: string): Element | null {
  const all = doc.querySelectorAll('div, span, p')
  for (const el of Array.from(all)) {
    const directText = extractDirectText(el)
    if (directText === text) return el
  }
  return null
}

/**
 * Поднимается от «Завершён» до контейнера, в котором есть и счёт, и скобки.
 */
function findMatchContainer(statusEl: Element): Element | null {
  let current: Element | null = statusEl
  let depth = 0

  while (current && depth < 10) {
    if (findTotalScore(current) !== null) return current
    current = current.parentElement
    depth++
  }
  return null
}

/**
 * Ищет общий счёт: div, внутри которого ровно два div с числами.
 * В HTML: <div><div>2</div>:<div>0</div></div>
 */
function findTotalScore(container: Element): string | null {
  const divs = container.querySelectorAll('div')

  for (const div of Array.from(divs)) {
    const childDivs = Array.from(div.children).filter(
      (c) => c.tagName === 'DIV',
    )
    if (childDivs.length !== 2) continue

    const a = (childDivs[0].textContent ?? '').trim()
    const b = (childDivs[1].textContent ?? '').trim()

    if (/^\d+$/.test(a) && /^\d+$/.test(b)) {
      return `${a}:${b}`
    }
  }
  return null
}

/**
 * Ищет счёт по таймам: текст вида "(2:0, 0:0)".
 */
function findPeriodsScore(container: Element): string | null {
  const divs = container.querySelectorAll('div')
  for (const div of Array.from(divs)) {
    const text = (div.textContent ?? '').trim()
    if (/^\(\d+:\d+(,\s*\d+:\d+)?\)$/.test(text)) {
      return text.replace(/\s+/g, ' ')
    }
  }
  return null
}

/**
 * Извлекает только прямой текст элемента (без детей).
 */
function extractDirectText(el: Element): string {
  const parts: string[] = []
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeName === '#text') {
      const t = (node.textContent ?? '').trim()
      if (t) parts.push(t)
    }
  }
  return parts.join(' ').trim()
}