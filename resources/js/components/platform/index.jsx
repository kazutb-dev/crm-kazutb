import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Inbox, Loader2, TriangleAlert } from 'lucide-react';

// These blocks render only inside the panel, where the Tailwind families resolve to the Qadam palette.
const STATUS_TONES = {
    default: 'border-slate-200 bg-slate-100 text-slate-700',
    success: 'border-emerald-200 bg-emerald-100 text-emerald-700',
    warning: 'border-amber-200 bg-amber-100 text-amber-700',
    danger: 'border-red-200 bg-red-100 text-red-700',
    info: 'border-sky-200 bg-sky-100 text-sky-700',
};

export function PageHeader({ eyebrow, title, description, actions = null, meta = null }) {
    return (
        <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 space-y-2">
                {eyebrow ? <p className="qd-kicker">{eyebrow}</p> : null}
                <h1 className="font-display text-[1.75rem] font-bold leading-tight tracking-[-0.015em] text-[#102945]">{title}</h1>
                {description ? <p className="max-w-3xl text-[0.9375rem] leading-relaxed text-slate-600">{description}</p> : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
                {meta}
                {actions}
            </div>
        </div>
    );
}

export function SectionHeader({ title, description = null, actions = null, compact = false }) {
    return (
        <div className={`flex flex-wrap items-center justify-between gap-3 ${compact ? '' : 'mb-3'}`}>
            <div className="min-w-0">
                <h2 className="font-display text-lg font-bold text-[#102945]">{title}</h2>
                {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
            </div>
            {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
    );
}

export function FilterBar({ children, className = '' }) {
    return (
        <div className={`rounded-[14px] border border-slate-200 bg-slate-50 p-4 ${className}`}>
            {children}
        </div>
    );
}

export function DataTable({ children, className = '' }) {
    return (
        <div className={`overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-[0_1px_2px_0_rgba(25,28,29,0.04)] ${className}`}>
            <div className="overflow-x-auto">{children}</div>
        </div>
    );
}

export function StatusBadge({ tone = 'default', children, className = '' }) {
    return (
        <Badge variant="outline" className={`${STATUS_TONES[tone] ?? STATUS_TONES.default} ${className}`}>
            {children}
        </Badge>
    );
}

export function EmptyState({ title, description, action = null }) {
    return (
        <Card className="border-dashed border-slate-300 bg-white">
            <CardContent className="flex flex-col items-center justify-center gap-4 py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-100 text-teal-700">
                    <Inbox className="h-7 w-7" />
                </div>
                <div className="max-w-md space-y-1.5">
                    <p className="font-display text-lg font-bold text-[#102945]">{title}</p>
                    {description ? <p className="text-sm leading-relaxed text-slate-600">{description}</p> : null}
                </div>
                {action}
            </CardContent>
        </Card>
    );
}

export function LoadingState({ label = 'Загрузка...' }) {
    return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{label}</span>
        </div>
    );
}

export function ErrorState({ title = 'Что-то пошло не так', description = 'Попробуйте обновить страницу или повторить действие.' }) {
    return (
        <Card className="border-red-200 bg-red-50">
            <CardContent className="flex items-start gap-3 py-5">
                <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-700" />
                <div className="space-y-1">
                    <p className="font-semibold text-red-800">{title}</p>
                    <p className="text-sm text-red-700">{description}</p>
                </div>
            </CardContent>
        </Card>
    );
}

export function FormGrid({ children, className = '' }) {
    return <div className={`grid gap-4 md:grid-cols-2 ${className}`}>{children}</div>;
}

export function FormField({ label, hint = null, children }) {
    return (
        <label className="block space-y-2">
            <span className="qd-field-label block">{label}</span>
            {children}
            {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
        </label>
    );
}

export { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Separator };
