import BannerColumnsSlide from './BannerColumnsSlide';
import CardsSlide from './CardsSlide';
import ChartSlide from './ChartSlide';
import ConclusionSlide from './ConclusionSlide';
import CoverSlide from './CoverSlide';
import HierarchySlide from './HierarchySlide';
import ImageTextSlide from './ImageTextSlide';
import LectureTitleSlide from './LectureTitleSlide';
import PyramidSlide from './PyramidSlide';
import StatsSlide from './StatsSlide';
import StepsSlide from './StepsSlide';
import TextBulletsSlide from './TextBulletsSlide';
import TimelineSlide from './TimelineSlide';

/** Layout name (SPEC-V2 §3) → component. */
export const LAYOUT_COMPONENTS = {
    cover: CoverSlide,
    lecture_title: LectureTitleSlide,
    text_bullets: TextBulletsSlide,
    timeline: TimelineSlide,
    banner_columns: BannerColumnsSlide,
    cards: CardsSlide,
    image_text: ImageTextSlide,
    chart: ChartSlide,
    pyramid: PyramidSlide,
    stats: StatsSlide,
    steps: StepsSlide,
    hierarchy: HierarchySlide,
    conclusion: ConclusionSlide,
};
