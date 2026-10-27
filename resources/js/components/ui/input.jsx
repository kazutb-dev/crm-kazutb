import * as React from "react"

import { cn } from "@/lib/utils"
import { usePanelDesign } from "@/components/ui/panel-design"

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  const panel = usePanelDesign()
  return (
    <input
      type={type}
      className={cn(
        panel
          ? "flex h-10 w-full rounded-[10px] border border-slate-300 bg-white px-3 py-1 text-sm text-slate-900 transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-slate-900 placeholder:text-slate-400 hover:border-slate-400 focus-visible:border-teal-600 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-teal-600/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-70"
          : "flex h-9 w-full rounded-lg border border-input bg-white/95 px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/80 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      ref={ref}
      {...props} />
  );
})
Input.displayName = "Input"

export { Input }
