import { Link, usePage } from '@inertiajs/react';
import { BookOpen, Bot, Home, LogIn, MapPin } from 'lucide-react';
import { useEffect, useState } from 'react';
import AiAssistant from '@/Components/AiAssistant';

const safeRoute = (name) => {
    try { return route(name); } catch { return '#'; }
};

const NAV_LINKS = [
    { href: '/', label: 'Главная', icon: Home, hideOnMobile: true },
    { href: () => safeRoute('catalog.index'), label: 'Каталог', icon: BookOpen, hideOnMobile: false },
    { href: () => safeRoute('nav.index'), label: 'Навигация', icon: MapPin, hideOnMobile: true },
];

function PublicNav({ onOpenAi, scrolled, isAuthenticated }) {
    return (
        <header style={{
            position: 'fixed',
            left: 0, right: 0, top: 0,
            zIndex: 'var(--z-sticky)',
            transition: 'background var(--dur-base) var(--ease-standard), box-shadow var(--dur-base) var(--ease-standard), backdrop-filter var(--dur-base) var(--ease-standard)',
            background: scrolled ? 'rgba(6,18,58,0.62)' : 'transparent',
            backdropFilter: scrolled ? 'blur(22px) saturate(1.8)' : 'none',
            WebkitBackdropFilter: scrolled ? 'blur(22px) saturate(1.8)' : 'none',
            borderBottom: scrolled ? '1px solid rgba(255,255,255,0.09)' : '1px solid transparent',
            boxShadow: scrolled ? 'var(--shadow-md)' : 'none',
        }}>
            <div style={{
                maxWidth: 'var(--container-xl)',
                margin: '0 auto',
                padding: '0 var(--gutter)',
                height: 72,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
            }}>
                {/* Compact identity block: seal + wordmark */}
                <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', flexShrink: 0 }}>
                    <img
                        src="/assets/images/logo-seal.png"
                        alt="КазУТБ"
                        style={{ width: 44, height: 44, objectFit: 'contain', opacity: 0.95, filter: 'drop-shadow(0 2px 8px rgba(0,0,0,.5))' }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{
                            fontFamily: 'var(--font-mono)', fontWeight: 500, fontSize: 12,
                            color: 'var(--teal-300)', marginTop: 5, letterSpacing: '0.07em',
                            textTransform: 'uppercase',
                            textShadow: '0 1px 8px rgba(0,0,0,0.8)',
                        }}>
                            Казахский университет технологии и бизнеса имени К. Кулажанова
                        </span>

                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)' }}>
                            Единый цифровой портал
                        </span>

                    </div>
                </Link>

                <nav aria-label="Публичная навигация" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {NAV_LINKS.map(({ href, label, icon: Icon, hideOnMobile }) => (
                        <Link
                            key={label}
                            href={typeof href === 'function' ? href() : href}
                            className={hideOnMobile ? 'hidden sm:flex' : 'flex'}
                            style={{
                                alignItems: 'center', gap: 6,
                                padding: '8px 14px', borderRadius: 'var(--radius-pill)',
                                fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600,
                                color: 'rgba(255,255,255,0.90)', textDecoration: 'none',
                                textShadow: '0 1px 6px rgba(0,0,0,0.7)',
                                transition: 'var(--transition-colors)',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = '#fff'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.90)'; }}
                        >
                            <Icon style={{ width: 15, height: 15, flexShrink: 0 }} />
                            <span>{label}</span>
                        </Link>
                    ))}

                    <button
                        type="button"
                        onClick={onOpenAi}
                        aria-label="Открыть AI Ассистент"
                        className="kz-chip kz-chip--active"
                        style={{ marginLeft: 4 }}
                    >
                        <Bot style={{ width: 15, height: 15, flexShrink: 0 }} />
                        <span className="hidden sm:inline">AI Ассистент</span>
                    </button>

                    {!isAuthenticated && (
                        <Link
                            href={safeRoute('login')}
                            className="hidden md:flex"
                            style={{
                                alignItems: 'center', gap: 6, marginLeft: 4,
                                padding: '8px 14px', borderRadius: 'var(--radius-pill)',
                                border: '1px solid rgba(255,255,255,0.30)',
                                background: 'rgba(255,255,255,0.10)',
                                backdropFilter: 'blur(8px)',
                                WebkitBackdropFilter: 'blur(8px)',
                                fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600,
                                color: '#fff', textDecoration: 'none',
                                textShadow: '0 1px 6px rgba(0,0,0,0.5)',
                                transition: 'var(--transition-colors)',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.18)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.45)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.10)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.30)'; }}
                        >
                            <LogIn style={{ width: 15, height: 15, flexShrink: 0 }} />
                            <span>Войти</span>
                        </Link>
                    )}
                </nav>
            </div>
        </header>
    );
}

export default function PublicLayout({ children }) {
    const { auth } = usePage().props;
    const isAuthenticated = Boolean(auth?.user);
    const [isAiOpen, setIsAiOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handler = () => setIsAiOpen(true);
        window.addEventListener('open-ai-assistant', handler);
        return () => window.removeEventListener('open-ai-assistant', handler);
    }, []);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 40);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    return (
        <>
            {/* Atmosphere: university poster + vivid blue wash + teal/gold accents */}
            <div style={{ pointerEvents: 'none', position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden' }}>
                <img
                    src="/assets/images/bg-poster.png"
                    alt=""
                    aria-hidden="true"
                    style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        opacity: 0.8,
                        filter: 'contrast(1.18) saturate(1.0) brightness(0.6)',
                    }}
                />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(4,12,40,0.45) 0%, rgba(5,14,46,0.58) 55%, rgba(4,10,34,0.74) 100%)' }} />
                <div className="kz-orb kz-orb--teal" style={{ width: 720, height: 720, top: '-20%', right: '-12%', opacity: 0.38 }} />
                <div className="kz-orb kz-orb--teal" style={{ width: 440, height: 440, top: '42%', left: '-10%', opacity: 0.32 }} />
                <div className="kz-orb kz-orb--gold" style={{ width: 480, height: 480, bottom: '-8%', right: '15%', opacity: 0.35 }} />
            </div>

            <PublicNav onOpenAi={() => setIsAiOpen(true)} scrolled={scrolled} isAuthenticated={isAuthenticated} />

            <div style={{ position: 'relative', zIndex: 1, paddingTop: 72, minHeight: '100vh' }}>
                {children}
            </div>

            {isAiOpen && <AiAssistant onClose={() => setIsAiOpen(false)} />}
        </>
    );
}
