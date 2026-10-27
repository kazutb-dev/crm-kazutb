import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { CircleAlert, CircleCheck, Inbox, Info, Loader2, TriangleAlert } from 'lucide-react';

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
            <div className="min-w-0 space-y-1.5">
                {eyebrow ? <p className="qd-kicker">{eyebrow}</p> : null}
                <h1 className="font-display text-[1.75rem] font-bold leading-tight tracking-[-0.015em] text-[#102945]">{title}</h1>
                {description ? <p className="max-w-3xl text-sm leading-relaxed text-slate-600">{description}</p> : null}
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
        <div className={`rounded-[14px] border border-slate-200 bg-white p-3 shadow-[0_1px_2px_0_rgba(25,28,29,0.04)] sm:p-4 ${className}`}>
            {children}
        </div>
    );
}

// Classes for raw <input>/<select>/<textarea> so they match the Qadam Input component.
export const qdFieldClass = 'h-10 w-full rounded-[10px] border border-slate-300 bg-white px-3 text-sm text-slate-900 transition-colors placeholder:text-slate-400 hover:border-slate-400 focus:border-teal-600 focus:outline-none focus:ring-[3px] focus:ring-teal-600/20 disabled:cursor-not-allowed disabled:bg-slate-100';

const STAT_DOTS = {
    teal: 'bg-teal-500',
    navy: 'bg-[#102945]',
    gold: 'bg-amber-400',
    success: 'bg-emerald-600',
    danger: 'bg-red-600',
    warning: 'bg-amber-500',
    info: 'bg-blue-600',
    copper: 'bg-[#a4531f]',
    neutral: 'bg-slate-400',
};

// KPI tile from the design page: a coloured marker and a label in spaced capitals, the number
// in Literata, an optional hint. Pass href-less; wrap in a Link yourself when it navigates.
export function StatTile({ label, value, hint = null, tone = 'teal', icon: Icon = null, trend = null, className = '' }) {
    return (
        <div className={`flex h-full flex-col rounded-[14px] border border-slate-200 bg-white px-4 py-3.5 shadow-[0_1px_2px_0_rgba(25,28,29,0.04)] ${className}`}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${STAT_DOTS[tone] ?? STAT_DOTS.teal}`} aria-hidden="true" />
                    <span className="line-clamp-2 text-[0.6875rem] font-bold uppercase leading-snug tracking-[0.1em] text-slate-600">{label}</span>
                </div>
                {Icon ? <Icon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" /> : null}
            </div>
            <div className="mt-2 flex items-baseline gap-2">
                <span className="text-[1.75rem] font-bold leading-none tabular-nums tracking-[-0.01em] text-[#102945]">{value}</span>
                {trend}
            </div>
            {hint ? <div className="mt-auto pt-2 text-xs leading-snug text-slate-500">{hint}</div> : null}
        </div>
    );
}

// Tiles share the row evenly whatever their count (3 tiles = 3 columns, no empty cell, no orphan row).
export function StatGrid({ children, className = '' }) {
    return <div className={`grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,9rem),1fr))] ${className}`}>{children}</div>;
}

// Underline tabs with an optional count chip; items: [{ key, label, count?, icon?, disabled? }].
export function UnderlineTabs({ items, value, onChange, className = '' }) {
    return (
        <div role="tablist" className={`flex flex-wrap gap-x-6 gap-y-1 border-b border-slate-200 ${className}`}>
            {items.map((item) => {
                const active = item.key === value;
                const Icon = item.icon;
                return (
                    <button
                        key={item.key}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        disabled={item.disabled}
                        onClick={() => onChange?.(item.key)}
                        className={`${underlineTabClass(active)} disabled:pointer-events-none disabled:opacity-40`}
                    >
                        {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
                        {item.label}
                        {item.count !== undefined && item.count !== null ? (
                            <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums ${active ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-600'}`}>
                                {item.count}
                            </span>
                        ) : null}
                    </button>
                );
            })}
        </div>
    );
}

export function underlineTabClass(active) {
    return active
        ? '-mb-px inline-flex items-center gap-2 border-b-2 border-teal-600 px-1 pb-3 pt-1 text-sm font-semibold text-[#102945] transition-colors'
        : '-mb-px inline-flex items-center gap-2 border-b-2 border-transparent px-1 pb-3 pt-1 text-sm font-medium text-slate-500 transition-colors hover:border-slate-300 hover:text-[#102945]';
}

// Segmented control (Week / Month / Quarter on the design page).
export function Segmented({ items, value, onChange, className = '' }) {
    return (
        <div className={`inline-flex rounded-[12px] border border-slate-200 bg-slate-100 p-1 ${className}`}>
            {items.map((item) => (
                <button
                    key={item.key}
                    type="button"
                    onClick={() => onChange?.(item.key)}
                    className={item.key === value
                        ? 'rounded-[9px] bg-white px-3.5 py-1.5 text-sm font-semibold text-[#102945] shadow-[0_1px_2px_0_rgba(25,28,29,0.08)]'
                        : 'rounded-[9px] px-3.5 py-1.5 text-sm font-medium text-slate-600 hover:text-[#102945]'}
                >
                    {item.label}
                </button>
            ))}
        </div>
    );
}

const NOTICE_TONES = {
    info: { box: 'border-blue-200 bg-blue-50', icon: 'text-blue-700', title: 'text-blue-800', Icon: Info },
    success: { box: 'border-emerald-200 bg-emerald-50', icon: 'text-emerald-700', title: 'text-emerald-800', Icon: CircleCheck },
    warning: { box: 'border-amber-200 bg-amber-50', icon: 'text-amber-700', title: 'text-amber-800', Icon: TriangleAlert },
    danger: { box: 'border-red-200 bg-red-50', icon: 'text-red-700', title: 'text-red-800', Icon: CircleAlert },
    brand: { box: 'border-teal-200 bg-teal-50', icon: 'text-teal-700', title: 'text-[#102945]', Icon: Info },
};

// In-page message from the design's Feedback section: soft tone, icon, title and text.
export function Notice({ tone = 'info', title = null, children = null, action = null, className = '' }) {
    const t = NOTICE_TONES[tone] ?? NOTICE_TONES.info;
    return (
        <div className={`flex items-start gap-3 rounded-[14px] border px-4 py-3.5 ${t.box} ${className}`}>
            <t.Icon className={`mt-0.5 h-5 w-5 shrink-0 ${t.icon}`} aria-hidden="true" />
            <div className="min-w-0 flex-1 space-y-0.5">
                {title ? <p className={`text-sm font-semibold ${t.title}`}>{title}</p> : null}
                {children ? <div className="text-sm leading-relaxed text-slate-700">{children}</div> : null}
            </div>
            {action}
        </div>
    );
}

// Dark deep-teal panel from the design (“on a dark panel”) for a page's key call to action.
export function DarkPanel({ kicker = null, title = null, children = null, actions = null, className = '' }) {
    return (
        <div className={`relative overflow-hidden rounded-[14px] bg-[#082834] p-6 text-white sm:p-8 ${className}`}>
            <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-teal-500/20 blur-3xl" aria-hidden="true" />
            <div className="relative space-y-3">
                {kicker ? <p className="qd-kicker text-teal-300">{kicker}</p> : null}
                {title ? <h2 className="font-display text-2xl font-bold leading-tight text-white sm:text-3xl">{title}</h2> : null}
                {children ? <div className="max-w-2xl text-sm leading-relaxed text-white/75">{children}</div> : null}
                {actions ? <div className="flex flex-wrap gap-3 pt-2">{actions}</div> : null}
            </div>
        </div>
    );
}

// Read-only field: label in spaced capitals over the value, separated by a rule.
export function InfoField({ label, children, className = '' }) {
    return (
        <div className={`flex flex-col gap-1 border-b border-slate-200 pb-3 ${className}`}>
            <span className="qd-field-label text-slate-500">{label}</span>
            <div className="text-[0.9375rem] font-medium text-slate-900">{children}</div>
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
            <CardContent className="flex flex-col items-center justify-center gap-3 py-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-100 text-teal-700">
                    <Inbox className="h-6 w-6" />
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
