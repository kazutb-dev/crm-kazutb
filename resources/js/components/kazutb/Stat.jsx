import React from 'react';

export function KazStat({
    value, label, prefix = '', suffix = '', tone = 'navy',
    duration = 1400, align = 'start', style = {}, ...rest
}) {
    const [display, setDisplay] = React.useState(0);
    const ref = React.useRef(null);

    React.useEffect(() => {
        const numeric = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.]/g, '')) || 0;
        const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduce) { setDisplay(numeric); return; }
        let raf, start;
        const io = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                const step = (t) => {
                    if (!start) start = t;
                    const p = Math.min((t - start) / duration, 1);
                    const eased = 1 - Math.pow(1 - p, 3);
                    setDisplay(numeric * eased);
                    if (p < 1) raf = requestAnimationFrame(step);
                };
                raf = requestAnimationFrame(step);
                io.disconnect();
            }
        }, { threshold: 0.4 });
        if (ref.current) io.observe(ref.current);
        return () => { io.disconnect(); cancelAnimationFrame(raf); };
    }, [value, duration]);

    const color = { navy: 'var(--navy-700)', teal: 'var(--teal-600)', gold: 'var(--gold-600)', white: '#fff' }[tone];
    const labelColor = tone === 'white' ? 'rgba(255,255,255,0.72)' : 'var(--text-muted)';
    const isInt = !String(value).includes('.');
    const shown = isInt
        ? Math.round(display).toLocaleString('ru-RU').replace(/,/g, ' ')
        : display.toFixed(1);

    return (
        <div
            ref={ref}
            style={{
                display: 'flex', flexDirection: 'column', gap: 6,
                alignItems: align === 'center' ? 'center' : 'flex-start',
                textAlign: align === 'center' ? 'center' : 'left',
                ...style,
            }}
            {...rest}
        >
            <div style={{
                fontFamily: 'var(--font-display)', fontWeight: 800,
                fontSize: 'clamp(2.5rem, 1.5rem + 3vw, 3.75rem)',
                lineHeight: 1, letterSpacing: '-0.02em', color,
            }}>
                {prefix}{shown}{suffix}
            </div>
            <div style={{
                fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)',
                fontWeight: 600, color: labelColor, letterSpacing: '0.01em',
            }}>
                {label}
            </div>
        </div>
    );
}
