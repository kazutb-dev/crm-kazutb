import { FitBox, ImageSlot, SlideTitle, columnParagraphs, paras } from '../primitives';
import { STYLE } from '../theme';

const HEADING = { ...STYLE.heading, after: 8 };
const COLUMN_BODY = { ...STYLE.body, size: 15, min: 11 };

/** G) image_text — portrait picture on one side; title and paragraphs + bullets (or two sub-columns) on the other. */
export default function ImageTextSlide({ slide, eager }) {
    const left = slide.image_side === 'left';
    // With the picture on the left the title box would reach under the emblem (x ≥ 1160): it stops at 1150.
    const [x, width, titleWidth] = left ? [540, 670, 610] : [70, 680, 680];

    let body;

    if (slide.columns.length === 2) {
        const columnWidth = (width - 30) / 2;

        body = slide.columns.map((column, index) => (
            <FitBox
                key={index}
                x={x + index * (columnWidth + 30)}
                y={210}
                w={columnWidth}
                h={450}
                group="image-columns"
                paragraphs={columnParagraphs(column, HEADING, COLUMN_BODY)}
            />
        ));
    } else {
        const paragraphs = [
            ...paras(slide.paragraphs, STYLE.body),
            ...slide.columns.flatMap((column) => columnParagraphs(column, HEADING, STYLE.body)),
            ...paras(slide.bullets, STYLE.bullet),
        ];

        body = <FitBox x={x} y={210} w={width} h={450} paragraphs={paragraphs} />;
    }

    return (
        <>
            <ImageSlot slide={slide} x={left ? 0 : 800} y={0} w={480} h={720} eager={eager} />
            <SlideTitle x={x} y={110} w={titleWidth} h={80} text={slide.title} />
            {body}
        </>
    );
}
