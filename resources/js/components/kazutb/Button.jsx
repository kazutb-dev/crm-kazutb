import React from 'react';

export function KazButton({
    children,
    variant = 'primary',
    size = 'md',
    shape = 'pill',
    fullWidth = false,
    disabled = false,
    iconLeft = null,
    iconRight = null,
    style = {},
    ...rest
}) {
    const sizes = {
        sm: { padding: '0 16px', height: 36, fontSize: 'var(--text-sm)', gap: 6 },
        md: { padding: '0 22px', height: 46, fontSize: 'var(--text-md)', gap: 8 },
        lg: { padding: '0 30px', height: 56, fontSize: 'var(--text-lg)', gap: 10 },
    }[size];

    const variants = {
        primary: {
            background: 'var(--navy-600)', color: '#fff',
            boxShadow: 'var(--shadow-sm)', border: '1px solid transparent',
        },
        accent: {
            background: 'var(--teal-500)', color: '#fff',
            boxShadow: 'var(--shadow-teal)', border: '1px solid transparent',
        },
        gold: {
            background: 'var(--gradient-gold)', color: 'var(--navy-900)',
            boxShadow: 'var(--shadow-gold)', border: '1px solid transparent',
        },
        outline: {
            background: 'transparent', color: 'var(--navy-700)',
            border: '2px solid var(--navy-200)', boxShadow: 'none',
        },
        ghost: {
            background: 'transparent', color: 'var(--teal-700)',
            border: '1px solid transparent', boxShadow: 'none',
        },
        onDark: {
            background: 'rgba(255,255,255,0.10)', color: '#fff',
            border: '1px solid rgba(255,255,255,0.30)', boxShadow: 'none',
            backdropFilter: 'blur(6px)',
        },
    }[variant];

    const radius = shape === 'pill' ? 'var(--radius-pill)' : 'var(--radius-md)';

    return (
        <button
            disabled={disabled}
            style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                gap: sizes.gap, height: sizes.height, padding: sizes.padding,
                fontSize: sizes.fontSize, fontFamily: 'var(--font-sans)',
                fontWeight: 'var(--weight-bold)', lineHeight: 1,
                letterSpacing: 'var(--tracking-tight)',
                borderRadius: radius, cursor: disabled ? 'not-allowed' : 'pointer',
                width: fullWidth ? '100%' : 'auto',
                opacity: disabled ? 0.5 : 1,
                transition: 'transform var(--dur-fast) var(--ease-spring), box-shadow var(--dur-base) var(--ease-standard), background-color var(--dur-fast) var(--ease-standard), filter var(--dur-fast) var(--ease-standard)',
                ...variants, ...style,
            }}
            onMouseDown={(e) => { if (!disabled) e.currentTarget.style.transform = 'scale(0.97)'; }}
            onMouseUp={(e) => { e.currentTarget.style.transform = ''; }}
            onMouseEnter={(e) => {
                if (disabled) return;
                e.currentTarget.style.filter = 'brightness(1.06)';
                if (['primary', 'accent', 'gold'].includes(variant))
                    e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                if (variant === 'outline') e.currentTarget.style.borderColor = 'var(--teal-400)';
                if (variant === 'ghost') e.currentTarget.style.background = 'var(--teal-50)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.filter = '';
                e.currentTarget.style.transform = '';
                e.currentTarget.style.boxShadow = variants.boxShadow || '';
                if (variant === 'outline') e.currentTarget.style.borderColor = 'var(--navy-200)';
                if (variant === 'ghost') e.currentTarget.style.background = 'transparent';
            }}
            {...rest}
        >
            {iconLeft}
            {children}
            {iconRight}
        </button>
    );
}
