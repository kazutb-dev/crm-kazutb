import * as React from "react"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"
import { usePanelDesign } from "@/components/ui/panel-design"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary/90 text-primary-foreground shadow-sm hover:bg-primary",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/85",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/90",
        outline: "border-border bg-white text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

// Qadam status chips: soft fill, matching border and text, read by colour and by text at once.
const panelBadgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-teal-200 bg-teal-100 text-teal-700",
        secondary: "border-slate-200 bg-slate-100 text-slate-700",
        destructive: "border-red-200 bg-red-100 text-red-700",
        outline: "border-slate-200 bg-white text-slate-700",
        success: "border-emerald-200 bg-emerald-100 text-emerald-700",
        warning: "border-amber-200 bg-amber-100 text-amber-700",
        info: "border-blue-200 bg-blue-100 text-blue-700",
        gold: "border-amber-300 bg-amber-400 text-amber-950",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  ...props
}) {
  const variants = usePanelDesign() ? panelBadgeVariants : badgeVariants
  return (<div className={cn(variants({ variant }), className)} {...props} />);
}

export { Badge, badgeVariants, panelBadgeVariants }
