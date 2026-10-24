import type { Match } from '../types/match';

const API_URL = 'http://localhost:3000';

export async function fetchMatches(): Promise<Match[]> {
  const res = await fetch(`${API_URL}/matches`);
  if (!res.ok) {
    throw new Error(`Failed to fetch matches: ${res.status}`);
  }
  return res.json();
}

export async function parseMatches() {
  const res = await fetch('http://localhost:3000/parser/matches')
  if (!res.ok) throw new Error('Ошибка парсинга')
  return res.json()
}

export async function analyzeMatches() {
  const res = await fetch('http://localhost:3000/matches/analyze', { method: 'POST' })
  if (!res.ok) throw new Error('Ошибка анализа')
  return res.json()
}

export async function parseMatchDetails(id: string | number) {
  const res = await fetch(`http://localhost:3000/parser/matches/${id}`)
  if (!res.ok) throw new Error('Ошибка парсинга деталей матча')
  return res.json()
}
export async function analizeMatchDetails(id: string | number) {
  const res = await fetch(`http://localhost:3000/matches/${id}/deep`)
  if (!res.ok) throw new Error('Ошибка парсинга деталей матча')
  return res.json()
}