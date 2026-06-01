/**
 * VideoBackground — full-screen looping video background with brand overlays.
 *
 * Usage: place as the first children inside any `relative overflow-hidden` container.
 * The video and all overlay layers are pointer-events-none so they never capture clicks.
 */
export default function VideoBackground() {
    return (
        <>
            {/* ── video layer ── */}
            <video
                className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                src="/assets/images/VID_20260528_122136.mp4"
                autoPlay
                loop
                muted
                playsInline
                aria-hidden="true"
            />

            {/* ── base dark veil (ensures contrast for all text above) ── */}
            <div className="pointer-events-none absolute inset-0 bg-[#0b1a2e]/62" />

            {/* ── brand gradient (navy → teal, directional depth) ── */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#16355A]/72 via-[#16355A]/28 to-[#00B0AD]/14" />
        </>
    );
}
