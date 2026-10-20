import { Fragment } from 'react';
import { FitBox, ShapeLayer, SlideTitle, para, polygonPoints } from '../primitives';
import { COLORS, STYLE } from '../theme';

const SHAPE_TOP = 200;
const SHAPE_HEIGHT = 70;
// PowerPoint's default point depth: half the shape height.
const TIP = SHAPE_HEIGHT / 2;

/** PowerPoint "homePlate" (pentagon): rectangle with a pointed right end. */
const homePlate = (x, w) => polygonPoints([
    [x, SHAPE_TOP],
    [x + w - TIP, SHAPE_TOP],
    [x + w, SHAPE_TOP + TIP],
    [x + w - TIP, SHAPE_TOP + SHAPE_HEIGHT],
    [x, SHAPE_TOP + SHAPE_HEIGHT],
]);

/** PowerPoint "chevron": notched left end, pointed right end. */
const chevron = (x, w) => polygonPoints([
    [x, SHAPE_TOP],
    [x + w - TIP, SHAPE_TOP],
    [x + w, SHAPE_TOP + TIP],
    [x + w - TIP, SHAPE_TOP + SHAPE_HEIGHT],
    [x, SHAPE_TOP + SHAPE_HEIGHT],
    [x + TIP, SHAPE_TOP + TIP],
]);

const CENTER = { align: 'center' };

/** J) stats — up to two concepts under arrow shapes, then a row of (three) big numbers. */
export default function StatsSlide({ slide }) {
    const concepts = slide.items;
    const { stats } = slide;
    const top = concepts.length > 0 ? 440 : 240;

    return (
        <>
            <SlideTitle x={70} y={120} w={1060} h={60} text={slide.title} />

            {concepts.length > 0 && (
                <ShapeLayer>
                    <polygon points={homePlate(70, 575)} fill={COLORS.lavender} />
                    <polygon points={chevron(630, 580)} fill={COLORS.lavender} />
                </ShapeLayer>
            )}

            {concepts.map((concept, k) => {
                const [x, width] = k === 0 ? [90, 520] : [660, 530];

                return (
                    <Fragment key={k}>
                        <FitBox x={x} y={290} w={width} h={30} group="concept-titles" paragraphs={[para(concept.title, STYLE.heading, { lines: 1 })]} />
                        <FitBox x={x} y={322} w={width} h={80} group="concept-texts" paragraphs={[para(concept.text, { size: 15, min: 11 })]} />
                    </Fragment>
                );
            })}

            {stats.map((stat, k) => {
                // 3 stats → centres 260 / 640 / 1020; fewer stay centred on the slide.
                const x = 640 + (k - (stats.length - 1) / 2) * 380 - 170;

                return (
                    <Fragment key={k}>
                        <FitBox
                            x={x}
                            y={top}
                            w={340}
                            h={44}
                            group="stat-values"
                            paragraphs={[para(stat.value, { size: 26, min: 18, bold: true, color: COLORS.title, lines: 1 }, CENTER)]}
                        />
                        <FitBox x={x} y={top + 52} w={340} h={30} group="stat-labels" paragraphs={[para(stat.label, STYLE.heading, { lines: 1 }, CENTER)]} />
                        <FitBox x={x} y={top + 88} w={340} h={70} group="stat-texts" paragraphs={[para(stat.text, STYLE.itemText, CENTER)]} />
                    </Fragment>
                );
            })}
        </>
    );
}
