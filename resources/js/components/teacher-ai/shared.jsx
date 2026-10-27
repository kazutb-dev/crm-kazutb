import { CheckCircle2, Clock3, LoaderCircle, XCircle } from 'lucide-react';

export const STATUS_META = {
    pending: {
        label: 'В очереди',
        className: 'border-slate-200 bg-slate-100 text-slate-700',
        Icon: Clock3,
    },
    processing: {
        label: 'Анализируется',
        className: 'border-blue-200 bg-blue-100 text-blue-700',
        Icon: LoaderCircle,
        spin: true,
    },
    completed: {
        label: 'Готово',
        className: 'border-emerald-200 bg-emerald-100 text-emerald-700',
        Icon: CheckCircle2,
    },
    failed: {
        label: 'Ошибка',
        className: 'border-red-200 bg-red-100 text-red-700',
        Icon: XCircle,
    },
};

export const SEVERITY_META = {
    critical: {
        label: 'Критично',
        className: 'border-red-200 bg-red-100 text-red-700',
        dotClassName: 'bg-red-600',
    },
    major: {
        label: 'Важно',
        className: 'border-amber-200 bg-amber-100 text-amber-700',
        dotClassName: 'bg-amber-500',
    },
    minor: {
        label: 'Рекомендация',
        className: 'border-blue-200 bg-blue-100 text-blue-700',
        dotClassName: 'bg-blue-600',
    },
};

export const SEVERITY_ORDER = ['critical', 'major', 'minor'];

export const isInProgress = (status) => status === 'pending' || status === 'processing';

export function StatusBadge({ status }) {
    const meta = STATUS_META[status] ?? STATUS_META.pending;
    const { Icon } = meta;

    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${meta.className}`}>
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
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${SEVERITY_META[key].className}`}
                >
                    <span className={`h-1.5 w-1.5 rounded-full ${SEVERITY_META[key].dotClassName}`} />
                    {SEVERITY_META[key].label}: {counts[key]}
                </span>
            ))}
        </div>
    );
}
