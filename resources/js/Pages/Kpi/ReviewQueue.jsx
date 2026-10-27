import ModerationQueue from './ModerationQueue';

export default function ReviewQueue(props) {
    return (
        <ModerationQueue
            {...props}
            mode="review"
            pageTitle="KPI — Проверка Завкафедрой"
            eyebrow="KPI · Завкафедрой"
            title="Проверка заведующим кафедрой"
            description="Здесь заведующий кафедрой просматривает отправленные KPI-записи, корректирует значения при необходимости и возвращает исполнителю на доработку."
            queueRoute="kpi.review-queue"
        />
    );
}