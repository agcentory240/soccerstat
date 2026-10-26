import { formatMatchDay } from '../../utils/dateTime';

interface MatchDayDividerProps {
  /** Дата игрового дня в формате ISO-строки матча (`dateTime`). */
  date: string;
}

/**
 * Разделитель игровых дней: горизонтальная линия с подписью даты.
 * Используется между блоками карточек разных дней.
 */
export function MatchDayDivider({ date }: MatchDayDividerProps) {
  return (
    <div className="flex items-center gap-3 py-3">
      <span className="h-px flex-1 bg-slate-800" />
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {formatMatchDay(date)}
      </span>
      <span className="h-px flex-1 bg-slate-800" />
    </div>
  );
}
