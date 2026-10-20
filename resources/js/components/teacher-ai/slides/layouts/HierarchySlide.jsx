import { Fragment } from 'react';
import { FitBox, ShapeLayer, SlideFooter, SlideTitle, para, polygonPoints } from '../primitives';
import { COLORS, STYLE } from '../theme';

const INDENT = 24;

/** PowerPoint "downArrow": shaft half the width, head as tall as half the shorter side. */
const downArrow = (x, y, w, h) => {
    const head = Math.min(w, h) / 2;

    return polygonPoints([
        [x + w / 4, y],
        [x + (w * 3) / 4, y],
        [x + (w * 3) / 4, y + h - head],
        [x + w, y + h - head],
        [x + w / 2, y + h],
        [x, y + h - head],
        [x + w / 4, y + h - head],
    ]);
};

/** L) hierarchy — staircase of levels, each with a lavender down arrow, a title and a text. */
export default function HierarchySlide({ slide }) {
    const { items } = slide;
    const step = 510 / items.length;

    return (
        <>
            {/* Centred like the spec's (70, 40, 1140, 50) box, narrow enough to stay clear of the emblem. */}
            <SlideTitle x={132} y={40} w={1016} h={50} text={slide.title} align="center" compact />

            <ShapeLayer>
                {items.map((_, index) => (
                    <polygon
                        key={index}
                        points={downArrow(70 + index * INDENT, 110 + index * step + 4, 44, Math.max(0, step - 12))}
                        fill={COLORS.lavender}
                    />
                ))}
            </ShapeLayer>

            {items.map((item, index) => {
                const y = 110 + index * step;
                const dx = index * INDENT;

                return (
                    <Fragment key={index}>
                        <FitBox x={130 + dx} y={y + 6} w={1080 - dx} h={28} group="hierarchy-titles" paragraphs={[para(item.title, STYLE.itemTitle, { lines: 1 })]} />
                        <FitBox x={130 + dx} y={y + 36} w={1080 - dx} h={step - 42} group="hierarchy-texts" paragraphs={[para(item.text, STYLE.itemText)]} />
                    </Fragment>
                );
            })}

            {slide.footer && <SlideFooter x={70} y={632} w={1140} h={70} text={slide.footer} />}
        </>
    );
}
