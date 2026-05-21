import type { Subtask } from '@/api'

export type DraftEntry = Subtask & { projectName: string }

const STORAGE_KEY = 'cookie-ai-draft'

export function getDraftEntries(): DraftEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

export function addDraftEntries(entries: DraftEntry[]) {
  const existing = getDraftEntries()
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, ...entries]))
}

export function updateDraftEntry(id: string, updates: Partial<DraftEntry>) {
  const entries = getDraftEntries()
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.map(e => e.id === id ? { ...e, ...updates } : e)))
}

export function deleteDraftEntry(id: string) {
  const entries = getDraftEntries()
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.filter(e => e.id !== id)))
}
