import React from 'react';
import { KazCard } from './Card';
import { KazBadge } from './Badge';

export function KazProgramCard({
    title, faculty, level, duration, icon = null, tags = [],
    accent = 'teal', onClick, style = {}, ...rest
}) {
    const iconBg    = { teal: 'var(--teal-50)', gold: 'var(--gold-100)', navy: 'var(--navy-50)' }[accent];
    const iconColor = { teal: 'var(--teal-600)', gold: 'var(--gold-700)', navy: 'var(--navy-600)' }[accent];

    return (
        <KazCard accent={accent} interactive onClick={onClick} style={{ display: 'flex', flexDirection: 'column', gap: 14, ...style }} {...rest}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 52, height: 52, borderRadius: 'var(--radius-md)',
                    background: iconBg, color: iconColor,
                }}>
                    {icon}
                </span>
                {level && <KazBadge tone={accent === 'gold' ? 'gold' : 'navy'}>{level}</KazBadge>}
            </div>

            <div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-xl)', color: 'var(--text-strong)', lineHeight: 1.15, margin: 0 }}>
                    {title}
                </h3>
                {faculty && (
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginTop: 6 }}>
                        {faculty}
                    </div>
                )}
            </div>

            {tags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {tags.map((t, i) => (
                        <span key={i} style={{
                            fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 600,
                            color: 'var(--ink-600)', background: 'var(--ink-100)',
                            padding: '3px 10px', borderRadius: 'var(--radius-pill)',
                        }}>
                            {t}
                        </span>
                    ))}
                </div>
            )}

            <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 }}>
                {duration && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-faint)' }}>
                        {duration}
                    </span>
                )}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--teal-700)' }}>
                    Толығырақ
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12"/>
                        <polyline points="12 5 19 12 12 19"/>
                    </svg>
                </span>
            </div>
        </KazCard>
    );
}
