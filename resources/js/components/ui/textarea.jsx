import { cn } from '@/lib/utils';
import { usePanelDesign } from '@/components/ui/panel-design';

export const Textarea = ({ className, ...props }) => {
    const panel = usePanelDesign();
    return (
    <textarea
        className={cn(
            panel
                ? 'flex min-h-[96px] w-full rounded-[10px] border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 transition-colors placeholder:text-slate-400 hover:border-slate-400 focus-visible:border-teal-600 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-teal-600/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-70'
                : 'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            className,
        )}
        {...props}
    />
    );
};
