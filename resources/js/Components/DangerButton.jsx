import { usePanelDesign } from '@/components/ui/panel-design';

export default function DangerButton({
    className = '',
    disabled,
    children,
    ...props
}) {
    const panel = usePanelDesign();

    return (
        <button
            {...props}
            className={
                (panel
                    ? 'inline-flex h-10 items-center rounded-[10px] border border-transparent bg-red-700 px-5 text-xs font-bold uppercase tracking-[0.07em] text-white transition-colors duration-200 hover:bg-red-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 '
                    : 'inline-flex items-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white transition duration-150 ease-in-out hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 active:bg-red-700 ') + `${
                    disabled && 'opacity-25'
                } ` + className
            }
            disabled={disabled}
        >
            {children}
        </button>
    );
}
