import type { Match } from '../types/match';

export const API_URL = 'http://localhost:3000';

export async function fetchMatches(): Promise<Match[]> {
  const res = await fetch(`${API_URL}/matches`);
  if (!res.ok) {
    throw new Error(`Failed to fetch matches: ${res.status}`);
  }
  return res.json();
}

export async function fetchPrognozedMatches(): Promise<Match[]> {
  const res = await fetch(`${API_URL}/matches/prognozed`);
  if (!res.ok) {
    throw new Error(`Failed to fetch matches: ${res.status}`);
  }
  return res.json();
}

/** Загружает один матч по id (используется для точечного обновления карточки). */
export async function fetchMatch(id: number): Promise<Match> {
  const res = await fetch(`${API_URL}/matches/${id}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch match ${id}: ${res.status}`);
  }
  return res.json();
}

export async function parseMatches() {
  const res = await fetch(`${API_URL}/parser/matches`)
  if (!res.ok) throw new Error('Ошибка парсинга')
  return res.json()
}

export async function analyzeMatches() {
  const res = await fetch(`${API_URL}/matches/analyze`, { method: 'POST' })
  if (!res.ok) throw new Error('Ошибка анализа')
  return res.json()
}

export async function parseMatchDetails(id: string | number) {
  const res = await fetch(`${API_URL}/parser/matches/${id}`)
  if (!res.ok) throw new Error('Ошибка парсинга деталей матча')
  return res.json()
}

export async function analizeMatchDetails(id: string | number) {
  const res = await fetch(`${API_URL}/matches/${id}/deep`)
  if (!res.ok) throw new Error('Ошибка парсинга деталей матча')
  return res.json()
}
export async function parseMatchScore(id: string | number) {
  const res = await fetch(`${API_URL}/parser/checkbet/${id}`)
  if (!res.ok) throw new Error('Ошибка парсинга счета матча')
  return res.json()
}

/** Запускает массовую проверку ставок по завершённым матчам (`/parser/checkbets`). */
export async function checkBets() {
  const res = await fetch(`${API_URL}/parser/checkbets`)
  if (!res.ok) throw new Error('Ошибка проверки ставок')
  return res.json()
}