import { useState } from 'react'
import { Navbar } from '@/components/Navbar'
import { SubtaskCardView } from '@/components/SubtaskCardView'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { getDraftEntries, type DraftEntry } from '@/lib/draft-store'
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

function SortableCard({ entry }: { entry: DraftEntry }) {
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
        onEdit={() => {}}
        onDelete={() => {}}
      />
    </div>
  )
}

function DroppableList({ columnId, items }: { columnId: string; items: DraftEntry[] }) {
  const { setNodeRef } = useDroppable({ id: columnId })
  return (
    <div ref={setNodeRef} className="flex flex-col gap-3 min-h-[40px]">
      <SortableContext items={items.map(e => e.id)} strategy={verticalListSortingStrategy}>
        {items.map(entry => <SortableCard key={entry.id} entry={entry} />)}
      </SortableContext>
    </div>
  )
}

function KanbanColumn({ column, items }: { column: Column; items: DraftEntry[] }) {
  return (
    <div className="flex flex-col flex-1 min-w-0 bg-secondary/40 rounded-lg border border-border">
      <div className="px-4 py-3 flex items-center gap-2">
        <span className="text-xs font-semibold text-foreground tracking-wide">{column.label}</span>
        <span className="text-xs text-muted-foreground">·</span>
        <span className="text-xs text-muted-foreground">{items.length}</span>
      </div>
      <Separator />
      <ScrollArea className="flex-1 min-h-0 p-3">
        <DroppableList columnId={column.id} items={items} />
      </ScrollArea>
    </div>
  )
}

export default function Dashboard() {
  const [columns, setColumns] = useState<Record<string, DraftEntry[]>>(() => ({
    draft:       getDraftEntries(),
    todo:        [],
    in_progress: [],
    done:        [],
  }))
  const [activeId, setActiveId] = useState<string | null>(null)

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
      setColumns(prev => ({ ...prev, [activeColId]: arrayMove(col, oldIndex, newIndex) }))
    } else {
      const moving     = columns[activeColId].find(e => e.id === activeId)!
      const overCol    = columns[overColId]
      const overIndex  = isOverColumn ? overCol.length : overCol.findIndex(e => e.id === overId)
      const insertAt   = overIndex >= 0 ? overIndex : overCol.length

      setColumns(prev => ({
        ...prev,
        [activeColId]: prev[activeColId].filter(e => e.id !== activeId),
        [overColId]:   [
          ...prev[overColId].slice(0, insertAt),
          moving,
          ...prev[overColId].slice(insertAt),
        ],
      }))
    }
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
            <KanbanColumn key={col.id} column={col} items={columns[col.id]} />
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
    </div>
  )
}
