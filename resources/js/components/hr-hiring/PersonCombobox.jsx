import { Combobox, ComboboxInput, ComboboxOption, ComboboxOptions } from '@headlessui/react';
import axios from 'axios';
import { PencilLine, UserRound, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { inputClassName } from './ui';

/**
 * The employee being replaced: any system account or employee hired through the module, or a name typed in.
 * value: { user_id, employee_id, full_name }
 */
export default function PersonCombobox({ id, value, onChange, error }) {
    const [query, setQuery] = useState('');
    const [items, setItems] = useState([]);
    const requestRef = useRef(0);
    const typed = query.trim();

    useEffect(() => {
        if (typed.length < 2) {
            setItems([]);
            return undefined;
        }
        const request = ++requestRef.current;
        const timer = window.setTimeout(() => {
            axios.get(route('hr.hiring.lookup.staff', { q: typed }))
                .then((response) => request === requestRef.current && setItems(response.data.items ?? []))
                .catch(() => request === requestRef.current && setItems([]));
        }, 250);

        return () => window.clearTimeout(timer);
    }, [typed]);

    const select = (item) => {
        if (!item) {
            return;
        }
        onChange({
            user_id: item.kind === 'user' ? item.id : null,
            employee_id: item.kind === 'employee' ? item.id : null,
            full_name: item.full_name,
        });
        setQuery('');
    };

    const current = value?.full_name ? value : null;

    return (
        <div>
            <Combobox value={current} onChange={select} by={(a, b) => (a?.full_name ?? '') === (b?.full_name ?? '')} immediate>
                <div className="relative">
                    <ComboboxInput
                        id={id}
                        className={`${inputClassName} pr-9`}
                        displayValue={(item) => item?.full_name ?? ''}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="ФИО замещаемого работника"
                        autoComplete="off"
                    />
                    {current && (
                        <button
                            type="button"
                            onClick={() => onChange({ user_id: null, employee_id: null, full_name: '' })}
                            className="absolute inset-y-0 right-2 my-auto h-6 rounded-md p-1 text-slate-400 hover:bg-slate-100"
                            title="Очистить"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>
                <ComboboxOptions anchor="bottom start" className="z-50 mt-1 max-h-72 w-[var(--input-width)] overflow-auto rounded-xl border border-slate-200 bg-white p-1 text-sm shadow-lg empty:invisible">
                    {items.map((item) => (
                        <ComboboxOption key={`${item.kind}-${item.id}`} value={item} className="flex cursor-pointer items-start gap-2 rounded-lg px-3 py-2 data-[focus]:bg-teal-50">
                            <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                            <span className="min-w-0">
                                <span className="block text-slate-900">{item.full_name}</span>
                                {item.note && <span className="block text-xs text-slate-500">{item.note}</span>}
                            </span>
                        </ComboboxOption>
                    ))}
                    {typed.length >= 2 && (
                        <ComboboxOption value={{ kind: 'manual', id: null, full_name: typed }} className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-teal-800 data-[focus]:bg-teal-50">
                            <PencilLine className="h-4 w-4" />
                            Ввести вручную: «{typed}»
                        </ComboboxOption>
                    )}
                </ComboboxOptions>
            </Combobox>
            {error ? <p className="mt-1 text-xs text-rose-600">{error}</p> : (
                <p className="mt-1 text-xs text-slate-500">Поиск по сотрудникам системы и принятым через модуль; можно ввести ФИО вручную.</p>
            )}
        </div>
    );
}
