import { useTranslation } from 'react-i18next';

export default function SiteHeader() {
    const { i18n } = useTranslation();

    const handleLanguageChange = (lang) => {
        i18n.changeLanguage(lang);
    };

    const langs = [
        { code: 'ru', label: 'РУС' },
        { code: 'kk', label: 'ҚАЗ' },
        { code: 'en', label: 'ENG' },
    ];

    return (
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                    width: 40, height: 40, borderRadius: 'var(--radius-md)',
                    background: 'var(--gradient-deep)',
                    boxShadow: 'var(--shadow-md)',
                    display: 'grid', placeItems: 'center', overflow: 'hidden',
                }}>
                    <img src="/assets/images/logo-seal.png" alt="KazUTB" style={{ width: 34, height: 34, objectFit: 'contain' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15, color: 'var(--navy-800)', letterSpacing: '-0.02em' }}>
                        KazUTB
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--teal-700)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                        Campus AI
                    </span>
                </div>
            </div>

            <div style={{ display: 'flex', gap: 3, padding: 3, background: 'var(--ink-100)', borderRadius: 'var(--radius-pill)' }}>
                {langs.map(({ code, label }) => {
                    const active = i18n.language === code;
                    return (
                        <button
                            key={code}
                            type="button"
                            onClick={() => handleLanguageChange(code)}
                            style={{
                                border: 'none', cursor: 'pointer',
                                padding: '5px 12px', borderRadius: 'var(--radius-pill)',
                                fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
                                letterSpacing: '0.04em',
                                background: active ? 'var(--navy-600)' : 'transparent',
                                color: active ? '#fff' : 'var(--ink-500)',
                                boxShadow: active ? 'var(--shadow-sm)' : 'none',
                                transition: 'all var(--dur-fast) var(--ease-standard)',
                            }}
                        >
                            {label}
                        </button>
                    );
                })}
            </div>
        </header>
    );
}
