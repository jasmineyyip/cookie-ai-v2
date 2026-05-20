import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Wand2, Trash2, Pencil, Clock, CirclePlus, CircleUserRound, Scissors, GitMerge, Loader2 } from 'lucide-react'
import {
  createProject, createSubtask, deleteProject, deleteSubtask,
  getProject, listProjects, redecomposeProject, updateProject, updateSubtask, splitSubtask,
} from './api'
import type { Project, Subtask } from './api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import './App.css'

const queryClient = new QueryClient()

type ModalType = null | 'add-project' | 'delete-project' | 'add-subtask' | 'edit-subtask' | 'delete-subtask'
type Priority = 'critical' | 'high' | 'medium' | 'low'

const PRIORITY_CONFIG: Record<Priority, { label: string; className: string }> = {
  critical: { label: 'Critical', className: 'bg-[#F87168] text-[#5D1F1A] hover:bg-[#F87168]' },
  high:     { label: 'High',     className: 'bg-[#FEA363] text-[#702E00] hover:bg-[#FEA363]' },
  medium:   { label: 'Medium',   className: 'bg-[#F6CC47] text-[#533F03] hover:bg-[#F6CC47]' },
  low:      { label: 'Low',      className: 'bg-[#4CCE97] text-[#174B35] hover:bg-[#4CCE97]' },
}

const DIFFICULTY_TO_PRIORITY: Record<string, Priority> = {
  easy: 'low', medium: 'medium', hard: 'high',
}

const PRIORITY_TO_DIFFICULTY: Record<Priority, 'easy' | 'medium' | 'hard'> = {
  critical: 'hard', high: 'hard', medium: 'medium', low: 'easy',
}

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function App() {
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedId = searchParams.get('project')
  function setSelectedId(id: string | null) {
    setSearchParams(id ? { project: id } : {}, { replace: true })
  }
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
      <div className="flex h-[calc(100vh-65px)] overflow-hidden">
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

      <AddProjectModal open={modal === 'add-project'} onClose={closeModal}
        onSuccess={(id) => { setSelectedId(id); closeModal() }} />

      {projectToDelete && (
        <DeleteProjectModal open={modal === 'delete-project'} project={projectToDelete}
          onClose={closeModal}
          onSuccess={() => {
          if (selectedId === projectToDelete.id) {
            const projects = queryClient.getQueryData<Project[]>(['projects']) ?? []
            const idx = projects.findIndex((p) => p.id === projectToDelete.id)
            const prev = projects[idx - 1] ?? null
            setSelectedId(prev?.id ?? null)
          }
          closeModal()
        }} />
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
  const links = [
    { label: 'Calendar', href: '/calendar' },
    { label: 'To-do List', href: '/to-do' },
    { label: 'Dashboard', href: '/dashboard' },
  ]
  return (
    <nav className="flex justify-between items-center px-5 h-[65px] border-b border-border bg-background">
      <div className="flex items-center gap-6">
        <a href="/"><img src="/cookie-ai-logo.png" alt="Cookie AI" className="w-8 h-8" /></a>
        <div className="flex items-center gap-1">
          {links.map(({ label, href }) => (
            <Button key={label} variant="ghost" size="sm" asChild>
              <a href={href} className="text-muted-foreground">{label}</a>
            </Button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Hi, Jasmine!</span>
        <a href="/account">
          <CircleUserRound className="size-7 text-amber" />
        </a>
      </div>
    </nav>
  )
}

// ── Left column: Projects ─────────────────────────────

function ProjectsPanel({ selectedId, onSelect, onAdd, onDelete }: {
  selectedId: string | null
  onSelect: (id: string) => void
  onAdd: () => void
  onDelete: (project: Project) => void
}) {
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: listProjects })

  return (
    <div className="w-[240px] shrink-0 border-r border-border flex flex-col">
      <div className="flex justify-between items-center px-4 py-4">
        <h2 className="text-base font-semibold text-foreground">Projects</h2>
        <Button variant="ghost" size="icon" onClick={onAdd} aria-label="Add project" className="text-primary hover:text-primary">
          <CirclePlus className="size-5" />
        </Button>
      </div>
      <Separator />
      <ScrollArea className="flex-1 min-h-0 px-2 py-2">
        <div className="flex flex-col gap-1.5">
          {projects.map((project) => (
            <div key={project.id} className="group relative flex items-center">
              <button
                onClick={() => onSelect(project.id)}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-md text-sm transition-colors truncate pr-8',
                  selectedId === project.id
                    ? 'bg-accent text-foreground font-medium'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                )}
              >
                {project.title}
              </button>
              <button
                className="absolute right-0 size-7 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded bg-transparent border-none"
                style={{ color: '#c7372d' }}
                onClick={(e) => { e.stopPropagation(); onDelete(project) }}
                aria-label="Delete project"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      </ScrollArea>
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
    if (!projectId) { setTitleValue(''); setInstructions(''); setDescription(''); syncedIdRef.current = null }
  }, [projectId])

  useEffect(() => {
    if (project && project.id !== syncedIdRef.current) {
      setTitleValue(project.title)
      setDescription(project.description ?? '')
      setInstructions(project.raw_instructions ?? '')
      syncedIdRef.current = project.id
    }
  }, [project])

  const updateMutation = useMutation({
    mutationFn: (payload: { title?: string; description?: string; raw_instructions?: string }) => updateProject(projectId!, payload),
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

  function handleDescriptionBlur() {
    if (project && description !== (project.description ?? '')) {
      updateMutation.mutate({ description })
    }
  }

  function handleInstructionsBlur() {
    if (project && instructions !== (project.raw_instructions ?? '')) {
      updateMutation.mutate({ raw_instructions: instructions })
    }
  }

  const noProject = !projectId

  return (
    <div className="flex-1 flex flex-col min-w-0 px-8 py-6 overflow-y-auto">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-6">
        <img src="/cookie-ai-logo.png" alt="" className="size-5" />
        <span className="text-base font-semibold text-foreground">Cookie AI</span>
      </div>

      <div className="flex flex-col gap-4 max-w-2xl">
        {/* Title */}
        {editingTitle ? (
          <Input
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={handleTitleKeyDown}
            autoFocus
            className="text-xl font-semibold h-auto py-1 border-0 border-b rounded-none px-0 shadow-none focus-visible:ring-0"
          />
        ) : (
          <h2
            className={cn(
              'text-xl font-semibold leading-tight',
              noProject ? 'text-muted-foreground cursor-default' : 'text-foreground cursor-pointer hover:text-primary transition-colors'
            )}
            onClick={() => !noProject && setEditingTitle(true)}
          >
            {noProject ? 'Select a project' : (titleValue || '...')}
          </h2>
        )}

        {/* Description */}
        <div className="flex items-start gap-4">
          <Label className="text-sm text-muted-foreground pt-0.5 w-24 shrink-0">Description</Label>
          {editingDesc ? (
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => { setEditingDesc(false); handleDescriptionBlur() }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) (e.target as HTMLTextAreaElement).blur() }}
              autoFocus
              className="min-h-0 text-sm"
            />
          ) : (
            <p
              className={cn('text-sm pt-0.5 min-h-5', description ? 'text-muted-foreground' : 'text-muted-foreground/50', !noProject && 'cursor-pointer hover:text-foreground transition-colors')}
              onClick={() => !noProject && setEditingDesc(true)}
            >
              {description || 'Add a description'}
            </p>
          )}
        </div>
      </div>

      <Separator className="my-4" />

      {/* Instructions */}
      <div className="flex flex-col gap-2">
        <Label className="text-sm font-medium">Instructions</Label>
        <Textarea
          placeholder="Paste in your project instructions."
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          onBlur={handleInstructionsBlur}
          disabled={noProject}
          className="min-h-[260px] max-h-[500px] text-sm leading-relaxed resize-none overflow-y-auto"
        />
      </div>

      {/* Generate */}
      <div className="flex items-center gap-3 mt-4">
        <Button
          className="px-6"
          onClick={() => redecomposeMutation.mutate()}
          disabled={noProject || redecomposeMutation.isPending}
        >
          <Wand2 className="size-4" />
          {redecomposeMutation.isPending ? 'Generating...' : 'Generate subtasks'}
        </Button>
        {redecomposeMutation.isError && (
          <p className="text-sm text-destructive">Generation failed. Try again.</p>
        )}
      </div>
    </div>
  )
}

// ── Right column: Subtasks ────────────────────────────

function SubtasksPanel({ projectId, onAdd, onEdit, onDelete }: {
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

  const prevIdsRef = useRef<Set<string>>(new Set())
  const [newIds, setNewIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const currentIds = new Set(subtasks.map((s) => String(s.id)))
    const prev = prevIdsRef.current
    prevIdsRef.current = currentIds
    if (prev.size === 0) return
    const appeared = [...currentIds].filter((id) => !prev.has(id))
    if (appeared.length === 0) return
    setNewIds(new Set(appeared))
    const timer = setTimeout(() => setNewIds(new Set()), 3500)
    return () => clearTimeout(timer)
  }, [subtasks])

  return (
    <div className="w-[320px] shrink-0 border-l border-border flex flex-col">
      <div className="flex items-center gap-2 px-4 py-4">
        <Wand2 className="size-4 text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground">AI-generated subtasks</span>
      </div>
      <Separator />
      <ScrollArea className="flex-1 min-h-0 px-3 py-3">
        <div className="flex flex-col gap-3">
          {subtasks.map((subtask) => (
            <SubtaskCard key={subtask.id} subtask={subtask} isNew={newIds.has(String(subtask.id))} onEdit={() => onEdit(subtask)} onDelete={() => onDelete(subtask)} />
          ))}
        </div>
      </ScrollArea>
      {subtasks.length > 0 && (
        <div className="p-3 border-t border-border">
          <Button className="w-full" onClick={onAdd}>
            <CirclePlus className="size-4" />
            Add a subtask
          </Button>
        </div>
      )}
    </div>
  )
}

function SubtaskCard({ subtask, isNew, onEdit, onDelete }: { subtask: Subtask; isNew?: boolean; onEdit: () => void; onDelete: () => void }) {
  const qc = useQueryClient()
  const priorityKey = DIFFICULTY_TO_PRIORITY[subtask.difficulty] ?? 'medium'
  const { label, className: badgeCls } = PRIORITY_CONFIG[priorityKey]
  const timeStr = formatTime(subtask.estimated_minutes)

  const splitMutation = useMutation({
    mutationFn: () => splitSubtask(subtask.id),
    onSuccess: (updated) => {
      qc.setQueryData(['projects', String(updated.id)], updated)
      qc.refetchQueries({ queryKey: ['projects', String(updated.id)] })
    },
  })

  return (
    <Card className="relative overflow-hidden gap-0 py-0 shadow-none border-border group">
      <div className={cn('absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl', isNew ? 'stripe-new' : 'bg-blue-border')} />
      <CardContent className="pl-5 pr-3 py-3 flex flex-col gap-1.5">
        <p className="text-sm font-semibold text-foreground leading-snug">{subtask.title}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{subtask.description}</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge className={cn('rounded-sm px-2 py-0.5 text-xs font-medium border-0', badgeCls)}>{label}</Badge>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="size-3" />
              <span className="text-xs">{timeStr}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-foreground" disabled={splitMutation.isPending} onClick={() => splitMutation.mutate()}>
              {splitMutation.isPending
                ? <Loader2 className="size-3.5 animate-spin" />
                : <Scissors className="size-3.5" />}
            </Button>
            <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-foreground" onClick={onEdit}>
              <Pencil className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive" onClick={onDelete}>
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Form helpers ──────────────────────────────────────

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <div className="text-xs text-destructive mt-1">{message}</div>
}

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
    <div className="flex flex-col gap-4">
      <div>
        <Label htmlFor="subtask-name" className="mb-1.5 block">Subtask name</Label>
        <Input
          id="subtask-name"
          placeholder="e.g. Write introduction"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={!!nameError}
        />
        <FieldError message={nameError} />
      </div>
      <div>
        <Label htmlFor="subtask-desc" className="mb-1.5 block">Description</Label>
        <Textarea
          id="subtask-desc"
          placeholder="What needs to be done?"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          className="min-h-[80px]"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="mb-1.5 block">Priority</Label>
          <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1.5 block">Time estimate</Label>
          <div className="flex items-center gap-2">
            <Select value={String(hours)} onValueChange={(v) => setHours(Number(v))}>
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[0,1,2,3,4,5].map((h) => <SelectItem key={h} value={String(h)}>{h}h</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={String(minutes)} onValueChange={(v) => setMinutes(Number(v))}>
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[0,15,30,45].map((m) => <SelectItem key={m} value={String(m)}>{String(m).padStart(2,'0')}m</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Add Project modal ─────────────────────────────────

function AddProjectModal({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: (id: string) => void }) {
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState('')

  const mutation = useMutation({
    mutationFn: (title: string) => createProject({ title }),
    onSuccess: (project) => {
      queryClient.setQueryData<Project[]>(['projects'], (old = []) => [...old, project])
      onSuccess(project.id)
    },
  })

  function handleSubmit() {
    if (!name.trim()) { setNameError('Project name is required'); return }
    mutation.mutate(name)
  }

  const pending = mutation.isPending

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !pending) { setName(''); setNameError(''); onClose() } }}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
        </DialogHeader>
        <div>
          <Label htmlFor="project-name" className="mb-3.5 block">Project name</Label>
          <Input
            id="project-name"
            placeholder="e.g. Research paper"
            value={name}
            onChange={(e) => { setName(e.target.value); setNameError('') }}
            aria-invalid={!!nameError}
            disabled={pending}
            autoFocus
          />
          <FieldError message={nameError} />
          {mutation.isError && <p className="text-xs text-destructive mt-1">{String(mutation.error)}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={pending}>
            {pending ? 'Creating...' : 'Create project'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Delete Project (AlertDialog) ──────────────────────

function DeleteProjectModal({ open, project, onClose, onSuccess }: { open: boolean; project: Project; onClose: () => void; onSuccess: () => void }) {
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => deleteProject(project.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); onSuccess() },
  })

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete "{project.title}"?</AlertDialogTitle>
          <AlertDialogDescription>
            This project and all its subtasks will be permanently deleted. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Deleting...' : 'Delete project'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Add subtask</DialogTitle>
        </DialogHeader>
        <SubtaskFormFields
          name={name} setName={(v) => { setName(v); setNameError('') }} nameError={nameError}
          desc={desc} setDesc={setDesc}
          priority={priority} setPriority={setPriority}
          hours={hours} setHours={setHours}
          minutes={mins} setMinutes={setMins}
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? 'Adding...' : 'Add subtask'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Edit Subtask modal ────────────────────────────────

function EditSubtaskModal({ open, subtask, onClose }: { open: boolean; subtask: Subtask; onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState(subtask.title)
  const [desc, setDesc] = useState(subtask.description ?? '')
  const [priority, setPriority] = useState<Priority>(DIFFICULTY_TO_PRIORITY[subtask.difficulty] ?? 'medium')
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

  const splitMutation = useMutation({
    mutationFn: () => splitSubtask(subtask.id),
    onSuccess: (updated) => {
      qc.setQueryData(['projects', updated.id], updated)
      qc.invalidateQueries({ queryKey: ['projects'] })
      onClose()
    },
  })

  const busy = mutation.isPending || splitMutation.isPending

  function handleSubmit() {
    if (!name.trim()) { setNameError('Subtask name is required'); return }
    mutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) onClose() }}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Edit subtask</DialogTitle>
        </DialogHeader>
        <SubtaskFormFields
          name={name} setName={(v) => { setName(v); setNameError('') }} nameError={nameError}
          desc={desc} setDesc={setDesc}
          priority={priority} setPriority={setPriority}
          hours={hours} setHours={setHours}
          minutes={mins} setMinutes={setMins}
        />
        <div className="flex flex-col gap-0.5 mt-0.5">
          <button
            className="flex items-center gap-1 text-xs text-slate hover:underline w-fit disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={busy}
            onClick={() => splitMutation.mutate()}
          >
            <Scissors className="size-3" />
            {splitMutation.isPending ? 'Splitting...' : 'Split this task further'}
          </button>
          <button className="flex items-center gap-1 text-xs text-slate hover:underline w-fit">
            <GitMerge className="size-3" />
            Merge this task with another one
          </button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={busy}>
            {mutation.isPending ? 'Saving...' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Delete Subtask (AlertDialog) ──────────────────────

function DeleteSubtaskModal({ open, subtask, onClose }: { open: boolean; subtask: Subtask; onClose: () => void }) {
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => deleteSubtask(subtask.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); onClose() },
  })

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete subtask?</AlertDialogTitle>
          <AlertDialogDescription>
            "{subtask.title}" will be permanently deleted. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export default App
