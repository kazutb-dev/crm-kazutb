import { FitBox, SlideTitle, para, paras } from '../primitives';
import { STYLE } from '../theme';

/** C) text_bullets — paragraphs on the left, side title + bullets on the right; either part alone takes the full width. */
export default function TextBulletsSlide({ slide }) {
    const paragraphs = paras(slide.paragraphs, STYLE.body);
    const title = <SlideTitle x={70} y={120} w={1060} h={80} text={slide.title} />;

    if (slide.bullets.length === 0) {
        return (
            <>
                {title}
                <FitBox x={70} y={225} w={1140} h={420} paragraphs={paragraphs} />
            </>
        );
    }

    const [x, width] = paragraphs.length === 0 ? [70, 1140] : [770, 440];
    const top = slide.side_title !== '' ? 268 : 225;

    return (
        <>
            {title}
            <FitBox x={70} y={225} w={650} h={420} paragraphs={paragraphs} />
            <FitBox x={x} y={225} w={width} h={34} paragraphs={[para(slide.side_title, STYLE.heading, { min: 14, lines: 1 })]} />
            <FitBox x={x} y={top} w={width} h={645 - top} paragraphs={paras(slide.bullets, STYLE.bullet, { after: 6 })} />
        </>
    );
}
