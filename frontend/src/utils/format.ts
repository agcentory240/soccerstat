// frontend/src/utils/format.ts

/**
 * Уверенность модели в процентах.
 *
 * Единая точка расчёта для всех компонентов, чтобы одна и та же ставка
 * показывала одинаковый процент в списке, карточке и деталях матча.
 *
 * В БД `confidence` хранится строкой как доля (0–1), но модель может вернуть
 * и уже переведённые проценты. Значения `<= 1` трактуем как долю,
 * значения `> 1` — как готовые проценты. Некорректные данные → `null`.
 */
export function formatConfidence(
  value: string | number | null | undefined,
): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  const pct = num <= 1 ? num * 100 : num;
  return Math.round(pct);
}
