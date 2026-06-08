import { Link } from '@inertiajs/react';
import { BookOpen, Bot, Home, MapPin } from 'lucide-react';
import { useEffect, useState } from 'react';
import AiAssistant from '@/Components/AiAssistant';

const BG_IMAGE = '/assets/images/bg-poster.png';
const SERIF = { fontFamily: '"Playfair Display", Georgia, "Times New Roman", serif' };

const safeRoute = (name) => {
    try { return route(name); } catch { return '#'; }
};

const NAV_LINKS = [
    { href: '/', label: 'Главная', icon: Home, hideOnMobile: true },
    { href: () => safeRoute('catalog.index'), label: 'Каталог', icon: BookOpen, hideOnMobile: false },
    { href: () => safeRoute('nav.index'), label: 'Навигация', icon: MapPin, hideOnMobile: true },
];

function PublicNav({ onOpenAi }) {
    return (
        <header className="fixed left-0 right-0 top-0 z-50 border-b border-white/[0.10] bg-[#061120]/97 backdrop-blur-xl">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8" style={{ height: '72px' }}>

                {/* Brand */}
                <Link href="/" className="group flex items-center gap-3.5">
                    <img
                        src="/assets/images/logo.png"
                        alt="КазУТБ"
                        className="h-11 w-11 object-contain opacity-92 transition group-hover:opacity-100 drop-shadow-[0_2px_8px_rgba(0,0,0,.5)]"
                    />
                    <div className="hidden flex-col leading-tight sm:flex">
                        <span style={SERIF} className="text-[15px] font-semibold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,.55)] transition group-hover:text-white">
                            Единый цифровой портал
                        </span>

                        <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/60 transition group-hover:text-white/75">
                            Казахский университет технологии и бизнеса имени К. Кулажанова
                        </span>
                    </div>
                </Link>

                {/* Nav */}
                <nav aria-label="Публичная навигация" className="flex items-center gap-1">
                    {NAV_LINKS.map(({ href, label, icon: Icon, hideOnMobile }) => (
                        <Link
                            key={label}
                            href={typeof href === 'function' ? href() : href}
                            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium text-white/80 transition hover:bg-white/[0.08] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E8A020] ${hideOnMobile ? 'hidden sm:flex' : 'flex'}`}
                        >
                            <Icon className="h-4 w-4 flex-shrink-0" />
                            <span>{label}</span>
                        </Link>
                    ))}

                    {/* AI Button — visually accented */}
                    <button
                        type="button"
                        onClick={onOpenAi}
                        className="ml-1 flex items-center gap-1.5 rounded-lg border border-[#E8A020]/35 bg-[#E8A020]/10 px-3 py-2 text-[13px] font-semibold text-[#f4bf55] transition hover:border-[#E8A020]/55 hover:bg-[#E8A020]/16 hover:text-[#ffd37c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E8A020]"
                        aria-label="Открыть AI Ассистент"
                    >
                        <Bot className="h-4 w-4 flex-shrink-0" />
                        <span className="hidden sm:inline">AI Ассистент</span>
                    </button>
                </nav>
            </div>
        </header>
    );
}

export default function PublicLayout({ children }) {
    const [isAiOpen, setIsAiOpen] = useState(false);

    useEffect(() => {
        const handler = () => setIsAiOpen(true);
        window.addEventListener('open-ai-assistant', handler);
        return () => window.removeEventListener('open-ai-assistant', handler);
    }, []);

    return (
        <>
            <div className="pointer-events-none fixed inset-0 z-0">
                <img
                    src={BG_IMAGE}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                    aria-hidden="true"
                />
                <div className="absolute inset-0 bg-[#0b1a2e]/65" />
                <div className="absolute inset-0 bg-gradient-to-br from-[#16355A]/70 via-[#16355A]/25 to-[#00B0AD]/10" />
            </div>
            <PublicNav onOpenAi={() => setIsAiOpen(true)} />
            <div className="relative z-[1] pt-[72px]">
                {children}
            </div>
            {isAiOpen && <AiAssistant onClose={() => setIsAiOpen(false)} />}
        </>
    );
}
