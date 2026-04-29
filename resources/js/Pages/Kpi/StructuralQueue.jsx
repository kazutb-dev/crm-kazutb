import ModerationQueue from './ModerationQueue';

export default function StructuralQueue(props) {
    return (
        <ModerationQueue
            {...props}
            mode="structural"
            pageTitle="Финальное утверждение KPI"
            title="Финальное утверждение KPI — структурные подразделения"
            description="Здесь структурные подразделения рассматривают KPI-записи ППС, прошедшие проверку деканатом. При утверждении записи начисляются баллы ППС и запись блокируется. При отклонении запись также блокируется — ППС не может её редактировать."
            queueRoute="kpi.structural-queue"
        />
    );
}
