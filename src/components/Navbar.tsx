import { CircleUserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'

const NAV_LINKS = [
  { label: 'Task Planner', href: '/', disabled: false },
  // { label: 'Calendar', href: '/calendar', disabled: true },
  { label: 'Dashboard', href: '/dashboard', disabled: false },
]

export function Navbar() {
  const { pathname } = useLocation()
  return (
    <nav className="flex justify-between items-center px-5 h-[65px] border-b border-border bg-background">
      <div className="flex items-center gap-6">
        <img src="/cookie-ai-logo.png" alt="Cookie AI" className="w-8 h-8" />
        <div className="flex items-center gap-1">
          {NAV_LINKS.map(({ label, href, disabled }) => (
            <Button
              key={label}
              variant="ghost"
              size="sm"
              disabled={disabled}
              asChild={!disabled}
              className={cn(!disabled && pathname === href && 'bg-accent')}
            >
              {disabled ? <span>{label}</span> : <a href={href}>{label}</a>}
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
