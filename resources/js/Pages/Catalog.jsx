import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Bot, BookOpenText, ExternalLink } from 'lucide-react';
import PublicLayout from '@/Layouts/PublicLayout';
import { useTranslation } from 'react-i18next';

const headingFont = { fontFamily: '"Literata", ui-serif, Georgia, Times, serif' };

const serviceIcons = {
    'AI-tutor': Bot,
    'AI-Student': Bot,
};

function Catalog() {
    const { t } = useTranslation();

    const extraServices = [
        {
            title: 'AI-tutor',
            href: 'https://ai-tutor.kaztbu.edu.kz/login',
            desc: t('ai_tutor_desc'),
        },
        {
            title: 'AI-Student',
            href: 'https://ai-student.kaztbu.edu.kz/login',
            desc: t('ai_student_desc'),
        },
        {
            title: t('library'),
            href: import.meta.env.VITE_LIBRARY_URL ?? '#',
            desc: t('library_desc'),
        },
    ];

    return (
        <>
            <Head title="Каталог сервисов">
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
                <link href="https://fonts.googleapis.com/css2?family=Literata:opsz,wght@7..72,500..900&family=Manrope:wght@400..800&display=swap" rel="stylesheet" />
            </Head>

            <main
                className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-4 font-['Manrope'] sm:p-6 lg:p-10"
                style={{ fontFamily: '"Manrope", ui-sans-serif, system-ui, sans-serif' }}
            >

                <section className="animate-fade-slide-up relative z-10 w-full max-w-4xl rounded-2xl bg-[#0f243f]/70 px-6 py-10 text-white ring-1 ring-white/15 shadow-[0_28px_90px_rgba(0,0,0,.42),inset_0_0_0_1px_rgba(232,160,32,.22)] sm:px-8 lg:px-12 lg:py-14">

                    {/* header */}
                    <div className="mb-10 flex items-start justify-between gap-4">
                        <div>
                            <p className="mb-2 inline-flex items-center gap-1.5 border border-[#FBBD48]/45 bg-[#FBBD48]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#FBBD48]">
                                Цифровые сервисы КазУТБ
                            </p>
                            <h1 style={headingFont} className="mt-3 text-3xl font-extrabold leading-tight tracking-[-0.03em] sm:text-4xl">
                                Каталог сервисов
                            </h1>
                            <p className="mt-3 max-w-lg text-sm leading-7 text-white/70">
                                Внешние платформы и системы, доступные для сотрудников и студентов университета.
                            </p>
                        </div>

                        <img
                            src="/assets/images/logo.png"
                            alt="KazUTB"
                            className="hidden h-14 w-14 flex-shrink-0 rounded-full border-2 border-white/80 object-contain sm:block"
                        />
                    </div>

                    {/* service cards */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {extraServices.map((service) => {
                            const Icon = serviceIcons[service.title] ?? BookOpenText;
                            return (
                                <a
                                    key={service.title}
                                    href={service.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="group flex items-start gap-4 border border-white/15 bg-white/8 p-5 transition hover:border-[#FBBD48]/50 hover:bg-white/15 hover:shadow-[inset_0_0_0_1px_rgba(251,189,72,.22)]"
                                >
                                    <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center border border-[#FBBD48]/30 bg-[#FBBD48]/15 text-[#FBBD48] transition group-hover:bg-[#FBBD48]/25">
                                        <Icon className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h3 style={headingFont} className="truncate text-base font-bold leading-tight text-white">
                                            {service.title}
                                        </h3>
                                        <p className="mt-1 text-sm leading-relaxed text-white/55">{service.desc}</p>
                                    </div>
                                    <ExternalLink className="mt-1 h-3.5 w-3.5 flex-shrink-0 text-white/25 transition group-hover:text-[#FBBD48]" />
                                </a>
                            );
                        })}
                    </div>

                    {/* footer row */}
                    <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6 text-xs text-white/45">
                        <span>Сервисов в каталоге: {extraServices.length} · Обновлено: 2026-04-08</span>
                        <Link
                            href="/"
                            className="inline-flex items-center gap-2 border border-white/25 bg-white/10 px-5 py-2 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-white/20"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            На главную
                        </Link>
                    </div>
                </section>
            </main>
        </>
    );
}

Catalog.layout = page => <PublicLayout>{page}</PublicLayout>;
export default Catalog;
