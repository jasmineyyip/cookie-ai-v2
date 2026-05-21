import { useEffect, useRef, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Wand2, Trash2, CirclePlus, Scissors, GitMerge, Check, Download } from 'lucide-react'
import {
  createProject, createSubtask, deleteProject, deleteSubtask,
  getProject, listProjects, redecomposeProject, updateProject, updateSubtask, splitSubtask, reorderSubtasks, mergeSubtasks,
} from './api'
import type { Project, Subtask } from './api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { Navbar } from '@/components/Navbar'
import { SubtaskCardView } from '@/components/SubtaskCardView'
import { SubtaskFormFields, FieldError } from '@/components/SubtaskFormFields'
import type { Priority } from '@/components/SubtaskFormFields'
import { addDraftEntries } from '@/lib/draft-store'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'

import './App.css'

const queryClient = new QueryClient()

type ModalType = null | 'add-project' | 'delete-project' | 'add-subtask' | 'edit-subtask' | 'delete-subtask'


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
        <EditSubtaskModal open={modal === 'edit-subtask'} subtask={activeSubtask} projectId={selectedId!} onClose={closeModal} />
      )}
      {activeSubtask && (
        <DeleteSubtaskModal open={modal === 'delete-subtask'} subtask={activeSubtask} onClose={closeModal} />
      )}
    </QueryClientProvider>
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

  useEffect(() => {
    if (!selectedId && projects.length > 0) onSelect(projects[0].id)
  }, [projects, selectedId, onSelect])

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
                className="absolute right-0 size-7 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded bg-transparent border-none text-muted-foreground hover:text-destructive transition-colors"
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
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => { setEditingDesc(false); handleDescriptionBlur() }}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setDescription(project?.description ?? ''); setEditingDesc(false) } }}
              autoFocus
              className="text-sm h-auto py-1 border-0 border-b rounded-none px-0 shadow-none focus-visible:ring-0"
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
          className="min-h-[260px] max-h-[400px] text-sm leading-relaxed resize-none overflow-y-auto"
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
  const navigate = useNavigate()
  const [showExportConfirm, setShowExportConfirm] = useState(false)

  const { data: project } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => getProject(projectId!),
    enabled: Boolean(projectId),
  })

  const serverSubtasks = project?.subtasks ?? []
  const [orderedSubtasks, setOrderedSubtasks] = useState<Subtask[]>([])

  useEffect(() => { setOrderedSubtasks(serverSubtasks) }, [project?.subtasks]) // eslint-disable-line react-hooks/exhaustive-deps

  const prevIdsRef = useRef<Set<string>>(new Set())
  const [newIds, setNewIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const currentIds = new Set(serverSubtasks.map((s) => String(s.id)))
    const prev = prevIdsRef.current
    prevIdsRef.current = currentIds
    if (prev.size === 0) return
    const appeared = [...currentIds].filter((id) => !prev.has(id))
    if (appeared.length === 0) return
    setNewIds(new Set(appeared))
    const timer = setTimeout(() => setNewIds(new Set()), 3500)
    return () => clearTimeout(timer)
  }, [project?.subtasks])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const [activeId, setActiveId] = useState<string | null>(null)
  const activeSubtask = orderedSubtasks.find((s) => s.id === activeId) ?? null

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = orderedSubtasks.findIndex((s) => s.id === active.id)
    const newIndex = orderedSubtasks.findIndex((s) => s.id === over.id)
    const reordered = arrayMove(orderedSubtasks, oldIndex, newIndex)
    setOrderedSubtasks(reordered)
    reorderSubtasks(projectId!, reordered.map((s, i) => ({ id: s.id, position: i })))
  }

  return (
    <div className="w-[320px] shrink-0 border-l border-border flex flex-col">
      <div className="flex justify-between items-center px-4 py-4">
        <div className="flex items-center gap-2">
          <Wand2 className="size-4 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground">AI-generated subtasks</span>
        </div>
        <Button variant="ghost" size="icon" onClick={onAdd} aria-label="Add subtask" className="text-primary hover:text-primary">
          <CirclePlus className="size-5" />
        </Button>
      </div>
      <Separator />
      <ScrollArea className="flex-1 min-h-0 px-3 py-3">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveId(null)}>
          <SortableContext items={orderedSubtasks.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-3">
              {orderedSubtasks.map((subtask) => (
                <SubtaskCard key={subtask.id} subtask={subtask} isNew={newIds.has(String(subtask.id))} onEdit={() => onEdit(subtask)} onDelete={() => onDelete(subtask)} />
              ))}
            </div>
          </SortableContext>
          <DragOverlay dropAnimation={null}>
            {activeSubtask && (
              <SubtaskCardView subtask={activeSubtask} isNew={newIds.has(String(activeSubtask.id))} onSplit={() => {}} splitPending={false} onEdit={() => {}} onDelete={() => {}} />
            )}
          </DragOverlay>
        </DndContext>
      </ScrollArea>
      {orderedSubtasks.length > 0 && (
        <div className="p-3 border-t border-border">
          <Button className="w-full" onClick={() => setShowExportConfirm(true)}>
            <Download className="size-4" />
            Export subtasks
          </Button>
        </div>
      )}

      <AlertDialog open={showExportConfirm} onOpenChange={setShowExportConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Export to Dashboard?</AlertDialogTitle>
            <AlertDialogDescription>
              {orderedSubtasks.length} subtask{orderedSubtasks.length !== 1 ? 's' : ''} from "{project?.title}" will be added to the Draft column on the Dashboard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              addDraftEntries(orderedSubtasks.map((s) => ({ ...s, id: crypto.randomUUID(), projectName: project?.title ?? 'Untitled' })))
              setShowExportConfirm(false)
              navigate('/dashboard')
            }}>
              Export
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}



function SubtaskCard({ subtask, isNew, onEdit, onDelete }: { subtask: Subtask; isNew?: boolean; onEdit: () => void; onDelete: () => void }) {
  const qc = useQueryClient()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: subtask.id })
  const style = {
    transform: transform ? `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)` : undefined,
    transition,
    opacity: isDragging ? 0 : 1,
  }

  const splitMutation = useMutation({
    mutationFn: () => splitSubtask(subtask.id),
    onSuccess: (updated) => {
      qc.setQueryData(['projects', String(updated.id)], updated)
      qc.invalidateQueries({ queryKey: ['projects', String(updated.id)] })
    },
  })

  return (
    <div ref={setNodeRef} style={style}>
      <SubtaskCardView
        subtask={subtask} isNew={isNew}
        onSplit={() => splitMutation.mutate()} splitPending={splitMutation.isPending}
        onEdit={onEdit} onDelete={onDelete}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
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
      priority,
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

function EditSubtaskModal({ open, subtask, projectId, onClose }: { open: boolean; subtask: Subtask; projectId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState(subtask.title)
  const [desc, setDesc] = useState(subtask.description ?? '')
  const [priority, setPriority] = useState<Priority>(subtask.priority)
  const [hours, setHours] = useState(Math.floor(subtask.estimated_minutes / 60))
  const [mins, setMins] = useState(subtask.estimated_minutes % 60)
  const [nameError, setNameError] = useState('')
  const [showMerge, setShowMerge] = useState(false)

  useEffect(() => {
    setName(subtask.title)
    setDesc(subtask.description ?? '')
    setPriority(subtask.priority)
    setHours(Math.floor(subtask.estimated_minutes / 60))
    setMins(subtask.estimated_minutes % 60)
    setNameError('')
  }, [subtask])

  const mutation = useMutation({
    mutationFn: () => updateSubtask(subtask.id, {
      title: name, description: desc,
      estimated_minutes: hours * 60 + mins,
      priority,
    }),
    onSuccess: async (updatedSubtask) => {
      qc.setQueryData<Project>(['projects', projectId], (old) => {
        if (!old) return old
        return { ...old, subtasks: old.subtasks.map((s) => s.id === updatedSubtask.id ? updatedSubtask : s) }
      })
      onClose()
      await qc.refetchQueries({ queryKey: ['projects', projectId] })
    },
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
    <>
      <Dialog open={open && !showMerge} onOpenChange={(o) => { if (!o && !busy) onClose() }}>
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
            <button
              className="flex items-center gap-1 text-xs text-slate hover:underline w-fit disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={busy}
              onClick={() => setShowMerge(true)}
            >
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
      <MergeSubtasksModal
        open={showMerge}
        currentSubtask={subtask}
        projectId={projectId}
        onClose={() => setShowMerge(false)}
        onSuccess={(updated) => {
          qc.setQueryData(['projects', projectId], updated)
          qc.invalidateQueries({ queryKey: ['projects', projectId] })
          setShowMerge(false)
          onClose()
        }}
      />
    </>
  )
}

// ── Merge Subtasks modal ──────────────────────────────

function MergeSubtasksModal({ open, currentSubtask, projectId, onClose, onSuccess }: {
  open: boolean
  currentSubtask: Subtask
  projectId: string
  onClose: () => void
  onSuccess: (updated: Project) => void
}) {
  const { data: project } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => getProject(projectId),
    enabled: open,
  })

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set([currentSubtask.id]))

  useEffect(() => {
    if (open) setSelectedIds(new Set([currentSubtask.id]))
  }, [open, currentSubtask.id])

  function toggle(id: string) {
    if (id === currentSubtask.id) return
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const mutation = useMutation({
    mutationFn: () => mergeSubtasks(projectId, [...selectedIds]),
    onSuccess,
  })

  const subtasks = project?.subtasks ?? []
  const canMerge = selectedIds.size >= 2

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !mutation.isPending) onClose() }}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Merge subtasks</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-2">Select which subtasks to merge together. Cookie will combine them into one.</p>
        <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto">
          {subtasks.map((subtask) => {
            const selected = selectedIds.has(subtask.id)
            const isCurrent = subtask.id === currentSubtask.id
            return (
              <button
                key={subtask.id}
                onClick={() => toggle(subtask.id)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-md border text-left transition-colors',
                  selected ? 'border-primary bg-accent' : 'border-border hover:bg-secondary',
                  isCurrent && 'cursor-default'
                )}
              >
                <div className={cn(
                  'size-4 rounded border flex items-center justify-center shrink-0',
                  selected ? 'bg-primary border-primary' : 'border-input'
                )}>
                  {selected && <Check className="size-3 text-white" />}
                </div>
                <span className="text-sm truncate">{subtask.title}</span>
                {isCurrent && <span className="text-xs text-muted-foreground ml-auto shrink-0">current</span>}
              </button>
            )
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={!canMerge || mutation.isPending}>
            {mutation.isPending ? 'Merging...' : `Merge ${selectedIds.size} subtasks`}
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
