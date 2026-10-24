import { create } from 'zustand'
import { analyzeMatches, fetchMatches, parseMatches } from '../api/matches'
import { subscribeToServerState } from '../api/events'
import type { Match } from '../types/match'
import type { ServerStateEvent } from '../types/state'
import { getErrorMessage } from '../utils/error'

/** Активная подписка на SSE, чтобы не открывать соединение повторно. */
let stopEvents: (() => void) | null = null

interface MatchesState {
  matches: Match[]
  loading: boolean
  refreshing: boolean   // ← отдельный флаг для "Обновить матчи"
  error: string | null

  serverState: ServerStateEvent | null   // ← состояние сервера из Redis через SSE
  eventsConnected: boolean

  loadMatches: () => Promise<void>
  refreshAll: () => Promise<void>   // ← парсинг + анализ + перезагрузка
  connectEvents: () => () => void   // ← подписка на состояние сервера
}

export const useMatchesStore = create<MatchesState>((set, get) => ({
  matches: [],
  loading: false,
  refreshing: false,
  error: null,
  serverState: null,
  eventsConnected: false,

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

  refreshAll: async () => {
    if (get().refreshing) return
    set({ refreshing: true, error: null })
    try {
      // 1. Парсинг
      await parseMatches()
      // 2. Анализ
      await analyzeMatches()
      // 3. Перезагрузка списка
      const data = await fetchMatches()
      set({ matches: sortMatches(data).slice(0, 500) })
    } catch (e: unknown) {
      set({ error: getErrorMessage(e) })
    } finally {
      set({ refreshing: false })
    }
  },

  connectEvents: () => {
    if (stopEvents) return stopEvents

    let isFirstMessage = true

    stopEvents = subscribeToServerState({
      onState: (state) => {
        set({ serverState: state })

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

function sortMatches(data: Match[]): Match[] {
  return [...data].sort((a, b) => {
    if (a.selected !== b.selected) return a.selected ? -1 : 1
    return new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime()
  })
}