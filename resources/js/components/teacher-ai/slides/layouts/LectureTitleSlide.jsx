import { FitBox, ImageSlot, para } from '../primitives';
import { COLORS } from '../theme';

const presentationText = (presentation, key) => (typeof presentation?.[key] === 'string' ? presentation[key].trim() : '');

/** B) lecture_title — portrait picture on the left, lecture title (bottom-anchored) and subtitle on the right. */
export default function LectureTitleSlide({ slide, presentation, eager }) {
    const title = slide.title || presentationText(presentation, 'title');
    const subtitle = slide.subtitle || presentationText(presentation, 'subtitle');

    return (
        <>
            <ImageSlot slide={slide} x={0} y={0} w={480} h={720} eager={eager} />
            <FitBox
                x={548}
                y={150}
                w={640}
                h={220}
                anchor="bottom"
                paragraphs={[para(title, { size: 24, min: 18, bold: true, color: COLORS.title })]}
            />
            <FitBox x={548} y={392} w={640} h={150} paragraphs={[para(subtitle, { size: 18, min: 14 })]} />
        </>
    );
}
