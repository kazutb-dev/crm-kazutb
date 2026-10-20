import { CheckCircle2, Clock3, LoaderCircle, XCircle } from 'lucide-react';

export const STATUS_META = {
    pending: {
        label: 'В очереди',
        className: 'border-slate-200 bg-slate-100 text-slate-700',
        Icon: Clock3,
    },
    processing: {
        label: 'Анализируется',
        className: 'border-sky-200 bg-sky-50 text-sky-700',
        Icon: LoaderCircle,
        spin: true,
    },
    completed: {
        label: 'Готово',
        className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        Icon: CheckCircle2,
    },
    failed: {
        label: 'Ошибка',
        className: 'border-rose-200 bg-rose-50 text-rose-700',
        Icon: XCircle,
    },
};

export const SEVERITY_META = {
    critical: {
        label: 'Критично',
        className: 'border-rose-200 bg-rose-50 text-rose-700',
        dotClassName: 'bg-rose-500',
    },
    major: {
        label: 'Важно',
        className: 'border-amber-200 bg-amber-50 text-amber-800',
        dotClassName: 'bg-amber-500',
    },
    minor: {
        label: 'Рекомендация',
        className: 'border-sky-200 bg-sky-50 text-sky-700',
        dotClassName: 'bg-sky-500',
    },
};

export const SEVERITY_ORDER = ['critical', 'major', 'minor'];

export const isInProgress = (status) => status === 'pending' || status === 'processing';

export function StatusBadge({ status }) {
    const meta = STATUS_META[status] ?? STATUS_META.pending;
    const { Icon } = meta;

    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${meta.className}`}>
            <Icon className={`h-3.5 w-3.5 ${meta.spin ? 'animate-spin' : ''}`} />
            {meta.label}
        </span>
    );
}

export function SeverityCounts({ counts }) {
    const items = SEVERITY_ORDER.filter((key) => (counts?.[key] ?? 0) > 0);

    if (!items.length) {
        return null;
    }

    return (
        <div className="flex flex-wrap gap-1.5">
            {items.map((key) => (
                <span
                    key={key}
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${SEVERITY_META[key].className}`}
                >
                    <span className={`h-1.5 w-1.5 rounded-full ${SEVERITY_META[key].dotClassName}`} />
                    {SEVERITY_META[key].label}: {counts[key]}
                </span>
            ))}
        </div>
    );
}
