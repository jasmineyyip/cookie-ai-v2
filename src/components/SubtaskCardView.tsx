import { ChevronUp, Clock, Loader2, Pencil, Scissors, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { Subtask } from '@/api'

const PROJECT_BADGE_COLORS = [
  '#cecfd3', '#699def', '#639df4', '#90c74e', '#f8c82c', '#f67267', '#c87cf3',
]

export function getProjectBadgeColor(projectName: string) {
  let hash = 0
  for (let i = 0; i < projectName.length; i++) hash = projectName.charCodeAt(i) + ((hash << 5) - hash)
  return PROJECT_BADGE_COLORS[Math.abs(hash) % PROJECT_BADGE_COLORS.length]
}

const PRIORITY_CONFIG = {
  critical: { label: 'Critical', className: 'bg-[#F87168] text-[#5D1F1A] hover:bg-[#F87168]', arrowCount: 3, arrowClass: 'text-priority-critical' },
  high:     { label: 'High',     className: 'bg-[#FEA363] text-[#702E00] hover:bg-[#FEA363]', arrowCount: 3, arrowClass: 'text-priority-high' },
  medium:   { label: 'Medium',   className: 'bg-[#F6CC47] text-[#533F03] hover:bg-[#F6CC47]', arrowCount: 2, arrowClass: 'text-priority-medium' },
  low:      { label: 'Low',      className: 'bg-[#4CCE97] text-[#174B35] hover:bg-[#4CCE97]', arrowCount: 1, arrowClass: 'text-priority-low' },
} as const

function PriorityArrows({ count, colorClass }: { count: number; colorClass: string }) {
  return (
    <div className="flex flex-col">
      {Array.from({ length: count }).map((_, i) => (
        <ChevronUp key={i} className={cn('size-4 -mb-3 last:mb-0', colorClass)} strokeWidth={3} style={{ transform: 'scaleX(1.4) scaleY(0.75)' }} />
      ))}
    </div>
  )
}

function formatTime(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export function SubtaskCardView({ subtask, isNew, onSplit, splitPending, onEdit, onDelete, dragHandleProps, projectName, hideSplit, hideStripe }: {
  subtask: Subtask
  isNew?: boolean
  onSplit: () => void
  splitPending?: boolean
  onEdit: () => void
  onDelete: () => void
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
  projectName?: string
  hideSplit?: boolean
  hideStripe?: boolean
}) {
  const { label, className: badgeCls, arrowCount, arrowClass } = PRIORITY_CONFIG[subtask.priority] ?? PRIORITY_CONFIG.medium
  const timeStr = formatTime(subtask.estimated_minutes)
  const badgeColor = projectName ? getProjectBadgeColor(projectName) : null

  return (
    <Card className="relative overflow-hidden gap-0 py-0 shadow-none border-border group">
      {!hideStripe && (
        <div
          {...dragHandleProps}
          className={cn(
            'absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl',
            dragHandleProps ? 'cursor-grab active:cursor-grabbing' : 'cursor-default',
            isNew ? 'stripe-new' : 'bg-blue-border'
          )}
        />
      )}
      <CardContent className={cn('pr-3 py-3 flex flex-col gap-1.5', hideStripe ? 'pl-3' : 'pl-5')}>
        <p className="text-sm font-semibold text-foreground leading-snug">{subtask.title}</p>
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{subtask.description}</p>
        {badgeColor && (
          <div>
            <Badge
              className="rounded-sm px-2 py-0.5 text-xs font-medium border-0"
              style={{ backgroundColor: badgeColor, color: '#172B4D' }}
            >
              {projectName}
            </Badge>
          </div>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            {hideStripe
              ? <PriorityArrows count={arrowCount} colorClass={arrowClass} />
              : <Badge className={cn('rounded-sm px-2 py-0.5 text-xs font-medium border-0', badgeCls)}>{label}</Badge>
            }
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="size-3" />
              <span className="text-xs">{timeStr}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {!hideSplit && (
              <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-foreground" disabled={splitPending} onClick={onSplit}>
                {splitPending ? <Loader2 className="size-3.5 animate-spin" /> : <Scissors className="size-3.5" />}
              </Button>
            )}
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
