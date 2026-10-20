import { useState } from 'react';
import { FitBox, para } from '../primitives';
import { COLORS, COVER_PHOTO_URL } from '../theme';

const NAVY = { color: COLORS.navy, align: 'center' };

/** The building photo with its curved white edge (public/assets/teacher-ai/cover-photo.jpg); hidden if it fails to load. */
function CoverPhoto() {
    const [failed, setFailed] = useState(false);

    return (
        <div style={{ position: 'absolute', left: '560px', top: 0, width: '720px', height: '720px', overflow: 'hidden', background: COLORS.white }}>
            {!failed && (
                <img
                    src={COVER_PHOTO_URL}
                    alt=""
                    draggable={false}
                    onError={() => setFailed(true)}
                    style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
                />
            )}
        </div>
    );
}

/** A) cover — university, faculty, department, course and city centred on the left, building photo on the right. */
export default function CoverSlide({ slide, presentation }) {
    const cover = slide.cover;
    const fallbackCourse = slide.title || (typeof presentation?.title === 'string' ? presentation.title.trim() : '');

    return (
        <>
            <CoverPhoto />
            <FitBox x={40} y={40} w={500} h={74} paragraphs={[para(cover?.university, { size: 16, min: 12 }, NAVY)]} />
            {/* Faculty (y 122) and department (y 152) share a box: a faculty name that wraps pushes the department down. */}
            <FitBox
                x={40}
                y={122}
                w={500}
                h={78}
                paragraphs={[
                    para(cover?.faculty, { size: 14, min: 10, after: 6 }, NAVY),
                    para(cover?.department, { size: 14, min: 10 }, NAVY),
                ]}
            />
            <FitBox x={40} y={236} w={500} h={40} paragraphs={[para(cover?.course_label, { size: 26, min: 18, lines: 1 }, NAVY)]} />
            <FitBox x={40} y={280} w={500} h={110} paragraphs={[para(cover?.course || fallbackCourse, { size: 26, min: 18, bold: true }, NAVY)]} />
            <FitBox x={40} y={650} w={500} h={30} paragraphs={[para(cover?.city_year, { size: 15, min: 12, lines: 1 }, NAVY)]} />
        </>
    );
}
