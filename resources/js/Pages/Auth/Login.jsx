import { Head, Link, useForm } from '@inertiajs/react';
import PublicLayout from '@/Layouts/PublicLayout';

function Login({ status, canResetPassword }) {
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

    const headingFont = { fontFamily: '"Literata", ui-serif, Georgia, Times, serif' };

    return (
        <>
            <Head title="Login">
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
                <link href="https://fonts.googleapis.com/css2?family=Literata:opsz,wght@7..72,500..900&family=Manrope:wght@400..800&display=swap" rel="stylesheet" />
            </Head>

            <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-4 font-['Manrope'] sm:p-6" style={{ fontFamily: '"Manrope", ui-sans-serif, system-ui, sans-serif' }}>

                <section className="animate-fade-slide-up relative z-10 w-full max-w-md rounded-2xl bg-[#0f243f]/70 p-6 text-white ring-1 ring-white/15 shadow-[0_28px_90px_rgba(0,0,0,.42),inset_0_0_0_1px_rgba(232,160,32,.22)] sm:p-8">
                    <div className="mb-6 text-center">
                        <img
                            src="/assets/images/logo.png"
                            alt="KazUTB logo"
                            className="mx-auto mb-4 h-16 w-16 rounded-full border-2 border-white/80 bg-[#0f243f] object-contain"
                        />
                        <p className="inline-flex items-center border border-[#E8A020]/45 bg-[#E8A020]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.13em] text-[#E8A020]">
                            Вход в систему
                        </p>
                        <h1 style={headingFont} className="mt-4 text-3xl font-extrabold tracking-[-0.03em]">
                            Авторизация
                        </h1>
                        <p className="mt-2 text-sm text-white/75">
                            Введите логин или email и пароль для входа в портал.
                        </p>
                    </div>

                    {status && (
                        <div className="mb-4 rounded-md border border-emerald-300/35 bg-emerald-400/15 px-3 py-2 text-sm text-emerald-100">
                            {status}
                        </div>
                    )}

                    <form onSubmit={submit} className="space-y-4">
                        <div>
                            <label htmlFor="email" className="mb-1 block text-sm font-semibold text-white/90">
                                Login или Email
                            </label>
                            <input
                                id="email"
                                type="text"
                                name="email"
                                value={data.email}
                                placeholder="api-kiosk"
                                autoComplete="username"
                                autoFocus
                                onChange={(e) => setData('email', e.target.value)}
                                className="w-full rounded-md border border-white/20 bg-white/10 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/40 focus:border-[#E8A020]"
                            />
                            {errors.email && (
                                <p className="mt-1 text-xs text-rose-300">{errors.email}</p>
                            )}
                        </div>

                        <div>
                            <label htmlFor="password" className="mb-1 block text-sm font-semibold text-white/90">
                                Пароль
                            </label>
                            <input
                                id="password"
                                type="password"
                                name="password"
                                value={data.password}
                                autoComplete="current-password"
                                onChange={(e) => setData('password', e.target.value)}
                                className="w-full rounded-md border border-white/20 bg-white/10 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/40 focus:border-[#E8A020]"
                            />
                            {errors.password && (
                                <p className="mt-1 text-xs text-rose-300">{errors.password}</p>
                            )}
                        </div>

                        <div className="flex items-center justify-between gap-3">
                            <label className="inline-flex items-center gap-2 text-sm text-white/80">
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
                            className="inline-flex w-full items-center justify-center rounded-md bg-[#E8A020] px-4 py-2.5 text-sm font-bold text-[#0f243f] shadow-[0_14px_34px_rgba(232,160,32,.3)] transition hover:-translate-y-0.5 hover:bg-[#d08c12] disabled:cursor-not-allowed disabled:opacity-70"
                        >
                            {processing ? 'Вход...' : 'Войти'}
                        </button>
                    </form>

                    <div className="mt-6 text-center text-xs text-white/65">
                        KazUTB CRM System
                    </div>

                    <div className="mt-4 text-center">
                        <Link
                            href="/"
                            className="text-xs font-semibold text-white/55 underline-offset-4 transition hover:text-white/80 hover:underline"
                        >
                            ← На главную
                        </Link>
                    </div>
                </section>
            </main>
        </>
    );
}

Login.layout = page => <PublicLayout>{page}</PublicLayout>;
export default Login;
