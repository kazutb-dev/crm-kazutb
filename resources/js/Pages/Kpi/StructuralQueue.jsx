import ModerationQueue from './ModerationQueue';

export default function StructuralQueue(props) {
    return (
        <ModerationQueue
            {...props}
            mode="structural"
            pageTitle="KPI — Проверка Структурным подразделением"
            eyebrow="KPI · Финальное утверждение"
            title="Проверка структурным подразделением"
            description="Здесь структурные подразделения выполняют финальное утверждение KPI-записей. При утверждении записи начисляются баллы и запись блокируется. При отклонении запись также блокируется и не подлежит дальнейшему редактированию."
            queueRoute="kpi.structural-queue"
        />
    );
}
