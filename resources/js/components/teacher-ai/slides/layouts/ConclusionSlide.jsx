import { Fragment } from 'react';
import { FitBox, Rect, SlideFooter, SlideTitle, para } from '../primitives';
import { COLORS, STYLE } from '../theme';

/** M) conclusion — two columns of white cards with an indigo accent bar on the left. */
export default function ConclusionSlide({ slide }) {
    const { items } = slide;
    const hasFooter = slide.footer !== '';
    const rows = Math.max(1, Math.ceil(items.length / 2));
    const height = ((hasFooter ? 590 : 690) - 130 - 16 * (rows - 1)) / rows;

    return (
        <>
            <SlideTitle x={70} y={62} w={1060} h={50} text={slide.title} compact />

            {items.map((item, index) => {
                const x = index % 2 === 0 ? 70 : 650;
                const y = 130 + Math.floor(index / 2) * (height + 16);

                return (
                    <Fragment key={index}>
                        <Rect x={x} y={y} w={560} h={height} fill={COLORS.white} border={`2px solid ${COLORS.lavenderBorder}`} radius={8} />
                        {/* A pill 3 px shorter at both ends stays inside the card's rounded corners. */}
                        <Rect x={x} y={y + 3} w={7} h={height - 6} fill={COLORS.indigo} radius={3.5} />
                        <FitBox x={x + 24} y={y + 14} w={520} h={28} group="conclusion-titles" paragraphs={[para(item.title, STYLE.itemTitle, { lines: 1 })]} />
                        <FitBox x={x + 24} y={y + 46} w={520} h={height - 56} group="conclusion-texts" paragraphs={[para(item.text, STYLE.itemText)]} />
                    </Fragment>
                );
            })}

            {hasFooter && <SlideFooter x={70} y={602} w={1140} h={100} text={slide.footer} />}
        </>
    );
}
