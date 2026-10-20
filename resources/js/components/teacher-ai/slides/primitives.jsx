import { createContext, useContext, useLayoutEffect, useRef, useState } from 'react';
import {
    COLORS,
    LINE_FACTOR,
    LOGO_BOX,
    LOGO_URL,
    PARAGRAPH,
    PLACEHOLDER_BACKGROUND,
    STYLE,
    pt,
} from './theme';
import { lines } from './normalize';

/**
 * Bumped by SlideCanvas when text must be measured again (the canvas became
 * visible or web fonts finished loading).
 */
export const FitEpochContext = createContext(0);

/**
 * Per-slide registry of fit groups: group name → members. Sibling boxes of a
 * group (all card texts, all step titles, …) share one shrink step, like the
 * exporter's addTexts(), so parallel items keep the same font size.
 */
export const FitGroupsContext = createContext(null);

const px = (value) => `${value}px`;

const JUSTIFY = { top: 'flex-start', middle: 'center', bottom: 'flex-end' };

/** One paragraph: text + style overrides on top of the exporter's defaults. */
export const para = (text, ...styles) => Object.assign({}, PARAGRAPH, ...styles, { text: typeof text === 'string' ? text : '' });

export const paras = (texts, ...styles) => texts.map((text) => para(text, ...styles));

/** Drops empty paragraphs; the last one gets no space after. */
function prepared(paragraphs) {
    const list = (Array.isArray(paragraphs) ? paragraphs : [])
        .filter((paragraph) => paragraph && typeof paragraph.text === 'string' && paragraph.text.trim() !== '')
        .map((paragraph) => ({ ...paragraph }));

    if (list.length > 0) {
        list[list.length - 1].after = 0;
    }

    return list;
}

/** Font size of a paragraph after `--fit-shrink` 1-pt steps, never below its minimum. */
const sizeCss = (paragraph) => `max(${pt(Math.min(paragraph.min, paragraph.size))}px, calc(${pt(paragraph.size)}px - var(--fit-shrink, 0) * ${4 / 3}px))`;

const sizePx = (paragraph, shrink) => Math.max(pt(Math.min(paragraph.min, paragraph.size)), pt(paragraph.size - shrink));

const withEllipsis = (text) => `${text.replace(/[\s,.;:–—-]+$/u, '')}…`;

/**
 * Shortens the paragraphs until `fits()`: drops words from the end of the
 * last paragraph (binary search), then whole trailing paragraphs, marking the
 * cut with "…" (LessonPptxExporter::truncated()).
 */
function truncate(nodes, texts, list, fits) {
    for (let last = list.length - 1; last >= 0; last -= 1) {
        const words = list[last].text.split(/\s+/).filter(Boolean);
        const show = (count) => {
            texts[last].textContent = withEllipsis(words.slice(0, count).join(' '));
        };
        let best = 0;
        let low = 1;
        let high = words.length;

        while (low <= high) {
            const middle = Math.floor((low + high) / 2);
            show(middle);

            if (fits()) {
                best = middle;
                low = middle + 1;
            } else {
                high = middle - 1;
            }
        }

        if (best > 0 || last === 0) {
            show(Math.max(best, 1));

            return;
        }

        nodes[last].style.display = 'none';
        nodes[last - 1].style.marginBottom = '0px';
    }
}

function applyGroup(groups, name) {
    const members = groups?.get(name);

    if (!members) {
        return;
    }

    let common = 0;
    members.forEach((member) => {
        common = Math.max(common, member.own);
    });
    members.forEach((member) => member.apply(common));
}

/**
 * Absolutely positioned text box (x, y, w, h in canvas px) holding a list of
 * paragraphs (see para()). Fitting, as in the exporter: all paragraphs shrink
 * together in 1-pt steps (each down to its own minimum) while the content is
 * taller than the box (scrollHeight > clientHeight) or a paragraph exceeds its
 * line limit; at the minimum the text is truncated with "…". Boxes with the
 * same `group` share the largest shrink. `onMeasure(height)` receives the
 * final content height (used to push following boxes down).
 *
 * The texts are written by the fit effect (React renders the paragraph
 * elements empty), so truncation never fights React.
 */
export function FitBox({ x, y, w, h, paragraphs, anchor = 'top', group = null, onMeasure }) {
    const outerRef = useRef(null);
    const innerRef = useRef(null);
    const epoch = useContext(FitEpochContext);
    const groups = useContext(FitGroupsContext);
    const onMeasureRef = useRef(onMeasure);
    const memberRef = useRef(null);
    const list = prepared(paragraphs);
    const fitKey = JSON.stringify(list);

    onMeasureRef.current = onMeasure;

    if (memberRef.current === null) {
        memberRef.current = {
            own: 0,
            applied: 0,
            setShrink(shrink) {
                innerRef.current?.style.setProperty('--fit-shrink', String(shrink));
            },
            report() {
                const inner = innerRef.current;

                if (inner && onMeasureRef.current) {
                    onMeasureRef.current(inner.scrollHeight);
                }
            },
            apply(shrink) {
                const target = Math.max(shrink, this.own);

                if (target !== this.applied) {
                    this.applied = target;
                    this.setShrink(target);
                    this.report();
                }
            },
        };
    }

    useLayoutEffect(() => {
        const outer = outerRef.current;
        const inner = innerRef.current;
        const member = memberRef.current;
        const items = JSON.parse(fitKey);

        if (!outer || !inner || items.length === 0) {
            return undefined;
        }

        const nodes = Array.from(inner.children);
        const texts = nodes.map((node) => node.lastElementChild);

        // Start from the full texts (a previous run may have truncated them).
        nodes.forEach((node, index) => {
            node.style.display = '';
            node.style.marginBottom = node.dataset.after ?? '';
            texts[index].textContent = items[index].text;
        });

        member.own = 0;
        member.applied = 0;
        member.setShrink(0);

        const available = outer.clientHeight;

        if (available <= 0) {
            // Not laid out (hidden container): measured again on the next epoch.
            return undefined;
        }

        let shrink = 0;
        const fits = () => {
            if (inner.scrollHeight > available + 1) {
                return false;
            }

            return items.every((item, index) => {
                if (item.lines <= 0 || nodes[index].style.display === 'none') {
                    return true;
                }

                const linePx = sizePx(item, shrink) * LINE_FACTOR * item.spacing;

                return Math.round(nodes[index].offsetHeight / linePx) <= item.lines;
            });
        };
        const maxShrink = Math.max(0, ...items.map((item) => item.size - Math.min(item.min, item.size)));

        while (shrink < maxShrink && !fits()) {
            shrink += 1;
            member.setShrink(shrink);
        }

        if (!fits()) {
            truncate(nodes, texts, items, fits);
        }

        member.own = shrink;
        member.applied = shrink;

        if (group && groups) {
            if (!groups.has(group)) {
                groups.set(group, new Set());
            }

            groups.get(group).add(member);
            applyGroup(groups, group);
        }

        member.report();

        return () => {
            if (group && groups?.get(group)?.delete(member)) {
                applyGroup(groups, group);
            }
        };
    }, [fitKey, w, h, epoch, group, groups]);

    if (list.length === 0) {
        return null;
    }

    return (
        <div
            ref={outerRef}
            style={{
                position: 'absolute',
                left: px(x),
                top: px(y),
                width: px(Math.max(0, w)),
                height: px(Math.max(0, h)),
                display: 'flex',
                flexDirection: 'column',
                justifyContent: JUSTIFY[anchor] ?? JUSTIFY.top,
                overflow: 'hidden',
                contain: 'strict',
            }}
        >
            <div ref={innerRef} style={{ flexShrink: 0, width: '100%' }}>
                {list.map((paragraph, index) => {
                    const after = index === list.length - 1 ? '0px' : `${paragraph.after / paragraph.size}em`;

                    return (
                        <div
                            key={index}
                            data-after={after}
                            style={{
                                position: 'relative',
                                // PowerPoint/LibreOffice put the extra leading of spaced lines above
                                // the glyphs; CSS centres it. ≈ 4 px at 16 pt / 115 %.
                                top: paragraph.spacing > 1 ? `${(paragraph.spacing - 1) * 1.25}em` : undefined,
                                margin: 0,
                                marginBottom: after,
                                paddingLeft: paragraph.bullet ? '0.9375em' : 0,
                                fontSize: sizeCss(paragraph),
                                fontWeight: paragraph.bold ? 700 : 400,
                                color: paragraph.color,
                                textAlign: paragraph.align,
                                lineHeight: LINE_FACTOR * paragraph.spacing,
                                overflowWrap: 'break-word',
                            }}
                        >
                            {paragraph.bullet && <span aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0 }}>•</span>}
                            <span />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/** TITLE style text box (22 pt bold, max 2 lines, fit to 16 pt; `compact` fits 50-px boxes down to 15 pt). */
export function SlideTitle({ x, y, w, h, text, align = 'left', compact = false }) {
    return <FitBox x={x} y={y} w={w} h={h} paragraphs={[para(text, compact ? STYLE.titleCompact : STYLE.title, { align })]} />;
}

/** FOOTER style text box (15 pt, fit to 12 pt). */
export function SlideFooter({ x, y, w, h, text }) {
    return <FitBox x={x} y={y} w={w} h={h} paragraphs={[para(text, STYLE.footer)]} />;
}

export function Rect({ x, y, w, h, fill = 'transparent', border, radius = 0, style, children }) {
    return (
        <div
            aria-hidden="true"
            style={{
                position: 'absolute',
                left: px(x),
                top: px(y),
                width: px(Math.max(0, w)),
                height: px(Math.max(0, h)),
                background: fill,
                border,
                borderRadius: px(radius),
                boxSizing: 'border-box',
                ...style,
            }}
        >
            {children}
        </div>
    );
}

/** Horizontal line from x1 to x2 at y, centred on y. */
export function HLine({ x1, x2, y, width = 1, color = COLORS.line }) {
    return (
        <div
            aria-hidden="true"
            style={{ position: 'absolute', left: px(Math.min(x1, x2)), top: px(y - width / 2), width: px(Math.abs(x2 - x1)), height: px(width), background: color }}
        />
    );
}

/** Vertical line from y1 to y2 at x, centred on x. */
export function VLine({ x, y1, y2, width = 1, color = COLORS.line }) {
    return (
        <div
            aria-hidden="true"
            style={{ position: 'absolute', left: px(x - width / 2), top: px(Math.min(y1, y2)), width: px(width), height: px(Math.abs(y2 - y1)), background: color }}
        />
    );
}

/** Full-canvas SVG layer for non-rectangular shapes (triangles, arrows, chevrons). */
export function ShapeLayer({ children }) {
    return (
        <svg
            aria-hidden="true"
            width="1280"
            height="720"
            viewBox="0 0 1280 720"
            style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }}
        >
            {children}
        </svg>
    );
}

export const polygonPoints = (points) => points.map(([pointX, pointY]) => `${pointX},${pointY}`).join(' ');

/** Bold number centred both ways in its box (numbered circles and boxes). */
export function NumberLabel({ x, y, w, h, number, size, color = COLORS.body, style }) {
    return (
        <div
            aria-hidden="true"
            style={{
                position: 'absolute',
                left: px(x),
                top: px(y),
                width: px(w),
                height: px(h),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: px(pt(size)),
                fontWeight: 700,
                lineHeight: 1,
                color,
                ...style,
            }}
        >
            {number}
        </div>
    );
}

/** Indigo circle with a white bold number (cards). */
export function NumberCircle({ x, y, size, number, fontSize }) {
    return (
        <NumberLabel
            x={x}
            y={y}
            w={size}
            h={size}
            number={number}
            size={fontSize}
            color={COLORS.white}
            style={{ borderRadius: '50%', background: COLORS.indigo }}
        />
    );
}

/**
 * Image slot: the AI picture (object-fit: cover) over the placeholder
 * gradient. Pending images show a spinner and «Картинка генерируется…»;
 * failed/none/missing images (or a broken URL) show the placeholder only.
 */
export function ImageSlot({ slide, x, y, w, h, eager = false }) {
    const url = slide?.image_url ?? null;
    const status = slide?.image_status ?? 'none';
    const [brokenUrl, setBrokenUrl] = useState(null);
    const showImage = Boolean(url) && status !== 'pending' && status !== 'failed' && status !== 'none' && brokenUrl !== url;

    return (
        <div
            style={{
                position: 'absolute',
                left: px(x),
                top: px(y),
                width: px(w),
                height: px(h),
                overflow: 'hidden',
                background: PLACEHOLDER_BACKGROUND,
            }}
        >
            {showImage && (
                <img
                    src={url}
                    alt=""
                    loading={eager ? 'eager' : 'lazy'}
                    decoding="async"
                    draggable={false}
                    onError={() => setBrokenUrl(url)}
                    style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }}
                />
            )}
            {status === 'pending' && (
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '14px',
                        color: 'rgba(255, 255, 255, 0.92)',
                        fontFamily: 'Figtree, ui-sans-serif, system-ui, sans-serif',
                        fontSize: '20px',
                        lineHeight: 1.3,
                        textAlign: 'center',
                        padding: '0 24px',
                    }}
                >
                    <span
                        className="animate-spin"
                        style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            border: '4px solid rgba(255, 255, 255, 0.3)',
                            borderTopColor: '#FFFFFF',
                        }}
                    />
                    <span>Картинка генерируется…</span>
                </div>
            )}
        </div>
    );
}

/** The round KazUTB emblem, top-most on every slide. */
export function Logo() {
    return (
        <img
            src={LOGO_URL}
            alt=""
            aria-hidden="true"
            draggable={false}
            style={{
                position: 'absolute',
                left: px(LOGO_BOX.x),
                top: px(LOGO_BOX.y),
                width: px(LOGO_BOX.w),
                height: px(LOGO_BOX.h),
                zIndex: 50,
                pointerEvents: 'none',
                userSelect: 'none',
            }}
        />
    );
}

/** Whether a box (x, y, w, h) comes within 6 px of the emblem (exporter's hitsLogo()). */
export const hitsLogo = (x, y, w, h) => x < LOGO_BOX.x + LOGO_BOX.w + 6 && x + w > LOGO_BOX.x - 6
    && y < LOGO_BOX.y + LOGO_BOX.h + 6 && y + h > LOGO_BOX.y - 6;

/** Heading, text paragraph(s) and bullets of one column (exporter's columnParagraphs()). */
export const columnParagraphs = (column, heading, body) => [
    para(column.title, heading),
    ...paras(lines(column.text), body),
    ...paras(column.bullets, body, { bullet: true }),
];
