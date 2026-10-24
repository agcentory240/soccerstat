import { create } from 'zustand'
import { analyzeMatches, fetchMatches, parseMatches } from '../api/matches'
import type { Match } from '../types/match'
import { getErrorMessage } from '../utils/error'

interface MatchesState {
  matches: Match[]
  loading: boolean
  refreshing: boolean   // ← отдельный флаг для "Обновить матчи"
  error: string | null

  loadMatches: () => Promise<void>
  refreshAll: () => Promise<void>   // ← парсинг + анализ + перезагрузка
}

export const useMatchesStore = create<MatchesState>((set, get) => ({
  matches: [],
  loading: false,
  refreshing: false,
  error: null,

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
}))

function sortMatches(data: Match[]): Match[] {
  return [...data].sort((a, b) => {
    if (a.selected !== b.selected) return a.selected ? -1 : 1
    return new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime()
  })
}