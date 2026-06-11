import { Head, Link, useForm, usePage } from '@inertiajs/react';
import {
    ArrowRight,
    BookOpen,
    Bot,
    Eye,
    EyeOff,
    Lock,
    Mail,
    MapPinned,
    Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import PublicLayout from '@/Layouts/PublicLayout';
import useReveal from '@/hooks/useReveal';

const safeRoute = (name) => {
    try {
        return route(name);
    } catch {
        return '#';
    }
};

const openAiAssistant = () => window.dispatchEvent(new Event('open-ai-assistant'));

const PILLARS = [
    {
        title: 'AI-ассистент',
        desc: 'Отвечает на вопросы о кабинетах, сервисах, сотрудниках и работе портала.',
        icon: Bot,
        onClick: openAiAssistant,
    },
    {
        title: 'Каталог сервисов',
        desc: 'Более 50 цифровых сервисов: от справок и сертификатов до KPI и библиотеки.',
        icon: BookOpen,
        href: () => safeRoute('catalog.index'),
    },
    {
        title: 'Навигация по кампусу',
        desc: 'Поиск кабинетов и отделов с пошаговыми маршрутами по корпусам.',
        icon: MapPinned,
        href: () => safeRoute('nav.index'),
    },
];

function LoginCard() {
    const [showPassword, setShowPassword] = useState(false);
    const { data, setData, post, processing, errors, reset } = useForm({
        email: '',
        password: '',
        remember: false,
    });

    const submit = (e) => {
        e.preventDefault();
        post(route('login'), {
            onFinish: () => reset('password'),
        });
    };

    return (
        <div className="kz-panel p-5 sm:p-6">
            <h2 className="kz-display text-[17px] font-semibold">Вход в портал</h2>
            <p className="mt-1 text-[13px] text-white/55">Единая учётная запись университета</p>

            <form onSubmit={submit} className="mt-5 space-y-3.5">
                <div>
                    <label htmlFor="welcome-email" className="sr-only">Email</label>
                    <div className="relative">
                        <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                        <input
                            id="welcome-email"
                            type="text"
                            name="email"
                            value={data.email}
                            placeholder="Email"
                            autoComplete="username"
                            onChange={(e) => setData('email', e.target.value)}
                            className="kz-field !pl-11"
                        />
                    </div>
                    {errors.email && <p className="mt-1.5 text-xs text-rose-300">{errors.email}</p>}
                </div>

                <div>
                    <label htmlFor="welcome-password" className="sr-only">Пароль</label>
                    <div className="relative">
                        <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                        <input
                            id="welcome-password"
                            type={showPassword ? 'text' : 'password'}
                            name="password"
                            value={data.password}
                            autoComplete="current-password"
                            placeholder="Пароль"
                            onChange={(e) => setData('password', e.target.value)}
                            className="kz-field !pl-11 !pr-12"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword((value) => !value)}
                            className="absolute inset-y-0 right-0 inline-flex items-center justify-center px-3.5 text-white/35 transition hover:text-white/75"
                            aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                        >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                    {errors.password && <p className="mt-1.5 text-xs text-rose-300">{errors.password}</p>}
                </div>

                <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-white/65">
                    <input
                        type="checkbox"
                        name="remember"
                        checked={data.remember}
                        onChange={(e) => setData('remember', e.target.checked)}
                        className="h-4 w-4 rounded border-white/25 bg-white/10 text-[var(--gold-500)] focus:ring-[var(--teal-400)]"
                    />
                    Запомнить меня
                </label>

                <button type="submit" disabled={processing} className="kz-btn kz-btn--gold w-full">
                    {processing ? 'Выполняется вход…' : 'Войти'}
                    {!processing && <ArrowRight className="h-4 w-4" />}
                </button>
            </form>
        </div>
    );
}

function AuthenticatedCard() {
    return (
        <div className="kz-panel p-5 sm:p-6">
            <h2 className="kz-display text-[17px] font-semibold">Вы в системе</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/65">
                Перейдите в рабочее пространство, чтобы получить доступ ко всем сервисам университета.
            </p>
            <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
                <Link href={safeRoute('dashboard')} className="kz-btn kz-btn--gold flex-1">
                    Перейти в систему
                    <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href={safeRoute('profile.edit')} className="kz-btn kz-btn--ghost">
                    Мой профиль
                </Link>
            </div>
        </div>
    );
}

function Welcome() {
    const { auth } = usePage().props;
    const isAuthenticated = Boolean(auth?.user);
    useReveal();

    return (
        <>
            <Head title="Единый интеллектуальный портал · КазУТБ" />

            <main style={{ fontFamily: 'var(--font-sans)' }} className="relative text-white lg:h-[calc(100vh-72px)] lg:overflow-hidden">
                <div className="mx-auto w-full max-w-[var(--container-xl)] px-[var(--gutter)] lg:flex lg:h-full lg:flex-col">
                    {/* ── Hero ── */}
                    <section className="grid items-center gap-8 py-8 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1.35fr)_450px] lg:py-4">
                        <div className="kz-stagger flex flex-col items-center text-center lg:items-start lg:text-left">

                            {/* Focal value proposition */}
                            <h1
                                className="kz-display mt-4 max-w-[720px] text-[clamp(2rem,3.4vw,3rem)] font-semibold lg:mt-2"
                                style={{
                                    background: 'linear-gradient(135deg, #f0fafe 0%, #67e8f9 28%, #22d3ee 55%, var(--teal-300) 72%, #f59e0b 100%)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    backgroundClip: 'text',
                                    textShadow: 'none',
                                    letterSpacing: '-0.01em',
                                }}
                            >
                                Единый интеллектуальный портал университета
                            </h1>

                            <p className="mt-3 max-w-[620px] text-[15px] leading-6 text-white/75 sm:text-base">
                                Искусственный интеллект, цифровые сервисы и все университетские
                                процессы — в одном пространстве. Для студентов, преподавателей
                                и сотрудников.
                            </p>

                            {/* Single primary action: ask the AI */}
                            <button
                                type="button"
                                onClick={openAiAssistant}
                                className="group mt-5 flex w-full max-w-[560px] items-center gap-3 rounded-[var(--radius-pill)] border border-white/14 bg-white/[0.07] py-3 pl-4 pr-2 text-left backdrop-blur-md transition hover:border-[rgba(9,186,178,0.45)] hover:bg-white/[0.11]"
                            >
                                <Sparkles className="h-4 w-4 flex-shrink-0 text-[var(--teal-300)]" />
                                <span className="flex-1 truncate text-sm text-white/55 transition group-hover:text-white/75">
                                    Спросите AI-ассистента: «Где деканат?», «Как получить KPI баллы?»
                                </span>
                                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[var(--navy-900)]" style={{ background: 'var(--gradient-gold)' }}>
                                    <ArrowRight className="h-4 w-4" />
                                </span>
                            </button>
                        </div>

                        <div className="kz-up w-full" style={{ animationDelay: '180ms', filter: 'drop-shadow(0 0 52px rgba(9,186,178,0.16))' }}>
                            {isAuthenticated ? <AuthenticatedCard /> : <LoginCard />}
                        </div>
                    </section>

                    {/* ── Platform pillars ── */}
                    <section aria-label="Возможности платформы" className="pb-8 lg:pb-3">
                        <div className="grid gap-2.5 md:grid-cols-3">
                            {PILLARS.map((pillar) => {
                                const Icon = pillar.icon;
                                const inner = (
                                    <>
                                        <span className="kz-icon-badge h-10 w-10">
                                            <Icon className="h-[18px] w-[18px]" />
                                        </span>
                                        <h2 className="kz-display mt-3.5 text-base font-semibold">{pillar.title}</h2>
                                        <p className="mt-1.5 text-[13.5px] leading-relaxed text-white/55">{pillar.desc}</p>
                                    </>
                                );
                                const className = 'kz-tile kz-reveal h-full flex-col items-start p-4 lg:p-3.5 text-left';

                                return pillar.onClick ? (
                                    <button key={pillar.title} type="button" onClick={pillar.onClick} className={className}>
                                        {inner}
                                    </button>
                                ) : (
                                    <Link key={pillar.title} href={pillar.href()} className={className}>
                                        {inner}
                                    </Link>
                                );
                            })}
                        </div>
                    </section>
                </div>
            </main>
        </>
    );
}

Welcome.layout = (page) => <PublicLayout>{page}</PublicLayout>;
export default Welcome;
