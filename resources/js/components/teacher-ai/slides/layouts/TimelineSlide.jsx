import { Fragment, useState } from 'react';
import { FitBox, HLine, NumberLabel, Rect, SlideFooter, SlideTitle, VLine, para } from '../primitives';
import { COLORS, STYLE } from '../theme';

const FOOTER_TOP = 600;

/** D) timeline — vertical axis with numbered boxes; items alternate left (right-aligned) and right. */
export default function TimelineSlide({ slide }) {
    const { items } = slide;
    const count = items.length;
    const step = count > 1 ? 420 / (count - 1) : 0;
    const textHeight = count > 1 ? Math.min(60, step - 34) : 60;
    const [textBottoms, setTextBottoms] = useState({});

    // The last item's text box reaches below y = 600: the footer moves down only when that text gets there.
    const bottom = items.reduce((lowest, _, index) => Math.max(lowest, textBottoms[index] ?? 0), 0);
    const footerTop = Math.max(FOOTER_TOP, Math.ceil(bottom) + 8);

    return (
        <>
            <SlideTitle x={70} y={40} w={1060} h={60} text={slide.title} />
            <VLine x={640} y1={110} y2={140 + (count - 1) * step + 40} width={2} color={COLORS.line} />

            {items.map((item, index) => {
                const cy = 140 + index * step;
                const left = index % 2 === 0;
                const align = left ? 'right' : 'left';
                const textTop = cy + 13;

                return (
                    <Fragment key={index}>
                        <Rect x={620} y={cy - 20} w={40} h={40} fill={COLORS.lavender} border={`1px solid ${COLORS.lavenderBorder}`} radius={8} />
                        <NumberLabel x={620} y={cy - 20} w={40} h={40} number={index + 1} size={15} />
                        <HLine x1={left ? 560 : 660} x2={left ? 620 : 720} y={cy} width={1.5} color={COLORS.line} />
                        <FitBox
                            x={left ? 90 : 730}
                            y={cy - 17}
                            w={left ? 460 : 480}
                            h={30}
                            group="timeline-titles"
                            paragraphs={[para(item.title, STYLE.itemTitle, { align, lines: 1 })]}
                        />
                        <FitBox
                            x={left ? 90 : 680}
                            y={textTop}
                            w={left ? 520 : 530}
                            h={textHeight}
                            group="timeline-texts"
                            paragraphs={[para(item.text, STYLE.itemText, { align })]}
                            onMeasure={(height) => setTextBottoms((previous) => (
                                previous[index] === textTop + height ? previous : { ...previous, [index]: textTop + height }
                            ))}
                        />
                    </Fragment>
                );
            })}

            {slide.footer && <SlideFooter x={70} y={footerTop} w={1140} h={700 - footerTop} text={slide.footer} />}
        </>
    );
}
