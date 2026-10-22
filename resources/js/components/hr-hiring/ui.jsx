import { Check, CircleAlert, ShieldCheck } from 'lucide-react';
import { createContext, useContext } from 'react';

/** DOM ids of the fields the documents still need (see Wizard): their labels get a marker. */
export const MissingFieldsContext = createContext(new Set());

export const inputClassName = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 disabled:bg-slate-50 disabled:text-slate-500';

export const buttonClassName = {
    primary: 'inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300',
    secondary: 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60',
    ghost: 'inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-teal-700 transition hover:bg-teal-50',
    danger: 'inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50',
};

export function FieldError({ message }) {
    if (!message) {
        return null;
    }

    return <p className="mt-1 text-xs text-rose-600">{Array.isArray(message) ? message[0] : message}</p>;
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
            <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
                {label}
                {required && <span className="text-rose-500"> *</span>}
                <MissingMark id={id} />
            </label>
            {children}
            {error ? <FieldError message={error} /> : hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
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
        <section id={id} className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <header className="mb-4">
                <h3 className="text-base font-semibold text-slate-900">{title}</h3>
                {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
                {(feeds.length > 0 || note) && (
                    <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                        {feeds.length > 0 ? (
                            <>
                                Попадает в:
                                {feeds.map((feed) => (
                                    <span key={feed} className="rounded-md bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">{FEED_LABELS[feed]}</span>
                                ))}
                            </>
                        ) : note}
                    </p>
                )}
            </header>
            <div className="space-y-4">{children}</div>
        </section>
    );
}

const PILL_LABELS = { contract: 'Договор', order: 'Приказ', card: 'Карточка' };
const PILL_STATES = {
    none: { className: 'border-dashed border-slate-300 text-slate-400', title: 'ещё не сформирован' },
    draft: { className: 'border-sky-200 bg-sky-50 text-sky-800', title: 'сформирован, не подписан' },
    signed: { className: 'border-emerald-200 bg-emerald-50 text-emerald-800', title: 'подписан' },
};

/** The three documents of a hiring: not generated yet / generated / signed. */
export function DocumentPills({ documents = {} }) {
    return (
        <span className="inline-flex flex-wrap gap-1">
            {Object.entries(PILL_LABELS).map(([type, label]) => {
                const state = PILL_STATES[documents[type]] ?? PILL_STATES.none;
                return (
                    <span key={type} title={`${label}: ${state.title}`} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${state.className}`}>
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
        <div id={id} tabIndex={-1} role="radiogroup" aria-label={label} className="inline-flex gap-1 rounded-xl border border-slate-300 bg-slate-50 p-1">
            {options.map((option) => {
                const checked = value === option.value;
                return (
                    <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={checked}
                        onClick={() => onChange(option.value)}
                        className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${checked ? 'bg-white text-teal-800 shadow-sm ring-1 ring-teal-500/40' : 'text-slate-600 hover:text-slate-900'}`}
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
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status] ?? STATUS_STYLES.cancelled}`}>
            {label}
        </span>
    );
}

export function DocumentStatusBadge({ status }) {
    return status === 'signed'
        ? <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">Подписан</span>
        : <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600">Черновик</span>;
}

/** Case forms state of a catalog entry: verified by HR or filled by rules. */
export function VerifiedBadge({ verified }) {
    if (verified === null || verified === undefined) {
        return null;
    }

    return verified
        ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700"><ShieldCheck className="h-3 w-3" />формы проверены</span>
        : <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800"><CircleAlert className="h-3 w-3" />формы не проверены ОУП</span>;
}

export function Notice({ tone = 'info', icon: Icon = CircleAlert, children }) {
    const tones = {
        info: 'border-slate-200 bg-slate-50 text-slate-700',
        warning: 'border-amber-200 bg-amber-50 text-amber-900',
        error: 'border-rose-200 bg-rose-50 text-rose-800',
        success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    };

    return (
        <div className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-sm ${tones[tone]}`}>
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0">{children}</div>
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
