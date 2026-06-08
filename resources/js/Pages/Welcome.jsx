import { Head, Link, useForm, usePage } from '@inertiajs/react';
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
    ShieldCheck,
    SlidersHorizontal,
    Timer,
    TrendingUp,
    Users,
    Eye,
    EyeOff,
    Lock,
    Mail,
    X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import AiAssistant from '@/Components/AiAssistant';

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
        title: 'KPI — Сводка',
        desc: 'Сводная аналитика и экспорт KPI-отчётов.',
        category: 'KPI и аналитика',
        href: safeRoute('kpi.summary'),
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

export default function Welcome({ canLogin }) {
    const { auth } = usePage().props;
    const isAuthenticated = Boolean(auth?.user);
    const [search, setSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState('Учебный процесс');
    const [isCatalogOpen, setIsCatalogOpen] = useState(false);
    const [isCatalogClosing, setIsCatalogClosing] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [isAiOpen, setIsAiOpen] = useState(false);
    const { data: loginData, setData: setLoginData, post: postLogin, processing: loginProcessing, errors: loginErrors, reset: resetLogin } = useForm({
        email: '',
        password: '',
        remember: false,
    });

    const headingFont = { fontFamily: '"Playfair Display", Georgia, "Times New Roman", serif' };

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

    const submitLogin = (e) => {
        e.preventDefault();

        postLogin(route('login'), {
            onFinish: () => resetLogin('password'),
        });
    };

    return (
        <>
            <Head title="Единый цифровой портал · КазУТБ">
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
                <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Manrope:wght@400..800&display=swap" rel="stylesheet" />
            </Head>

            <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0b1a2e] p-3 font-['Manrope'] sm:p-4 lg:p-6">
                <div className="pointer-events-none absolute inset-0 bg-[url('/assets/images/bg-poster.png')] bg-cover bg-center opacity-24 blur-[2px] scale-[1.01]" />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#071522]/96 via-[#0b2038]/94 to-[#07131f]/98" />
                <div className="pointer-events-none absolute inset-0 bg-black/42" />

                <section className="animate-fade-slide-up relative z-10 w-full max-w-[1180px] overflow-hidden rounded-2xl bg-[#0f243f]/78 px-4 py-10 text-white ring-1 ring-white/16 shadow-[0_28px_90px_rgba(0,0,0,.52),inset_0_0_0_1px_rgba(255,255,255,.04)] backdrop-blur-[100px] sm:px-6 lg:px-10 lg:py-14">
                    <div className="relative grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_420px] lg:items-center">
                        <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
                            <div className="w-full max-w-[680px]">
                                <img
                                    src="/assets/images/logo.png"
                                    alt="КазУТБ"
                                    className="mx-auto h-[88px] w-[88px] object-contain opacity-92 drop-shadow-[0_4px_20px_rgba(0,0,0,.4)] lg:mx-0"
                                />

                                <h1
                                    style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
                                    className="mt-5 text-[clamp(2.15rem,4.2vw,3.3rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-white"
                                >
                                    Казахский университет технологии и бизнеса
                                    <br />
                                    <span className="text-[#F5C36C]">имени К. Кулажанова</span>
                                </h1>

                                <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#F5C36C]/88 sm:text-[13px]">
                                    Единый цифровой портал
                                </p>

                                <p className="mt-2 text-[15px] font-medium tracking-wide text-[#F5C36C]/82 sm:text-[17px]">
                                    Цифровая экосистема университета
                                </p>
                            </div>

                            <p className="mt-6 max-w-[620px] text-[15px] leading-7 text-white/84 sm:text-[17px]">
                                Все сервисы, документы и внутренние процессы собраны в{' '}
                                <span className="text-[#F5C36C]">единой цифровой системе университета</span>.
                            </p>

                            <div className="mt-8 flex flex-wrap justify-center gap-3.5 lg:justify-start">
                                <Link
                                    href={safeRoute('catalog.index')}
                                    className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[12px] border border-[#E8A020]/35 bg-[#E8A020]/10 px-6 text-sm font-semibold text-[#F5C36C] transition hover:border-[#E8A020]/55 hover:bg-[#E8A020]/18"
                                >
                                    Каталог сервисов
                                </Link>
                                <Link
                                    href={safeRoute('nav.index')}
                                    className="inline-flex min-h-[48px] items-center justify-center rounded-[12px] border border-white/18 bg-white/7 px-6 text-sm font-semibold text-white/90 transition hover:border-white/28 hover:bg-white/10"
                                >
                                    Навигация по кампусу
                                </Link>
                                <button
                                    type="button"
                                    onClick={() => setIsAiOpen(true)}
                                    className="inline-flex min-h-[48px] items-center justify-center rounded-[12px] border border-[#4f6b8a] bg-[#15304d]/92 px-6 text-sm font-semibold text-white transition hover:border-[#6d89a8] hover:bg-[#1a3959]"
                                >
                                    AI Ассистент
                                </button>
                            </div>
                        </div>

                        <div className="relative">
                            <div className="absolute inset-6 rounded-[20px] bg-[radial-gradient(circle_at_top,rgba(255,255,255,.04),transparent_48%),linear-gradient(180deg,rgba(13,31,54,.24),rgba(13,31,54,0))] blur-2xl" />

                            {!isAuthenticated ? (
                                <div className="relative rounded-[18px] border border-white/18 bg-[#0f2744]/94 p-5 shadow-[0_22px_58px_rgba(0,0,0,.4)] backdrop-blur-xl sm:p-6">
                                    <div className="mb-5 flex items-start justify-between gap-4">
                                        <div>
                                            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#E8A020]/85">Безопасная авторизация</p>
                                            <h2 style={headingFont} className="mt-2 text-[22px] font-semibold tracking-[-0.02em] text-white">Вход в платформу</h2>
                                            <p className="mt-1.5 text-sm text-white/72">Единая учётная запись университета</p>
                                        </div>
                                        <div className="inline-flex items-center gap-2 rounded-[10px] border border-white/20 bg-white/8 px-3 py-1.5 text-xs font-medium text-white/88">
                                            <span className="h-2 w-2 rounded-full bg-emerald-300" />
                                            Online
                                        </div>
                                    </div>

                                    <form onSubmit={submitLogin} className="space-y-4">
                                        <div>
                                        <label htmlFor="welcome-email" className="mb-1 block text-sm font-semibold text-white/90">
                                                Email
                                        </label>
                                            <div className="relative">
                                                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0f243f]/45" />
                                                <input
                                                    id="welcome-email"
                                                    type="text"
                                                    name="email"
                                                    value={loginData.email}
                                                    placeholder="Введите email"
                                                    autoComplete="username"
                                                    onChange={(e) => setLoginData('email', e.target.value)}
                                                    className="w-full rounded-xl border border-white/20 bg-white/95 px-4 py-3 pl-10 text-sm text-[#0f243f] outline-none placeholder:text-[#0f243f]/55 shadow-[inset_0_1px_0_rgba(255,255,255,.03)] focus:border-[#E8A020] focus:bg-white"
                                                />
                                            </div>
                                            {loginErrors.email && <p className="mt-1 text-xs text-rose-200">{loginErrors.email}</p>}
                                        </div>

                                        <div>
                                            <label htmlFor="welcome-password" className="mb-1 block text-sm font-semibold text-white/90">
                                                Пароль
                                            </label>
                                            <div className="relative">
                                                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0f243f]/45" />
                                                <input
                                                    id="welcome-password"
                                                    type={showPassword ? 'text' : 'password'}
                                                    name="password"
                                                    value={loginData.password}
                                                    autoComplete="current-password"
                                                    placeholder="Введите пароль"
                                                    onChange={(e) => setLoginData('password', e.target.value)}
                                                    className="w-full rounded-xl border border-white/20 bg-white/95 px-4 py-3 pl-10 pr-12 text-sm text-[#0f243f] outline-none placeholder:text-[#0f243f]/55 shadow-[inset_0_1px_0_rgba(255,255,255,.03)] focus:border-[#E8A020] focus:bg-white"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword((value) => !value)}
                                                    className="absolute inset-y-0 right-0 inline-flex items-center justify-center px-3 text-[#0f243f]/45 transition hover:text-[#0f243f]"
                                                    aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                                                >
                                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                </button>
                                            </div>
                                            {loginErrors.password && <p className="mt-1 text-xs text-rose-200">{loginErrors.password}</p>}
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-white/88">
                                                <input
                                                    type="checkbox"
                                                    name="remember"
                                                    checked={loginData.remember}
                                                    onChange={(e) => setLoginData('remember', e.target.checked)}
                                                    className="h-4 w-4 rounded border-white/25 bg-white/10 text-[#E8A020] focus:ring-[#E8A020]"
                                                />
                                                Запомнить меня
                                            </label>
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={loginProcessing}
                                            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#E8A020] px-4 py-3 text-sm font-bold text-[#0f243f] shadow-[0_14px_34px_rgba(232,160,32,.3)] transition hover:-translate-y-0.5 hover:bg-[#d08c12] disabled:cursor-not-allowed disabled:opacity-70"
                                        >
                                            {loginProcessing ? 'Выполняется вход...' : 'Войти в систему'}
                                            {!loginProcessing && <ArrowRight className="h-4 w-4" />}
                                        </button>
                                    </form>
                                </div>
                            ) : (
                                <div className="relative rounded-[18px] border border-white/18 bg-[#0f2744]/94 p-5 shadow-[0_22px_58px_rgba(0,0,0,.4)] backdrop-blur-xl sm:p-6">
                                    <div className="mb-1 flex items-center justify-between gap-4">
                                        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#E8A020]/85">Добро пожаловать</p>
                                        <div className="inline-flex items-center gap-2 rounded-[10px] border border-white/20 bg-white/8 px-3 py-1.5 text-xs font-medium text-white/88">
                                            <span className="h-2 w-2 rounded-full bg-emerald-300" />
                                            Онлайн
                                        </div>
                                    </div>
                                    <h2 style={headingFont} className="mt-1 text-[22px] font-semibold tracking-[-0.02em] text-white">Вы в системе</h2>
                                    <p className="mt-3 text-sm leading-relaxed text-white/78">
                                        Вы авторизованы в системе КазУТБ. Перейдите в рабочее пространство для доступа ко всем сервисам университета.
                                    </p>
                                    <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
                                        <Link
                                            href={safeRoute('dashboard')}
                                            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#E8A020] px-4 py-3 text-sm font-bold text-[#0f243f] shadow-[0_8px_24px_rgba(232,160,32,.28)] transition hover:bg-[#d08c12]"
                                        >
                                            Перейти в систему
                                            <ArrowRight className="h-4 w-4" />
                                        </Link>
                                        <Link
                                            href={safeRoute('profile.edit')}
                                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/18 bg-white/8 px-4 py-3 text-sm font-medium text-white/80 transition hover:bg-white/12 hover:text-white"
                                        >
                                            Мой профиль
                                        </Link>
                                    </div>
                                </div>
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
                                            className="w-full border border-white/20 bg-white/95 py-2.5 pl-10 pr-4 text-sm text-[#0f243f] placeholder:text-[#0f243f]/55 outline-none transition focus:border-[#E8A020]/60 focus:bg-white"
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


            </main>
            {isAiOpen && <AiAssistant onClose={() => setIsAiOpen(false)} />}
        </>
    );
}
