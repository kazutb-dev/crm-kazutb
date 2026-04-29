import ModerationQueue from './ModerationQueue';

export default function ApprovalQueue(props) {
    return (
        <ModerationQueue
            {...props}
            mode="approval"
            pageTitle="Очередь утверждения деканом"
            title="Очередь рассмотрения деканом"
            description="Здесь декан рассматривает KPI-записи, одобренные заведующим кафедрой. При одобрении запись переходит на финальное рассмотрение в структурные подразделения. При отклонении запись возвращается ППС на доработку."
            queueRoute="kpi.approval-queue"
        />
    );
}