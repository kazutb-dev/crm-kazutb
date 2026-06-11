import React from 'react';

export function KazTag({ children, selected = false, removable = false, onRemove, icon = null, style = {}, ...rest }) {
    return (
        <span
            role={rest.onClick ? 'button' : undefined}
            style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '6px 14px', borderRadius: 'var(--radius-pill)',
                fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-semibold)', lineHeight: 1.2,
                cursor: rest.onClick ? 'pointer' : 'default',
                border: selected ? '1.5px solid var(--teal-400)' : '1.5px solid var(--border-subtle)',
                background: selected ? 'var(--teal-50)' : 'var(--surface-card)',
                color: selected ? 'var(--teal-800)' : 'var(--ink-700)',
                transition: 'var(--transition-colors), transform var(--dur-fast) var(--ease-spring)',
                ...style,
            }}
            onMouseEnter={(e) => {
                if (!selected) {
                    e.currentTarget.style.borderColor = 'var(--navy-200)';
                    e.currentTarget.style.background = 'var(--navy-50)';
                }
            }}
            onMouseLeave={(e) => {
                if (!selected) {
                    e.currentTarget.style.borderColor = 'var(--border-subtle)';
                    e.currentTarget.style.background = 'var(--surface-card)';
                }
            }}
            {...rest}
        >
            {icon}
            {children}
            {removable && (
                <span
                    onClick={(e) => { e.stopPropagation(); onRemove && onRemove(e); }}
                    aria-label="Remove"
                    style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 16, height: 16, borderRadius: '50%', marginRight: -4,
                        background: selected ? 'var(--teal-200)' : 'var(--ink-200)',
                        color: selected ? 'var(--teal-800)' : 'var(--ink-700)',
                        fontSize: 12, lineHeight: 1, cursor: 'pointer',
                    }}
                >
                    ×
                </span>
            )}
        </span>
    );
}
