import { Fragment, useState } from 'react';
import { FitBox, NumberCircle, Rect, SlideFooter, SlideTitle, para } from '../primitives';
import { COLORS, STYLE } from '../theme';

const GAP = 20;

// [circle inset, circle size, number pt, title x, title y, text x, text y, text bottom margin]
const TALL = [20, 48, 18, 20, 82, 20, 116, 12];
const SHORT = [18, 34, 14, 64, 20, 18, 62, 10];

/**
 * F) cards — grid of lavender cards with an indigo number circle, a title and a text.
 * Tall cards stack circle, title and text; short ones put the title next to a smaller circle.
 */
export default function CardsSlide({ slide }) {
    const { items } = slide;
    const count = items.length;
    const hasFooter = slide.footer !== '';
    const columns = count === 3 ? 3 : (count <= 4 ? 2 : 3);
    const rows = Math.max(1, Math.ceil(count / columns));
    const width = (1140 - GAP * (columns - 1)) / columns;
    const height = ((hasFooter ? 380 : 450) - GAP * (rows - 1)) / rows;
    const [inset, circle, number, titleX, titleY, textX, textY, margin] = height >= 170 ? TALL : SHORT;
    const [titleHeights, setTitleHeights] = useState({});

    return (
        <>
            <SlideTitle x={70} y={95} w={1060} h={60} text={slide.title} />

            {items.map((item, index) => {
                const x = 70 + (index % columns) * (width + GAP);
                const y = 180 + Math.floor(index / columns) * (height + GAP);
                // A title that wraps to a second line pushes its text down.
                const used = item.title ? (titleHeights[index] ?? 0) : 0;
                const textTop = Math.max(y + textY, y + titleY + used + 8);

                return (
                    <Fragment key={index}>
                        <Rect x={x} y={y} w={width} h={height} fill={COLORS.lavender} border={`1px solid ${COLORS.lavenderBorder}`} radius={8} />
                        <NumberCircle x={x + inset} y={y + inset} size={circle} number={index + 1} fontSize={number} />
                        <FitBox
                            x={x + titleX}
                            y={y + titleY}
                            w={width - titleX - 20}
                            h={52}
                            group="card-titles"
                            paragraphs={[para(item.title, STYLE.itemTitle, { lines: 2 })]}
                            onMeasure={(measured) => setTitleHeights((previous) => (
                                previous[index] === measured ? previous : { ...previous, [index]: measured }
                            ))}
                        />
                        <FitBox
                            x={x + textX}
                            y={textTop}
                            w={width - 2 * textX}
                            h={y + height - margin - textTop}
                            group="card-texts"
                            paragraphs={[para(item.text, STYLE.itemText)]}
                        />
                    </Fragment>
                );
            })}

            {hasFooter && <SlideFooter x={70} y={580} w={1140} h={110} text={slide.footer} />}
        </>
    );
}
