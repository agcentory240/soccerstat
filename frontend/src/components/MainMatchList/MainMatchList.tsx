import { useEffect, useRef, useState } from 'react';
import type { Match } from '../../types/match';
import { MainMatchCard } from '../MainMatchCard';
import { MatchDayDivider } from '../MatchDayDivider';
import { useMatchesStore } from '../../store/useMatchesStore';
import { fetchMatch } from '../../api/matches';

interface MainMatchListProps {
  matches: Match[];
  loading: boolean;
  error: string | null;
}

/** Игровой день: ключ для React и дата для разделителя. */
interface MatchDayGroup {
  /** Дата в формате `YYYY-MM-DD` — стабильный ключ группы. */
  key: string;
  /** Исходная ISO-строка `dateTime` для форматирования подписи. */
  date: string;
  matches: Match[];
}

/** Сводка по ставкам списка прогнозов. */
interface MatchStats {
  /** Ставки, которые зашли (`betStatus === true`). */
  won: number;
  /** Ставки, которые не зашли (`betStatus === false`). */
  lost: number;
  /** Матчи, по которым ставка не делалась или результат не будет получен. */
  skipped: number;
  /** Матчи со ставкой, результат которой ещё не проверен. */
  pending: number;
}

/** Общая сводка и сводка по каждому игровому дню (ключ — `YYYY-MM-DD`). */
interface MatchStatsSummary {
  total: MatchStats;
  byDay: Record<string, MatchStats>;
}

/** Начальное (нулевое) значение сводки. */
const EMPTY_STATS: MatchStats = { won: 0, lost: 0, skipped: 0, pending: 0 };

/** Начальное значение сводки со счётчиками по каждому дню. */
const EMPTY_SUMMARY: MatchStatsSummary = { total: EMPTY_STATS, byDay: {} };

export function MainMatchList({ matches, loading, error }: MainMatchListProps) {
  const serverState = useMatchesStore((s) => s.serverState)
  const updateMatch = useMatchesStore((s) => s.updateMatch)

  /**
   * Количество выигранных, проигранных, пропущенных и ожидающих ставок —
   * суммарно и отдельно за каждый игровой день.
   */
  const [statsSummary, setStatsSummary] = useState<MatchStatsSummary>(EMPTY_SUMMARY)

  /** Ключ `<id>:<updatedAt>` последнего обработанного события — защита от повторов. */
  const lastCardUpdateRef = useRef<string | null>(null)

  /**
   * Финальный счёт и результат проверки ставки приходят событиями
   * `score-parsed` и `bet-checked`. Перечитываем только тот матч, который есть
   * в текущем списке, и точечно заменяем его карточку — без полной
   * перезагрузки списка.
   */
  useEffect(() => {
    if (!serverState || serverState.status !== 'done') return
    if (serverState.stage !== 'score-parsed' && serverState.stage !== 'bet-checked') return

    const eventMatchId = serverState.data?.match?.id
    if (eventMatchId == null) return

    // Матча нет в текущем списке — перечитывать нечего.
    const inList = useMatchesStore
      .getState()
      .prognozedMatches.some((m) => m.id === eventMatchId)
    if (!inList) return

    const eventKey = `${eventMatchId}:${serverState.updatedAt}`
    if (lastCardUpdateRef.current === eventKey) return
    lastCardUpdateRef.current = eventKey

    void fetchMatch(eventMatchId)
      .then((updated) => updateMatch(updated))
      .catch(() => {
        // Фоновое обновление одной карточки не должно ломать список.
      })
  }, [serverState, updateMatch])

  /**
   * Пересчитываем сводку (общую и по дням) при каждом изменении списка.
   * Список обновляется в реальном времени: SSE-события (`score-parsed` /
   * `bet-checked`) точечно заменяют матч в сторе, поэтому `matches` приходит
   * новой ссылкой.
   */
  useEffect(() => {
    // Осознанный пересчёт производных данных при изменении входного списка.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatsSummary(computeStats(matches))
  }, [matches])

  if (loading) {
    return <div className="p-4 text-slate-400 text-sm">Загрузка матчей...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-400 text-sm">Ошибка: {error}</div>;
  }

  if (matches.length === 0) {
    return <div className="p-4 text-slate-500 text-sm">Матчей нет</div>;
  }

  const days = groupMatchesByDay(matches);
  const totalStats = statsSummary.total;

  return (
    <div className="flex flex-col">
      {/* Общая сводка по ставкам: обновляется в реальном времени вместе со списком. */}
      <StatsRow label="Итого по всем дням" stats={totalStats} className="mb-3" />

      {days.map((day) => (
        <section key={day.key}>
          <MatchDayDivider date={day.date} />
          <div className="flex flex-row justify-center">
            {/* Сводка по ставкам конкретного игрового дня. */}
            <StatsRow
              label="За день"
              stats={statsSummary.byDay[day.key] ?? EMPTY_STATS}
              className="mb-2"
            />

          </div>

          {/* Пять карточек в ряд, остальные переносятся на следующую строку. */}
          <div className="grid grid-cols-5 gap-3">
            {day.matches.map((match) => (
              <MainMatchCard key={match.id} match={match}/>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/** Строка сводки: заголовок и четыре счётчика ставок. */
function StatsRow({
  label,
  stats,
  className = '',
}: {
  label: string;
  stats: MatchStats;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-2 text-xs ${className}`}>
      <span className="font-semibold text-slate-300">{label}:</span>
      <StatsPill label="Выиграно" value={stats.won} className="bg-green-600/20 text-green-300" />
      <StatsPill label="Проиграно" value={stats.lost} className="bg-red-600/20 text-red-300" />
      <StatsPill label="Пропущено" value={stats.skipped} className="bg-slate-600/30 text-slate-300" />
      <StatsPill label="В ожидании" value={stats.pending} className="bg-amber-600/20 text-amber-300" />
    </div>
  );
}

/** Компактный бейдж со значением сводки. */
function StatsPill({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-semibold ${className}`}>
      <span className="font-normal opacity-80">{label}</span>
      <span>{value}</span>
    </span>
  );
}

/**
 * Считает сводку по ставкам — общую и отдельно за каждый игровой день.
 * Ключ дня совпадает с ключом группировки: `dateTime.slice(0, 10)` (`YYYY-MM-DD`).
 *
 * Категории взаимоисключающие, порядок проверки важен:
 * 1. `skipped` — ставка не делалась (`mainBet` пуст) либо матч перенесён/отменён,
 *    то есть результат уже не будет получен;
 * 2. `pending` — ставка есть, но `betStatus` ещё `null`;
 * 3. `won` / `lost` — по значению `betStatus`.
 */
function computeStats(matches: Match[]): MatchStatsSummary {
  if (matches.length === 0) return EMPTY_SUMMARY;

  const total: MatchStats = { ...EMPTY_STATS };
  const byDay: Record<string, MatchStats> = {};

  for (const match of matches) {
    const dayKey = match.dateTime.slice(0, 10);
    const dayStats = byDay[dayKey] ?? { ...EMPTY_STATS };
    byDay[dayKey] = dayStats;

    const isVoided = match.status === 'canceled' || match.status === 'postponed';

    /** Увеличивает счётчик в общей сводке и в сводке дня. */
    const bump = (key: keyof MatchStats) => {
      total[key] += 1;
      dayStats[key] += 1;
    };

    if (!match.mainBet || isVoided) {
      bump('skipped');
      continue;
    }

    if (match.betStatus === null) {
      bump('pending');
    } else if (match.betStatus) {
      bump('won');
    } else {
      bump('lost');
    }
  }

  return { total, byDay };
}

/**
 * Группирует матчи по календарному дню начала, сохраняя порядок исходного списка.
 * День берётся прямо из строки `dateTime` (без пересчёта часового пояса).
 */
function groupMatchesByDay(matches: Match[]): MatchDayGroup[] {
  const groups = new Map<string, MatchDayGroup>();

  for (const match of matches) {
    const key = match.dateTime.slice(0, 10);

    const group = groups.get(key);
    if (group) {
      group.matches.push(match);
      continue;
    }

    groups.set(key, { key, date: match.dateTime, matches: [match] });
  }

  return Array.from(groups.values());
}
