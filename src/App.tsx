import { useEffect, useRef, useState } from 'react'
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createProject,
  createSubtask,
  deleteProject,
  deleteSubtask,
  getProject,
  listProjects,
  redecomposeProject,
  updateProject,
  updateSubtask,
} from './api'
import type { Project, Subtask } from './api'
import './App.css'

const queryClient = new QueryClient()

type ModalType = null | 'add-project' | 'delete-project' | 'add-subtask' | 'edit-subtask' | 'delete-subtask'
type Priority = 'critical' | 'high' | 'medium' | 'low'

const PRIORITY_MAP: Record<Priority, { label: string; bg: string; color: string }> = {
  critical: { label: 'Critical', bg: '#F87168', color: '#5D1F1A' },
  high:     { label: 'High',     bg: '#FEA363', color: '#702E00' },
  medium:   { label: 'Medium',   bg: '#F6CC47', color: '#533F03' },
  low:      { label: 'Low',      bg: '#4CCE97', color: '#174B35' },
}

const DIFFICULTY_TO_PRIORITY: Record<string, Priority> = {
  easy: 'low',
  medium: 'medium',
  hard: 'high',
}

const PRIORITY_TO_DIFFICULTY: Record<Priority, 'easy' | 'medium' | 'hard'> = {
  critical: 'hard',
  high: 'hard',
  medium: 'medium',
  low: 'easy',
}

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function App() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalType>(null)
  const [activeSubtask, setActiveSubtask] = useState<Subtask | null>(null)
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)

  function closeModal() {
    setModal(null)
    setActiveSubtask(null)
    setProjectToDelete(null)
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Navbar />
      <div className="columns">
        <ProjectsPanel
          selectedId={selectedId}
          onSelect={setSelectedId}
          onAdd={() => setModal('add-project')}
          onDelete={(p) => { setProjectToDelete(p); setModal('delete-project') }}
        />
        <InstructionsPanel projectId={selectedId} />
        <SubtasksPanel
          projectId={selectedId}
          onAdd={() => setModal('add-subtask')}
          onEdit={(s) => { setActiveSubtask(s); setModal('edit-subtask') }}
          onDelete={(s) => { setActiveSubtask(s); setModal('delete-subtask') }}
        />
      </div>

      {modal === 'add-project' && (
        <AddProjectModal
          onClose={closeModal}
          onSuccess={(id) => { setSelectedId(id); closeModal() }}
        />
      )}
      {modal === 'delete-project' && projectToDelete && (
        <DeleteProjectModal
          project={projectToDelete}
          onClose={closeModal}
          onSuccess={() => {
            if (selectedId === projectToDelete.id) setSelectedId(null)
            closeModal()
          }}
        />
      )}
      {modal === 'add-subtask' && selectedId && (
        <AddSubtaskModal projectId={selectedId} onClose={closeModal} />
      )}
      {modal === 'edit-subtask' && activeSubtask && (
        <EditSubtaskModal subtask={activeSubtask} onClose={closeModal} />
      )}
      {modal === 'delete-subtask' && activeSubtask && (
        <DeleteSubtaskModal subtask={activeSubtask} onClose={closeModal} />
      )}
    </QueryClientProvider>
  )
}

// ── Navbar ────────────────────────────────────────────

function Navbar() {
  return (
    <nav className="navbar">
      <div className="navbar-left">
        <a href="/"><img src="/cookie-ai-logo.png" alt="Cookie AI" className="logo-img" /></a>
        <ul>
          <li><a href="/calendar">Calendar</a></li>
          <li><a href="/to-do">To-do List</a></li>
          <li><a href="/dashboard">Dashboard</a></li>
        </ul>
      </div>
      <div className="navbar-right">
        <p className="nav-greeting">Hi, Jasmine!</p>
        <a href="/account">
          <i className="fa-solid fa-circle-user nav-user-icon"></i>
        </a>
      </div>
    </nav>
  )
}

// ── Left column: Projects ─────────────────────────────

function ProjectsPanel({
  selectedId,
  onSelect,
  onAdd,
  onDelete,
}: {
  selectedId: string | null
  onSelect: (id: string) => void
  onAdd: () => void
  onDelete: (project: Project) => void
}) {
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: listProjects,
  })

  return (
    <div className="project-column">
      <div className="projects">
        <div className="header">
          <h2>Projects</h2>
          <button className="add-project" onClick={onAdd} aria-label="Add project">
            <i className="fa-solid fa-circle-plus"></i>
          </button>
        </div>
        <div className="projects-container">
          {projects.map((project) => (
            <div className="project-item" key={project.id}>
              <button
                className={`title${selectedId === project.id ? ' active' : ''}`}
                onClick={() => onSelect(project.id)}
              >
                <p>{project.title}</p>
              </button>
              <button
                className="delete-button"
                onClick={(e) => { e.stopPropagation(); onDelete(project) }}
                aria-label="Delete project"
              >
                <i className="fa-regular fa-trash-can"></i>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Middle column: Instructions ───────────────────────

function InstructionsPanel({ projectId }: { projectId: string | null }) {
  const qc = useQueryClient()

  const { data: project } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => getProject(projectId!),
    enabled: Boolean(projectId),
  })

  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState('')
  const [description, setDescription] = useState('')
  const [editingDesc, setEditingDesc] = useState(false)
  const [instructions, setInstructions] = useState('')

  // Track which project's data is currently reflected in local state
  const syncedIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!projectId) {
      setTitleValue('')
      setInstructions('')
      setDescription('')
      syncedIdRef.current = null
    }
  }, [projectId])

  useEffect(() => {
    if (project && project.id !== syncedIdRef.current) {
      setTitleValue(project.title)
      setInstructions(project.raw_instructions ?? '')
      syncedIdRef.current = project.id
    }
  }, [project])

  const updateMutation = useMutation({
    mutationFn: (payload: { title?: string; raw_instructions?: string }) =>
      updateProject(projectId!, payload),
    onSuccess: (updated) => {
      qc.setQueryData(['projects', projectId], updated)
      qc.invalidateQueries({ queryKey: ['projects'] })
    },
  })

  const redecomposeMutation = useMutation({
    mutationFn: () => redecomposeProject(projectId!),
    onSuccess: (updated) => {
      syncedIdRef.current = null // allow re-sync after redecompose
      qc.setQueryData(['projects', projectId], updated)
      qc.invalidateQueries({ queryKey: ['projects'] })
    },
  })

  function handleTitleBlur() {
    setEditingTitle(false)
    if (project && titleValue !== project.title) {
      updateMutation.mutate({ title: titleValue })
    }
  }

  function handleTitleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
    if (e.key === 'Escape') { setTitleValue(project?.title ?? ''); setEditingTitle(false) }
  }

  function handleInstructionsBlur() {
    if (project && instructions !== (project.raw_instructions ?? '')) {
      updateMutation.mutate({ raw_instructions: instructions })
    }
  }

  const noProject = !projectId

  return (
    <div className="instruction-column">
      <div className="instructions">
        <div className="wrapper">
          {/* Logo lockup */}
          <div className="logo">
            <img src="/cookie-ai-logo.png" alt="" />
            <span>Cookie AI</span>
          </div>

          {/* Project header */}
          <div className="header">
            <div className="title-container">
              {editingTitle ? (
                <input
                  type="text"
                  value={titleValue}
                  onChange={(e) => setTitleValue(e.target.value)}
                  onBlur={handleTitleBlur}
                  onKeyDown={handleTitleKeyDown}
                  autoFocus
                />
              ) : (
                <h2
                  className={noProject ? 'placeholder' : ''}
                  onClick={() => !noProject && setEditingTitle(true)}
                >
                  {noProject ? 'Select a project' : (titleValue || '...')}
                </h2>
              )}
            </div>

            <div className="desc">
              <div className="left"><p>Description</p></div>
              <div className="right">
                {editingDesc ? (
                  <textarea
                    rows={1}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    onBlur={() => setEditingDesc(false)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) (e.target as HTMLTextAreaElement).blur()
                    }}
                    autoFocus
                  />
                ) : (
                  <p
                    className={`description${!description ? ' placeholder' : ''}`}
                    onClick={() => !noProject && setEditingDesc(true)}
                  >
                    {description || 'Add a description'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Instruction textarea */}
          <textarea
            className="instruction"
            placeholder="Paste in your assignment instructions."
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            onBlur={handleInstructionsBlur}
            disabled={noProject}
          />

          {/* Generate button */}
          <div className="generate">
            <button
              className="generate-button"
              onClick={() => redecomposeMutation.mutate()}
              disabled={noProject || redecomposeMutation.isPending}
            >
              <i className="fa-solid fa-wand-magic-sparkles"></i>
              <p>{redecomposeMutation.isPending ? 'Generating...' : 'Generate subtasks'}</p>
            </button>
            {redecomposeMutation.isError && (
              <p className="error">Generation failed. Try again.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Right column: Subtasks ────────────────────────────

function SubtasksPanel({
  projectId,
  onAdd,
  onEdit,
  onDelete,
}: {
  projectId: string | null
  onAdd: () => void
  onEdit: (subtask: Subtask) => void
  onDelete: (subtask: Subtask) => void
}) {
  const { data: project } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => getProject(projectId!),
    enabled: Boolean(projectId),
  })

  const subtasks = project?.subtasks ?? []

  return (
    <div className="subtask-column">
      <div className="subtasks">
        <div className="wrapper">
          <div className="header">
            <div className="title">
              <i className="fa-solid fa-wand-magic-sparkles"></i>
              <p>AI-generated subtasks</p>
            </div>
          </div>

          <div className="subtasks-container">
            {subtasks.map((subtask) => (
              <SubtaskCard
                key={subtask.id}
                subtask={subtask}
                onEdit={() => onEdit(subtask)}
                onDelete={() => onDelete(subtask)}
              />
            ))}
          </div>

          {subtasks.length > 0 && (
            <button className="add-task-button" onClick={onAdd}>
              <i className="fa-solid fa-plus"></i>
              <span>Add a subtask</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function SubtaskCard({
  subtask,
  onEdit,
  onDelete,
}: {
  subtask: Subtask
  onEdit: () => void
  onDelete: () => void
}) {
  const priorityKey = DIFFICULTY_TO_PRIORITY[subtask.difficulty] ?? 'medium'
  const priority = PRIORITY_MAP[priorityKey]
  const timeStr = formatTime(subtask.estimated_minutes)

  return (
    <div className="subtask">
      <div className="stripe"></div>
      <div className="wrapper">
        <p className="title">{subtask.title}</p>
        <p className="description">{subtask.description}</p>
        <div className="tools">
          <div className="priority">
            <p className="level" style={{ backgroundColor: priority.bg, color: priority.color }}>
              {priority.label}
            </p>
            <div className="time">
              <i className="fa-regular fa-clock"></i>
              <p><span>{timeStr}</span> estimated</p>
            </div>
          </div>
          <div className="edit">
            <i className="fa-regular fa-pen-to-square" onClick={onEdit}></i>
            <i className="fa-regular fa-trash-can" onClick={onDelete}></i>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Shared popup wrapper ──────────────────────────────

function Popup({
  onClose,
  narrow = false,
  locked = false,
  children,
}: {
  onClose: () => void
  narrow?: boolean
  locked?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="popup-overlay" onClick={locked ? undefined : onClose}>
      <div
        className={`popup-content${narrow ? ' popup-narrow' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

// ── Add Project modal ─────────────────────────────────

function AddProjectModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: (id: string) => void
}) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState('')

  const mutation = useMutation({
    mutationFn: () => createProject({ title: name }),
    onSuccess: (project) => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      onSuccess(project.id)
    },
  })

  function handleSubmit() {
    if (!name.trim()) { setNameError('Project name is required'); return }
    mutation.mutate()
  }

  const pending = mutation.isPending

  return (
    <Popup onClose={onClose} locked={pending}>
      <div className="top">
        <h2>Add Project</h2>
        <button className="close" onClick={onClose} disabled={pending}><i className="fa-solid fa-xmark"></i></button>
      </div>
      <div className="field">
        <input
          type="text"
          placeholder="Project Name"
          value={name}
          onChange={(e) => { setName(e.target.value); setNameError('') }}
          className={nameError ? 'field-error' : ''}
          disabled={pending}
        />
        {nameError && <p className="error-message"><i className="fa-solid fa-exclamation-circle"></i>{nameError}</p>}
      </div>
      <div className="buttons">
        <button className="confirm-button" onClick={handleSubmit} disabled={pending}>
          {pending ? 'Adding...' : 'Add Project'}
        </button>
        <button className="cancel-button" onClick={onClose} disabled={pending}>Cancel</button>
      </div>
    </Popup>
  )
}

// ── Delete Project modal ──────────────────────────────

function DeleteProjectModal({
  project,
  onClose,
  onSuccess,
}: {
  project: Project
  onClose: () => void
  onSuccess: () => void
}) {
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => deleteProject(project.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      onSuccess()
    },
  })

  return (
    <Popup onClose={onClose} narrow>
      <div className="top">
        <h2>Delete project</h2>
        <button className="close" onClick={onClose}><i className="fa-solid fa-xmark"></i></button>
      </div>
      <p className="delete-warning">
        Once deleted, this project will no longer be accessible. This process cannot be undone.
      </p>
      <div className="buttons">
        <button className="confirm-button delete-confirm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          Delete
        </button>
        <button className="cancel-button" onClick={onClose}>Cancel</button>
      </div>
    </Popup>
  )
}

// ── Shared subtask form fields ────────────────────────

function SubtaskFormFields({
  name, setName, nameError,
  desc, setDesc,
  priority, setPriority,
  hours, setHours,
  minutes, setMinutes,
}: {
  name: string; setName: (v: string) => void; nameError?: string
  desc: string; setDesc: (v: string) => void
  priority: Priority; setPriority: (v: Priority) => void
  hours: number; setHours: (v: number) => void
  minutes: number; setMinutes: (v: number) => void
}) {
  return (
    <>
      <div className="field">
        <input
          type="text"
          placeholder="Subtask name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={nameError ? 'field-error' : ''}
        />
        {nameError && <p className="error-message"><i className="fa-solid fa-exclamation-circle"></i>{nameError}</p>}
      </div>
      <div className="field">
        <textarea
          placeholder="Subtask description"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
        />
      </div>
      <div className="priority-row">
        <i className="fa-solid fa-fire"></i>
        <select
          className="level-select"
          value={priority}
          onChange={(e) => setPriority(e.target.value as Priority)}
        >
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>
      <div className="time-row">
        <i className="fa-solid fa-stopwatch"></i>
        <select value={hours} onChange={(e) => setHours(Number(e.target.value))}>
          {[0, 1, 2, 3, 4, 5].map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
        <span>hours</span>
        <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
          {[0, 15, 30, 45].map((m) => <option key={m} value={m}>{String(m).padStart(2, '0')}</option>)}
        </select>
        <span>minutes</span>
      </div>
    </>
  )
}

// ── Add Subtask modal ─────────────────────────────────

function AddSubtaskModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [hours, setHours] = useState(0)
  const [mins, setMins] = useState(0)
  const [nameError, setNameError] = useState('')

  const mutation = useMutation({
    mutationFn: () => createSubtask(projectId, {
      title: name,
      description: desc,
      estimated_minutes: hours * 60 + mins,
      difficulty: PRIORITY_TO_DIFFICULTY[priority],
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', projectId] })
      onClose()
    },
  })

  function handleSubmit() {
    if (!name.trim()) { setNameError('Subtask name is required'); return }
    mutation.mutate()
  }

  return (
    <Popup onClose={onClose}>
      <div className="top">
        <h2>Add a subtask</h2>
        <button className="close" onClick={onClose}><i className="fa-solid fa-xmark"></i></button>
      </div>
      <SubtaskFormFields
        name={name} setName={(v) => { setName(v); setNameError('') }} nameError={nameError}
        desc={desc} setDesc={setDesc}
        priority={priority} setPriority={setPriority}
        hours={hours} setHours={setHours}
        minutes={mins} setMinutes={setMins}
      />
      <div className="buttons">
        <button className="confirm-button" onClick={handleSubmit} disabled={mutation.isPending}>
          {mutation.isPending ? 'Adding...' : 'Add Subtask'}
        </button>
        <button className="cancel-button" onClick={onClose}>Cancel</button>
      </div>
    </Popup>
  )
}

// ── Edit Subtask modal ────────────────────────────────

function EditSubtaskModal({ subtask, onClose }: { subtask: Subtask; onClose: () => void }) {
  const qc = useQueryClient()
  const initialPriority = DIFFICULTY_TO_PRIORITY[subtask.difficulty] ?? 'medium'
  const [name, setName] = useState(subtask.title)
  const [desc, setDesc] = useState(subtask.description ?? '')
  const [priority, setPriority] = useState<Priority>(initialPriority)
  const [hours, setHours] = useState(Math.floor(subtask.estimated_minutes / 60))
  const [mins, setMins] = useState(subtask.estimated_minutes % 60)
  const [nameError, setNameError] = useState('')

  const mutation = useMutation({
    mutationFn: () => updateSubtask(subtask.id, {
      title: name,
      description: desc,
      estimated_minutes: hours * 60 + mins,
      difficulty: PRIORITY_TO_DIFFICULTY[priority],
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      onClose()
    },
  })

  function handleSubmit() {
    if (!name.trim()) { setNameError('Subtask name is required'); return }
    mutation.mutate()
  }

  return (
    <Popup onClose={onClose}>
      <div className="top">
        <h2>Edit subtask</h2>
        <button className="close" onClick={onClose}><i className="fa-solid fa-xmark"></i></button>
      </div>
      <SubtaskFormFields
        name={name} setName={(v) => { setName(v); setNameError('') }} nameError={nameError}
        desc={desc} setDesc={setDesc}
        priority={priority} setPriority={setPriority}
        hours={hours} setHours={setHours}
        minutes={mins} setMinutes={setMins}
      />
      <div className="buttons">
        <button className="confirm-button" onClick={handleSubmit} disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving...' : 'Save Changes'}
        </button>
        <button className="cancel-button" onClick={onClose}>Cancel</button>
      </div>
    </Popup>
  )
}

// ── Delete Subtask modal ──────────────────────────────

function DeleteSubtaskModal({ subtask, onClose }: { subtask: Subtask; onClose: () => void }) {
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => deleteSubtask(subtask.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      onClose()
    },
  })

  return (
    <Popup onClose={onClose} narrow>
      <div className="top">
        <h2>Delete subtask</h2>
        <button className="close" onClick={onClose}><i className="fa-solid fa-xmark"></i></button>
      </div>
      <p className="delete-warning">
        Once deleted, this subtask will no longer be accessible. This process cannot be undone.
      </p>
      <div className="buttons">
        <button className="confirm-button delete-confirm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          Delete
        </button>
        <button className="cancel-button" onClick={onClose}>Cancel</button>
      </div>
    </Popup>
  )
}

export default App
