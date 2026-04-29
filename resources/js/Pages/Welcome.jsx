import { Head, Link } from '@inertiajs/react';
import SiteHeader from '@/Components/SiteHeader';
import ChatBot from '@/Components/ChatBot';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import {
    Award,
    BookOpenText,
    CalendarDays,
    Compass,
    FileText,
    Grid2x2,
    Headset,
    LibraryBig,
    MapPinned,
    Ticket,
} from 'lucide-react';
import '../../css/welcome.css';

export default function Welcome({ canLogin }) {
    const { t } = useTranslation();
    const [isChatOpen, setIsChatOpen] = useState(false);

    const services = [
        [t('tickets'), '/tickets', t('tickets_desc'), Ticket],
        [t('docs'), '/docs', t('docs_desc'), FileText],
        [t('navigation'), 'http://10.0.1.18:3000/nav', t('navigation_desc'), Compass],
        [t('study'), '/study', t('study_desc'), BookOpenText],
        [t('schedule'), '/schedule', t('schedule_desc'), CalendarDays],
        [t('booking'), '/booking', t('booking_desc'), MapPinned],
        [t('support'), '/support', t('support_desc'), Headset],
        [t('catalog'), '/catalog', t('catalog_desc'), Grid2x2],
        [t('templates'), '/templates', t('templates_desc'), FileText],
        [t('certificates'), '/certificates', t('certificates_desc'), Award],
        [t('more'), '/more', t('more_desc'), LibraryBig],
    ];

    return (
        <>
            <Head title="KazUTB Campus AI" />

            <ChatBot isOpen={isChatOpen} setIsOpen={setIsChatOpen} />

            <div className="welcome-root page">
                <div className="brand-blob" aria-hidden="true" />
                <div className="container">
                    <SiteHeader />

                    <section className="hero">
                        <div className="left">
                            <div className="kicker">{t('platform')}</div>
                            <h1 className="title">
                                {t('title').split(' ')[0]} <span className="accent">{t('title').substring(t('title').indexOf(' ') + 1)}</span>
                                <br />
                                {t('for_students_and_staff')}
                            </h1>
                            <p className="subtitle">
                                {t('subtitle')}
                            </p>
                            <div className="cta-row">
                                <button 
                                    className="btn btn-primary" 
                                    onClick={() => setIsChatOpen(true)}
                                >
                                    {t('ai_assistant')}
                                </button>
                                {canLogin && (
                                    <Link className="btn btn-ghost" href={route('login')}>
                                        {t('login')}
                                    </Link>
                                )}
                            </div>
                        </div>

                        <div className="right">
                            <div className="tiles-wrap">
                                <div className="search-row">
                                    <input
                                        className="search"
                                        placeholder={t('search_placeholder')}
                                        defaultValue=""
                                    />
                                </div>

                                <div className="tiles">
                                    {services.map(([title, href, desc, Icon]) => (
                                        <a key={title} href={href} className="tile">
                                            <div className="icon">
                                                <Icon strokeWidth={2} />
                                            </div>
                                            <b>{title}</b>
                                            <small>{desc}</small>
                                        </a>
                                    ))}
                                </div>

                                <div className="hint">
                                    <span>{t('copyright')}</span>
                                    <span>{t('version')}</span>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </>
    );
}