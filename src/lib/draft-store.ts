import type { Subtask } from '@/api'

export type DraftEntry = Subtask & { projectName: string; column: string }

const STORAGE_KEY = 'cookie-ai-draft'

export function getDraftEntries(): DraftEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

export function addDraftEntries(entries: Omit<DraftEntry, 'column'>[]) {
  const existing = getDraftEntries()
  const stamped = entries.map(e => ({ ...e, column: 'draft' }))
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, ...stamped]))
}

export function persistColumns(columns: Record<string, DraftEntry[]>) {
  const flat = Object.entries(columns).flatMap(([colId, entries]) =>
    entries.map(e => ({ ...e, column: colId }))
  )
  localStorage.setItem(STORAGE_KEY, JSON.stringify(flat))
}

export function updateDraftEntry(id: string, updates: Partial<DraftEntry>) {
  const entries = getDraftEntries()
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.map(e => e.id === id ? { ...e, ...updates } : e)))
}

export function deleteDraftEntry(id: string) {
  const entries = getDraftEntries()
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.filter(e => e.id !== id)))
}
