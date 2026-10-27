import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"
import { usePanelDesign } from "@/components/ui/panel-design"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_10px_24px_rgba(15,36,63,0.26)] hover:-translate-y-0.5 hover:bg-primary/95",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[0_8px_18px_rgba(190,47,42,0.28)] hover:-translate-y-0.5 hover:bg-destructive/90",
        outline:
          "border border-input bg-white/90 text-foreground shadow-sm hover:border-ring/40 hover:bg-accent/40",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/85",
        ghost: "hover:bg-accent/55 hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-10 px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

// Qadam buttons for the panel's main block: square, spaced capitals, teal turning navy on hover.
// Inside the panel the Tailwind teal/red/amber/slate families resolve to the Qadam palette.
const panelButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-xs font-bold uppercase tracking-[0.07em] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-teal-700 text-white hover:bg-[#102945]",
        ink: "bg-[#102945] text-white hover:bg-teal-700",
        destructive: "bg-red-700 text-white hover:bg-red-800",
        gold: "bg-amber-400 text-amber-950 hover:bg-amber-300",
        outline: "border border-slate-300 bg-white text-[#102945] hover:border-[#102945] hover:bg-slate-50",
        secondary: "bg-teal-100 text-teal-700 hover:bg-teal-200",
        ghost: "text-slate-600 hover:bg-slate-100 hover:text-[#102945]",
        link: "h-auto rounded-none px-0 text-teal-700 underline decoration-teal-300 decoration-1 underline-offset-4 hover:decoration-teal-700",
      },
      size: {
        default: "h-10 px-5",
        sm: "h-8 px-3 text-[0.6875rem]",
        lg: "h-12 px-7 text-[0.8125rem]",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  const variants = usePanelDesign() ? panelButtonVariants : buttonVariants
  return (
    <Comp
      className={cn(variants({ variant, size, className }))}
      ref={ref}
      {...props} />
  );
})
Button.displayName = "Button"

export { Button, buttonVariants, panelButtonVariants }
