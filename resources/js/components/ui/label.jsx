import { cn } from '@/lib/utils';
import { usePanelDesign } from '@/components/ui/panel-design';

export function Label({ className, ...props }) {
    return (
        <label
            className={cn(
                usePanelDesign()
                    ? 'text-[0.6875rem] font-bold uppercase leading-none tracking-[0.12em] text-slate-900'
                    : 'text-sm font-medium leading-none',
                className,
            )}
            {...props}
        />
    );
}
