import { Link } from 'react-router-dom';
import type { FinalDecision, Match } from '../../types/match';

interface MatchCardProps {
  match: Match;
  active: boolean;
}

export function MatchCard({ match,active }: MatchCardProps) {
  const confidencePct = formatConfidence(match.confidence);

  /*
    `betStatus === null` — проверка ставки ещё не выполнялась,
    `true`/`false` — проверка сделана по финальному счёту.
  */
  const betChecked = match.betStatus !== null;

  return (
    <div
      className={`
        relative p-3 rounded-lg border cursor-pointer transition
        ${match.selected
          ? 'bg-emerald-950/40 border-emerald-700 hover:bg-emerald-950/60'
          : 'bg-slate-900 border-slate-800 hover:bg-slate-800'
        }
        ${active
          ? 'bg-lime-950/40 border-lime-700 hover:bg-lime-950/60'
          : ''
        }        
      `}
    >
      {/*
        Растянутая ссылка на страницу прогноза: покрывает всю карточку,
        но не вкладывает в себя внешнюю ссылку nb-bet (вложенные <a> запрещены).
      */}
      <Link
        to={`/prognoses/${match.id}`}
        aria-label={`Открыть прогноз: ${match.homeTeam} — ${match.awayTeam}`}
        className="absolute inset-0 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500"
      />

      <div className="relative z-10 pointer-events-none">
        <div className="text-xs text-slate-400 mb-1">
          {match.country} · {match.league}
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
          <span>{formatDateTime(match.dateTime)}</span>
          {match.liveTime && match.status !== 'finished' && (
            <span className="px-1.5 py-0.5 bg-red-600 text-white rounded text-[10px] font-bold">
              {match.liveTime}
            </span>
          )}
          {match.status === 'finished' && (
            <span className="px-1.5 py-0.5 bg-slate-700 text-slate-300 rounded text-[10px] font-bold">
              Завершён
            </span>
          )}
        </div>

        <div className="flex items-center justify-between mb-2">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{match.homeTeam}</div>
            <div className="text-sm font-medium truncate">{match.awayTeam}</div>
          </div>
          {match.score && (
            <div className="text-lg font-bold text-emerald-400 ml-2">
              {match.score}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 text-xs">
          <OddBadge label="П1" value={match.oddsHome} />
          <OddBadge label="X" value={match.oddsDraw} />
          <OddBadge label="П2" value={match.oddsAway} />
        </div>

        {match.aiReason && (
          <div className="flex items-center gap-1 text-xs pt-2">
            <span className="px-1.5 py-0.5 bg-green-800 rounded text-slate-300">
              <span className="text-yellow-00 font-bold text-2xl pr-1">{match.aiScore}</span>
              <span className="text-yellow-00">{match.aiReason}</span>
            </span>
          </div>
        )}

        {match.mainBet && (
          <div
            className={`mt-2 p-2 rounded border text-xs ${decisionCardStyle(match.finalDecision)}`}
          >
            <div className="flex items-center gap-1.5 flex-wrap">
              {match.finalDecision && (
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${decisionBadgeStyle(match.finalDecision)}`}
                >
                  {match.finalDecision}
                </span>
              )}
              <span className="font-semibold text-white">{match.mainBet}</span>
              {match.betCoefficient && (
                <span className="text-slate-300">× {match.betCoefficient}</span>
              )}
              {confidencePct !== null && (
                <span className="text-slate-400">Уверенность: {confidencePct}%</span>
              )}
            </div>
            {match.stakeRecommendation && (
              <div className="text-[11px] text-slate-400 mt-1">
                Банк: {match.stakeRecommendation}
              </div>
            )}
            {betChecked && (
              <div
                className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  match.betStatus
                    ? 'bg-green-700 text-white'
                    : 'bg-red-700 text-white'
                }`}
              >
                {match.betStatus ? '✓ Ставка сыграла' : '✕ Ставка не сыграла'}
              </div>
            )}
          </div>
        )}
      </div>

      {match.url && (
        <a
          href={match.url}
          target="_blank"
          rel="noopener noreferrer"
          className="relative z-20 inline-block mt-2 text-xs text-emerald-400 hover:text-emerald-300 underline"
        >
          Открыть на nb-bet →
        </a>
      )}
    </div>
  );
}

/** Фон/рамка блока рекомендуемой ставки в зависимости от решения Pro-модели. */
function decisionCardStyle(decision: FinalDecision | null): string {
  switch (decision) {
    case 'СТАВИТЬ':
      return 'bg-green-950/40 border-green-700';
    case 'НАБЛЮДАТЬ':
      return 'bg-yellow-950/40 border-yellow-700';
    case 'ПРОПУСТИТЬ':
      return 'bg-red-950/40 border-red-800';
    default:
      return 'bg-indigo-950/40 border-indigo-700';
  }
}

/** Цвет бейджа с решением Pro-модели. */
function decisionBadgeStyle(decision: FinalDecision | null): string {
  switch (decision) {
    case 'СТАВИТЬ':
      return 'bg-green-700 text-white';
    case 'НАБЛЮДАТЬ':
      return 'bg-yellow-700 text-white';
    case 'ПРОПУСТИТЬ':
      return 'bg-red-700 text-white';
    default:
      return 'bg-indigo-700 text-white';
  }
}

/**
 * Уверенность приходит строкой. В БД она хранится как доля (0–1),
 * но на всякий случай поддерживаем и уже переведённые проценты.
 */
function formatConfidence(value: string | null): number | null {
  if (!value) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  const pct = num <= 1 ? num * 100 : num;
  return Math.round(pct);
}

function OddBadge({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <span className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-300">
      <span className="text-slate-500">{label}</span> {value}
    </span>
  );
}

function formatDateTime(dateTime: string): string {
  const d = new Date(dateTime);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}