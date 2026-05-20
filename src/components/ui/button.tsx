import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center cursor-pointer font-medium text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        primary:   'bg-blue border-2 border-blue-border text-white hover:bg-blue-dark rounded-md px-5 py-2.5',
        danger:    'bg-red border-2 border-[#FFBDAD] text-white hover:bg-red-dark rounded-md px-5 py-2.5',
        secondary: 'bg-white border-2 border-[#EBECF0] text-navy hover:bg-[#EBECF0] rounded-md px-5 py-2.5',
        ghost:     'bg-transparent border-none p-0',
        icon:      'bg-transparent border-none p-1.5 rounded-full hover:bg-border',
      },
    },
    defaultVariants: { variant: 'primary' },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return <Comp ref={ref} className={cn(buttonVariants({ variant }), className)} {...props} />
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
