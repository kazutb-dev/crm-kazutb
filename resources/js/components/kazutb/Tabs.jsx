import React from 'react';

export function KazTabs({ items = [], value, defaultValue, onChange, variant = 'underline', style = {}, ...rest }) {
    const [internal, setInternal] = React.useState(defaultValue ?? (items[0] && items[0].value));
    const active = value !== undefined ? value : internal;
    const select = (v) => { if (value === undefined) setInternal(v); onChange && onChange(v); };

    if (variant === 'pill') {
        return (
            <div style={{ display: 'inline-flex', gap: 4, padding: 4, background: 'var(--ink-100)', borderRadius: 'var(--radius-pill)', ...style }} {...rest}>
                {items.map((it) => {
                    const on = it.value === active;
                    return (
                        <button key={it.value} onClick={() => select(it.value)}
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: 7,
                                border: 'none', cursor: 'pointer', padding: '8px 18px',
                                borderRadius: 'var(--radius-pill)',
                                fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 700,
                                background: on ? 'var(--surface-card)' : 'transparent',
                                color: on ? 'var(--navy-700)' : 'var(--ink-500)',
                                boxShadow: on ? 'var(--shadow-sm)' : 'none',
                                transition: 'all var(--dur-fast) var(--ease-standard)',
                            }}>
                            {it.icon}{it.label}
                        </button>
                    );
                })}
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', gap: 4, borderBottom: '1.5px solid var(--border-subtle)', ...style }} {...rest}>
            {items.map((it) => {
                const on = it.value === active;
                return (
                    <button key={it.value} onClick={() => select(it.value)}
                        style={{
                            position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 7,
                            border: 'none', background: 'transparent', cursor: 'pointer',
                            padding: '12px 18px', marginBottom: -1.5,
                            fontFamily: 'var(--font-sans)', fontSize: 'var(--text-md)', fontWeight: 700,
                            color: on ? 'var(--navy-800)' : 'var(--ink-500)',
                            transition: 'color var(--dur-fast) var(--ease-standard)',
                        }}
                        onMouseEnter={(e) => { if (!on) e.currentTarget.style.color = 'var(--navy-600)'; }}
                        onMouseLeave={(e) => { if (!on) e.currentTarget.style.color = 'var(--ink-500)'; }}>
                        {it.icon}{it.label}
                        <span style={{
                            position: 'absolute', left: 12, right: 12, bottom: 0, height: 3, borderRadius: '3px 3px 0 0',
                            background: 'var(--gradient-wave)',
                            transform: on ? 'scaleX(1)' : 'scaleX(0)', transformOrigin: 'center',
                            transition: 'transform var(--dur-base) var(--ease-out)',
                        }} />
                    </button>
                );
            })}
        </div>
    );
}
