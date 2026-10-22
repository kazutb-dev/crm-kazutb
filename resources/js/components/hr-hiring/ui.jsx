import { CircleAlert, ShieldCheck } from 'lucide-react';

export const inputClassName = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 disabled:bg-slate-50 disabled:text-slate-500';

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

/** Label + control + hint/error. `id` must be the control's id (missing-field links focus it). */
export function Field({ id, label, hint, error, required = false, className = '', children }) {
    return (
        <div className={className}>
            <label htmlFor={id} className="mb-1 block text-xs font-medium text-slate-600">
                {label}
                {required && <span className="text-rose-500"> *</span>}
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

/** Form section with the documents it feeds («договор · личное дело»), as in the prototype. */
export function Section({ title, feeds, children, id }) {
    return (
        <section id={id} className="space-y-3 border-t border-slate-100 pt-5 first:border-t-0 first:pt-0">
            <h3 className="flex flex-wrap items-baseline gap-2 text-sm font-semibold text-slate-900">
                {title}
                {feeds && <span className="text-xs font-normal text-slate-400">{feeds}</span>}
            </h3>
            {children}
        </section>
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
