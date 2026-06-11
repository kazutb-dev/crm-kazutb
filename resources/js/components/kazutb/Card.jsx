import React from 'react';

export function KazCard({
    children,
    elevation = 'md',
    accent = 'none',
    interactive = false,
    padded = true,
    style = {},
    ...rest
}) {
    const shadow = {
        none: 'none', sm: 'var(--shadow-sm)', md: 'var(--shadow-md)', lg: 'var(--shadow-lg)', flat: 'none',
    }[elevation];

    const accentBar = {
        none: null, teal: 'var(--gradient-wave)', gold: 'var(--gradient-gold)', navy: 'var(--navy-600)',
    }[accent];

    return (
        <div
            style={{
                position: 'relative',
                background: 'var(--surface-card)',
                borderRadius: 'var(--radius-lg)',
                border: elevation === 'flat' ? '1px solid var(--border-subtle)' : '1px solid rgba(20,46,75,0.04)',
                boxShadow: shadow,
                padding: padded ? 'var(--space-5)' : 0,
                overflow: 'hidden',
                cursor: interactive ? 'pointer' : 'default',
                transition: 'transform var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-standard)',
                ...style,
            }}
            onMouseEnter={(e) => {
                if (!interactive) return;
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
            }}
            onMouseLeave={(e) => {
                if (!interactive) return;
                e.currentTarget.style.transform = '';
                e.currentTarget.style.boxShadow = shadow;
            }}
            {...rest}
        >
            {accentBar && (
                <span style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: accentBar }} />
            )}
            {children}
        </div>
    );
}
