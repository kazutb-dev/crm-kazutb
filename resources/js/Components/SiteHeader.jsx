import { Link } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';

export default function SiteHeader() {
    const { i18n } = useTranslation();

    const handleLanguageChange = (lang) => {
        i18n.changeLanguage(lang);
    };

    return (
        <header className="topbar">
            <div className="logo">
                <div className="logo-badge">
                    <img src="/assets/images/logo.png" alt="KazUTB" />
                </div>
                <div className="logo-title">
                    <b>KazUTB</b>
                    <span>Campus AI</span>
                </div>
            </div>
            <div className="right-actions" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                        className={`btn ${i18n.language === 'ru' ? 'btn-primary' : 'btn-ghost'}`}
                        type="button"
                        style={{ padding: '8px 12px', fontSize: '14px', minWidth: 'auto' }}
                        onClick={() => handleLanguageChange('ru')}
                    >
                        РУС
                    </button>
                    <button
                        className={`btn ${i18n.language === 'kk' ? 'btn-primary' : 'btn-ghost'}`}
                        type="button"
                        style={{ padding: '8px 12px', fontSize: '14px', minWidth: 'auto' }}
                        onClick={() => handleLanguageChange('kk')}
                    >
                        ҚАЗ
                    </button>
                    <button
                        className={`btn ${i18n.language === 'en' ? 'btn-primary' : 'btn-ghost'}`}
                        type="button"
                        style={{ padding: '8px 12px', fontSize: '14px', minWidth: 'auto' }}
                        onClick={() => handleLanguageChange('en')}
                    >
                        ENG
                    </button>
                </div>
            </div>
        </header>
    );
}