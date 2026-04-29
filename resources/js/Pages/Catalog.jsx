import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, ExternalLink, Sparkles, Wrench } from 'lucide-react';
import SiteHeader from '@/Components/SiteHeader';
import { useTranslation } from 'react-i18next';
import '../../css/welcome.css';

export default function Catalog() {
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
            href: 'http://10.0.1.8/',
            desc: t('library_desc'),
        },
    ];

    return (
        <>
            <Head title="Дополнительные сервисы" />

            <div className="welcome-root page">
                <div className="brand-blob" aria-hidden="true" />
                <div className="container">
                    <SiteHeader />

                    <section className="hero" style={{ minHeight: 'calc(100vh - 220px)' }}>
                        <div className="left">
                            <div className="kicker">
                                <Sparkles size={14} />
                                {t('additional_services')}
                            </div>
                            <h1 className="title">
                                {t('catalog_title').split(' ')[0]}
                                <span className="accent"> {t('catalog_title').substring(t('catalog_title').indexOf(' ') + 1)}</span>
                            </h1>
                            <p className="subtitle">
                                {t('catalog_first_added')}
                            </p>
                            <div className="cta-row">
                                <Link className="btn btn-ghost" href="/">
                                    <ArrowLeft size={16} />
                                    {t('to_main')}
                                </Link>
                            </div>
                        </div>

                        <div className="right">
                            <div className="tiles-wrap" style={{ display: 'grid', gap: '14px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Wrench size={20} />
                                    <b>{t('catalog_draft')}</b>
                                </div>
                                <div className="tiles">
                                    {extraServices.map((service) => (
                                        <a
                                            key={service.title}
                                            href={service.href}
                                            className="tile"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            <div className="icon">
                                                <ExternalLink strokeWidth={2} />
                                            </div>
                                            <b>{service.title}</b>
                                            <small>{service.desc}</small>
                                        </a>
                                    ))}
                                </div>
                                <div className="subtitle" style={{ margin: 0 }}>
                                    {t('waiting_links')}
                                </div>
                                <div className="hint" style={{ marginTop: '8px' }}>
                                    <span>{t('services_added')}: {extraServices.length}</span>
                                    <span>{t('updated')}: 2026-04-08</span>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </>
    );
}
