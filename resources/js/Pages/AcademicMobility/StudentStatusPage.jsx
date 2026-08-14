import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Link, usePage } from '@inertiajs/react';
import { CheckCircle2, Clock3, XCircle } from 'lucide-react';

const getStatusMeta = (status) => {
    switch (status) {
        case 'accepted':
            return {
                label: 'Принято',
                badgeClassName: 'bg-emerald-100 text-emerald-700 border-emerald-200',
                description: 'Заявка одобрена сотрудником академической мобильности.',
                Icon: CheckCircle2,
                iconClassName: 'text-emerald-600',
            };
        case 'rejected':
            return {
                label: 'Отклонено',
                badgeClassName: 'bg-rose-100 text-rose-700 border-rose-200',
                description: 'Заявка отклонена. Проверьте комментарий сотрудника ниже.',
                Icon: XCircle,
                iconClassName: 'text-rose-600',
            };
        default:
            return {
                label: 'На рассмотрении',
                badgeClassName: 'bg-amber-100 text-amber-700 border-amber-200',
                description: 'Заявка отправлена и ожидает решения сотрудника.',
                Icon: Clock3,
                iconClassName: 'text-amber-600',
            };
    }
};

export default function StudentStatusPage({ application, user, can_resubmit = false }) {
    const { props } = usePage();
    const flashSuccess = props.flash?.success;
    const statusMeta = getStatusMeta(application?.status);
    const StatusIcon = statusMeta.Icon;

    return (
        <AuthenticatedLayout
            header={(
                <div className="space-y-2">
                    <p className="text-sm font-medium uppercase tracking-[0.2em] text-teal-700">Академическая мобильность</p>
                    <h2 className="text-2xl font-semibold text-slate-900">Статус вашей заявки</h2>
                    <p className="max-w-3xl text-sm text-slate-600">
                        Повторная подача отключена. На этой странице можно отслеживать текущий статус.
                    </p>
                </div>
            )}
        >
            <div className="w-full space-y-6 px-4 py-6 sm:px-6 lg:px-8">
                {flashSuccess ? (
                    <div className="mx-auto flex max-w-3xl flex-col items-center justify-center rounded-3xl border border-emerald-200 bg-emerald-50 px-6 py-10 text-center shadow-sm">
                        <CheckCircle2 className="h-16 w-16 text-emerald-600" />
                        <h3 className="mt-4 text-2xl font-semibold text-emerald-900">Заявка успешно отправлена</h3>
                        <p className="mt-2 max-w-xl text-sm text-emerald-800">
                            Спасибо, {user?.name ?? 'студент'}. Ваша заявка зарегистрирована и передана на рассмотрение.
                        </p>
                    </div>
                ) : null}

                <div className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-2">
                            <p className="text-sm text-slate-500">Номер заявки: #{application?.id}</p>
                            <h3 className="text-xl font-semibold text-slate-900">{user?.name}</h3>
                            <p className="text-sm text-slate-600">{user?.email}</p>
                        </div>
                        <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium ${statusMeta.badgeClassName}`}>
                            <StatusIcon className={`h-4 w-4 ${statusMeta.iconClassName}`} />
                            <span>{statusMeta.label}</span>
                        </div>
                    </div>

                    <p className="mt-4 text-sm text-slate-600">{statusMeta.description}</p>

                    <div className="mt-6 grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700 sm:grid-cols-2">
                        <p>Телефон: {application?.phone ?? '—'}</p>
                        <p>Группа: {application?.student_group ?? '—'}</p>
                        <p>Дата подачи: {application?.created_at ?? '—'}</p>
                        <p>Дата рассмотрения: {application?.reviewed_at ?? '—'}</p>
                    </div>

                    {(application?.document_types?.length ?? 0) > 0 ? (
                        <div className="mt-6">
                            <p className="text-sm font-medium text-slate-900">Прикрепленные документы</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {application.document_types.map((document) => (
                                    <span key={document} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                                        {document}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ) : null}

                    {(application?.document_files?.length ?? 0) > 0 ? (
                        <div className="mt-6 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-sm font-medium text-slate-900">Файлы заявки</p>

                            <ul className="space-y-2 text-sm text-slate-700">
                                {(application.document_files ?? []).map((file) => (
                                    <li key={file.path} className="flex flex-wrap items-center gap-3">
                                        <span className="font-medium text-slate-900">{file.document_type}</span>
                                        <a
                                            href={file.view_url ?? file.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-teal-700 underline-offset-2 hover:underline"
                                        >
                                            {file.original_name}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : null}

                    {application?.review_notes ? (
                        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-sm font-medium text-slate-900">Комментарий сотрудника</p>
                            <p className="mt-2 text-sm text-slate-700">{application.review_notes}</p>
                        </div>
                    ) : null}

                    <div className="mt-8 flex flex-wrap justify-end gap-2">
                        {can_resubmit ? (
                            <Link
                                href={route('academic-mobility.student.resubmit')}
                                className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-900 transition hover:bg-amber-100"
                            >
                                Подать заявку повторно
                            </Link>
                        ) : null}
                        <Link
                            href={route('dashboard')}
                            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700"
                        >
                            Вернуться в кабинет
                        </Link>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
