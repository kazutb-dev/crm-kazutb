const BG_IMAGE = '/assets/images/bg-poster.png';

export default function PublicLayout({ children }) {
    return (
        <>
            {/* Fixed full-screen image background */}
            <div className="pointer-events-none fixed inset-0 z-0">
                <img
                    src={BG_IMAGE}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                    aria-hidden="true"
                />
                <div className="absolute inset-0 bg-[#0b1a2e]/62" />
                <div className="absolute inset-0 bg-gradient-to-br from-[#16355A]/72 via-[#16355A]/28 to-[#00B0AD]/14" />
            </div>
            <div className="relative z-[1]">
                {children}
            </div>
        </>
    );
}
