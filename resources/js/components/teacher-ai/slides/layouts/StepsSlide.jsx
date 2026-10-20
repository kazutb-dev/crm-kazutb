import { Fragment } from 'react';
import { FitBox, HLine, SlideFooter, SlideTitle, para } from '../primitives';
import { COLORS, STYLE } from '../theme';

/** K) steps — numbered steps in two columns: «01» label, indigo rule, title, text. */
export default function StepsSlide({ slide }) {
    const { items } = slide;
    const hasFooter = slide.footer !== '';
    const rows = Math.max(1, Math.ceil(items.length / 2));
    const rowHeight = ((hasFooter ? 540 : 650) - 190) / rows;

    return (
        <>
            {/* Centred on the canvas like the spec's (70, 110, 1140, 50), but narrow enough to stay clear of the emblem. */}
            <SlideTitle x={132} y={110} w={1016} h={50} text={slide.title} align="center" compact />

            {items.map((item, index) => {
                const x = index % 2 === 0 ? 70 : 650;
                const y = 190 + Math.floor(index / 2) * rowHeight;

                return (
                    <Fragment key={index}>
                        <FitBox x={x} y={y} w={100} h={26} paragraphs={[para(String(index + 1).padStart(2, '0'), { size: 15 })]} />
                        <HLine x1={x} x2={x + 560} y={y + 30} width={3} color={COLORS.indigo} />
                        <FitBox x={x} y={y + 40} w={560} h={28} group="step-titles" paragraphs={[para(item.title, STYLE.itemTitle, { lines: 1 })]} />
                        <FitBox x={x} y={y + 72} w={560} h={rowHeight - 80} group="step-texts" paragraphs={[para(item.text, STYLE.itemText)]} />
                    </Fragment>
                );
            })}

            {hasFooter && <SlideFooter x={70} y={560} w={1140} h={110} text={slide.footer} />}
        </>
    );
}
