import { Clock } from 'lucide-react'
import { Navbar } from '@/components/Navbar'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

const PROJECT_BADGE_COLORS = [
  '#cecfd3',
  '#699def',
  '#639df4',
  '#90c74e',
  '#f8c82c',
  '#f67267',
  '#c87cf3',
]

function getProjectColor(projectName: string) {
  let hash = 0
  for (let i = 0; i < projectName.length; i++) hash = projectName.charCodeAt(i) + ((hash << 5) - hash)
  return PROJECT_BADGE_COLORS[Math.abs(hash) % PROJECT_BADGE_COLORS.length]
}

type DraftCard = {
  id: string
  title: string
  description: string
  difficulty: 'easy' | 'medium' | 'hard'
  estimated_minutes: number
  projectName: string
}

const PRIORITY_CONFIG = {
  critical: { label: 'Critical', className: 'bg-[#F87168] text-[#5D1F1A] hover:bg-[#F87168]' },
  high:     { label: 'High',     className: 'bg-[#FEA363] text-[#702E00] hover:bg-[#FEA363]' },
  medium:   { label: 'Medium',   className: 'bg-[#F6CC47] text-[#533F03] hover:bg-[#F6CC47]' },
  low:      { label: 'Low',      className: 'bg-[#4CCE97] text-[#174B35] hover:bg-[#4CCE97]' },
} as const

const DIFFICULTY_TO_PRIORITY = { easy: 'low', medium: 'medium', hard: 'high' } as const

function formatTime(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

const SAMPLE_DRAFT: DraftCard[] = [
  { id: '1', title: 'Write introduction section', description: 'Draft the opening paragraph covering background and objectives.', difficulty: 'easy', estimated_minutes: 30, projectName: 'Research Paper' },
  { id: '2', title: 'Set up database schema', description: 'Define tables and relationships for the core data model.', difficulty: 'hard', estimated_minutes: 90, projectName: 'Backend API' },
  { id: '3', title: 'Design landing page wireframe', description: 'Create low-fidelity mockups for desktop and mobile layouts.', difficulty: 'medium', estimated_minutes: 60, projectName: 'Marketing Site' },
  { id: '4', title: 'Write unit tests for auth module', description: 'Cover login, logout, and token refresh flows.', difficulty: 'medium', estimated_minutes: 45, projectName: 'Backend API' },
]

function DraftSubtaskCard({ card }: { card: DraftCard }) {
  const priorityKey = DIFFICULTY_TO_PRIORITY[card.difficulty]
  const { label, className: badgeCls } = PRIORITY_CONFIG[priorityKey]
  const color = getProjectColor(card.projectName)

  return (
    <Card className="relative overflow-hidden gap-0 py-0 shadow-none border-border">
      <div className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl bg-blue-border" />
      <CardContent className="pl-5 pr-3 py-3 flex flex-col gap-1.5">
        <p className="text-sm font-semibold text-foreground leading-snug">{card.title}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{card.description}</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={cn('rounded-sm px-2 py-0.5 text-xs font-medium border-0', badgeCls)}>{label}</Badge>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="size-3" />
              <span className="text-xs">{formatTime(card.estimated_minutes)}</span>
            </div>
            <Badge
              className="rounded-sm px-2 py-0.5 border-0"
              style={{ backgroundColor: color, color: '#172B4D' }}
            >
              <span className="text-[10px] font-bold uppercase tracking-wide">{card.projectName}</span>
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

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
              <DraftSubtaskCard key={card.id} card={card} />
            ))}
          </KanbanColumn>
        ))}
      </div>
    </div>
  )
}
