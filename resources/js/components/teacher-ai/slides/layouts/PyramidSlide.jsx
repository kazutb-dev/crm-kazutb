import { Fragment } from 'react';
import { FitBox, HLine, NumberLabel, ShapeLayer, SlideTitle, para, polygonPoints } from '../primitives';
import { COLORS, STYLE } from '../theme';

const APEX_X = 355;
const TOP = 165;
const HEIGHT = 305;

/** Half width of the triangle at height y (apex (355, 165), 560 px base at y = 470). */
const halfWidth = (y) => (280 * (y - TOP)) / HEIGHT;

/** I) pyramid — lavender triangle split into numbered bands, labels to the right, detail columns below. */
export default function PyramidSlide({ slide }) {
    const { items } = slide;
    const count = items.length;
    const band = HEIGHT / count;
    const columnWidth = (1140 - 30 * (count - 1)) / count;

    return (
        <>
            <SlideTitle x={70} y={95} w={1060} h={60} text={slide.title} />

            <ShapeLayer>
                <polygon points={polygonPoints([[APEX_X, TOP], [APEX_X + 280, TOP + HEIGHT], [APEX_X - 280, TOP + HEIGHT]])} fill={COLORS.lavender} />
                {items.slice(1).map((_, index) => {
                    const y = TOP + (index + 1) * band;

                    return <line key={index} x1={APEX_X - halfWidth(y)} y1={y} x2={APEX_X + halfWidth(y)} y2={y} stroke={COLORS.white} strokeWidth="3" />;
                })}
            </ShapeLayer>

            {items.map((item, k) => {
                const top = TOP + k * band;
                // The tip is narrow: the first number sits at 60 % of its band.
                const numberY = top + band * (k === 0 ? 0.6 : 0.5);
                const labelX = APEX_X + halfWidth(top + band / 2) + 40;

                return (
                    <Fragment key={k}>
                        <NumberLabel x={325} y={numberY - 15} w={60} h={30} number={k + 1} size={18} />
                        <FitBox
                            x={labelX}
                            y={top + 10}
                            w={1210 - labelX}
                            h={26}
                            group="pyramid-titles"
                            paragraphs={[para(item.title, STYLE.itemTitle, { lines: 1 })]}
                        />
                        <FitBox
                            x={labelX}
                            y={top + 38}
                            w={1210 - labelX}
                            h={band - 44}
                            group="pyramid-texts"
                            paragraphs={[para(item.text, STYLE.itemText)]}
                        />
                        {k < count - 1 && <HLine x1={labelX} x2={1210} y={top + band} width={1} color={COLORS.line} />}
                        {item.detail !== '' && (
                            <FitBox
                                x={70 + k * (columnWidth + 30)}
                                y={495}
                                w={columnWidth}
                                h={195}
                                group="pyramid-details"
                                paragraphs={[
                                    para(item.title, { size: 15, min: 12, bold: true, color: COLORS.item, after: 6 }),
                                    para(item.detail, STYLE.itemText),
                                ]}
                            />
                        )}
                    </Fragment>
                );
            })}
        </>
    );
}
