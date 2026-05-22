import { Tooltip } from 'radix-ui'
import { cn } from '@/lib/utils'

function TooltipProvider({ children, ...props }: React.ComponentProps<typeof Tooltip.Provider>) {
  return <Tooltip.Provider delayDuration={400} {...props}>{children}</Tooltip.Provider>
}

function TooltipRoot({ children, ...props }: React.ComponentProps<typeof Tooltip.Root>) {
  return <Tooltip.Root {...props}>{children}</Tooltip.Root>
}

function TooltipTrigger({ children, ...props }: React.ComponentProps<typeof Tooltip.Trigger>) {
  return <Tooltip.Trigger asChild {...props}>{children}</Tooltip.Trigger>
}

function TooltipContent({ className, sideOffset = 4, children, ...props }: React.ComponentProps<typeof Tooltip.Content>) {
  return (
    <Tooltip.Portal>
      <Tooltip.Content
        sideOffset={sideOffset}
        className={cn(
          'z-50 rounded-md bg-popover px-2.5 py-1 text-xs text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
          className
        )}
        {...props}
      >
        {children}
      </Tooltip.Content>
    </Tooltip.Portal>
  )
}

export { TooltipProvider, TooltipRoot, TooltipTrigger, TooltipContent }
