import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export type Priority = 'critical' | 'high' | 'medium' | 'low'

export const DIFFICULTY_TO_PRIORITY: Record<string, Priority> = {
  easy: 'low', medium: 'medium', hard: 'high', critical: 'critical',
}

export const PRIORITY_TO_DIFFICULTY: Record<Priority, 'easy' | 'medium' | 'hard' | 'critical'> = {
  critical: 'critical', high: 'hard', medium: 'medium', low: 'easy',
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <div className="text-xs text-destructive mt-1">{message}</div>
}

export function SubtaskFormFields({
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
            <div className="relative flex-1">
              <Input
                type="number"
                min={0}
                value={hours}
                onChange={(e) => setHours(Math.max(0, parseInt(e.target.value) || 0))}
                className="pr-6"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">h</span>
            </div>
            <div className="relative flex-1">
              <Input
                type="number"
                min={0}
                max={59}
                value={minutes}
                onChange={(e) => setMinutes(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                className="pr-6"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">m</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
