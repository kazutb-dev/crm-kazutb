import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowRight, BookOpenText, Eye, EyeOff, Lock, Mail, Search, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import PublicLayout from '@/Layouts/PublicLayout';

const safeRoute = (name) => {
    try {
        return route(name);
    } catch {
        return '#';
    }
};

function Login({ status, canResetPassword }) {
    const { data, setData, post, processing, errors, reset } = useForm({
        email: '',
        password: '',
        remember: false,
    });
    const [showPassword, setShowPassword] = useState(false);

    const submit = (e) => {
        e.preventDefault();

        post(route('login'), {
            onFinish: () => reset('password'),
        });
    };

    const headingFont = { fontFamily: '"Literata", ui-serif, Georgia, Times, serif' };

    const previewItems = [
        { label: 'Каталог сервисов', value: '53', meta: 'доступных модуля', icon: BookOpenText },
        { label: 'Навигация', value: '145', meta: 'точек кампуса', icon: Search },
        { label: 'Безопасный вход', value: 'SSO', meta: 'единая авторизация', icon: ShieldCheck },
    ];

    return (
        <>
            <Head title="Авторизация">
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
                <link href="https://fonts.googleapis.com/css2?family=Literata:opsz,wght@7..72,500..900&family=Manrope:wght@400..800&display=swap" rel="stylesheet" />
            </Head>

            <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0b1a2e] p-3 font-['Manrope'] sm:p-4 lg:p-6" style={{ fontFamily: '"Manrope", ui-sans-serif, system-ui, sans-serif' }}>
                <div className="pointer-events-none absolute inset-0 bg-[url('/assets/images/bg-poster.png')] bg-cover bg-center opacity-60 blur-[1px] scale-[1.03]" />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#102845]/84 via-[#132b49]/78 to-[#081826]/84" />
                <div className="pointer-events-none absolute inset-0 bg-black/12" />

                <section className="animate-fade-slide-up relative z-10 w-full max-w-[1180px] overflow-hidden rounded-2xl bg-[#0f243f]/60 px-4 py-6 text-white ring-1 ring-white/15 shadow-[0_28px_90px_rgba(0,0,0,.42),inset_0_0_0_1px_rgba(232,160,32,.22)] sm:px-6 lg:px-10 lg:py-8">
                    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_430px] lg:items-center">
                        <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
                            <div className="flex w-full items-start gap-4">
                                <div className="flex items-center gap-5">
                                    <div className="flex h-[112px] w-[112px] items-center justify-center rounded-full border border-white/28 bg-[#0f2744]/92 shadow-[0_14px_30px_rgba(0,0,0,.24)] sm:h-[126px] sm:w-[126px]">
                                        <img
                                            src="/assets/images/logo.png"
                                            alt="KazUTB logo"
                                            className="h-[84px] w-[84px] rounded-full object-contain sm:h-[98px] sm:w-[98px]"
                                        />
                                    </div>
                                    <div className="max-w-[520px] text-left">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/55">
                                            KazUTB CRM
                                        </p>
                                        <p className="mt-2 text-base font-semibold leading-7 text-white/92 sm:text-[17px]">
                                            Казахский университет технологии и бизнеса имени К. Кулажанова
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <p className="mt-8 inline-flex items-center gap-1.5 rounded-full border border-[#E8A020]/35 bg-[#E8A020]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#E8A020]">
                                Вход в систему
                            </p>

                            <h1 style={headingFont} className="mt-4 max-w-3xl text-[clamp(2.65rem,5vw,4.8rem)] font-semibold leading-[0.98] tracking-[-0.03em] text-white">
                                Авторизация
                            </h1>

                            <p className="mt-5 max-w-[620px] text-[15px] leading-7 text-white/74 sm:text-[17px]">
                                Введите логин или email и пароль, чтобы получить доступ к платформе, сервисам университета и навигации кампуса.
                            </p>

                            <div className="mt-8 flex flex-wrap justify-center gap-3.5 lg:justify-start">
                                <Link
                                    href="/"
                                    className="inline-flex min-h-[48px] items-center justify-center rounded-[12px] bg-[#F5C36C] px-6 text-sm font-semibold text-[#102845] shadow-[0_10px_20px_rgba(245,195,108,.16)] transition hover:bg-[#f0b84d]"
                                >
                                    На главную
                                </Link>
                                <Link
                                    href={safeRoute('catalog.index')}
                                    className="inline-flex min-h-[48px] items-center justify-center rounded-[12px] border border-white/18 bg-white/7 px-6 text-sm font-semibold text-white/90 transition hover:border-white/28 hover:bg-white/10"
                                >
                                    Каталог сервисов
                                </Link>
                                <Link
                                    href={safeRoute('nav.index')}
                                    className="inline-flex min-h-[48px] items-center justify-center rounded-[12px] border border-white/18 bg-white/7 px-6 text-sm font-semibold text-white/90 transition hover:border-white/28 hover:bg-white/10"
                                >
                                    Навигация по кампусу
                                </Link>
                            </div>

                            <div className="mt-8 grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
                                {previewItems.map((item) => {
                                    const Icon = item.icon;

                                    return (
                                        <div key={item.label} className="rounded-[16px] border border-white/10 bg-[#102845]/76 p-4 text-left backdrop-blur-md">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="inline-flex h-11 w-11 items-center justify-center rounded-[12px] border border-white/10 bg-white/8 text-[#E8A020]">
                                                    <Icon className="h-5 w-5" />
                                                </div>
                                            </div>
                                            <div className="mt-4">
                                                <p className="text-sm text-white/58">{item.label}</p>
                                                <div className="mt-1.5 flex items-end justify-between gap-3">
                                                    <p className="text-[1.7rem] font-semibold tracking-[-0.04em] text-white">{item.value}</p>
                                                    <p className="text-right text-xs leading-5 text-white/48">{item.meta}</p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="relative">
                            <div className="absolute inset-6 rounded-[20px] bg-[radial-gradient(circle_at_top,rgba(255,255,255,.05),transparent_48%),linear-gradient(180deg,rgba(13,31,54,.18),rgba(13,31,54,0))] blur-2xl" />
                            <div className="relative rounded-[18px] border border-white/14 bg-[#0f2744]/90 p-5 shadow-[0_22px_58px_rgba(0,0,0,.34)] sm:p-6">
                                <div className="mb-5 flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/52">Secure access</p>
                                        <h2 style={headingFont} className="mt-2 text-[22px] font-semibold tracking-[-0.02em] text-white sm:text-[26px]">Вход в платформу</h2>
                                        <p className="mt-1.5 text-sm text-white/68">Доступ к личным сервисам университета</p>
                                    </div>
                                    <div className="inline-flex items-center gap-2 rounded-[10px] border border-white/16 bg-white/8 px-3 py-1.5 text-xs font-medium text-white/84">
                                        <span className="h-2 w-2 rounded-full bg-emerald-300" />
                                        Online
                                    </div>
                                </div>

                                {status && (
                                    <div className="mb-4 rounded-md border border-emerald-300/35 bg-emerald-400/15 px-3 py-2 text-sm text-emerald-100">
                                        {status}
                                    </div>
                                )}

                                <form onSubmit={submit} className="space-y-4">
                                    <div>
                                        <label htmlFor="email" className="mb-1 block text-sm font-semibold text-white/90">
                                            Email
                                        </label>
                                        <div className="relative">
                                            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0f243f]/45" />
                                            <input
                                                id="email"
                                                type="text"
                                                name="email"
                                                value={data.email}
                                                placeholder="Введите email"
                                                autoComplete="username"
                                                autoFocus
                                                onChange={(e) => setData('email', e.target.value)}
                                                className="w-full rounded-xl border border-white/20 bg-white/95 px-4 py-3 pl-10 text-sm text-[#0f243f] outline-none placeholder:text-[#0f243f]/55 shadow-[inset_0_1px_0_rgba(255,255,255,.03)] focus:border-[#E8A020] focus:bg-white"
                                            />
                                        </div>
                                        {errors.email && (
                                            <p className="mt-1 text-xs text-rose-200">{errors.email}</p>
                                        )}
                                    </div>

                                    <div>
                                        <label htmlFor="password" className="mb-1 block text-sm font-semibold text-white/90">
                                            Пароль
                                        </label>
                                        <div className="relative">
                                            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0f243f]/45" />
                                            <input
                                                id="password"
                                                type={showPassword ? 'text' : 'password'}
                                                name="password"
                                                value={data.password}
                                                autoComplete="current-password"
                                                placeholder="Введите пароль"
                                                onChange={(e) => setData('password', e.target.value)}
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
                                        {errors.password && (
                                            <p className="mt-1 text-xs text-rose-200">{errors.password}</p>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between gap-3">
                                        <label className="inline-flex items-center gap-2 text-sm text-white/86">
                                            <input
                                                type="checkbox"
                                                name="remember"
                                                checked={data.remember}
                                                onChange={(e) => setData('remember', e.target.checked)}
                                                className="h-4 w-4 rounded border-white/25 bg-white/10 text-[#E8A020] focus:ring-[#E8A020]"
                                            />
                                            Запомнить меня
                                        </label>

                                        {canResetPassword && (
                                            <Link
                                                href={route('password.request')}
                                                className="text-sm font-semibold text-[#E8A020] underline-offset-4 hover:underline"
                                            >
                                                Забыли пароль?
                                            </Link>
                                        )}
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={processing}
                                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#E8A020] px-4 py-3 text-sm font-bold text-[#0f243f] shadow-[0_14px_34px_rgba(232,160,32,.3)] transition hover:-translate-y-0.5 hover:bg-[#d08c12] disabled:cursor-not-allowed disabled:opacity-70"
                                    >
                                        {processing ? 'Вход...' : 'Войти'}
                                        {!processing && <ArrowRight className="h-4 w-4" />}
                                    </button>
                                </form>

                                <div className="mt-6 border-t border-white/10 pt-4 text-center text-xs text-white/65">
                                    KazUTB CRM System
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
        </>
    );
}

Login.layout = page => <PublicLayout>{page}</PublicLayout>;
export default Login;
