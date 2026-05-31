import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-xs font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-3.5 [&_svg]:shrink-0 active:translate-y-px active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-b from-primary to-primary-strong text-primary-foreground shadow-[0_1px_0_0_hsl(var(--primary-foreground)/0.1)_inset,0_2px_8px_-2px_hsl(var(--primary)/0.4)] hover:shadow-[0_1px_0_0_hsl(var(--primary-foreground)/0.1)_inset,0_4px_12px_-2px_hsl(var(--primary)/0.5)]",
        destructive:
          "bg-gradient-to-b from-destructive to-[hsl(0,72%,42%)] text-destructive-foreground shadow-[0_1px_0_0_hsl(var(--destructive-foreground)/0.1)_inset,0_2px_8px_-2px_hsl(var(--destructive)/0.4)] hover:shadow-[0_1px_0_0_hsl(var(--destructive-foreground)/0.1)_inset,0_4px_12px_-2px_hsl(var(--destructive)/0.5)]",
        outline:
          "border border-border bg-card hover:bg-muted/50 hover:border-foreground/20",
        secondary:
          "bg-muted text-foreground hover:bg-muted/80",
        ghost: "hover:bg-muted/60",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 px-3",
        sm: "h-7 px-2.5 text-2xs",
        lg: "h-9 px-4 text-sm",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
