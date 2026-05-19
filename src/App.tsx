import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Navigate, Route, BrowserRouter as Router, Routes, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, ClipboardList, Loader2, Plus, RefreshCw } from 'lucide-react'
import {
  createProject,
  getProject,
  listProjects,
  redecomposeProject,
  updateSubtask,
} from './api'
import type { Project, Subtask, SubtaskStatus } from './api'
import './App.css'

const queryClient = new QueryClient()

const columns: Array<{ status: SubtaskStatus; label: string }> = [
  { status: 'todo', label: 'Todo' },
  { status: 'in_progress', label: 'In progress' },
  { status: 'done', label: 'Done' },
]

const statusOrder: SubtaskStatus[] = ['todo', 'in_progress', 'done']

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          <Route path="/" element={<Navigate to="/projects" replace />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/new" element={<NewProjectPage />} />
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        </Routes>
      </Router>
    </QueryClientProvider>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="app-shell">
      <nav className="topbar">
        <Link to="/projects" className="brand">
          <ClipboardList size={22} />
          Cookie AI
        </Link>
        <Link to="/projects/new" className="primary-link">
          <Plus size={18} />
          New project
        </Link>
      </nav>
      {children}
    </main>
  )
}

function ProjectsPage() {
  const { data: projects = [], isLoading, error } = useQuery({
    queryKey: ['projects'],
    queryFn: listProjects,
  })

  return (
    <Shell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Projects</p>
          <h1>Your decomposition workspace</h1>
        </div>
      </header>

      {isLoading ? <LoadingState label="Loading projects" /> : null}
      {error ? <ErrorState message="Could not load projects. Is the backend running on port 8000?" /> : null}
      {!isLoading && !error && projects.length === 0 ? <EmptyProjects /> : null}

      <section className="project-list">
        {projects.map((project) => (
          <Link to={`/projects/${project.id}`} className="project-row" key={project.id}>
            <div>
              <h2>{project.title}</h2>
              <p>{project.raw_instructions || 'No instructions saved'}</p>
            </div>
            <div className="project-meta">
              <StatusBadge status={project.status} />
              <span>{project.subtasks.length} tasks</span>
            </div>
          </Link>
        ))}
      </section>
    </Shell>
  )
}

function EmptyProjects() {
  return (
    <section className="empty-state">
      <ClipboardList size={34} />
      <h2>No projects yet</h2>
      <p>Paste a real project description and Cookie AI will turn it into a working task board.</p>
      <Link to="/projects/new" className="primary-link">
        <Plus size={18} />
        Create project
      </Link>
    </section>
  )
}

function NewProjectPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [instructions, setInstructions] = useState('')
  const mutation = useMutation({
    mutationFn: createProject,
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      navigate(`/projects/${project.id}`)
    },
  })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    mutation.mutate({ title, instructions })
  }

  return (
    <Shell>
      <Link to="/projects" className="back-link">
        <ArrowLeft size={18} />
        Projects
      </Link>
      <form className="project-form" onSubmit={handleSubmit}>
        <div>
          <p className="eyebrow">New project</p>
          <h1>Paste the messy version</h1>
          <p className="supporting-copy">Include enough detail for Claude to split the work into focused sessions.</p>
        </div>

        <label>
          Title
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Launch SaaS dashboard"
            required
          />
        </label>

        <label>
          Instructions
          <textarea
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            placeholder="Build a React dashboard with user auth, charts, migrations, deploy..."
            rows={9}
            required
          />
        </label>

        {mutation.error ? <ErrorState message="Project creation failed. Check the backend logs." /> : null}

        <button className="primary-button" type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? <Loader2 className="spin" size={18} /> : <Plus size={18} />}
          Create and decompose
        </button>
      </form>
    </Shell>
  )
}

function ProjectDetailPage() {
  const { projectId = '' } = useParams()
  const queryClient = useQueryClient()
  const projectQuery = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => getProject(projectId),
    enabled: Boolean(projectId),
  })
  const updateMutation = useMutation({
    mutationFn: ({ subtaskId, status, position }: { subtaskId: string; status: SubtaskStatus; position: number }) =>
      updateSubtask(subtaskId, { status, position }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] })
    },
  })
  const redecomposeMutation = useMutation({
    mutationFn: () => redecomposeProject(projectId),
    onSuccess: (project) => {
      queryClient.setQueryData(['projects', projectId], project)
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })

  const project = projectQuery.data
  const grouped = useMemo(() => groupSubtasks(project?.subtasks ?? []), [project?.subtasks])

  function moveSubtask(subtask: Subtask, direction: -1 | 1) {
    const currentIndex = statusOrder.indexOf(subtask.status)
    const nextStatus = statusOrder[currentIndex + direction]
    if (!nextStatus) return

    updateMutation.mutate({
      subtaskId: subtask.id,
      status: nextStatus,
      position: grouped[nextStatus].length,
    })
  }

  return (
    <Shell>
      <Link to="/projects" className="back-link">
        <ArrowLeft size={18} />
        Projects
      </Link>

      {projectQuery.isLoading ? <LoadingState label="Loading project" /> : null}
      {projectQuery.error ? <ErrorState message="Could not load project." /> : null}

      {project ? (
        <>
          <header className="project-detail-header">
            <div>
              <p className="eyebrow">Project board</p>
              <h1>{project.title}</h1>
              <p className="supporting-copy">{project.raw_instructions}</p>
            </div>
            <div className="header-actions">
              <StatusBadge status={project.status} />
              <button className="secondary-button" onClick={() => redecomposeMutation.mutate()} disabled={redecomposeMutation.isPending}>
                {redecomposeMutation.isPending ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />}
                Redecompose
              </button>
            </div>
          </header>

          <section className="board">
            {columns.map((column) => (
              <div className="board-column" key={column.status}>
                <div className="column-header">
                  <h2>{column.label}</h2>
                  <span>{grouped[column.status].length}</span>
                </div>
                <div className="task-stack">
                  {grouped[column.status].map((subtask) => (
                    <article className="task-card" key={subtask.id}>
                      <div>
                        <h3>{subtask.title}</h3>
                        <p>{subtask.description}</p>
                      </div>
                      <div className="task-meta">
                        <span>{subtask.estimated_minutes} min</span>
                        <span>{subtask.difficulty}</span>
                      </div>
                      <div className="task-actions">
                        <button
                          aria-label="Move task left"
                          disabled={subtask.status === 'todo' || updateMutation.isPending}
                          onClick={() => moveSubtask(subtask, -1)}
                        >
                          <ArrowLeft size={16} />
                        </button>
                        <button
                          aria-label="Move task right"
                          disabled={subtask.status === 'done' || updateMutation.isPending}
                          onClick={() => moveSubtask(subtask, 1)}
                        >
                          <ArrowRight size={16} />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </section>
        </>
      ) : null}
    </Shell>
  )
}

function groupSubtasks(subtasks: Subtask[]) {
  return columns.reduce<Record<SubtaskStatus, Subtask[]>>(
    (acc, column) => {
      acc[column.status] = subtasks
        .filter((subtask) => subtask.status === column.status)
        .sort((a, b) => a.position - b.position || a.order_index - b.order_index)
      return acc
    },
    { todo: [], in_progress: [], done: [] },
  )
}

function StatusBadge({ status }: { status: Project['status'] }) {
  return <span className={`status-badge ${status}`}>{status}</span>
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="inline-state">
      <Loader2 className="spin" size={18} />
      {label}
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return <p className="error-state">{message}</p>
}

export default App
