import { Check, CircleAlert, ShieldCheck } from 'lucide-react';
import { createContext, useContext } from 'react';

/** DOM ids of the fields the documents still need (see Wizard): their labels get a marker. */
export const MissingFieldsContext = createContext(new Set());

// Qadam field: 10px radius, 40px tall, teal focus ring (matches qdFieldClass from components/platform).
export const inputClassName = 'min-h-10 w-full rounded-[10px] border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition-colors placeholder:text-slate-400 hover:border-slate-400 focus:border-teal-600 focus:outline-none focus:ring-[3px] focus:ring-teal-600/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500';

export const buttonClassName = {
    // Qadam buttons: spaced capitals, 10px radius; primary is teal turning navy on hover.
    primary: 'inline-flex h-10 items-center justify-center gap-2 rounded-[10px] bg-teal-700 px-4 text-xs font-bold uppercase tracking-[0.08em] text-white transition-colors hover:bg-[#102945] disabled:cursor-not-allowed disabled:bg-teal-700/50',
    secondary: 'inline-flex h-10 items-center justify-center gap-2 rounded-[10px] border border-slate-300 bg-white px-4 text-xs font-bold uppercase tracking-[0.08em] text-[#102945] transition-colors hover:border-[#102945] disabled:cursor-not-allowed disabled:opacity-60',
    ghost: 'inline-flex items-center gap-1.5 rounded-[10px] px-2 py-1 text-sm font-semibold text-teal-700 transition-colors hover:bg-teal-50 hover:text-[#102945]',
    danger: 'inline-flex h-10 items-center justify-center gap-2 rounded-[10px] border border-red-200 bg-white px-3 text-xs font-bold uppercase tracking-[0.08em] text-red-700 transition-colors hover:bg-red-50',
};

export function FieldError({ message }) {
    if (!message) {
        return null;
    }

    return <p className="mt-1.5 flex items-center gap-1 text-xs text-red-700"><CircleAlert className="h-3.5 w-3.5 shrink-0" />{Array.isArray(message) ? message[0] : message}</p>;
}

/** Marker after a label: the documents need this field and it is empty. */
export function MissingMark({ id }) {
    const missing = useContext(MissingFieldsContext);
    if (!missing.has(id)) {
        return null;
    }

    return (
        <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-amber-400 align-middle" title="Нужно для документов">
            <span className="sr-only">(нужно для документов)</span>
        </span>
    );
}

/** Label + control + hint/error. `id` must be the control's id (missing-field links focus it). */
export function Field({ id, label, hint, error, required = false, className = '', children }) {
    return (
        <div className={className}>
            <label htmlFor={id} className="qd-field-label mb-2 block text-[#102945]">
                {label}
                {required && <span className="text-red-600"> *</span>}
                <MissingMark id={id} />
            </label>
            {children}
            {error ? <FieldError message={error} /> : hint ? <p className="mt-1.5 text-xs leading-snug text-slate-500">{hint}</p> : null}
        </div>
    );
}

export function TextInput({ id, value, onChange, className = '', ...props }) {
    return (
        <input
            id={id}
            value={value ?? ''}
            onChange={(event) => onChange(event.target.value)}
            className={`${inputClassName} ${className}`}
            autoComplete="off"
            {...props}
        />
    );
}

export function SelectInput({ id, value, onChange, options, placeholder, className = '', ...props }) {
    return (
        <select
            id={id}
            value={value ?? ''}
            onChange={(event) => onChange(event.target.value === '' ? null : event.target.value)}
            className={`${inputClassName} ${className}`}
            {...props}
        >
            {placeholder !== undefined && <option value="">{placeholder}</option>}
            {options.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
            ))}
        </select>
    );
}

const FEED_LABELS = { contract: 'договор', order: 'приказ', card: 'личная карточка' };

/**
 * Form section as a card: title, a plain-language description and the documents it feeds
 * (`feeds`: contract, order, card) — or `note` when it feeds none of them.
 */
export function Section({ title, description, feeds = [], note, children, id }) {
    return (
        <section id={id} className="scroll-mt-24 overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-[0_1px_2px_0_rgba(25,28,29,0.04)]">
            <header className="border-b border-slate-200 bg-slate-50 px-5 py-3.5 sm:px-6">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                    <h3 className="text-[0.75rem] font-bold uppercase tracking-[0.1em] text-[#102945]">{title}</h3>
                    {(feeds.length > 0 || note) && (
                        <p className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                            {feeds.length > 0 ? (
                                <>
                                    Попадает в:
                                    {feeds.map((feed) => (
                                        <span key={feed} className="rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 font-semibold text-teal-800">{FEED_LABELS[feed]}</span>
                                    ))}
                                </>
                            ) : note}
                        </p>
                    )}
                </div>
                {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
            </header>
            <div className="space-y-5 p-5 sm:p-6">{children}</div>
        </section>
    );
}

const PILL_LABELS = { contract: 'Договор', order: 'Приказ', card: 'Карточка' };
const PILL_STATES = {
    none: { className: 'border-dashed border-slate-300 bg-white text-slate-400', title: 'ещё не сформирован' },
    draft: { className: 'border-blue-200 bg-blue-50 text-blue-800', title: 'сформирован, не подписан' },
    signed: { className: 'border-emerald-200 bg-emerald-50 text-emerald-800', title: 'подписан' },
};

/** The three documents of a hiring: not generated yet / generated / signed. */
export function DocumentPills({ documents = {} }) {
    return (
        <span className="inline-flex flex-wrap gap-1">
            {Object.entries(PILL_LABELS).map(([type, label]) => {
                const state = PILL_STATES[documents[type]] ?? PILL_STATES.none;
                return (
                    <span key={type} title={`${label}: ${state.title}`} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${state.className}`}>
                        {documents[type] === 'signed' && <Check className="h-3 w-3" />}
                        {label}
                    </span>
                );
            })}
        </span>
    );
}

/** Two to four mutually exclusive options as a segmented control (radio semantics). */
export function ChoiceGroup({ id, label, value, onChange, options }) {
    return (
        <div id={id} tabIndex={-1} role="radiogroup" aria-label={label} className="inline-flex max-w-full flex-wrap gap-1 rounded-[12px] border border-slate-200 bg-slate-100 p-1 focus:outline-none focus:ring-[3px] focus:ring-teal-600/20">
            {options.map((option) => {
                const checked = value === option.value;
                return (
                    <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={checked}
                        onClick={() => onChange(option.value)}
                        className={`whitespace-nowrap rounded-[9px] px-3.5 py-1.5 text-sm transition-colors ${checked ? 'bg-white font-semibold text-[#102945] shadow-[0_1px_2px_0_rgba(25,28,29,0.08)]' : 'font-medium text-slate-600 hover:text-[#102945]'}`}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}

const STATUS_STYLES = {
    draft: 'border-amber-200 bg-amber-50 text-amber-800',
    signed: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    cancelled: 'border-slate-200 bg-slate-100 text-slate-600',
};

export function StatusBadge({ status, label }) {
    return (
        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[status] ?? STATUS_STYLES.cancelled}`}>
            {label}
        </span>
    );
}

export function DocumentStatusBadge({ status }) {
    return status === 'signed'
        ? <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800"><Check className="h-3 w-3" />Подписан</span>
        : <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">Черновик</span>;
}

/** Case forms state of a catalog entry: verified by HR or filled by rules. */
export function VerifiedBadge({ verified }) {
    if (verified === null || verified === undefined) {
        return null;
    }

    return verified
        ? <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800"><ShieldCheck className="h-3 w-3" />формы проверены</span>
        : <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800"><CircleAlert className="h-3 w-3" />формы не проверены ОУП</span>;
}

export function Notice({ tone = 'info', icon: Icon = CircleAlert, children }) {
    const tones = {
        info: { box: 'border-blue-200 bg-blue-50 text-slate-700', icon: 'text-blue-700' },
        warning: { box: 'border-amber-200 bg-amber-50 text-amber-900', icon: 'text-amber-700' },
        error: { box: 'border-red-200 bg-red-50 text-red-800', icon: 'text-red-700' },
        success: { box: 'border-emerald-200 bg-emerald-50 text-emerald-800', icon: 'text-emerald-700' },
    };
    const t = tones[tone] ?? tones.info;

    // Same shape as the platform Notice: soft tone, 14px radius, icon at the first line.
    return (
        <div className={`flex items-start gap-3 rounded-[14px] border px-4 py-3 text-sm leading-relaxed ${t.box}`}>
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${t.icon}`} />
            <div className="min-w-0 flex-1">{children}</div>
        </div>
    );
}

export const formatBytes = (bytes) => {
    if (!bytes) {
        return '';
    }
    return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} МБ` : `${Math.max(1, Math.round(bytes / 1024))} КБ`;
};

/** Laravel validation errors of axios → { 'employee.iin': 'message' }. */
export const validationErrors = (error) => {
    const errors = error?.response?.data?.errors ?? {};
    return Object.fromEntries(Object.entries(errors).map(([key, messages]) => [key, Array.isArray(messages) ? messages[0] : messages]));
};
