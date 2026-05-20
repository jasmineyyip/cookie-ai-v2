import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, error, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'w-full px-2.5 py-2.5 border-2 border-border rounded-md text-sm text-slate outline-none font-[Inter]',
      error && 'border-red-dark',
      className
    )}
    {...props}
  />
))
Input.displayName = 'Input'

export { Input }
