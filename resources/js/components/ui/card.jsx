import * as React from "react"

import { cn } from "@/lib/utils"
import { usePanelDesign } from "@/components/ui/panel-design"

const Card = React.forwardRef(({ className, ...props }, ref) => {
  const panel = usePanelDesign()
  return (
    <div
      ref={ref}
      className={cn(
        panel
          ? "rounded-[14px] border border-slate-200 bg-white text-slate-900 shadow-[0_1px_2px_0_rgba(25,28,29,0.04)]"
          : "rounded-2xl border border-border/80 bg-card/95 text-card-foreground shadow-[0_16px_40px_rgba(15,36,63,0.08)] backdrop-blur",
        className
      )}
      {...props} />
  )
})
Card.displayName = "Card"

// In the panel a card header is the Qadam panel strip: raised background, a rule below and a
// spaced-capitals title. panel.css pins its padding and title size, which pages tuned for the old look.
const CardHeader = React.forwardRef(({ className, ...props }, ref) => {
  const panel = usePanelDesign()
  return (
    <div
      ref={ref}
      data-qd={panel ? "card-header" : undefined}
      className={cn("flex flex-col space-y-1.5 p-5 sm:p-6", className)}
      {...props} />
  )
})
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef(({ className, ...props }, ref) => {
  const panel = usePanelDesign()
  return (
    <div
      ref={ref}
      data-qd={panel ? "card-title" : undefined}
      className={cn(
        panel
          ? "font-display text-lg font-bold leading-snug tracking-[-0.01em] text-[#102945]"
          : "font-semibold leading-none tracking-tight text-foreground",
        className
      )}
      {...props} />
  )
})
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef(({ className, ...props }, ref) => {
  const panel = usePanelDesign()
  return (
    <div
      ref={ref}
      data-qd={panel ? "card-description" : undefined}
      className={cn("text-sm text-muted-foreground", className)}
      {...props} />
  )
})
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef(({ className, ...props }, ref) => {
  // Under the panel strip the body needs its own top padding; pages' p-0 / pt-4 still win.
  const panel = usePanelDesign()
  return (
    <div
      ref={ref}
      data-qd={panel ? "card-content" : undefined}
      className={cn(panel ? "p-5 sm:p-6" : "p-5 pt-0 sm:p-6 sm:pt-0", className)}
      {...props} />
  )
})
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props} />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
