// frontend/src/components/MatchDetails/MatchDetails.tsx
import { useParams } from 'react-router-dom';
import { useMatch } from '../../hooks/useMatch';
import { Markdown } from '../Markdown/Markdown';
import { useState } from 'react';
import { analizeMatchDetails, parseMatchDetails } from '../../api/matches';
import { getErrorMessage } from '../../utils/error';
import type {
  DeepAnalysis,
  DeepAnalysisAlternativeBet,
  DeepAnalysisAvoid,
} from '../../types/match';

export function MatchDetails() {
  const { id } = useParams<{ id: string }>()
  const { match, loading, error, refetch } = useMatch(id)

  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)

  const handleMakePrediction = async () => {
    if (!id || parsing) return
    setParsing(true)
    setParseError(null)
    try {
      await parseMatchDetails(id)
      await analizeMatchDetails(id)
      await refetch()
    } catch (e: unknown) {
      setParseError(getErrorMessage(e))
    } finally {
      setParsing(false)
    }
  }

  if (loading) {
    return <div className="p-6 text-slate-400">Загрузка матча...</div>;
  }

  if (error) {
    return <div className="p-6 text-red-400">Ошибка: {error}</div>;
  }

  if (!match) {
    return <div className="p-6 text-slate-500">Матч не найден</div>;
  }

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-emerald-400 mb-2">
        {match.homeTeam} — {match.awayTeam}
      </h2>
      <p className="text-slate-400 mb-4">
        {match.country} · {match.league}
      </p>

      {/* Кнопка "Сделать прогноз" */}
      <div className="mb-4">
        <button
          onClick={handleMakePrediction}
          disabled={parsing}
          className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 
                     text-white text-sm font-medium transition
                     disabled:opacity-60 disabled:cursor-not-allowed
                     flex items-center gap-2"
        >
          {parsing && (
            <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          )}
          {parsing ? 'Парсинг деталей...' : 'Сделать прогноз'}
        </button>
        {parseError && (
          <p className="text-sm text-red-400 mt-2">Ошибка: {parseError}</p>
        )}
      </div>

      <div className="space-y-2 text-sm">
        <div className="text-slate-300">
          <span className="text-slate-500">Дата:</span> {match.dateTime}
        </div>
        {match.score && (
          <div className="text-slate-300">
            <span className="text-slate-500">Счёт:</span> {match.score}
          </div>
        )}
        <div className="text-slate-300">
          <span className="text-slate-500">Коэффициенты:</span> П1 {match.oddsHome}, X {match.oddsDraw}, П2 {match.oddsAway}
        </div>

        {match.aiReason && (
          <div className="p-3 bg-emerald-950/40 border border-emerald-800 rounded">
            <div className="text-xs text-emerald-400 mb-1">Обоснование выбора AI {match.aiScore}:</div>
            <div className="text-slate-300"><Markdown>{match.aiReason}</Markdown></div>
          </div>
        )}

      {/* 🆕 ГЛУБОКИЙ АНАЛИЗ ОТ DEEPSEEK PRO */}
      {match.deepAnalyzed && match.deepAnalysis && (
        <DeepAnalysisBlock analysis={match.deepAnalysis} />
      )}


        {match.info && (
          <div className="p-3 bg-emerald-950/40 border border-emerald-800 rounded">
            <div className="text-xs text-emerald-400 mb-1">Информация о матче:</div>
            <div className="text-slate-300"><Markdown>{match.info}</Markdown></div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   Блок глубокого анализа от DeepSeek Pro
   ============================================================ */

function DeepAnalysisBlock({ analysis }: { analysis: DeepAnalysis }) {
  const prediction = analysis.prediction || {};
  const decision = analysis.final_decision || '—';

  // Цвета в зависимости от решения
  const decisionStyles: Record<string, string> = {
    'СТАВИТЬ': 'bg-green-900/40 border-green-500 text-green-300',
    'НАБЛЮДАТЬ': 'bg-yellow-900/40 border-yellow-500 text-yellow-300',
    'ПРОПУСТИТЬ': 'bg-red-900/40 border-red-500 text-red-300',
  };

  const decisionStyle =
    decisionStyles[decision] ||
    'bg-slate-800/40 border-slate-600 text-slate-300';

  // Confidence в проценты
  const confidencePct = prediction.confidence
    ? Math.round(prediction.confidence * 100)
    : null;

  // Цвет confidence
  const confidenceColor =
    confidencePct && confidencePct >= 70
      ? 'text-green-400'
      : confidencePct && confidencePct >= 50
      ? 'text-yellow-400'
      : 'text-red-400';

  return (
    <div className="mb-6 rounded-lg border-2 border-indigo-600/60 bg-indigo-950/30 overflow-hidden">
      {/* Заголовок */}
      <div className="px-4 py-2 bg-indigo-900/50 border-b border-indigo-700/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🤖</span>
          <span className="text-sm font-semibold text-indigo-300">
            Глубокий анализ (DeepSeek Pro)
          </span>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-bold border ${decisionStyle}`}
        >
          {decision}
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Основная ставка */}
        {prediction.main_bet && (
          <div className="p-3 rounded bg-indigo-900/40 border border-indigo-700/50">
            <div className="text-xs text-indigo-400 mb-1">Основная ставка</div>
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-lg font-bold text-white">
                {prediction.main_bet}
              </span>
              {prediction.coefficient && (
                <span className="text-indigo-300">
                  × {prediction.coefficient}
                </span>
              )}
              {confidencePct !== null && (
                <span className={`text-sm font-semibold ${confidenceColor}`}>
                  Уверенность: {confidencePct}%
                </span>
              )}
              {prediction.expected_value && (
                <span className="text-sm text-emerald-400">
                  EV: {prediction.expected_value}
                </span>
              )}
            </div>
            {prediction.stake_recommendation && (
              <div className="text-xs text-slate-400 mt-1">
                Рекомендация: {prediction.stake_recommendation}
              </div>
            )}
          </div>
        )}

        {/* Альтернативные ставки */}
        {analysis.alternative_bets && analysis.alternative_bets.length > 0 && (
          <div>
            <div className="text-xs text-indigo-400 mb-2">
              Альтернативные ставки
            </div>
            <div className="space-y-2">
              {analysis.alternative_bets.map((bet: DeepAnalysisAlternativeBet, i: number) => (
                <div
                  key={i}
                  className="p-2 rounded bg-slate-900/40 border border-slate-700/40 text-sm"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-white">
                      {bet.market}
                    </span>
                    {bet.coefficient && (
                      <span className="text-slate-400">
                        × {bet.coefficient}
                      </span>
                    )}
                    {bet.confidence && (
                      <span className="text-xs text-indigo-300">
                        {Math.round(bet.confidence * 100)}%
                      </span>
                    )}
                  </div>
                  {bet.reason && (
                    <div className="text-xs text-slate-400 mt-1">
                      {bet.reason}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Что НЕ ставить */}
        {analysis.avoid && analysis.avoid.length > 0 && (
          <div>
            <div className="text-xs text-red-400 mb-2">⚠️ Избегать</div>
            <div className="space-y-1">
              {analysis.avoid.map((item: DeepAnalysisAvoid, i: number) => (
                <div key={i} className="text-xs text-slate-400">
                  <span className="font-semibold text-red-300">
                    {item.market}
                  </span>
                  {item.reason && <> — {item.reason}</>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Обоснование */}
        {analysis.reasoning && (
          <div className="p-3 rounded bg-indigo-900/30 border border-indigo-700/40">
            <div className="text-xs text-indigo-400 mb-1">Обоснование</div>
            <div className="text-sm text-slate-200">{analysis.reasoning}</div>
          </div>
        )}

        {/* Ключевые факторы и риски — в две колонки */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {analysis.key_factors && analysis.key_factors.length > 0 && (
            <div className="p-3 rounded bg-green-950/30 border border-green-800/40">
              <div className="text-xs text-green-400 mb-2">✅ Факторы</div>
              <ul className="space-y-1">
                {analysis.key_factors.map((f: string, i: number) => (
                  <li key={i} className="text-xs text-slate-300">
                    • {f}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {analysis.risks && analysis.risks.length > 0 && (
            <div className="p-3 rounded bg-red-950/30 border border-red-800/40">
              <div className="text-xs text-red-400 mb-2">⚠️ Риски</div>
              <ul className="space-y-1">
                {analysis.risks.map((r: string, i: number) => (
                  <li key={i} className="text-xs text-slate-300">
                    • {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Итоговое резюме */}
        {analysis.summary && (
          <div className="pt-2 border-t border-indigo-800/40 text-sm text-slate-300 italic">
            {analysis.summary}
          </div>
        )}
      </div>
    </div>
  );
}