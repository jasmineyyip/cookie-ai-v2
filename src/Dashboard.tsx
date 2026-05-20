import { useState } from 'react'
import { Navbar } from '@/components/Navbar'
import { SubtaskCardView } from '@/components/SubtaskCardView'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { getDraftEntries, type DraftEntry } from '@/lib/draft-store'

type Column = { id: string; label: string }

const COLUMNS: Column[] = [
  { id: 'draft',       label: 'Draft' },
  { id: 'todo',        label: 'To Do' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'done',        label: 'Done' },
]

function KanbanColumn({ column, children }: { column: Column; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col flex-1 min-w-0 bg-secondary/40 rounded-lg border border-border">
      <div className="px-4 py-3 flex items-center gap-2">
        <span className="text-sm font-semibold text-foreground">{column.label}</span>
      </div>
      <Separator />
      <ScrollArea className="flex-1 min-h-0 p-3">
        <div className="flex flex-col gap-3">
          {children}
        </div>
      </ScrollArea>
    </div>
  )
}

export default function Dashboard() {
  const [draftEntries] = useState<DraftEntry[]>(getDraftEntries)

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Navbar />
      <div className="flex gap-4 flex-1 min-h-0 p-5 overflow-hidden">
        {COLUMNS.map((col) => (
          <KanbanColumn key={col.id} column={col}>
            {col.id === 'draft' && draftEntries.map((entry) => (
              <SubtaskCardView
                key={entry.id}
                subtask={entry}
                projectName={entry.projectName}
                onSplit={() => {}}
                onEdit={() => {}}
                onDelete={() => {}}
              />
            ))}
          </KanbanColumn>
        ))}
      </div>
    </div>
  )
}
