import { Head, Link } from '@inertiajs/react';
import {
    AlertCircle,
    ArrowRight,
    Award,
    BarChart3,
    BookOpen,
    BookOpenText,
    Bot,
    Building,
    Building2,
    CalendarDays,
    CalendarRange,
    ClipboardList,
    Clock,
    FileText,
    GraduationCap,
    Megaphone,
    ScrollText,
    Search,
    Send,
    ShieldCheck,
    SlidersHorizontal,
    Timer,
    TrendingUp,
    Users,
    X,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';

const categories = [
    'Учебный процесс',
    'KPI и аналитика',
    'HR и кадры',
    'Библиотека',
    'Документы и сервисы',
    'Smart Calendar',
    'AI Tutor',
    'AI Student',
];

const safeRoute = (name) => {
    try {
        return route(name);
    } catch {
        return '#';
    }
};

const serviceCards = [
    // ── Учебный процесс ──
    {
        title: 'Факультеты и кафедры',
        desc: 'Единая структура факультетов, кафедр и сотрудников.',
        category: 'Учебный процесс',
        href: safeRoute('faculties.index'),
        icon: GraduationCap,
    },
    {
        title: 'Учебные годы',
        desc: 'Академические периоды и учебные циклы.',
        category: 'Учебный процесс',
        href: safeRoute('academic-years.index'),
        icon: CalendarDays,
    },
    {
        title: 'Образовательные программы',
        desc: 'Настройка и администрирование программ.',
        category: 'Учебный процесс',
        href: safeRoute('educational-programs.index'),
        icon: BookOpen,
    },
    {
        title: 'Дипломные работы',
        desc: 'Загрузка, проверка и утверждение дипломов.',
        category: 'Учебный процесс',
        href: safeRoute('diplomas.index'),
        icon: ScrollText,
    },
    {
        title: 'Студенты',
        desc: 'Каталог студентов и их профилей.',
        category: 'Учебный процесс',
        href: safeRoute('users.students'),
        icon: Users,
    },

    // ── KPI и аналитика ──
    {
        title: 'KPI — Сезоны',
        desc: 'Управление KPI-сезонами и их статусами.',
        category: 'KPI и аналитика',
        href: safeRoute('kpi.index'),
        icon: CalendarDays,
    },
    {
        title: 'KPI — Мои показатели',
        desc: 'Личная форма заполнения KPI-показателей.',
        category: 'KPI и аналитика',
        href: safeRoute('kpi.my-form'),
        icon: BarChart3,
    },
    {
        title: 'KPI — Индикаторы',
        desc: 'Настройка и редактирование индикаторов KPI.',
        category: 'KPI и аналитика',
        href: safeRoute('kpi.indicators.index'),
        icon: SlidersHorizontal,
    },
    {
        title: 'KPI — Очередь проверки',
        desc: 'Проверка KPI-записей сотрудников кафедры.',
        category: 'KPI и аналитика',
        href: safeRoute('kpi.review-queue'),
        icon: ShieldCheck,
    },
    {
        title: 'KPI — Утверждение',
        desc: 'Деканское утверждение KPI-показателей.',
        category: 'KPI и аналитика',
        href: safeRoute('kpi.approval-queue'),
        icon: ShieldCheck,
    },
    {
        title: 'KPI — Аналитика',
        desc: 'Сводная аналитика и экспорт данных KPI.',
        category: 'KPI и аналитика',
        href: safeRoute('kpi.analytics.index'),
        icon: TrendingUp,
    },

    // ── HR и кадры ──
    {
        title: 'Сотрудники',
        desc: 'Кадровый каталог и профили персонала.',
        category: 'HR и кадры',
        href: safeRoute('users.index'),
        icon: Users,
    },
    {
        title: 'Должности',
        desc: 'Справочник должностей и грейдов.',
        category: 'HR и кадры',
        href: safeRoute('positions.index'),
        icon: Building2,
    },
    {
        title: 'Департаменты',
        desc: 'Структура подразделений и отделов.',
        category: 'HR и кадры',
        href: safeRoute('divisions.index'),
        icon: Building,
    },
    {
        title: 'HR Dashboard',
        desc: 'Сводная HR-аналитика и статистика присутствия.',
        category: 'HR и кадры',
        href: safeRoute('hr.dashboard'),
        icon: BarChart3,
    },
    {
        title: 'Учёт рабочего времени',
        desc: 'Данные Perco: приходы, уходы, отчёты.',
        category: 'HR и кадры',
        href: safeRoute('hr.perco.index'),
        icon: Clock,
    },
    {
        title: 'Опоздавшие',
        desc: 'Список сотрудников с опозданиями за период.',
        category: 'HR и кадры',
        href: safeRoute('hr.perco.late'),
        icon: AlertCircle,
    },

    // ── Библиотека ──
    {
        title: 'Library Dashboard',
        desc: 'Общая статистика и состояние фонда.',
        category: 'Библиотека',
        href: safeRoute('library.dashboard'),
        icon: BookOpenText,
    },
    {
        title: 'Выдать книгу',
        desc: 'Оформление выдачи книги читателю.',
        category: 'Библиотека',
        href: safeRoute('library.issue-book'),
        icon: ClipboardList,
    },
    {
        title: 'Брони книг',
        desc: 'Управление бронированиями и резервами.',
        category: 'Библиотека',
        href: safeRoute('library.reservations.admin'),
        icon: Timer,
    },

    // ── Документы и сервисы ──
    {
        title: 'Объявления',
        desc: 'Официальные публикации университета.',
        category: 'Документы и сервисы',
        href: safeRoute('announcements.index'),
        icon: Megaphone,
    },
    {
        title: 'Заявки',
        desc: 'Тикеты и обращения сотрудников.',
        category: 'Документы и сервисы',
        href: safeRoute('tickets.index'),
        icon: ClipboardList,
    },
    {
        title: 'Навигация',
        desc: 'Маршруты и точки навигации по кампусу.',
        category: 'Документы и сервисы',
        href: safeRoute('nav.index'),
        icon: Search,
    },
    {
        title: 'Шаблоны',
        desc: 'Шаблоны для генерации сертификатов.',
        category: 'Документы и сервисы',
        href: safeRoute('templates.index'),
        icon: FileText,
    },
    {
        title: 'Сертификаты',
        desc: 'Выпуск и верификация сертификатов.',
        category: 'Документы и сервисы',
        href: safeRoute('certificates.index'),
        icon: Award,
    },

    // ── AI Tutor ──
    {
        title: 'AI Tutor',
        desc: 'Интеллектуальный помощник для преподавателей.',
        category: 'AI Tutor',
        href: 'https://ai-tutor.kaztbu.edu.kz/login',
        icon: Bot,
    },

    // ── AI Student ──
    {
        title: 'AI Student',
        desc: 'Интеллектуальный помощник для студентов.',
        category: 'AI Student',
        href: 'https://ai-student.kaztbu.edu.kz/login',
        icon: Bot,
    },

    // ── Smart Calendar ──
    {
        title: 'Мой календарь',
        desc: 'Личное расписание встреч и событий.',
        category: 'Smart Calendar',
        href: safeRoute('calendar.index'),
        icon: CalendarRange,
    },
    {
        title: 'Сотрудники',
        desc: 'Доступность и расписание коллег.',
        category: 'Smart Calendar',
        href: safeRoute('calendar.employees'),
        icon: Users,
    },
    {
        title: 'Конференции',
        desc: 'Планирование и управление конференциями.',
        category: 'Smart Calendar',
        href: safeRoute('calendar.conferences'),
        icon: Building2,
    },
    {
        title: 'Аналитика',
        desc: 'Статистика использования календаря.',
        category: 'Smart Calendar',
        href: safeRoute('calendar.analytics'),
        icon: TrendingUp,
    },
];

function normalizePolyline(polyline) {
    if (!Array.isArray(polyline)) {
        return [];
    }

    return polyline
        .map((point) => ({
            x: Number(point?.x),
            y: Number(point?.y),
        }))
        .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
        .filter((point) => point.x >= 0 && point.x <= 100 && point.y >= 0 && point.y <= 100);
}

function buildSmoothPath(points) {
    if (!Array.isArray(points) || points.length === 0) {
        return '';
    }

    if (points.length === 1) {
        return `M ${points[0].x} ${points[0].y}`;
    }

    if (points.length === 2) {
        return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
    }

    const pathParts = [`M ${points[0].x} ${points[0].y}`];

    for (let index = 1; index < points.length - 1; index += 1) {
        const current = points[index];
        const next = points[index + 1];
        const midX = (current.x + next.x) / 2;
        const midY = (current.y + next.y) / 2;
        pathParts.push(`Q ${current.x} ${current.y}, ${midX} ${midY}`);
    }

    const lastIndex = points.length - 1;
    pathParts.push(`Q ${points[lastIndex - 1].x} ${points[lastIndex - 1].y}, ${points[lastIndex].x} ${points[lastIndex].y}`);

    return pathParts.join(' ');
}

export default function Welcome({ canLogin }) {
    const [search, setSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState('Учебный процесс');
    const [isCatalogOpen, setIsCatalogOpen] = useState(false);
    const [isCatalogClosing, setIsCatalogClosing] = useState(false);
    const [isAiOpen, setIsAiOpen] = useState(false);
    const [aiInput, setAiInput] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const aiMessagesEndRef = useRef(null);
    const [aiMessages, setAiMessages] = useState([
        {
            id: 1,
            role: 'assistant',
            text: 'Здравствуйте! Я AI ассистент KazUTB. Подскажу нужный сервис или раздел.',
        },
    ]);

    const headingFont = { fontFamily: '"Literata", ui-serif, Georgia, Times, serif' };
    const brandMarkStyle = {
        width: '108px',
        height: '108px',
        borderRadius: '50%',
        background: '#0f243f',
        border: '3.5px solid rgba(255,255,255,.92)',
        boxShadow: '0 16px 48px rgba(0,0,0,.38), 0 2px 10px rgba(0,0,0,.2)',
        position: 'relative',
        flex: '0 0 auto',
        transition: 'transform .36s cubic-bezier(.23,1,.32,1)',
    };

    const filteredCards = useMemo(() => {
        const query = search.trim().toLowerCase();

        return serviceCards.filter((card) => {
            if (card.category !== activeCategory) {
                return false;
            }

            if (!query) {
                return true;
            }

            return card.title.toLowerCase().includes(query)
                || card.desc.toLowerCase().includes(query);
        });
    }, [activeCategory, search]);

    const closeCatalog = () => {
        setIsCatalogClosing(true);
        setTimeout(() => {
            setIsCatalogOpen(false);
            setIsCatalogClosing(false);
        }, 260);
    };

    const getCsrfToken = () =>
        decodeURIComponent(document.cookie.match(/XSRF-TOKEN=([^;]+)/)?.[1] ?? '');

    const sendAiMessage = async () => {
        const value = aiInput.trim();
        if (!value || aiLoading) return;

        const user = { id: Date.now(), role: 'user', text: value };
        const nextMessages = [...aiMessages, user];

        setAiMessages(nextMessages);
        setAiInput('');
        setAiLoading(true);

        try {
            const res = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-XSRF-TOKEN': getCsrfToken(),
                },
                credentials: 'include',
                body: JSON.stringify({
                    messages: nextMessages.map(({ role, text }) => ({ role, text })),
                }),
            });

            let data = {};
            try {
                data = await res.json();
            } catch {
                data = {};
            }

            const botText = data.text || data.error || 'Извините, не удалось получить ответ.';

            setAiMessages((prev) => [
                ...prev,
                {
                    id: Date.now(),
                    role: 'assistant',
                    text: botText,
                    imageUrl: typeof data.image_url === 'string' ? data.image_url : null,
                    routePolyline: normalizePolyline(data.route_polyline),
                },
            ]);
        } catch {
            setAiMessages((prev) => [
                ...prev,
                { id: Date.now(), role: 'assistant', text: 'Ошибка соединения. Попробуйте позже.' },
            ]);
        } finally {
            setAiLoading(false);
        }
    };

    return (
        <>
            <Head title="KazUTB Portal">
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
                <link href="https://fonts.googleapis.com/css2?family=Literata:opsz,wght@7..72,500..900&family=Manrope:wght@400..800&display=swap" rel="stylesheet" />
            </Head>

            <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0b1a2e] p-3 font-['Manrope'] sm:p-4 lg:p-6">
                <div className="pointer-events-none absolute inset-0 bg-[url('https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=1800&q=80')] bg-cover bg-center opacity-55 blur-[2px] scale-[1.03]" />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#203653]/95 via-[#2b4265]/82 to-[#18b8b3]/26" />
                <div className="pointer-events-none absolute inset-0 bg-black/10 backdrop-blur-[2px]" />

                <section className="animate-fade-slide-up relative z-10 w-full max-w-[1180px] overflow-hidden rounded-2xl bg-[#0f243f]/55 px-4 py-10 text-white ring-1 ring-white/15 shadow-[0_28px_90px_rgba(0,0,0,.42),inset_0_0_0_1px_rgba(232,160,32,.22)] sm:px-6 lg:px-10 lg:py-14">
                    {/* logo */}
                    <div className="mb-14 mt-0 flex w-full flex-col items-center self-center">
                        <div className="relative flex flex-col items-center gap-2">
                            <div aria-label="Логотип КазУТБ" role="img" style={brandMarkStyle} className="hover:scale-105">
                                <img
                                    src="/assets/images/logo.png"
                                    alt="KazUTB logo"
                                    className="h-full w-full rounded-full object-contain mb-4"
                                />
                            </div>
                            <span style={{
                                fontFamily: 'var(--font-heading, "Literata", ui-serif, Georgia, Times, serif)',
                                position: 'absolute',
                                zIndex: 1,
                                width: 'max-content',
                                bottom: '-40px',
                                fontSize: '18px',
                                fontWeight: 800,
                                color: 'rgba(255,255,255,.98)',
                                textTransform: 'uppercase',
                                lineHeight: 1.1,
                                textAlign: 'center',
                                letterSpacing: '-.006em',
                                textShadow: '0 2px 14px rgba(0,0,0,.65), 0 4px 32px rgba(0,0,0,.35)',
                                transition: 'opacity .42s ease, color .42s ease, text-shadow .42s ease, font-size .42s ease, letter-spacing .42s ease',
                            }}>
                                Казахский университет технологии и бизнеса имени К. Кулажанова
                            </span>
                        </div>
                    </div>

                    <div className="relative z-10 m-10 flex w-full max-w-5xl flex-col items-center text-center lg:items-start lg:text-left">

                        {/* badge */}
                        <span className="mt-7 mb-2 inline-flex items-center gap-2 border border-[#E8A020]/45 bg-[#E8A020]/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#E8A020]">
                            Цифровая экосистема университета
                        </span>

                        {/* heading */}
                        <h1 style={headingFont} className="max-w-3xl text-4xl font-extrabold leading-[1.02] tracking-[-0.04em] sm:text-6xl">
                            Единая витрина <span className='text-[#E8A020]'>цифровых сервисов</span>
                            <br />
                            для сотрудников
                        </h1>
                        <p className="mt-5 max-w-2xl text-base leading-8 text-white/80 sm:text-lg">
                            Получите доступ к цифровым услугам университета: заявки, справки, бронирования, поддержка — всё в одном месте.
                        </p>

                        {/* actions */}
                        <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
                            <button
                                type="button"
                                onClick={() => setIsCatalogOpen(true)}
                                className="inline-flex min-h-12 items-center justify-center border border-white/30 bg-white/10 px-8 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-white/20"
                            >
                                Открыть каталог
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsAiOpen(true)}
                                className="inline-flex min-h-12 items-center justify-center bg-[#E8A020] px-8 text-sm font-bold text-[#0f243f] shadow-[0_14px_34px_rgba(232,160,32,.32)] transition hover:-translate-y-0.5 hover:bg-[#d08c12]"
                            >
                                AI Assistant
                            </button>
                            {canLogin && (
                                <Link
                                    href={route('login')}
                                    className="inline-flex min-h-12 items-center justify-center border border-white/30 bg-white/10 px-8 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-white/20"
                                >
                                    Login
                                </Link>
                            )}
                        </div>
                    </div>
                </section>

                {isCatalogOpen && (
                    <div
                        className={`fixed inset-0 z-[80] flex items-end justify-center bg-[#071524]/75 px-0 py-0 backdrop-blur-md sm:items-center sm:px-4 sm:py-6 ${isCatalogClosing ? 'animate-fade-out' : 'animate-fade-in'}`}
                        onClick={closeCatalog}
                    >
                        <div
                            className={`relative flex w-full max-h-[94vh] flex-col overflow-hidden rounded-t-2xl text-white sm:rounded-2xl sm:max-w-6xl bg-[#0f243f]/80 backdrop-blur-2xl ring-1 ring-white/15 shadow-[0_28px_90px_rgba(0,0,0,.65),inset_0_0_0_1px_rgba(232,160,32,.22)] ${isCatalogClosing ? 'animate-modal-out' : 'animate-modal-in'}`}
                            onClick={(e) => e.stopPropagation()}
                        >
                                {/* ── header ── */}
                                <div className="flex flex-shrink-0 items-center justify-between px-6 py-5 sm:px-8" style={{ borderBottom: '1px solid rgba(255,255,255,.09)' }}>
                                    <div>
                                        <span className="mb-1 inline-flex items-center gap-1.5 border border-[#E8A020]/45 bg-[#E8A020]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#E8A020]">
                                            <BookOpen className="h-3 w-3" /> Цифровые сервисы КазУТБ
                                        </span>
                                        <h3 style={headingFont} className="text-xl font-extrabold leading-tight tracking-tight text-white sm:text-2xl">
                                            Каталог сервисов
                                        </h3>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={closeCatalog}
                                        className="ml-4 inline-flex min-h-9 min-w-9 items-center justify-center border border-white/30 bg-white/10 text-white/70 transition hover:bg-white/20 hover:text-white"
                                        aria-label="Закрыть"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>

                                {/* ── search ── */}
                                <div className="flex-shrink-0 px-6 py-3.5 sm:px-8" style={{ borderBottom: '1px solid rgba(255,255,255,.07)' }}>
                                    <div className="relative">
                                        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                                        <input
                                            type="text"
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                            placeholder="Найти сервис..."
                                            className="w-full border border-white/20 bg-white/10 py-2.5 pl-10 pr-4 text-sm text-white placeholder-white/40 outline-none transition focus:border-[#E8A020]/60 focus:bg-white/15"
                                        />
                                    </div>
                                </div>

                                <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
                                    {/* ── category tabs ── */}
                                    <aside className="flex flex-shrink-0 gap-2 overflow-x-auto px-6 py-4 sm:px-8 lg:w-64 lg:flex-col lg:overflow-x-visible lg:overflow-y-auto lg:border-r lg:py-6" style={{ borderBottom: '1px solid rgba(255,255,255,.07)', borderColor: 'rgba(255,255,255,.07)' }}>
                                        {categories.map((cat) => {
                                            const active = activeCategory === cat;
                                            return (
                                                <button
                                                    key={cat}
                                                    type="button"
                                                    onClick={() => setActiveCategory(cat)}
                                                    className={`flex-shrink-0 px-4 py-2.5 text-left text-sm font-bold transition lg:w-full ${
                                                        active
                                                            ? 'bg-[#E8A020] text-[#0f243f] shadow-[0_8px_24px_rgba(232,160,32,.28)]'
                                                            : 'border border-white/20 bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
                                                    }`}
                                                >
                                                    {cat}
                                                </button>
                                            );
                                        })}
                                    </aside>

                                    {/* ── cards ── */}
                                    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-8">
                                        <span className="mb-4 inline-flex items-center gap-1.5 border border-[#E8A020]/45 bg-[#E8A020]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#E8A020]">
                                            {activeCategory}
                                        </span>
                                        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                            {filteredCards.length === 0 && (
                                                <p className="col-span-full py-10 text-center text-sm text-white/40">Ничего не найдено</p>
                                            )}
                                            {filteredCards.map((card) => {
                                                const Icon = card.icon;
                                                const disabled = card.href === '#';
                                                return (
                                                    <a
                                                        key={card.title}
                                                        href={disabled ? undefined : card.href}
                                                        className={`group flex items-start gap-4 border border-white/15 bg-white/8 p-5 transition ${
                                                            disabled
                                                                ? 'pointer-events-none opacity-30'
                                                                : 'hover:border-[#E8A020]/50 hover:bg-white/15 hover:shadow-[inset_0_0_0_1px_rgba(232,160,32,.22)]'
                                                        }`}
                                                    >
                                                        <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center border border-[#E8A020]/30 bg-[#E8A020]/15 text-[#E8A020] transition group-hover:bg-[#E8A020]/25">
                                                            <Icon className="h-5 w-5" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <h5 style={headingFont} className="truncate text-base font-bold leading-tight text-white">{card.title}</h5>
                                                            <p className="mt-1 text-sm leading-relaxed text-white/50">{card.desc}</p>
                                                        </div>
                                                        {!disabled && (
                                                            <ArrowRight className="ml-auto mt-1 h-3.5 w-3.5 flex-shrink-0 text-white/25 transition group-hover:translate-x-0.5 group-hover:text-[#E8A020]" />
                                                        )}
                                                    </a>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                        </div>
                    </div>
                )}

                {/* ── AI modal ── */}
                {isAiOpen && (
                    <div
                        className="animate-fade-in fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/55 px-4"
                        onClick={() => setIsAiOpen(false)}
                    >
                        <div
                            className="animate-modal-in w-full max-w-2xl border border-slate-200 bg-white shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
                                <div>
                                    <h3 className="text-lg font-bold text-[#16355A]">AI Ассистент KazUTB</h3>
                                    <p className="text-sm text-slate-500">Помощь по сервисам и разделам портала</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsAiOpen(false)}
                                    className="rounded p-1 text-slate-500 hover:bg-slate-100"
                                    aria-label="Закрыть"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="max-h-[52vh] space-y-3 overflow-y-auto p-5">
                                {aiMessages.map((message) => (
                                    <div
                                        key={message.id}
                                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div className={`max-w-[80%] px-4 py-2 text-sm ${message.role === 'user' ? 'bg-[#16355A] text-white' : 'border border-slate-200 bg-slate-50 text-slate-700'}`}>
                                            <p>{message.text}</p>
                                            {message.role === 'assistant' && typeof message.imageUrl === 'string' && message.imageUrl.trim() !== '' && (
                                                <div className="relative mt-3 w-full max-w-sm overflow-hidden border border-slate-200 bg-white">
                                                    <img
                                                        src={message.imageUrl}
                                                        alt="Маршрут"
                                                        className="block max-h-56 w-full object-contain"
                                                        loading="lazy"
                                                    />
                                                    {Array.isArray(message.routePolyline) && message.routePolyline.length > 0 && (
                                                        <svg
                                                            viewBox="0 0 100 100"
                                                            preserveAspectRatio="none"
                                                            className="pointer-events-none absolute inset-0 h-full w-full"
                                                            aria-hidden="true"
                                                        >
                                                            {message.routePolyline.length > 1 && (
                                                                <>
                                                                    <path
                                                                        d={buildSmoothPath(message.routePolyline)}
                                                                        fill="none"
                                                                        stroke="#000"
                                                                        strokeWidth="1.08"
                                                                        strokeLinecap="round"
                                                                        strokeLinejoin="round"
                                                                        opacity="0.18"
                                                                    />
                                                                    <path
                                                                        d={buildSmoothPath(message.routePolyline)}
                                                                        fill="none"
                                                                        stroke="#111"
                                                                        strokeWidth="0.64"
                                                                        strokeLinecap="round"
                                                                        strokeLinejoin="round"
                                                                        strokeDasharray="1.45 2.2"
                                                                    />
                                                                </>
                                                            )}
                                                            <circle
                                                                cx={message.routePolyline[0]?.x}
                                                                cy={message.routePolyline[0]?.y}
                                                                r="1.1"
                                                                fill="#e5242a"
                                                                stroke="#fff"
                                                                strokeWidth="0.32"
                                                            />
                                                            {message.routePolyline.length > 1 && (
                                                                <circle
                                                                    cx={message.routePolyline[message.routePolyline.length - 1]?.x}
                                                                    cy={message.routePolyline[message.routePolyline.length - 1]?.y}
                                                                    r="1.1"
                                                                    fill="#16a34a"
                                                                    stroke="#fff"
                                                                    strokeWidth="0.32"
                                                                />
                                                            )}
                                                        </svg>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {aiLoading && (
                                    <div className="flex justify-start">
                                        <div className="border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-400">
                                            ...
                                        </div>
                                    </div>
                                )}
                                <div ref={aiMessagesEndRef} />
                            </div>

                            <div className="border-t border-slate-200 p-4">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={aiInput}
                                        onChange={(e) => setAiInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                sendAiMessage();
                                            }
                                        }}
                                        placeholder="Например: где найти факультеты?"
                                        className="w-full border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#16355A]"
                                        disabled={aiLoading}
                                    />
                                    <button
                                        type="button"
                                        onClick={sendAiMessage}
                                        disabled={aiLoading || !aiInput.trim()}
                                        className="inline-flex items-center gap-1 bg-[#16355A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f2744] disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Send className="h-4 w-4" />
                                        Отправить
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </>
    );
}
