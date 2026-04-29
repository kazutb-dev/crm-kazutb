import SiteHeader from '@/Components/SiteHeader';
import '../../css/welcome.css';

export default function GuestLayout({ children }) {
    return (
        <div className="page guest-page">
            <div className="brand-blob" aria-hidden="true" />
            <div className="container guest-container">
                <SiteHeader />

                <div className="guest-card">
                    {children}
                </div>
            </div>
        </div>
    );
}
