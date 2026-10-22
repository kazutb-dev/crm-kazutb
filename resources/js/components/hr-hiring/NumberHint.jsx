import axios from 'axios';
import { TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * Next number from the yearly counter (contract «№{n}», order «{n}-К») and a warning when the typed number is
 * already used in the same year by another hiring.
 */
export default function NumberHint({ kind, date, value, hiringId, onApply }) {
    const [hint, setHint] = useState(null);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            axios.get(route('hr.hiring.lookup.numbers', { kind, date: date || undefined, value: value || undefined, hiring: hiringId }))
                .then((response) => setHint(response.data))
                .catch(() => setHint(null));
        }, 400);

        return () => window.clearTimeout(timer);
    }, [kind, date, value, hiringId]);

    if (!hint) {
        return null;
    }

    return (
        <div className="mt-1 space-y-1 text-xs">
            {hint.next !== value && (
                <p className="text-slate-500">
                    Следующий свободный за {hint.year} г.: <span className="font-medium text-slate-700">{hint.next}</span>
                    {hint.external_last ? ` (учтён номер вне системы: ${hint.external_last}-К)` : ''}{' '}
                    <button type="button" onClick={() => onApply(hint.next)} className="font-medium text-teal-700 hover:underline">подставить</button>
                </p>
            )}
            {hint.duplicate_hiring_id && (
                <p className="flex items-center gap-1 text-amber-800">
                    <TriangleAlert className="h-3.5 w-3.5" />
                    Этот номер уже есть в {hint.year} г.:{' '}
                    <a href={route('hr.hiring.show', hint.duplicate_hiring_id)} target="_blank" rel="noreferrer" className="underline">приём #{hint.duplicate_hiring_id}</a>
                </p>
            )}
        </div>
    );
}
