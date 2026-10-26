/**
 * Утилиты форматирования дат матчей для отображения в интерфейсе.
 */

/** Разбирает ISO-подобную строку на компоненты без участия часового пояса. */
const MATCH_DATE_TIME_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/;

/** Дни недели по индексу `Date#getDay()` (0 — воскресенье). */
const WEEKDAYS = [
  'воскресенье',
  'понедельник',
  'вторник',
  'среда',
  'четверг',
  'пятница',
  'суббота',
];

interface FormatMatchDateTimeOptions {
  /** Показывать год. По умолчанию `true`. */
  withYear?: boolean;
}

/**
 * Форматирует дату матча в читаемый вид: `ДД.ММ.ГГГГ ЧЧ:ММ`.
 *
 * Важно: API отдаёт `dateTime` как ISO-строку с суффиксом `Z`, но в этом поле
 * лежит «настенное» время начала матча (то, что показывает nb-bet), а не
 * момент времени в UTC — парсер записывает локальное время в колонку
 * `timestamp` без часового пояса. Поэтому компоненты даты берём прямо из
 * строки, без пересчёта зоны: `new Date(value)` в UTC+3 прибавил бы лишние
 * 3 часа к времени начала матча.
 */
export function formatMatchDay(value: string | null | undefined): string {
  if (!value) return '';

  const parsed = MATCH_DATE_TIME_RE.exec(value);
  if (!parsed) return value;

  const [, year, month, day] = parsed;
  // Локальная дата из компонент строки — без пересчёта часового пояса.
  const weekdayIndex = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
  ).getDay();

  return `${day}.${month}.${year}, ${WEEKDAYS[weekdayIndex]}`;
}

export function formatMatchDateTime(
  value: string | null | undefined,
  options: FormatMatchDateTimeOptions = {},
): string {
  const { withYear = true } = options;
  if (!value) return '';

  const parsed = MATCH_DATE_TIME_RE.exec(value);
  if (!parsed) return value;

  const [, year, month, day, hours, minutes] = parsed;
  return withYear
    ? `${day}.${month}.${year} ${hours}:${minutes}`
    : `${day}.${month} ${hours}:${minutes}`;
}
