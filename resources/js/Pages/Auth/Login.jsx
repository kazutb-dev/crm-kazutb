import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowRight, Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react';
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

    return (
        <>
            <Head title="Вход в портал · КазУТБ" />

            <main
                style={{ fontFamily: 'var(--font-sans)' }}
                className="relative flex min-h-[calc(100vh-152px)] items-center justify-center px-[var(--gutter)] py-12 text-white"
            >
                <section className="kz-up w-full max-w-[440px]">
                    {/* Identity block */}
                    <div className="mb-7 flex flex-col items-center text-center">
                        <img
                            src="/assets/images/logo.png"
                            alt="КазУТБ"
                            className="h-16 w-16 object-contain drop-shadow-[0_4px_16px_rgba(0,0,0,.4)]"
                        />
                        <h1 className="kz-display mt-4 text-[22px] font-semibold">Вход в портал</h1>
                        <p className="mt-2 max-w-[340px] text-sm leading-relaxed text-white/60">
                            Единая учётная запись Казахского университета технологии и бизнеса
                            им. К. Кулажанова
                        </p>
                    </div>

                    <div className="kz-panel kz-panel--strong p-5 sm:p-6" style={{ boxShadow: '0 0 80px rgba(9,186,178,0.14), 0 30px 70px rgba(0,0,0,0.40)' }}>
                        {status && (
                            <div className="mb-4 rounded-[var(--radius-sm)] border border-emerald-300/30 bg-emerald-400/10 px-3.5 py-2.5 text-sm text-emerald-100">
                                {status}
                            </div>
                        )}

                        <form onSubmit={submit} className="space-y-4">
                            <div>
                                <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-white/85">
                                    Email
                                </label>
                                <div className="relative">
                                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                                    <input
                                        id="email"
                                        type="text"
                                        name="email"
                                        value={data.email}
                                        placeholder="Введите email"
                                        autoComplete="username"
                                        autoFocus
                                        onChange={(e) => setData('email', e.target.value)}
                                        className="kz-field !pl-11"
                                    />
                                </div>
                                {errors.email && <p className="mt-1.5 text-xs text-rose-300">{errors.email}</p>}
                            </div>

                            <div>
                                <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-white/85">
                                    Пароль
                                </label>
                                <div className="relative">
                                    <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                                    <input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        name="password"
                                        value={data.password}
                                        autoComplete="current-password"
                                        placeholder="Введите пароль"
                                        onChange={(e) => setData('password', e.target.value)}
                                        className="kz-field !pl-11 !pr-12"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((value) => !value)}
                                        className="absolute inset-y-0 right-0 inline-flex items-center justify-center px-3.5 text-white/40 transition hover:text-white/80"
                                        aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                                {errors.password && <p className="mt-1.5 text-xs text-rose-300">{errors.password}</p>}
                            </div>

                            <div className="flex items-center justify-between gap-3">
                                <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-white/80">
                                    <input
                                        type="checkbox"
                                        name="remember"
                                        checked={data.remember}
                                        onChange={(e) => setData('remember', e.target.checked)}
                                        className="h-4 w-4 rounded border-white/25 bg-white/10 text-[var(--gold-500)] focus:ring-[var(--teal-400)]"
                                    />
                                    Запомнить меня
                                </label>

                                {canResetPassword && (
                                    <Link
                                        href={route('password.request')}
                                        className="text-sm font-semibold text-[var(--gold-400)] underline-offset-4 transition hover:underline"
                                    >
                                        Забыли пароль?
                                    </Link>
                                )}
                            </div>

                            <button type="submit" disabled={processing} className="kz-btn kz-btn--gold w-full">
                                {processing ? 'Выполняется вход…' : 'Войти'}
                                {!processing && <ArrowRight className="h-4 w-4" />}
                            </button>
                        </form>
                    </div>

                    {/* Trust signal */}
                    <p className="mt-5 flex items-center justify-center gap-2 text-center text-xs text-white/45">
                        <ShieldCheck className="h-3.5 w-3.5 text-[var(--teal-300)]" />
                        Защищённое соединение · Единая авторизация университета
                    </p>
                </section>
            </main>
        </>
    );
}

Login.layout = (page) => <PublicLayout>{page}</PublicLayout>;
export default Login;
