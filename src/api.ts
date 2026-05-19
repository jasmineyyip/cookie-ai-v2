export type SubtaskStatus = 'todo' | 'in_progress' | 'done'

export type Subtask = {
  id: string
  title: string
  description: string | null
  estimated_minutes: number
  difficulty: 'easy' | 'medium' | 'hard'
  status: SubtaskStatus
  position: number
  order_index: number
  created_at: string
}

export type Project = {
  id: string
  title: string
  raw_instructions: string | null
  status: 'decomposing' | 'ready' | 'failed'
  created_at: string
  subtasks: Subtask[]
}

export type ProjectCreate = {
  title: string
  instructions: string
}

export type ProjectUpdate = {
  title?: string
  raw_instructions?: string
}

export type SubtaskCreate = {
  title: string
  description?: string
  estimated_minutes: number
  difficulty: 'easy' | 'medium' | 'hard'
}

export type SubtaskUpdate = {
  title?: string
  description?: string
  estimated_minutes?: number
  difficulty?: string
  status?: SubtaskStatus
  position?: number
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `Request failed with ${response.status}`)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

export function listProjects() {
  return request<Project[]>('/api/projects')
}

export function getProject(projectId: string) {
  return request<Project>(`/api/projects/${projectId}`)
}

export function createProject(payload: ProjectCreate) {
  return request<Project>('/api/projects', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateProject(projectId: string, payload: ProjectUpdate) {
  return request<Project>(`/api/projects/${projectId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteProject(projectId: string) {
  return request<void>(`/api/projects/${projectId}`, { method: 'DELETE' })
}

export function redecomposeProject(projectId: string) {
  return request<Project>(`/api/projects/${projectId}/redecompose`, {
    method: 'POST',
  })
}

export function createSubtask(projectId: string, payload: SubtaskCreate) {
  return request<Subtask>(`/api/projects/${projectId}/subtasks`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateSubtask(subtaskId: string, payload: SubtaskUpdate) {
  return request<Subtask>(`/api/subtasks/${subtaskId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteSubtask(subtaskId: string) {
  return request<void>(`/api/subtasks/${subtaskId}`, { method: 'DELETE' })
}
