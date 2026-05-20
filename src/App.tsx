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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogTitle, DialogClose } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
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
      <div className="flex justify-between min-h-[calc(100vh-70px)]">
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

      <AddProjectModal
        open={modal === 'add-project'}
        onClose={closeModal}
        onSuccess={(id) => { setSelectedId(id); closeModal() }}
      />
      {projectToDelete && (
        <DeleteProjectModal
          open={modal === 'delete-project'}
          project={projectToDelete}
          onClose={closeModal}
          onSuccess={() => {
            if (selectedId === projectToDelete.id) setSelectedId(null)
            closeModal()
          }}
        />
      )}
      {selectedId && (
        <AddSubtaskModal open={modal === 'add-subtask'} projectId={selectedId} onClose={closeModal} />
      )}
      {activeSubtask && (
        <EditSubtaskModal open={modal === 'edit-subtask'} subtask={activeSubtask} onClose={closeModal} />
      )}
      {activeSubtask && (
        <DeleteSubtaskModal open={modal === 'delete-subtask'} subtask={activeSubtask} onClose={closeModal} />
      )}
    </QueryClientProvider>
  )
}

// ── Navbar ────────────────────────────────────────────

function Navbar() {
  return (
    <nav className="flex justify-between items-center px-4 py-4 border-b-[1.5px] border-border">
      <div className="flex items-center pl-2">
        <a href="/"><img src="/cookie-ai-logo.png" alt="Cookie AI" className="w-[35px] h-[35px]" /></a>
        <ul className="flex items-center pt-0.5 pl-6 m-0 list-none gap-0">
          {['Calendar', 'To-do List', 'Dashboard'].map((item) => (
            <li key={item} className="px-3 py-2 mr-2 rounded hover:bg-bg-hover transition-colors">
              <a href={`/${item.toLowerCase().replace(' ', '-')}`} className="text-slate text-sm font-medium">{item}</a>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex items-center pr-4">
        <p className="text-slate text-sm">Hi, Jasmine!</p>
        <a href="/account">
          <i className="fa-solid fa-circle-user text-amber text-2xl ml-4"></i>
        </a>
      </div>
    </nav>
  )
}

// ── Left column: Projects ─────────────────────────────

function ProjectsPanel({
  selectedId, onSelect, onAdd, onDelete,
}: {
  selectedId: string | null
  onSelect: (id: string) => void
  onAdd: () => void
  onDelete: (project: Project) => void
}) {
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: listProjects })

  return (
    <div className="flex-[3] p-5 border-r-[1.5px] border-border">
      <div className="flex justify-between items-center pb-6 pl-1 pt-1">
        <h2 className="text-navy font-semibold text-lg pt-0.5">Projects</h2>
        <button className="bg-transparent border-none p-0 cursor-pointer leading-none" onClick={onAdd} aria-label="Add project">
          <i className="fa-solid fa-circle-plus text-[30px] text-blue hover:text-blue-dark transition-colors"></i>
        </button>
      </div>
      <div className="flex flex-col">
        {projects.map((project) => (
          <div key={project.id} className="relative h-[50px] mb-1">
            <button
              className={cn(
                'absolute inset-0 w-full h-full border-none rounded-[10px] flex items-center cursor-pointer transition-colors',
                selectedId === project.id ? 'bg-active-blue' : 'bg-white hover:bg-active-blue/25'
              )}
              onClick={() => onSelect(project.id)}
            >
              <p className="text-sm text-navy mx-0 ml-2.5 mr-10 whitespace-nowrap overflow-hidden text-ellipsis text-left">{project.title}</p>
            </button>
            <button
              className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer p-1.5 leading-none z-10"
              onClick={(e) => { e.stopPropagation(); onDelete(project) }}
              aria-label="Delete project"
            >
              <i className="fa-regular fa-trash-can text-slate-light hover:text-red transition-colors"></i>
            </button>
          </div>
        ))}
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
      syncedIdRef.current = null
      qc.setQueryData(['projects', projectId], updated)
      qc.invalidateQueries({ queryKey: ['projects'] })
    },
  })

  function handleTitleBlur() {
    setEditingTitle(false)
    if (project && titleValue !== project.title) updateMutation.mutate({ title: titleValue })
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
    <div className="flex-[8] p-5">
      <div className="w-[95%] mx-auto">
        {/* Logo lockup */}
        <div className="flex items-center">
          <img src="/cookie-ai-logo.png" alt="" className="w-5 h-5 my-2.5 mr-2.5" />
          <span className="text-xl font-semibold pt-2 text-navy">Cookie AI</span>
        </div>

        {/* Project header */}
        <div className="pb-2.5">
          {/* Title */}
          <div className="relative inline-block">
            {editingTitle ? (
              <input
                type="text"
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                onBlur={handleTitleBlur}
                onKeyDown={handleTitleKeyDown}
                autoFocus
                className="w-[500px] my-5 mb-[18.5px] outline-none border-none border-b-[1.5px] border-border text-navy text-xl font-semibold bg-transparent block"
              />
            ) : (
              <h2
                className={cn('text-xl font-semibold py-5 leading-snug', noProject ? 'text-slate-faint cursor-default' : 'text-navy cursor-pointer')}
                onClick={() => !noProject && setEditingTitle(true)}
              >
                {noProject ? 'Select a project' : (titleValue || '...')}
              </h2>
            )}
          </div>

          {/* Description row */}
          <div className="flex pb-5 w-full">
            <div className="shrink-0">
              <p className="text-sm text-navy pr-5 leading-6 whitespace-nowrap">Description</p>
            </div>
            <div className="w-full">
              {editingDesc ? (
                <textarea
                  rows={1}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={() => setEditingDesc(false)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) (e.target as HTMLTextAreaElement).blur() }}
                  autoFocus
                  className="w-[calc(100%-16px)] rounded-md px-2 py-1 leading-6 text-slate-light text-sm resize-y border-[1.5px] border-border outline-none"
                />
              ) : (
                <p
                  className={cn('leading-6 text-sm min-h-6 cursor-pointer', description ? 'text-slate-light' : 'text-slate-faint')}
                  onClick={() => !noProject && setEditingDesc(true)}
                >
                  {description || 'Add a description'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Instructions textarea */}
        <textarea
          className="block w-[calc(100%-30px)] h-[300px] px-[15px] py-2.5 rounded-lg border-[1.5px] border-border shadow-[0_3px_5px_rgba(0,0,0,0.04)] resize-none text-sm leading-[26px] text-navy outline-none placeholder:text-slate-faint disabled:bg-bg-hover disabled:cursor-not-allowed"
          placeholder="Paste in your assignment instructions."
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          onBlur={handleInstructionsBlur}
          disabled={noProject}
        />

        {/* Generate button */}
        <div className="flex items-center gap-3 pt-5">
          <Button
            onClick={() => redecomposeMutation.mutate()}
            disabled={noProject || redecomposeMutation.isPending}
          >
            <i className="fa-solid fa-wand-magic-sparkles text-sm pr-2.5 text-white"></i>
            <p className="text-sm font-medium m-0">{redecomposeMutation.isPending ? 'Generating...' : 'Generate subtasks'}</p>
          </Button>
          {redecomposeMutation.isError && (
            <p className="text-red text-[13px]">Generation failed. Try again.</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Right column: Subtasks ────────────────────────────

function SubtasksPanel({
  projectId, onAdd, onEdit, onDelete,
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
    <div className="flex-[4] p-5 border-l-[1.5px] border-border">
      <div className="w-[95%] mx-auto">
        <div className="flex justify-between items-center pb-5 text-xs font-medium text-slate">
          <div className="flex items-center">
            <i className="fa-solid fa-wand-magic-sparkles pr-2.5 text-slate-faint"></i>
            <p className="text-slate-faint pt-0.5 text-xs">AI-generated subtasks</p>
          </div>
        </div>

        <div className="w-[350px] max-h-[550px] overflow-y-auto pb-5 mb-5">
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
          <Button onClick={onAdd}>
            <i className="fa-solid fa-plus text-sm pr-2.5 text-white"></i>
            <span className="font-medium text-sm">Add a subtask</span>
          </Button>
        )}
      </div>
    </div>
  )
}

function SubtaskCard({ subtask, onEdit, onDelete }: { subtask: Subtask; onEdit: () => void; onDelete: () => void }) {
  const priorityKey = DIFFICULTY_TO_PRIORITY[subtask.difficulty] ?? 'medium'
  const priority = PRIORITY_MAP[priorityKey]
  const timeStr = formatTime(subtask.estimated_minutes)

  return (
    <div className="w-[330px] relative flex bg-[#F5F7FA] rounded-lg overflow-hidden mb-5">
      <div className="absolute left-0 top-0 bottom-0 w-2.5 bg-blue-border rounded-tl-lg rounded-bl-lg shrink-0"></div>
      <div className="py-[15px] pr-5 pl-[25px] grow min-w-0">
        <p className="text-sm font-semibold leading-5 text-navy">{subtask.title}</p>
        <p className="text-xs leading-5 py-[5px] pb-[15px] text-slate-light">{subtask.description}</p>
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <p className="text-xs font-medium rounded-[3px] px-2.5 py-[3px] mr-3" style={{ backgroundColor: priority.bg, color: priority.color }}>
              {priority.label}
            </p>
            <div className="flex items-center">
              <i className="fa-regular fa-clock text-slate-light text-xs"></i>
              <p className="text-slate-light text-xs pl-1.5 m-0"><span>{timeStr}</span> estimated</p>
            </div>
          </div>
          <div className="flex items-center">
            <i className="fa-regular fa-pen-to-square pl-2.5 text-[15px] text-slate-faint hover:text-navy transition-colors cursor-pointer" onClick={onEdit}></i>
            <i className="fa-regular fa-trash-can pl-2.5 text-[15px] text-slate-faint hover:text-red transition-colors cursor-pointer" onClick={onDelete}></i>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Modal helpers ─────────────────────────────────────

function ModalHeader({ title, onClose, disabled }: { title: string; onClose: () => void; disabled?: boolean }) {
  return (
    <div className="flex justify-between items-start mb-5">
      <DialogTitle className="text-navy text-xl font-semibold">{title}</DialogTitle>
      <DialogClose asChild>
        <button
          onClick={onClose}
          disabled={disabled}
          className="bg-transparent border-none w-10 h-10 rounded-full translate-x-5 -translate-y-5 cursor-pointer flex items-center justify-center hover:bg-border transition-colors disabled:opacity-60"
        >
          <i className="fa-solid fa-xmark text-[22px] text-navy"></i>
        </button>
      </DialogClose>
    </div>
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p className="text-xs text-red-dark pb-1 mt-1 m-0">
      <i className="fa-solid fa-exclamation-circle mr-1"></i>{message}
    </p>
  )
}

function ModalButtons({ confirmLabel, onClose, onConfirm, danger, disabled }: {
  confirmLabel: string
  onClose: () => void
  onConfirm?: () => void
  danger?: boolean
  disabled?: boolean
}) {
  return (
    <div className="flex gap-2.5 mt-2.5">
      <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} disabled={disabled}>{confirmLabel}</Button>
      <Button variant="secondary" onClick={onClose} disabled={disabled}>Cancel</Button>
    </div>
  )
}

// ── Add Project modal ─────────────────────────────────

function AddProjectModal({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: (id: string) => void }) {
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
    <Dialog open={open} onOpenChange={(o) => { if (!o && !pending) onClose() }}>
      <DialogContent>
        <ModalHeader title="Add Project" onClose={onClose} disabled={pending} />
        <div className="mb-2.5">
          <Input
            placeholder="Project Name"
            value={name}
            onChange={(e) => { setName(e.target.value); setNameError('') }}
            error={!!nameError}
            disabled={pending}
          />
          <FieldError message={nameError} />
        </div>
        <ModalButtons confirmLabel={pending ? 'Adding...' : 'Add Project'} onClose={onClose} onConfirm={handleSubmit} disabled={pending} />
      </DialogContent>
    </Dialog>
  )
}

// ── Delete Project modal ──────────────────────────────

function DeleteProjectModal({ open, project, onClose, onSuccess }: { open: boolean; project: Project; onClose: () => void; onSuccess: () => void }) {
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => deleteProject(project.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); onSuccess() },
  })

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent narrow>
        <ModalHeader title="Delete project" onClose={onClose} />
        <p className="text-navy text-sm leading-5 mb-5">
          Once deleted, this project will no longer be accessible. This process cannot be undone.
        </p>
        <ModalButtons confirmLabel="Delete" onClose={onClose} onConfirm={() => mutation.mutate()} danger disabled={mutation.isPending} />
      </DialogContent>
    </Dialog>
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
      <div className="mb-2.5">
        <Input placeholder="Subtask name" value={name} onChange={(e) => setName(e.target.value)} error={!!nameError} />
        <FieldError message={nameError} />
      </div>
      <div className="mb-2.5">
        <Textarea placeholder="Subtask description" value={desc} onChange={(e) => setDesc(e.target.value)} className="h-[100px] leading-[22px]" />
      </div>
      <div className="flex items-center pb-5 gap-1 pt-1">
        <i className="fa-solid fa-fire text-[#FF7452] text-lg pr-1 pt-1"></i>
        <select
          className="bg-bg-hover border-none rounded-[3px] text-sm font-medium text-slate px-2 py-1 mx-1 cursor-pointer"
          value={priority}
          onChange={(e) => setPriority(e.target.value as Priority)}
        >
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>
      <div className="flex items-center gap-1 pb-5">
        <i className="fa-solid fa-stopwatch text-slate-faint"></i>
        <select className="bg-bg-hover border-none rounded-[3px] text-sm font-medium text-slate px-2 py-1 mx-1 cursor-pointer" value={hours} onChange={(e) => setHours(Number(e.target.value))}>
          {[0, 1, 2, 3, 4, 5].map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
        <span className="text-slate-faint text-sm">hours</span>
        <select className="bg-bg-hover border-none rounded-[3px] text-sm font-medium text-slate px-2 py-1 mx-1 cursor-pointer" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
          {[0, 15, 30, 45].map((m) => <option key={m} value={m}>{String(m).padStart(2, '0')}</option>)}
        </select>
        <span className="text-slate-faint text-sm">minutes</span>
      </div>
    </>
  )
}

// ── Add Subtask modal ─────────────────────────────────

function AddSubtaskModal({ open, projectId, onClose }: { open: boolean; projectId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [hours, setHours] = useState(0)
  const [mins, setMins] = useState(0)
  const [nameError, setNameError] = useState('')

  const mutation = useMutation({
    mutationFn: () => createSubtask(projectId, {
      title: name, description: desc,
      estimated_minutes: hours * 60 + mins,
      difficulty: PRIORITY_TO_DIFFICULTY[priority],
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects', projectId] }); onClose() },
  })

  function handleSubmit() {
    if (!name.trim()) { setNameError('Subtask name is required'); return }
    mutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent>
        <ModalHeader title="Add a subtask" onClose={onClose} />
        <SubtaskFormFields
          name={name} setName={(v) => { setName(v); setNameError('') }} nameError={nameError}
          desc={desc} setDesc={setDesc}
          priority={priority} setPriority={setPriority}
          hours={hours} setHours={setHours}
          minutes={mins} setMinutes={setMins}
        />
        <ModalButtons confirmLabel={mutation.isPending ? 'Adding...' : 'Add Subtask'} onClose={onClose} onConfirm={handleSubmit} disabled={mutation.isPending} />
      </DialogContent>
    </Dialog>
  )
}

// ── Edit Subtask modal ────────────────────────────────

function EditSubtaskModal({ open, subtask, onClose }: { open: boolean; subtask: Subtask; onClose: () => void }) {
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
      title: name, description: desc,
      estimated_minutes: hours * 60 + mins,
      difficulty: PRIORITY_TO_DIFFICULTY[priority],
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); onClose() },
  })

  function handleSubmit() {
    if (!name.trim()) { setNameError('Subtask name is required'); return }
    mutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent>
        <ModalHeader title="Edit subtask" onClose={onClose} />
        <SubtaskFormFields
          name={name} setName={(v) => { setName(v); setNameError('') }} nameError={nameError}
          desc={desc} setDesc={setDesc}
          priority={priority} setPriority={setPriority}
          hours={hours} setHours={setHours}
          minutes={mins} setMinutes={setMins}
        />
        <ModalButtons confirmLabel={mutation.isPending ? 'Saving...' : 'Save Changes'} onClose={onClose} onConfirm={handleSubmit} disabled={mutation.isPending} />
      </DialogContent>
    </Dialog>
  )
}

// ── Delete Subtask modal ──────────────────────────────

function DeleteSubtaskModal({ open, subtask, onClose }: { open: boolean; subtask: Subtask; onClose: () => void }) {
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => deleteSubtask(subtask.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); onClose() },
  })

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent narrow>
        <ModalHeader title="Delete subtask" onClose={onClose} />
        <p className="text-navy text-sm leading-5 mb-5">
          Once deleted, this subtask will no longer be accessible. This process cannot be undone.
        </p>
        <ModalButtons confirmLabel="Delete" onClose={onClose} onConfirm={() => mutation.mutate()} danger disabled={mutation.isPending} />
      </DialogContent>
    </Dialog>
  )
}

export default App
