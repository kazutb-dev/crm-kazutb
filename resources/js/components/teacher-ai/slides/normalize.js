import { KNOWN_LAYOUTS, MAX_ITEMS } from './theme';

/*
 * Defensive normalisation of one stored slide (SPEC-V2 §2), the same rules as
 * LessonPptxExporter::slide(): every key present, texts cleaned, lists clamped
 * to what the layout can draw. An unknown layout (also the version-1 ones), or
 * a layout without the data it needs, becomes text_bullets. The renderer never
 * crashes on missing keys or wrong types.
 */

const IMAGE_STATUSES = ['ready', 'pending', 'failed', 'none'];

const asObject = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});

const asArray = (value) => (Array.isArray(value) ? value : []);

/** Any scalar → trimmed string without control characters; line breaks are kept. */
export function clean(value) {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? String(value) : '';
    }

    if (typeof value !== 'string') {
        return '';
    }

    return value
        .replace(/\r\n?/g, '\n')
        .replace(/\t/g, ' ')
        // Unicode category C (controls, format characters, …) except the line break.
        .replace(/[^\P{C}\n]+/gu, '')
        .trim();
}

/** Cleaned text on a single line (runs of whitespace become one space). */
export const line = (value) => clean(value).replace(/\s+/g, ' ').trim();

/** Non-empty single-line strings. */
const lineList = (value) => asArray(value).map(line).filter(Boolean);

/** Non-empty lines of a multi-line text. */
export const lines = (text) => lineList(clean(text).split('\n'));

/** Paragraph strings; one with line breaks becomes several paragraphs. */
const paragraphList = (value) => asArray(value).flatMap((item) => lines(item));

const records = (value, keys) => asArray(value)
    .filter((entry) => entry && typeof entry === 'object' && !Array.isArray(entry))
    .map((entry) => Object.fromEntries(keys.map((key) => [key, line(entry[key])])))
    .filter((record) => keys.some((key) => record[key] !== ''));

const columns = (value) => asArray(value)
    .filter((entry) => entry && typeof entry === 'object' && !Array.isArray(entry))
    .map((entry) => ({ title: line(entry.title), text: clean(entry.text), bullets: lineList(entry.bullets) }))
    .filter((column) => column.title !== '' || column.text !== '' || column.bullets.length > 0);

/** PHP is_numeric() + max(0, …): numbers and numeric strings, anything else is 0. */
const nonNegative = (value) => {
    let number = Number.NaN;

    if (typeof value === 'number') {
        number = value;
    } else if (typeof value === 'string' && value.trim() !== '') {
        number = Number(value.trim());
    }

    return Number.isFinite(number) ? Math.max(0, number) : 0;
};

/** Up to three series with one value per category. */
const seriesList = (value, categoryCount) => asArray(value)
    .filter((entry) => entry && typeof entry === 'object' && Array.isArray(entry.values))
    .map((entry) => ({
        name: line(entry.name),
        values: Array.from({ length: categoryCount }, (_, index) => nonNegative(entry.values[index])),
    }))
    .slice(0, 3);

const hasLayoutData = (slide) => {
    switch (slide.layout) {
        case 'timeline':
        case 'cards':
        case 'pyramid':
        case 'steps':
        case 'hierarchy':
        case 'conclusion':
            return slide.items.length > 0;
        case 'banner_columns':
            return slide.columns.length > 0;
        case 'chart':
            return slide.categories.length > 0 && slide.series.length > 0;
        case 'stats':
            return slide.stats.length > 0;
        default:
            return true;
    }
};

/** Fallback of a slide whose layout cannot be drawn: everything as paragraphs and bullets. */
const asTextSlide = (slide) => {
    const filled = (texts) => texts.filter((text) => text !== '');

    return {
        ...slide,
        layout: 'text_bullets',
        paragraphs: filled([...slide.paragraphs, slide.text, slide.footer]),
        bullets: filled([...slide.bullets, ...slide.items.map((item) => filled([item.title, item.text]).join(': '))]),
    };
};

const coverTexts = (value) => {
    const cover = asObject(value);

    return {
        university: line(cover.university),
        faculty: line(cover.faculty),
        department: line(cover.department),
        course_label: line(cover.course_label),
        course: line(cover.course),
        city_year: line(cover.city_year),
    };
};

export function normalizeSlide(raw) {
    const source = asObject(raw);
    const layout = line(source.layout).toLowerCase();
    const known = KNOWN_LAYOUTS.includes(layout);
    const categories = lineList(source.categories).slice(0, 6);
    const imageUrl = line(source.image_url) || null;

    const slide = {
        layout: known ? layout : 'text_bullets',
        title: line(source.title),
        subtitle: line(source.subtitle),
        paragraphs: paragraphList(source.paragraphs),
        side_title: line(source.side_title),
        bullets: lineList(source.bullets),
        items: records(source.items, ['title', 'text', 'detail']).slice(0, MAX_ITEMS[layout] ?? 6),
        columns: columns(source.columns).slice(0, 2),
        stats: records(source.stats, ['value', 'label', 'text']).slice(0, 3),
        categories,
        series: seriesList(source.series, categories.length),
        unit: line(source.unit),
        text: line(source.text),
        footer: line(source.footer),
        image: source.image === true,
        image_side: source.image_side === 'left' ? 'left' : 'right',
        notes: clean(source.notes),
        cover: source.cover && typeof source.cover === 'object' && !Array.isArray(source.cover) ? coverTexts(source.cover) : null,
        image_url: imageUrl,
        image_status: IMAGE_STATUSES.includes(source.image_status) ? source.image_status : (imageUrl ? 'ready' : 'none'),
    };

    return known && hasLayoutData(slide) ? slide : asTextSlide(slide);
}
