import { create } from 'zustand'
import {
  checkBets as checkBetsRequest,
  fetchMatches,
  fetchPrognozedMatches,
  parseMatches,
} from '../api/matches'
import { subscribeToServerState } from '../api/events'
import type { Match } from '../types/match'
import type { ServerStateEvent, ServerStateLogEntry } from '../types/state'
import { getErrorMessage } from '../utils/error'

/** Активная подписка на SSE, чтобы не открывать соединение повторно. */
let stopEvents: (() => void) | null = null

/** Предел хранимых записей журнала Redis (кольцевой буфер). */
const MAX_EVENT_LOGS = 300

/** Монотонный счётчик для стабильных React-ключей записей журнала. */
let logSeq = 0

interface MatchesState {
  matches: Match[]
  prognozedMatches: Match[]
  loading: boolean
  refreshing: boolean   // ← отдельный флаг для "Обновить матчи"
  checkingBets: boolean // ← отдельный флаг для "Проверить ставки"
  error: string | null

  serverState: ServerStateEvent | null   // ← состояние сервера из Redis через SSE
  eventsConnected: boolean
  eventLogs: ServerStateLogEntry[]       // ← накопленный журнал событий Redis

  loadMatches: () => Promise<void>
  loadPrognozeMatches: () => Promise<void>
  refreshAll: () => Promise<void>   // ← парсинг + анализ + перезагрузка
  checkBets: () => Promise<void>    // ← массовая проверка ставок по завершённым матчам
  connectEvents: () => () => void   // ← подписка на состояние сервера
  /** Очищает накопленный журнал событий Redis. */
  clearEventLogs: () => void
  /**
   * Точечно заменяет матч во всех загруженных списках (`matches`,
   * `prognozedMatches`). Списки, где матча нет, не меняются.
   */
  updateMatch: (match: Match) => void
}

export const useMatchesStore = create<MatchesState>((set, get) => ({
  matches: [],
  prognozedMatches: [],
  loading: false,
  refreshing: false,
  checkingBets: false,
  error: null,
  serverState: null,
  eventsConnected: false,
  eventLogs: [],

  loadMatches: async () => {
    if (get().loading) return
    set({ loading: true, error: null })
    try {
      const data = await fetchMatches()
      set({ matches: sortMatches(data).slice(0, 500) })
    } catch (e: unknown) {
      set({ error: getErrorMessage(e) })
    } finally {
      set({ loading: false })
    }
  },

  loadPrognozeMatches: async () => {
    if (get().loading) return
    set({ loading: true, error: null })
    try {
      const data = await fetchPrognozedMatches()
      set({ prognozedMatches: sortMatches(data).slice(0, 500) })
    } catch (e: unknown) {
      set({ error: getErrorMessage(e) })
    } finally {
      set({ loading: false })
    }
  },

  refreshAll: async () => {
    if (get().refreshing) return
    set({ refreshing: true, error: null })
    try {
      // 1. Парсинг списка. Быстрый и глубокий AI-анализ запускаются
      //    автоматически по событиям RabbitMQ (`matches.parsed` → `matches.analyzed`).
      await parseMatches()
      // 2. Перезагрузка списка
      const data = await fetchMatches()
      set({ matches: sortMatches(data).slice(0, 500) })
    } catch (e: unknown) {
      set({ error: getErrorMessage(e) })
    } finally {
      set({ refreshing: false })
    }
  },

  checkBets: async () => {
    if (get().checkingBets) return
    set({ checkingBets: true, error: null })
    try {
      // Сервер последовательно парсит счёт отмеченных матчей и обновляет betStatus.
      await checkBetsRequest()
      // Перезагружаем список, чтобы показать новые результаты проверки.
      const data = await fetchMatches()
      set({ matches: sortMatches(data).slice(0, 500) })
    } catch (e: unknown) {
      set({ error: getErrorMessage(e) })
    } finally {
      set({ checkingBets: false })
    }
  },

  clearEventLogs: () => {
    set({ eventLogs: [] })
  },

  updateMatch: (match) => {
    set((prev) => ({
      ...prev,
      matches: replaceById(prev.matches, match),
      prognozedMatches: replaceById(prev.prognozedMatches, match),
    }))
  },

  connectEvents: () => {
    if (stopEvents) return stopEvents

    let isFirstMessage = true

    stopEvents = subscribeToServerState({
      onState: (state) => {
        // Копим журнал событий независимо от видимости панели логов.
        set((prev) => ({
          serverState: state,
          eventLogs: [
            ...prev.eventLogs,
            {
              id: ++logSeq,
              at: state.updatedAt,
              status: state.status,
              stage: state.stage,
              message: state.message,
            },
          ].slice(-MAX_EVENT_LOGS),
        }))

        // Первое сообщение — снапшот при подключении, список уже загружен страницей.
        if (isFirstMessage) {
          isFirstMessage = false
          return
        }

        // Сервер завершил парсинг или анализ — обновляем список матчей.
        if (state.status === 'done' && (state.stage === 'parsed' || state.stage === 'analyzed')) {
          void get().loadMatches()
        }
      },
      onConnectionChange: (connected) => set({ eventsConnected: connected }),
    })

    const stop = stopEvents
    return () => {
      stop()
      stopEvents = null
      set({ eventsConnected: false })
    }
  },
}))

/**
 * Возвращает новый массив с заменённым по `id` матчем.
 * Если матча в списке нет, возвращается исходный массив (ссылка сохраняется,
 * поэтому подписчики стора не получают лишних обновлений).
 */
function replaceById(list: Match[], match: Match): Match[] {
  const index = list.findIndex((m) => m.id === match.id)
  if (index === -1) return list

  const next = [...list]
  next[index] = match
  return next
}

function sortMatches(data: Match[]): Match[] {
  return [...data].sort((a, b) => {
    if (a.selected !== b.selected) return a.selected ? -1 : 1
    return new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime()
  })
}