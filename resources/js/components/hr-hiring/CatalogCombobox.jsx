import { Combobox, ComboboxButton, ComboboxInput, ComboboxOption, ComboboxOptions } from '@headlessui/react';
import axios from 'axios';
import { ChevronsUpDown, PencilLine, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { inputClassName, MissingMark, VerifiedBadge } from './ui';

const SEARCH_DELAY_MS = 250;

const keyOf = (item) => (item ? (item.id ? `id:${item.id}` : `manual:${item.name_ru ?? ''}`) : '');

/**
 * Catalog entry or free text: search the catalog (`searchUrl(query)` → { items }), pick an entry, or choose
 * «Ввести вручную: …». The case forms the documents need are shown under the field; for a typed-in value
 * they are entered here (the RU genitive is suggested by the server), with «Добавить в справочник» for
 * people who may extend the catalog. A catalog entry with all forms filled shows them folded into one line.
 *
 * value: { id, name_ru, verified, add_to_catalog, …forms }
 */
export default function CatalogCombobox({
    id,
    label,
    value,
    onChange,
    searchUrl,
    inflectKind,
    forms,
    canAddToCatalog = false,
    disabled = false,
    placeholder = 'Начните вводить название',
    errors = {},
    errorPrefix,
    emptyHint,
}) {
    const [query, setQuery] = useState('');
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [formsOpen, setFormsOpen] = useState(false);
    const requestRef = useRef(0);
    // Forms the catalog already had when the entry was picked are read-only (the server takes them from the
    // catalog); the missing ones can be typed in.
    const lockRef = useRef({ key: null, locked: {} });
    // The latest value for the async genitive suggestion (the user may have typed or picked something meanwhile).
    const valueRef = useRef(value);
    valueRef.current = value;

    // The URL (not the builder function) drives the search, so a new builder on every render does not refetch.
    const url = disabled ? null : searchUrl(query.trim());

    useEffect(() => {
        if (!url) {
            return undefined;
        }
        const request = ++requestRef.current;
        setLoading(true);
        const timer = window.setTimeout(() => {
            axios.get(url)
                .then((response) => {
                    if (request === requestRef.current) {
                        setItems(response.data.items ?? []);
                    }
                })
                .catch(() => request === requestRef.current && setItems([]))
                .finally(() => request === requestRef.current && setLoading(false));
        }, SEARCH_DELAY_MS);

        return () => window.clearTimeout(timer);
    }, [url]);

    const typed = query.trim();
    const exactMatch = items.some((item) => item.name_ru.toLowerCase() === typed.toLowerCase());
    const hasValue = Boolean(value?.name_ru);
    const isManual = hasValue && !value?.id;
    const catalogKey = value?.id ? `id:${value.id}` : null;
    if (lockRef.current.key !== catalogKey) {
        lockRef.current = {
            key: catalogKey,
            locked: catalogKey ? Object.fromEntries(forms.map((form) => [form.key, Boolean(value?.[form.key])])) : {},
        };
    }
    const locked = lockRef.current.locked;
    const hasGaps = forms.some((form) => !locked[form.key]);
    const formsComplete = forms.every((form) => String(value?.[form.key] ?? '').trim() !== '');
    const folded = hasValue && !isManual && formsComplete && !formsOpen;

    const select = (item) => {
        if (!item) {
            return;
        }
        if (item.manual) {
            const next = { id: null, name_ru: item.name_ru, verified: null, add_to_catalog: false };
            forms.forEach((form) => { next[form.key] = ''; });
            onChange(next);
            axios.post(route('hr.hiring.lookup.inflect'), { kind: inflectKind, name: item.name_ru })
                .then((response) => {
                    const latest = valueRef.current;
                    if (!latest?.id && latest?.name_ru === item.name_ru && String(latest.name_ru_gen ?? '').trim() === '') {
                        onChange({ ...latest, name_ru_gen: response.data.name_ru_gen ?? '' });
                    }
                })
                .catch(() => {});
        } else {
            const next = { id: item.id, name_ru: item.name_ru, verified: item.verified, add_to_catalog: false };
            forms.forEach((form) => { next[form.key] = item[form.key] ?? ''; });
            onChange(next);
        }
        setQuery('');
    };

    const clear = () => {
        const next = { id: null, name_ru: '', verified: null, add_to_catalog: false };
        forms.forEach((form) => { next[form.key] = ''; });
        onChange(next);
    };

    const setForm = (key, formValue) => onChange({ ...value, [key]: formValue });
    const error = errors[`${errorPrefix}.id`] ?? errors[`${errorPrefix}.name_ru`];

    return (
        <div className="space-y-2">
            <label htmlFor={id} className="qd-field-label mb-2 block text-[#102945]">{label}<MissingMark id={id} /></label>
            <Combobox value={hasValue ? value : null} onChange={select} by={(a, b) => keyOf(a) === keyOf(b)} disabled={disabled} immediate>
                <div className="relative">
                    <ComboboxInput
                        id={id}
                        className={`${inputClassName} pr-16`}
                        displayValue={(item) => item?.name_ru ?? ''}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={disabled ? emptyHint ?? placeholder : placeholder}
                        autoComplete="off"
                    />
                    <div className="absolute inset-y-0 right-1 flex items-center gap-0.5">
                        {hasValue && !disabled && (
                            <button type="button" onClick={clear} className="rounded-[8px] p-1 text-slate-400 hover:bg-slate-100 hover:text-[#102945]" title="Очистить">
                                <X className="h-4 w-4" />
                            </button>
                        )}
                        <ComboboxButton className="rounded-[8px] px-1 text-slate-400 hover:text-[#102945]">
                            <ChevronsUpDown className="h-4 w-4" />
                        </ComboboxButton>
                    </div>
                </div>
                <ComboboxOptions
                    anchor="bottom start"
                    className="z-50 mt-1 max-h-72 w-[var(--input-width)] overflow-auto rounded-[12px] border border-slate-200 bg-white p-1 text-sm shadow-[0_12px_32px_0_rgba(25,28,29,0.10)] empty:invisible"
                >
                    {items.map((item) => (
                        <ComboboxOption
                            key={item.id}
                            value={item}
                            className="flex cursor-pointer flex-col gap-0.5 rounded-[10px] px-3 py-2 data-[focus]:bg-teal-50"
                        >
                            <span className="font-medium text-slate-900">{item.name_ru}</span>
                            <span className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                {item.type_label && <span>{item.type_label}</span>}
                                <VerifiedBadge verified={item.verified} />
                            </span>
                        </ComboboxOption>
                    ))}
                    {typed !== '' && !exactMatch && (
                        <ComboboxOption
                            value={{ manual: true, name_ru: typed }}
                            className="flex cursor-pointer items-center gap-2 rounded-[10px] border-t border-slate-100 px-3 py-2 font-semibold text-teal-700 data-[focus]:bg-teal-50"
                        >
                            <PencilLine className="h-4 w-4 shrink-0" />
                            <span>Ввести вручную: «{typed}»</span>
                        </ComboboxOption>
                    )}
                    {!loading && items.length === 0 && typed === '' && (
                        <div className="px-3 py-2 text-xs text-slate-500">Справочник пуст — введите название.</div>
                    )}
                </ComboboxOptions>
            </Combobox>
            {error && <p className="text-xs text-red-700">{error}</p>}

            {folded && (
                <p className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    Из справочника, формы для документов заполнены
                    <VerifiedBadge verified={value.verified} />
                    <button type="button" onClick={() => setFormsOpen(true)} className="font-semibold text-teal-700 underline-offset-2 hover:text-[#102945] hover:underline">
                        {hasGaps ? 'Изменить формы' : 'Показать формы'}
                    </button>
                </p>
            )}

            {hasValue && !folded && (
                <div className="space-y-3 rounded-xl border border-slate-200 border-l-[3px] border-l-teal-500 bg-white p-4">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="text-[0.6875rem] font-bold uppercase tracking-[0.1em] text-[#102945]">Формы для текста документов</span>
                        {isManual ? 'Введено вручную: сохранится в записи о приёме.' : 'Из справочника.'}
                        {!isManual && <VerifiedBadge verified={value.verified} />}
                        {!isManual && formsComplete && (
                            <button type="button" onClick={() => setFormsOpen(false)} className="ml-auto font-semibold text-teal-700 underline-offset-2 hover:text-[#102945] hover:underline">Скрыть</button>
                        )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        {forms.map((form) => {
                            const formValue = value[form.key] ?? '';
                            return (
                                <div key={form.key}>
                                    <label htmlFor={`${id}-${form.key}`} className="mb-1.5 block text-xs font-semibold text-slate-600">{form.label}<MissingMark id={`${id}-${form.key}`} /></label>
                                    <input
                                        id={`${id}-${form.key}`}
                                        value={formValue}
                                        onChange={(event) => setForm(form.key, event.target.value)}
                                        readOnly={Boolean(locked[form.key])}
                                        placeholder={form.placeholder}
                                        className={`${inputClassName} ${formValue === '' ? 'border-amber-300 bg-amber-50' : ''} read-only:bg-slate-50 read-only:text-slate-600`}
                                    />
                                    {form.hint && <p className="mt-1 text-[11px] text-slate-500">{form.hint}</p>}
                                    {errors[`${errorPrefix}.${form.key}`] && <p className="mt-1 text-xs text-red-700">{errors[`${errorPrefix}.${form.key}`]}</p>}
                                </div>
                            );
                        })}
                    </div>
                    {canAddToCatalog && (isManual || hasGaps) && (
                        <label className="flex items-center gap-2 border-t border-slate-200 pt-3 text-xs font-medium text-slate-700">
                            <input
                                type="checkbox"
                                checked={Boolean(value.add_to_catalog)}
                                onChange={(event) => onChange({ ...value, add_to_catalog: event.target.checked })}
                                className="h-4 w-4 rounded-[4px] border-slate-300 text-teal-700 focus:ring-teal-600/30"
                            />
                            {isManual ? 'Добавить в справочник' : 'Сохранить формы в справочнике'}
                        </label>
                    )}
                </div>
            )}
        </div>
    );
}
