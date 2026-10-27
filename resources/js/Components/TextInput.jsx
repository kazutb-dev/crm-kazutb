import { usePanelDesign } from '@/components/ui/panel-design';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

export default forwardRef(function TextInput(
    { type = 'text', className = '', isFocused = false, ...props },
    ref,
) {
    const localRef = useRef(null);
    const panel = usePanelDesign();

    useImperativeHandle(ref, () => ({
        focus: () => localRef.current?.focus(),
    }));

    useEffect(() => {
        if (isFocused) {
            localRef.current?.focus();
        }
    }, [isFocused]);

    return (
        <input
            {...props}
            type={type}
            className={
                (panel
                    ? 'h-10 rounded-[10px] border-slate-300 bg-white text-sm shadow-none focus:border-teal-600 focus:ring-teal-600/20 '
                    : 'rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 ') +
                className
            }
            ref={localRef}
        />
    );
});
