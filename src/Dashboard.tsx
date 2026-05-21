import { useEffect, useState } from 'react'
import { Navbar } from '@/components/Navbar'
import { SubtaskCardView } from '@/components/SubtaskCardView'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { getDraftEntries, persistColumns, updateDraftEntry, deleteDraftEntry, type DraftEntry } from '@/lib/draft-store'
import { SubtaskFormFields } from '@/components/SubtaskFormFields'
import type { Priority } from '@/components/SubtaskFormFields'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, closestCenter, useDroppable } from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'

type Column = { id: string; label: string }

const COLUMNS: Column[] = [
  { id: 'draft',       label: 'DRAFT' },
  { id: 'todo',        label: 'TO DO' },
  { id: 'in_progress', label: 'IN PROGRESS' },
  { id: 'done',        label: 'DONE' },
]

function SortableCard({ entry, onEdit, onDelete }: { entry: DraftEntry; onEdit: (entry: DraftEntry) => void; onDelete: (entry: DraftEntry) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: entry.id })
  const style = {
    transform: transform ? `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)` : undefined,
    transition,
    opacity: isDragging ? 0 : 1,
  }
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
      <SubtaskCardView
        subtask={entry}
        projectName={entry.projectName}
        hideSplit
        hideStripe
        onSplit={() => {}}
        onEdit={() => onEdit(entry)}
        onDelete={() => onDelete(entry)}
      />
    </div>
  )
}

function DroppableList({ columnId, items, onEdit, onDelete }: { columnId: string; items: DraftEntry[]; onEdit: (entry: DraftEntry) => void; onDelete: (entry: DraftEntry) => void }) {
  const { setNodeRef } = useDroppable({ id: columnId })
  return (
    <div ref={setNodeRef} className="flex flex-col gap-3 min-h-[40px]">
      <SortableContext items={items.map(e => e.id)} strategy={verticalListSortingStrategy}>
        {items.map(entry => <SortableCard key={entry.id} entry={entry} onEdit={onEdit} onDelete={onDelete} />)}
      </SortableContext>
    </div>
  )
}

function KanbanColumn({ column, items, onEdit, onDelete }: { column: Column; items: DraftEntry[]; onEdit: (entry: DraftEntry) => void; onDelete: (entry: DraftEntry) => void }) {
  return (
    <div className="flex flex-col flex-1 min-w-0 bg-secondary/40 rounded-lg border border-border">
      <div className="px-4 py-3 flex items-center gap-2">
        <span className="text-xs font-semibold text-foreground tracking-wide">{column.label}</span>
        <span className="text-xs text-muted-foreground">·</span>
        <span className="text-xs text-muted-foreground">{items.length}</span>
      </div>
      <Separator />
      <ScrollArea className="flex-1 min-h-0 p-3">
        <DroppableList columnId={column.id} items={items} onEdit={onEdit} onDelete={onDelete} />
      </ScrollArea>
    </div>
  )
}

function DashboardEditModal({ entry, onClose, onSave }: {
  entry: DraftEntry
  onClose: () => void
  onSave: (updated: DraftEntry) => void
}) {
  const [name, setName] = useState(entry.title)
  const [desc, setDesc] = useState(entry.description ?? '')
  const [priority, setPriority] = useState<Priority>(entry.priority)
  const [hours, setHours] = useState(Math.floor(entry.estimated_minutes / 60))
  const [mins, setMins] = useState(entry.estimated_minutes % 60)
  const [nameError, setNameError] = useState('')

  useEffect(() => {
    setName(entry.title)
    setDesc(entry.description ?? '')
    setPriority(entry.priority)
    setHours(Math.floor(entry.estimated_minutes / 60))
    setMins(entry.estimated_minutes % 60)
    setNameError('')
  }, [entry])

  function handleSave() {
    if (!name.trim()) { setNameError('Subtask name is required'); return }
    onSave({
      ...entry,
      title: name,
      description: desc,
      estimated_minutes: hours * 60 + mins,
      priority,
    })
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
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
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function Dashboard() {
  const [columns, setColumns] = useState<Record<string, DraftEntry[]>>(() => {
    const grouped: Record<string, DraftEntry[]> = { draft: [], todo: [], in_progress: [], done: [] }
    for (const entry of getDraftEntries()) {
      const col = entry.column in grouped ? entry.column : 'draft'
      grouped[col].push(entry)
    }
    return grouped
  })
  const [activeId, setActiveId] = useState<string | null>(null)
  const [editingEntry, setEditingEntry] = useState<DraftEntry | null>(null)
  const [deletingEntry, setDeletingEntry] = useState<DraftEntry | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const activeEntry = Object.values(columns).flat().find(e => e.id === activeId) ?? null

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    if (!over) return

    const activeId = String(active.id)
    const overId   = String(over.id)

    const activeColId = Object.keys(columns).find(colId => columns[colId].some(e => e.id === activeId))
    if (!activeColId) return

    const isOverColumn = COLUMNS.some(c => c.id === overId)
    const overColId = isOverColumn
      ? overId
      : Object.keys(columns).find(colId => columns[colId].some(e => e.id === overId))
    if (!overColId) return

    if (activeColId === overColId) {
      if (activeId === overId) return
      const col      = columns[activeColId]
      const oldIndex = col.findIndex(e => e.id === activeId)
      const newIndex = col.findIndex(e => e.id === overId)
      const next = { ...columns, [activeColId]: arrayMove(col, oldIndex, newIndex) }
      setColumns(next)
      persistColumns(next)
    } else {
      const moving    = columns[activeColId].find(e => e.id === activeId)!
      const overCol   = columns[overColId]
      const overIndex = isOverColumn ? overCol.length : overCol.findIndex(e => e.id === overId)
      const insertAt  = overIndex >= 0 ? overIndex : overCol.length
      const next = {
        ...columns,
        [activeColId]: columns[activeColId].filter(e => e.id !== activeId),
        [overColId]:   [
          ...columns[overColId].slice(0, insertAt),
          moving,
          ...columns[overColId].slice(insertAt),
        ],
      }
      setColumns(next)
      persistColumns(next)
    }
  }

  function handleSave(updated: DraftEntry) {
    updateDraftEntry(updated.id, updated)
    setColumns(prev => {
      const next = { ...prev }
      for (const colId of Object.keys(next)) {
        next[colId] = next[colId].map(e => e.id === updated.id ? updated : e)
      }
      return next
    })
    setEditingEntry(null)
  }

  function handleDelete(entry: DraftEntry) {
    deleteDraftEntry(entry.id)
    setColumns(prev => {
      const next = { ...prev }
      for (const colId of Object.keys(next)) {
        next[colId] = next[colId].filter(e => e.id !== entry.id)
      }
      return next
    })
    setDeletingEntry(null)
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Navbar />
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="flex gap-4 flex-1 min-h-0 p-5 overflow-hidden">
          {COLUMNS.map(col => (
            <KanbanColumn key={col.id} column={col} items={columns[col.id]} onEdit={setEditingEntry} onDelete={setDeletingEntry} />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {activeEntry && (
            <SubtaskCardView
              subtask={activeEntry}
              projectName={activeEntry.projectName}
              hideSplit
              hideStripe
              onSplit={() => {}}
              onEdit={() => {}}
              onDelete={() => {}}
            />
          )}
        </DragOverlay>
      </DndContext>

      {editingEntry && (
        <DashboardEditModal
          entry={editingEntry}
          onClose={() => setEditingEntry(null)}
          onSave={handleSave}
        />
      )}

      <AlertDialog open={!!deletingEntry} onOpenChange={(o) => { if (!o) setDeletingEntry(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete subtask?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deletingEntry?.title}" will be removed from the dashboard. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => deletingEntry && handleDelete(deletingEntry)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
