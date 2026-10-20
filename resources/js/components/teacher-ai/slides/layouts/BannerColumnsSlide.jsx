import { FitBox, ImageSlot, SlideTitle, columnParagraphs } from '../primitives';
import { STYLE } from '../theme';

const HEADING = { ...STYLE.heading, after: 10 };

/** E) banner_columns — optional full-width banner picture, title, two text columns (heading, text, bullets). */
export default function BannerColumnsSlide({ slide, eager }) {
    const [titleTop, top] = slide.image ? [248, 325] : [110, 195];
    const width = slide.columns.length > 1 ? 540 : 1140;

    return (
        <>
            {slide.image && <ImageSlot slide={slide} x={0} y={0} w={1280} h={215} eager={eager} />}
            <SlideTitle x={70} y={titleTop} w={1060} h={60} text={slide.title} />
            {slide.columns.map((column, index) => (
                <FitBox
                    key={index}
                    x={70 + index * 600}
                    y={top}
                    w={width}
                    h={690 - top}
                    group="columns"
                    paragraphs={columnParagraphs(column, HEADING, STYLE.body)}
                />
            ))}
        </>
    );
}
