import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { InfoField, Notice, PageHeader } from '@/components/platform';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link, usePage } from '@inertiajs/react';
import { CheckCircle2, Clock3, FileText, MessageSquareText, Plane, XCircle } from 'lucide-react';

const getStatusMeta = (status) => {
    switch (status) {
        case 'accepted':
            return {
                label: 'Принято',
                variant: 'success',
                description: 'Заявка одобрена сотрудником академической мобильности.',
                Icon: CheckCircle2,
                iconClassName: 'bg-emerald-100 text-emerald-700',
                step: 3,
            };
        case 'rejected':
            return {
                label: 'Отклонено',
                variant: 'destructive',
                description: 'Заявка отклонена. Проверьте комментарий сотрудника ниже.',
                Icon: XCircle,
                iconClassName: 'bg-red-100 text-red-700',
                step: 3,
            };
        default:
            return {
                label: 'На рассмотрении',
                variant: 'warning',
                description: 'Заявка отправлена и ожидает решения сотрудника.',
                Icon: Clock3,
                iconClassName: 'bg-amber-100 text-amber-700',
                step: 2,
            };
    }
};

export default function StudentStatusPage({ application, user, can_resubmit = false }) {
    const { props } = usePage();
    const flashSuccess = props.flash?.success;
    const statusMeta = getStatusMeta(application?.status);
    const StatusIcon = statusMeta.Icon;

    const steps = [
        { key: 1, label: 'Заявка отправлена' },
        { key: 2, label: 'На рассмотрении' },
        { key: 3, label: application?.status === 'rejected' ? 'Отклонено' : 'Решение принято' },
    ];

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="Академическая мобильность"
                    title="Статус вашей заявки"
                    description="Повторная подача отключена. На этой странице можно отслеживать текущий статус."
                    meta={<Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>}
                    actions={(
                        <>
                            {can_resubmit ? (
                                <Button variant="gold" asChild>
                                    <Link href={route('academic-mobility.student.resubmit')}>
                                        Подать заявку повторно
                                    </Link>
                                </Button>
                            ) : null}
                            <Button variant="outline" asChild>
                                <Link href={route('dashboard')}>
                                    Вернуться в кабинет
                                </Link>
                            </Button>
                        </>
                    )}
                />
            )}
        >
            <div className="admin-page-wrap">
                <div className="mx-auto max-w-4xl space-y-6">
                    {flashSuccess ? (
                        <Notice tone="success" title="Заявка успешно отправлена">
                            Спасибо, {user?.name ?? 'студент'}. Ваша заявка зарегистрирована и передана на рассмотрение.
                        </Notice>
                    ) : null}

                    <Card>
                        <CardContent className="space-y-6 pt-6">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-center gap-4">
                                    <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${statusMeta.iconClassName}`}>
                                        <StatusIcon className="h-7 w-7" />
                                    </span>
                                    <div className="min-w-0 space-y-0.5">
                                        <p className="qd-field-label tabular-nums text-slate-500">Номер заявки: #{application?.id}</p>
                                        <h2 className="font-display text-xl font-bold text-[#102945]">{user?.name}</h2>
                                        <p className="text-sm text-slate-600">{user?.email}</p>
                                    </div>
                                </div>
                                <Badge variant={statusMeta.variant} className="self-start px-3 py-1 text-sm sm:self-center">
                                    {statusMeta.label}
                                </Badge>
                            </div>

                            <p className="text-sm text-slate-600">{statusMeta.description}</p>

                            <ol className="grid gap-3 border-y border-slate-200 py-4 sm:grid-cols-3">
                                {steps.map((step) => {
                                    const done = step.key <= statusMeta.step;
                                    return (
                                        <li key={step.key} className="flex items-center gap-2.5">
                                            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${done ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                                {step.key}
                                            </span>
                                            <span className={`text-sm ${done ? 'font-semibold text-[#102945]' : 'text-slate-500'}`}>{step.label}</span>
                                        </li>
                                    );
                                })}
                            </ol>

                            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                                <InfoField label="Телефон">{application?.phone ?? '—'}</InfoField>
                                <InfoField label="Группа">{application?.student_group ?? '—'}</InfoField>
                                <InfoField label="Дата подачи">{application?.created_at ?? '—'}</InfoField>
                                <InfoField label="Дата рассмотрения">{application?.reviewed_at ?? '—'}</InfoField>
                            </div>

                            {(application?.document_types?.length ?? 0) > 0 ? (
                                <div>
                                    <p className="qd-field-label text-slate-500">Прикрепленные документы</p>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {application.document_types.map((document) => (
                                            <Badge key={document} variant="secondary">{document}</Badge>
                                        ))}
                                    </div>
                                </div>
                            ) : null}
                        </CardContent>
                    </Card>

                    {(application?.document_files?.length ?? 0) > 0 ? (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Plane className="shrink-0" />
                                    Файлы заявки
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="py-2">
                                <ul className="divide-y divide-slate-200 text-sm text-slate-700">
                                    {(application.document_files ?? []).map((file) => (
                                        <li key={file.path} className="flex flex-wrap items-center gap-3 py-3">
                                            <FileText className="h-4 w-4 shrink-0 text-teal-700" />
                                            <span className="font-medium text-slate-900">{file.document_type}</span>
                                            <a
                                                href={file.view_url ?? file.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="font-medium text-teal-700 underline-offset-2 hover:text-[#102945] hover:underline"
                                            >
                                                {file.original_name}
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    ) : null}

                    {application?.review_notes ? (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <MessageSquareText className="shrink-0" />
                                    Комментарий сотрудника
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="border-l-2 border-teal-500 pl-3 text-sm leading-relaxed text-slate-800">{application.review_notes}</p>
                            </CardContent>
                        </Card>
                    ) : null}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
