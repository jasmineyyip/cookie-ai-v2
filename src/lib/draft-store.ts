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
