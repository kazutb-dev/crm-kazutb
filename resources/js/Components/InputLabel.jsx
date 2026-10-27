import { usePanelDesign } from '@/components/ui/panel-design';

export default function InputLabel({
    value,
    className = '',
    children,
    ...props
}) {
    return (
        <label
            {...props}
            className={
                (usePanelDesign()
                    ? 'block text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-slate-900 '
                    : 'block text-sm font-medium text-gray-700 ') +
                className
            }
        >
            {value ? value : children}
        </label>
    );
}
