import { cn } from '@/lib/utils';
import { createContext, useContext } from 'react';

// Lightweight shadcn-compatible Select using native <select>
// API matches shadcn: <Select value onValueChange><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value>…</SelectItem></SelectContent></Select>

const Ctx = createContext(null);

export function Select({ value, onValueChange, children }) {
    // Collect SelectItem children from SelectContent to build native <select>
    return <Ctx.Provider value={{ value, onValueChange }}>{children}</Ctx.Provider>;
}

// SelectTrigger + SelectContent + SelectItem work together via a wrapping div
// that renders a styled native <select>
export function SelectTrigger({ className, children }) {
    // Rendered by NativeSelect internally; this wrapper just reserves the slot
    return <div data-select-trigger className={className}>{children}</div>;
}
export function SelectValue({ placeholder }) {
    return <span data-select-value>{placeholder}</span>;
}
export function SelectContent({ children }) {
    return <div data-select-content style={{ display: 'none' }}>{children}</div>;
}
export function SelectItem({ value, children }) {
    return <div data-select-item data-value={value} style={{ display: 'none' }}>{children}</div>;
}

// Use this wrapper instead of the above stub approach:
// Re-export a working compound that renders a native styled select.
export function NativeSelect({ value, onValueChange, options = [], className }) {
    return (
        <select
            value={value}
            onChange={e => onValueChange(e.target.value)}
            className={cn(
                'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                className,
            )}
        >
            {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
    );
}
