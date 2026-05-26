import { Head, Link, useForm } from '@inertiajs/react';

export default function Register() {
    const { data, setData, post, processing, errors, reset } = useForm({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
    });

    const submit = (e) => {
        e.preventDefault();

        post(route('register'), {
            onFinish: () => reset('password', 'password_confirmation'),
        });
    };

    const headingFont = { fontFamily: '"Literata", ui-serif, Georgia, Times, serif' };

    return (
        <>
            <Head title="Register">
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
                <link href="https://fonts.googleapis.com/css2?family=Literata:opsz,wght@7..72,500..900&family=Manrope:wght@400..800&display=swap" rel="stylesheet" />
            </Head>

            <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0b1a2e] p-4 font-['Manrope'] sm:p-6" style={{ fontFamily: '"Manrope", ui-sans-serif, system-ui, sans-serif' }}>
                <div className="pointer-events-none absolute inset-0 bg-[url('/assets/images/main.png')] bg-cover bg-center opacity-55 blur-[2px] scale-[1.03]" />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#203653]/95 via-[#2b4265]/82 to-[#18b8b3]/26" />
                <div className="pointer-events-none absolute inset-0 bg-black/10 backdrop-blur-[2px]" />

                <section className="animate-fade-slide-up relative z-10 w-full max-w-md rounded-2xl bg-[#0f243f]/70 p-6 text-white ring-1 ring-white/15 shadow-[0_28px_90px_rgba(0,0,0,.42),inset_0_0_0_1px_rgba(232,160,32,.22)] sm:p-8">
                    <div className="mb-6 text-center">
                        <img
                            src="/assets/images/logo.png"
                            alt="KazUTB logo"
                            className="mx-auto mb-4 h-16 w-16 rounded-full border-2 border-white/80 bg-[#0f243f] object-contain"
                        />
                        <p className="inline-flex items-center border border-[#E8A020]/45 bg-[#E8A020]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.13em] text-[#E8A020]">
                            Регистрация
                        </p>
                        <h1 style={headingFont} className="mt-4 text-3xl font-extrabold tracking-[-0.03em]">
                            Создание аккаунта
                        </h1>
                        <p className="mt-2 text-sm text-white/75">
                            Заполните поля для регистрации в портале.
                        </p>
                    </div>

                    <form onSubmit={submit} className="space-y-4">
                        <div>
                            <label htmlFor="name" className="mb-1 block text-sm font-semibold text-white/90">
                                ФИО
                            </label>
                            <input
                                id="name"
                                type="text"
                                name="name"
                                value={data.name}
                                autoComplete="name"
                                autoFocus
                                onChange={(e) => setData('name', e.target.value)}
                                required
                                className="w-full rounded-md border border-white/20 bg-white/10 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/40 focus:border-[#E8A020]"
                            />
                            {errors.name && (
                                <p className="mt-1 text-xs text-rose-300">{errors.name}</p>
                            )}
                        </div>

                        <div>
                            <label htmlFor="email" className="mb-1 block text-sm font-semibold text-white/90">
                                Email
                            </label>
                            <input
                                id="email"
                                type="email"
                                name="email"
                                value={data.email}
                                autoComplete="username"
                                onChange={(e) => setData('email', e.target.value)}
                                required
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
                                autoComplete="new-password"
                                onChange={(e) => setData('password', e.target.value)}
                                required
                                className="w-full rounded-md border border-white/20 bg-white/10 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/40 focus:border-[#E8A020]"
                            />
                            {errors.password && (
                                <p className="mt-1 text-xs text-rose-300">{errors.password}</p>
                            )}
                        </div>

                        <div>
                            <label htmlFor="password_confirmation" className="mb-1 block text-sm font-semibold text-white/90">
                                Подтверждение пароля
                            </label>
                            <input
                                id="password_confirmation"
                                type="password"
                                name="password_confirmation"
                                value={data.password_confirmation}
                                autoComplete="new-password"
                                onChange={(e) => setData('password_confirmation', e.target.value)}
                                required
                                className="w-full rounded-md border border-white/20 bg-white/10 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/40 focus:border-[#E8A020]"
                            />
                            {errors.password_confirmation && (
                                <p className="mt-1 text-xs text-rose-300">{errors.password_confirmation}</p>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={processing}
                            className="inline-flex w-full items-center justify-center rounded-md bg-[#E8A020] px-4 py-2.5 text-sm font-bold text-[#0f243f] shadow-[0_14px_34px_rgba(232,160,32,.3)] transition hover:-translate-y-0.5 hover:bg-[#d08c12] disabled:cursor-not-allowed disabled:opacity-70"
                        >
                            {processing ? 'Создание...' : 'Зарегистрироваться'}
                        </button>
                    </form>

                    <div className="mt-5 text-center text-sm text-white/75">
                        Уже есть аккаунт?{' '}
                        <Link
                            href={route('login')}
                            className="font-semibold text-[#E8A020] underline-offset-4 hover:underline"
                        >
                            Войти
                        </Link>
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
