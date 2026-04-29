import ModerationQueue from './ModerationQueue';

export default function ReviewQueue(props) {
    return (
        <ModerationQueue
            {...props}
            mode="review"
            pageTitle="Очередь проверки KPI"
            title="Очередь проверки KPI-записей"
            description="Здесь заведующий кафедрой или декан просматривает отправленные KPI-записи, проверяет их комплектность и при необходимости возвращает исполнителю на доработку."
            queueRoute="kpi.review-queue"
        />
    );
}