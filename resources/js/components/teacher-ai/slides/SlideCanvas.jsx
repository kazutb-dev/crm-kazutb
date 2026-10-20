import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LAYOUT_COMPONENTS } from './layouts';
import { normalizeSlide } from './normalize';
import { FitEpochContext, FitGroupsContext, Logo } from './primitives';
import { CANVAS_HEIGHT, CANVAS_WIDTH, COLORS, FONT_FAMILY } from './theme';

const SlideContent = memo(function SlideContent({ slide, presentation, eager, language }) {
    const Layout = LAYOUT_COMPONENTS[slide.layout] ?? LAYOUT_COMPONENTS.text_bullets;

    return <Layout slide={slide} presentation={presentation} eager={eager} language={language} />;
});

/**
 * One slide of a version-2 presentation, rendered on the fixed 1280x720
 * design canvas (SPEC-V2 §1) and scaled with a CSS transform to the width of
 * its container; the wrapper's height follows (720 × scale).
 *
 * Text fitting measures layout sizes, which transforms do not affect, so a
 * thumbnail and the main viewer render identical slides.
 */
export default function SlideCanvas({ slide, presentation = null, eager = false, language = 'ru', className = '', label }) {
    const wrapperRef = useRef(null);
    const [scale, setScale] = useState(0);
    const [epoch, setEpoch] = useState(0);
    // null = not measured yet; text boxes measure themselves on mount.
    const visibleRef = useRef(null);
    // Fit groups of this slide (sibling boxes sharing one shrink step).
    const groupsRef = useRef(null);
    const normalized = useMemo(() => normalizeSlide(slide), [slide]);

    if (groupsRef.current === null) {
        groupsRef.current = new Map();
    }

    useLayoutEffect(() => {
        const wrapper = wrapperRef.current;

        if (!wrapper) {
            return undefined;
        }

        const update = () => {
            const width = wrapper.clientWidth;
            const visible = width > 0;

            // A zero width (hidden, collapsed or a transient resize) keeps the last scale.
            if (visible) {
                const next = width / CANVAS_WIDTH;

                setScale((previous) => (Math.abs(previous - next) < 0.0001 ? previous : next));
            }

            // Text measured while hidden (zero size) is measured again once shown.
            if (visible && visibleRef.current === false) {
                setEpoch((value) => value + 1);
            }

            visibleRef.current = visible;
        };

        update();

        if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', update);

            return () => window.removeEventListener('resize', update);
        }

        const observer = new ResizeObserver(update);
        observer.observe(wrapper);

        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const fonts = typeof document !== 'undefined' ? document.fonts : null;

        if (!fonts || fonts.status === 'loaded' || !fonts.ready) {
            return undefined;
        }

        let active = true;

        fonts.ready.then(() => {
            if (active) {
                setEpoch((value) => value + 1);
            }
        });

        return () => {
            active = false;
        };
    }, []);

    return (
        <div
            ref={wrapperRef}
            role={label ? 'group' : undefined}
            aria-label={label}
            className={`relative w-full overflow-hidden ${className}`}
            style={{
                height: scale > 0 ? `${CANVAS_HEIGHT * scale}px` : undefined,
                aspectRatio: scale > 0 ? undefined : `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}`,
                background: COLORS.white,
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: `${CANVAS_WIDTH}px`,
                    height: `${CANVAS_HEIGHT}px`,
                    transform: `scale(${scale})`,
                    transformOrigin: '0 0',
                    overflow: 'hidden',
                    background: COLORS.white,
                    color: COLORS.body,
                    fontFamily: FONT_FAMILY,
                    fontSize: '16px',
                    lineHeight: 1.15,
                    textAlign: 'left',
                    letterSpacing: 'normal',
                    wordBreak: 'normal',
                    fontKerning: 'normal',
                    WebkitFontSmoothing: 'antialiased',
                }}
            >
                <FitGroupsContext.Provider value={groupsRef.current}>
                    <FitEpochContext.Provider value={epoch}>
                        <SlideContent slide={normalized} presentation={presentation} eager={eager} language={language} />
                    </FitEpochContext.Provider>
                </FitGroupsContext.Provider>
                <Logo />
            </div>
        </div>
    );
}
