import { useEffect, useState } from 'react';

export function usePersistedState(key, initialValue) {
    const [state, setState] = useState(() => {
        if (typeof window === 'undefined') {
            return initialValue;
        }

        try {
            const raw = window.localStorage.getItem(key);
            if (!raw) {
                return initialValue;
            }

            return JSON.parse(raw);
        } catch {
            return initialValue;
        }
    });

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        try {
            window.localStorage.setItem(key, JSON.stringify(state));
        } catch {
            // Ignore storage failures.
        }
    }, [key, state]);

    return [state, setState];
}
