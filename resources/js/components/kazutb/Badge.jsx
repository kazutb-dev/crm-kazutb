import React from 'react';

export function KazBadge({ children, tone = 'navy', variant = 'soft', dot = false, style = {}, ...rest }) {
    const palette = {
        navy:    { soft: ['var(--navy-50)', 'var(--navy-700)'],    solid: ['var(--navy-600)', '#fff'] },
        teal:    { soft: ['var(--teal-50)', 'var(--teal-700)'],    solid: ['var(--teal-500)', '#fff'] },
        gold:    { soft: ['var(--gold-100)', 'var(--gold-800)'],   solid: ['var(--gold-400)', 'var(--navy-900)'] },
        success: { soft: ['var(--kz-success-soft)', 'var(--kz-success)'], solid: ['var(--kz-success)', '#fff'] },
        danger:  { soft: ['var(--kz-danger-soft)', 'var(--kz-danger)'],   solid: ['var(--kz-danger)', '#fff'] },
        neutral: { soft: ['var(--ink-100)', 'var(--ink-700)'],     solid: ['var(--ink-700)', '#fff'] },
    }[tone][variant];

    return (
        <span
            style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '3px 10px', borderRadius: 'var(--radius-pill)',
                background: palette[0], color: palette[1],
                fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)',
                fontWeight: 'var(--weight-bold)', lineHeight: 1.4,
                letterSpacing: '0.01em', whiteSpace: 'nowrap',
                ...style,
            }}
            {...rest}
        >
            {dot && (
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
            )}
            {children}
        </span>
    );
}
