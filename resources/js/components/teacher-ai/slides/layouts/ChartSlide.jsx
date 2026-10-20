import { Fragment } from 'react';
import { FitBox, HLine, Rect, SlideTitle, VLine, hitsLogo, para } from '../primitives';
import { CHART_SERIES_COLORS, COLORS, STYLE, pt } from '../theme';

const X0 = 640;
const X1 = 1190;
const TOP = 100;
const BOTTOM = 560;
const SHARES = [0, 0.25, 0.5, 0.75, 1];

/** Axis maximum: 100 when every value fits, else 1/2/2.5/5 × 10^k. */
export function niceMax(series) {
    const largest = Math.max(0, ...series.flatMap((one) => one.values));

    if (largest <= 100) {
        return 100;
    }

    const power = 10 ** Math.floor(Math.log10(largest));

    for (const factor of [1, 2, 2.5, 5]) {
        if (factor * power >= largest) {
            return factor * power;
        }
    }

    return 10 * power;
}

/** Up to two decimals, no grouping, decimal comma except in English (exporter's number()). */
export function formatNumber(value, language) {
    const point = language === 'en' ? '.' : ',';
    const fixed = (Math.round(value * 100) / 100).toFixed(2).replace('.', point);

    return fixed.replace(/0+$/, '').replace(new RegExp(`\\${point}$`), '');
}

// Glyph widths of Times New Roman in em (the exporter's estimate), for label boxes.
const GLYPHS_NARROW = ".,:;!'\"|()[]{}-/iljtfrIіІ";
const GLYPHS_WIDE = 'mwжмшщыюф';
const GLYPHS_EXTRA_WIDE = 'MWЖМШЩЫЮФ%—';

const glyphWidth = (char) => {
    if (GLYPHS_NARROW.includes(char)) {
        return 0.31;
    }

    if (GLYPHS_EXTRA_WIDE.includes(char)) {
        return 0.95;
    }

    if (GLYPHS_WIDE.includes(char)) {
        return 0.71;
    }

    return /^\p{Lu}$/u.test(char) ? 0.7 : 0.49;
};

/** Box width (px) a one-line label needs at the given size, with a little slack. */
const labelWidth = (text, size) => {
    const em = text.split(' ').reduce((sum, word) => sum + [...word].reduce((width, char) => width + glyphWidth(char), 0) + 0.25, -0.25);

    return pt(em * size) + 6;
};

/** Value label right of the bar end; inside the bar end when it would run into the emblem. */
function BarValue({ value, x, y, length, height, series }) {
    const width = labelWidth(value, 12);
    let left = x + length + 6;
    const top = y + height / 2 - 11;
    let style = { size: 12, min: 9, lines: 1 };

    if (hitsLogo(left, top, width, 22) && length > width + 12) {
        left = x + length - 6 - width;
        style = { ...style, align: 'right', color: series === 2 ? COLORS.title : COLORS.white };
    }

    return <FitBox x={left} y={top} w={width} h={22} anchor="middle" paragraphs={[para(value, style)]} />;
}

/** Legend row (470, 612, 740, 30): colour square + name per series, then the unit in parentheses. */
function ChartLegend({ series, unit }) {
    const entries = [
        ...series.flatMap((one, index) => (one.name !== '' ? [{ text: one.name, color: CHART_SERIES_COLORS[index] }] : [])),
        ...(unit !== '' ? [{ text: `(${unit})`, color: null }] : []),
    ];

    // Largest size from 15 pt down at which the whole row fits its 740 px.
    let size = 15;

    for (; size > 11; size -= 1) {
        const width = entries.reduce((sum, entry) => sum + (entry.color !== null ? 20 : 0) + labelWidth(entry.text, size) + 24, -24);

        if (width <= 740) {
            break;
        }
    }

    let x = 470;

    return entries.map((entry, index) => {
        const square = entry.color !== null ? { left: x } : null;

        if (square) {
            x += 20;
        }

        const width = Math.min(labelWidth(entry.text, size), Math.max(40, 1210 - x));
        const textX = x;
        x += width + 24;

        return (
            <Fragment key={index}>
                {square && <Rect x={square.left} y={620} w={14} h={14} fill={entry.color} />}
                <FitBox x={textX} y={612} w={width} h={30} anchor="middle" paragraphs={[para(entry.text, { size, min: 9, lines: 1 })]} />
            </Fragment>
        );
    });
}

/** H) chart — explanation on the left, horizontal bar chart (bars grouped by category) on the right. */
export default function ChartSlide({ slide, language }) {
    const { categories, series } = slide;
    const max = niceMax(series);
    const groupHeight = (BOTTOM - TOP) / categories.length;
    const barHeight = Math.max(1, Math.min(30, (groupHeight - 18) / series.length));
    const barsTop = (groupHeight - series.length * barHeight - (series.length - 1) * 4) / 2;

    return (
        <>
            <SlideTitle x={110} y={30} w={1000} h={50} text={slide.title} align="center" compact />
            <FitBox x={40} y={120} w={390} h={440} paragraphs={[para(slide.text, STYLE.body)]} />

            {SHARES.slice(1).map((share) => (
                <VLine key={share} x={X0 + share * (X1 - X0)} y1={TOP} y2={BOTTOM} width={1} color={COLORS.grid} />
            ))}

            {categories.map((category, k) => {
                const groupTop = TOP + k * groupHeight;

                return (
                    <Fragment key={k}>
                        <FitBox
                            x={470}
                            y={groupTop}
                            w={160}
                            h={groupHeight}
                            anchor="middle"
                            group="chart-labels"
                            paragraphs={[para(category, { size: 14, min: 10, align: 'right' })]}
                        />
                        {series.map((one, j) => {
                            const y = groupTop + barsTop + j * (barHeight + 4);
                            const length = (one.values[k] / max) * (X1 - X0);

                            return (
                                <Fragment key={j}>
                                    {length >= 0.5 && <Rect x={X0} y={y} w={length} h={barHeight} fill={CHART_SERIES_COLORS[j]} />}
                                    <BarValue value={formatNumber(one.values[k], language)} x={X0} y={y} length={length} height={barHeight} series={j} />
                                </Fragment>
                            );
                        })}
                    </Fragment>
                );
            })}

            <VLine x={X0} y1={TOP} y2={BOTTOM} width={1.5} color={COLORS.body} />
            <HLine x1={X0} x2={X1} y={BOTTOM} width={1.5} color={COLORS.body} />

            {SHARES.map((share) => (
                <FitBox
                    key={share}
                    x={X0 + share * (X1 - X0) - 40}
                    y={566}
                    w={80}
                    h={22}
                    paragraphs={[para(formatNumber(max * share, language), { size: 13, min: 10, color: COLORS.muted, align: 'center', lines: 1 })]}
                />
            ))}

            <ChartLegend series={series} unit={slide.unit} />
        </>
    );
}
