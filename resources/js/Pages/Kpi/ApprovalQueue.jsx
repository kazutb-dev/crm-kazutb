import ModerationQueue from './ModerationQueue';

export default function ApprovalQueue(props) {
    return (
        <ModerationQueue
            {...props}
            mode="approval"
            pageTitle="KPI — Проверка Деканом"
            title="KPI — Проверка Деканом"
            description="Здесь декан рассматривает KPI-записи, корректирует значения при необходимости, одобряет записи или возвращает их на доработку. После одобрения запись переходит на финальное утверждение."
            queueRoute="kpi.approval-queue"
        />
    );
}