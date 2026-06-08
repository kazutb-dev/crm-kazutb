import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Loader2, TriangleAlert } from 'lucide-react';

const STATUS_TONES = {
    default: 'border-slate-200 bg-slate-100 text-slate-800',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    danger: 'border-red-200 bg-red-50 text-red-800',
    info: 'border-sky-200 bg-sky-50 text-sky-800',
};

export function PageHeader({ eyebrow, title, description, actions = null, meta = null }) {
    return (
        <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 space-y-1">
                {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{eyebrow}</p> : null}
                <h1 className="text-2xl font-semibold leading-tight text-[#132844]">{title}</h1>
                {description ? <p className="max-w-3xl text-sm text-muted-foreground">{description}</p> : null}
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
                <h2 className="text-base font-semibold text-foreground">{title}</h2>
                {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
            </div>
            {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
    );
}

export function FilterBar({ children, className = '' }) {
    return (
        <div className={`rounded-2xl border border-border/80 bg-white/90 p-4 shadow-[0_12px_30px_rgba(15,36,63,0.06)] ${className}`}>
            {children}
        </div>
    );
}

export function DataTable({ children, className = '' }) {
    return (
        <div className={`overflow-hidden rounded-2xl border border-border/80 bg-white/95 shadow-[0_12px_30px_rgba(15,36,63,0.06)] ${className}`}>
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
        <Card className="border-dashed border-border/80 bg-white/80">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/80 bg-slate-50 text-slate-500">
                    <TriangleAlert className="h-5 w-5" />
                </div>
                <div className="max-w-md space-y-1">
                    <p className="font-semibold text-foreground">{title}</p>
                    {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
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
        <Card className="border-red-200 bg-red-50/50">
            <CardContent className="py-6">
                <div className="space-y-1">
                    <p className="font-semibold text-red-900">{title}</p>
                    <p className="text-sm text-red-800">{description}</p>
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
        <label className="block space-y-1.5">
            <span className="text-sm font-medium text-foreground">{label}</span>
            {children}
            {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
        </label>
    );
}

export { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Separator };
