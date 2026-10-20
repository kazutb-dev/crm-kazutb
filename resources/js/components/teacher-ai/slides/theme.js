/**
 * Design tokens of the KazUTB lecture template (SPEC-V2 §1).
 *
 * Every slide is laid out on a fixed 1280x720 canvas; geometry is given in
 * canvas px and font sizes in pt (px = pt × 4/3), exactly like the PPTX
 * export (app/Services/TeacherAi/LessonPptxExporter.php), whose text styles
 * and fitting rules the preview mirrors.
 */

export const CANVAS_WIDTH = 1280;
export const CANVAS_HEIGHT = 720;

/** pt → canvas px. */
export const pt = (value) => (value * 4) / 3;

export const FONT_FAMILY = "'Times New Roman', Tinos, 'Liberation Serif', Times, serif";

export const COLORS = {
    title: '#111111',
    body: '#333333',
    muted: '#555555',
    item: '#1F1F1F',
    navy: '#1B2A4A',
    indigo: '#4B4FC4',
    lavender: '#DCDCF3',
    lavenderBorder: '#C3C3E6',
    line: '#C9C9DD',
    grid: '#E5E7EB',
    white: '#FFFFFF',
};

export const CHART_SERIES_COLORS = ['#161A38', '#3C3F9F', '#8C8FD9'];

export const PLACEHOLDER_BACKGROUND = 'linear-gradient(to bottom right, #2E2A78, #6A5ACD)';

export const LOGO_URL = '/assets/images/logo.png';
export const LOGO_BOX = { x: 1160, y: 24, w: 92, h: 92 };

export const COVER_PHOTO_URL = '/assets/teacher-ai/cover-photo.jpg';

/**
 * Single line height in em, a paragraph's `spacing` multiplies it. 1.2 is what
 * the exporter estimates with and what the PPTX renders show for Times New
 * Roman (measured ≈ 1.19–1.22 em per line).
 */
export const LINE_FACTOR = 1.2;

/**
 * Paragraph styles of the exporter. Sizes and the fit minimum in pt, `spacing`
 * the line spacing factor, `after` the space after the paragraph in pt,
 * `lines` a line limit (0 = none).
 */
export const PARAGRAPH = {
    text: '',
    size: 16,
    min: 12,
    bold: false,
    color: COLORS.body,
    align: 'left',
    spacing: 1,
    after: 0,
    bullet: false,
    lines: 0,
};

export const STYLE = {
    title: { size: 22, min: 16, bold: true, color: COLORS.title, lines: 2 },
    /** Title boxes 50 px high hold two lines only from 15 pt down. */
    titleCompact: { size: 22, min: 15, bold: true, color: COLORS.title, lines: 2 },
    body: { size: 16, min: 12, spacing: 1.15, after: 8 },
    bullet: { size: 16, min: 12, spacing: 1.15, after: 8, bullet: true },
    heading: { size: 17, min: 13, bold: true, color: COLORS.title },
    itemTitle: { size: 16, min: 12, bold: true, color: COLORS.item },
    itemText: { size: 14, min: 11 },
    footer: { size: 15, min: 12 },
};

export const KNOWN_LAYOUTS = [
    'cover',
    'lecture_title',
    'text_bullets',
    'timeline',
    'banner_columns',
    'cards',
    'image_text',
    'chart',
    'pyramid',
    'stats',
    'steps',
    'hierarchy',
    'conclusion',
];

/** Most items a layout can draw (as in the exporter). */
export const MAX_ITEMS = { timeline: 6, cards: 6, pyramid: 4, stats: 2, steps: 6, hierarchy: 6, conclusion: 6 };
