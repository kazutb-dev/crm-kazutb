import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { router } from '@inertiajs/react';
import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';

const getStatusMeta = (status) => {
    switch (status) {
        case 'accepted':
            return {
                label: 'Принято',
                badgeClassName: 'bg-emerald-100 text-emerald-700',
                description: 'Заявка одобрена и закрыта.',
            };
        case 'rejected':
            return {
                label: 'Отклонено',
                badgeClassName: 'bg-rose-100 text-rose-700',
                description: 'Заявка отклонена после рассмотрения.',
            };
        default:
            return {
                label: 'На рассмотрении',
                badgeClassName: 'bg-amber-100 text-amber-700',
                description: 'Ожидает решения сотрудника.',
            };
    }
};

export default function StaffPage({ applications = [], documents = [] }) {
    const [reviewNotes, setReviewNotes] = useState({});
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedApplication, setSelectedApplication] = useState(null);

    const filteredApplications = useMemo(() => {
        const query = search.trim().toLowerCase();
        let items = applications;

        if (statusFilter !== 'all') {
            items = items.filter((application) => application.status === statusFilter);
        }

        if (!query) {
            return items;
        }

        return items.filter((application) => {
            const haystack = [
                application.full_name,
                application.user?.email,
                application.student_group,
                application.phone,
                application.status,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();

            return haystack.includes(query);
        });
    }, [applications, search, statusFilter]);

    const statusCounts = useMemo(() => ({
        pending: applications.filter((item) => item.status === 'pending').length,
        accepted: applications.filter((item) => item.status === 'accepted').length,
        rejected: applications.filter((item) => item.status === 'rejected').length,
    }), [applications]);

    const openDetails = (application) => {
        setSelectedApplication(application);
        setReviewNotes((prev) => ({
            ...prev,
            [application.id]: prev[application.id] ?? application.review_notes ?? '',
        }));
    };

    const closeDetails = () => {
        setSelectedApplication(null);
    };

    const accept = (id) => {
        router.post(route('academic-mobility.staff.accept', id), {
            review_notes: reviewNotes[id] ?? '',
        }, {
            preserveScroll: true,
            onSuccess: () => closeDetails(),
        });
    };

    const reject = (id) => {
        router.post(route('academic-mobility.staff.reject', id), {
            review_notes: reviewNotes[id] ?? '',
        }, {
            preserveScroll: true,
            onSuccess: () => closeDetails(),
        });
    };

    return (
        <AuthenticatedLayout
            header={(
                <div className="space-y-2">
                    <p className="text-sm font-medium uppercase tracking-[0.2em] text-teal-700">Академическая мобильность</p>
                    <h2 className="text-2xl font-semibold text-slate-900">Заявки на рассмотрение</h2>
                    <p className="text-sm text-slate-600">Проверьте прикреплённые документы и примите заявку после одобрения.</p>
                </div>
            )}
        >
            <div className="admin-page-wrap space-y-6">
                <div className="rounded-2xl border border-border/60 bg-white p-4 shadow-sm">
                    <div className="grid gap-3 sm:grid-cols-4">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <p className="text-xs text-slate-500">Всего заявок</p>
                            <p className="mt-1 text-xl font-semibold text-slate-900">{applications.length}</p>
                        </div>
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                            <p className="text-xs text-amber-700">На рассмотрении</p>
                            <p className="mt-1 text-xl font-semibold text-amber-900">{statusCounts.pending}</p>
                        </div>
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                            <p className="text-xs text-emerald-700">Принято</p>
                            <p className="mt-1 text-xl font-semibold text-emerald-900">{statusCounts.accepted}</p>
                        </div>
                        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                            <p className="text-xs text-rose-700">Отклонено</p>
                            <p className="mt-1 text-xl font-semibold text-rose-900">{statusCounts.rejected}</p>
                        </div>
                    </div>
                    <div className="relative mt-4">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Поиск по ФИО, email, группе, телефону"
                            className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                        />
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setStatusFilter('all')}
                            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${statusFilter === 'all' ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'}`}
                        >
                            Все ({applications.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setStatusFilter('pending')}
                            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${statusFilter === 'pending' ? 'border-amber-700 bg-amber-700 text-white' : 'border-amber-300 bg-white text-amber-800 hover:bg-amber-50'}`}
                        >
                            На рассмотрении ({statusCounts.pending})
                        </button>
                        <button
                            type="button"
                            onClick={() => setStatusFilter('accepted')}
                            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${statusFilter === 'accepted' ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-50'}`}
                        >
                            Принято ({statusCounts.accepted})
                        </button>
                        <button
                            type="button"
                            onClick={() => setStatusFilter('rejected')}
                            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${statusFilter === 'rejected' ? 'border-rose-700 bg-rose-700 text-white' : 'border-rose-300 bg-white text-rose-800 hover:bg-rose-50'}`}
                        >
                            Отклонено ({statusCounts.rejected})
                        </button>
                    </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-border/60 bg-white shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                <tr>
                                    <th className="px-4 py-3">Студент</th>
                                    <th className="px-4 py-3">Контакты</th>
                                    <th className="px-4 py-3">Группа</th>
                                    <th className="px-4 py-3">Статус</th>
                                    <th className="px-4 py-3">Дата подачи</th>
                                    <th className="px-4 py-3 text-right">Действие</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredApplications.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                                            Заявки не найдены.
                                        </td>
                                    </tr>
                                ) : filteredApplications.map((application) => {
                                    const statusMeta = getStatusMeta(application.status);

                                    return (
                                        <tr key={application.id} className="hover:bg-slate-50/70">
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-slate-900">{application.full_name}</div>
                                                <div className="text-xs text-slate-500">#{application.id}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="text-slate-700">{application.user?.email ?? '—'}</div>
                                                <div className="text-xs text-slate-500">{application.phone}</div>
                                            </td>
                                            <td className="px-4 py-3 text-slate-700">{application.student_group}</td>
                                            <td className="px-4 py-3">
                                                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusMeta.badgeClassName}`}>
                                                    {statusMeta.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-slate-700">{application.created_at}</td>
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => openDetails(application)}
                                                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                                                >
                                                    Открыть
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <Dialog open={Boolean(selectedApplication)} onOpenChange={(open) => { if (!open) closeDetails(); }}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
                    {selectedApplication ? (
                        <>
                            <DialogHeader>
                                <DialogTitle>Заявка #{selectedApplication.id}: {selectedApplication.full_name}</DialogTitle>
                                <DialogDescription>{getStatusMeta(selectedApplication.status).description}</DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4 text-sm text-slate-700">
                                <div className="grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
                                    <p>Email: {selectedApplication.user?.email ?? '—'}</p>
                                    <p>Телефон: {selectedApplication.phone}</p>
                                    <p>Группа: {selectedApplication.student_group}</p>
                                    <p>Дата подачи: {selectedApplication.created_at}</p>
                                    <p>Дата рассмотрения: {selectedApplication.reviewed_at ?? '—'}</p>
                                </div>

                                <div>
                                    <p className="font-medium text-slate-900">Документы</p>
                                    <ul className="mt-2 space-y-2">
                                        {(selectedApplication.document_files ?? []).map((file) => (
                                            <li key={file.path} className="flex flex-wrap items-center gap-2">
                                                <span className="font-medium text-slate-900">{file.document_type}:</span>
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

                                {selectedApplication.notes ? (
                                    <div>
                                        <p className="font-medium text-slate-900">Комментарий студента</p>
                                        <p className="mt-1 rounded-xl bg-slate-50 p-3">{selectedApplication.notes}</p>
                                    </div>
                                ) : null}

                                <div>
                                    <label className="mb-1 block font-medium text-slate-900" htmlFor={`review-notes-${selectedApplication.id}`}>
                                        Комментарий сотрудника
                                    </label>
                                    <textarea
                                        id={`review-notes-${selectedApplication.id}`}
                                        value={reviewNotes[selectedApplication.id] ?? ''}
                                        onChange={(event) => setReviewNotes((prev) => ({
                                            ...prev,
                                            [selectedApplication.id]: event.target.value,
                                        }))}
                                        rows="4"
                                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-500"
                                        placeholder="Добавьте комментарий к решению"
                                    />
                                </div>
                            </div>

                            <DialogFooter className="gap-2 sm:justify-between">
                                {selectedApplication.status === 'pending' ? (
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={() => accept(selectedApplication.id)}
                                            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700"
                                        >
                                            Принять заявку
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => reject(selectedApplication.id)}
                                            className="rounded-xl border border-rose-300 bg-white px-4 py-2.5 text-sm font-medium text-rose-700 transition hover:bg-rose-50"
                                        >
                                            Отклонить заявку
                                        </button>
                                    </div>
                                ) : <div />}
                                <button
                                    type="button"
                                    onClick={closeDetails}
                                    className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                                >
                                    Закрыть
                                </button>
                            </DialogFooter>
                        </>
                    ) : null}
                </DialogContent>
            </Dialog>
        </AuthenticatedLayout>
    );
}
