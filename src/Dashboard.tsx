import { Navbar } from '@/components/Navbar'
import { SubtaskCardView } from '@/components/SubtaskCardView'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import type { Subtask } from '@/api'

type DraftCard = Subtask & { projectName: string }

const SAMPLE_DRAFT: DraftCard[] = [
  { id: '1', title: 'Write introduction section', description: 'Draft the opening paragraph covering background and objectives.', difficulty: 'easy', estimated_minutes: 30, projectName: 'Research Paper', status: 'todo', position: 0, order_index: 0, created_at: '' },
  { id: '2', title: 'Set up database schema', description: 'Define tables and relationships for the core data model.', difficulty: 'hard', estimated_minutes: 90, projectName: 'Backend API', status: 'todo', position: 1, order_index: 1, created_at: '' },
  { id: '3', title: 'Design landing page wireframe', description: 'Create low-fidelity mockups for desktop and mobile layouts.', difficulty: 'medium', estimated_minutes: 60, projectName: 'Marketing Site', status: 'todo', position: 2, order_index: 2, created_at: '' },
  { id: '4', title: 'Write unit tests for auth module', description: 'Cover login, logout, and token refresh flows.', difficulty: 'medium', estimated_minutes: 45, projectName: 'Backend API', status: 'todo', position: 3, order_index: 3, created_at: '' },
]

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
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Navbar />
      <div className="flex gap-4 flex-1 min-h-0 p-5 overflow-hidden">
        {COLUMNS.map((col) => (
          <KanbanColumn key={col.id} column={col}>
            {col.id === 'draft' && SAMPLE_DRAFT.map((card) => (
              <SubtaskCardView
                key={card.id}
                subtask={card}
                projectName={card.projectName}
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
