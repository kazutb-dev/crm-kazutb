import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { DataTable, EmptyState, FilterBar, InfoField, PageHeader, StatGrid, StatTile, UnderlineTabs } from '@/components/platform';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { router } from '@inertiajs/react';
import { CircleCheck, CircleX, Clock3, FileText, Plane, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

const getStatusMeta = (status) => {
    switch (status) {
        case 'accepted':
            return {
                label: 'Принято',
                variant: 'success',
                description: 'Заявка одобрена и закрыта.',
            };
        case 'rejected':
            return {
                label: 'Отклонено',
                variant: 'destructive',
                description: 'Заявка отклонена после рассмотрения.',
            };
        default:
            return {
                label: 'На рассмотрении',
                variant: 'warning',
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
                <PageHeader
                    eyebrow="Академическая мобильность"
                    title="Заявки на рассмотрение"
                    description="Проверьте прикреплённые документы и примите заявку после одобрения."
                />
            )}
        >
            <div className="admin-page-wrap space-y-6">
                <StatGrid>
                    <StatTile label="Всего заявок" value={applications.length} icon={Plane} tone="navy" />
                    <StatTile label="На рассмотрении" value={statusCounts.pending} icon={Clock3} tone="warning" hint="Ждут решения" />
                    <StatTile label="Принято" value={statusCounts.accepted} icon={CircleCheck} tone="success" />
                    <StatTile label="Отклонено" value={statusCounts.rejected} icon={CircleX} tone="danger" />
                </StatGrid>

                <UnderlineTabs
                    items={[
                        { key: 'all', label: 'Все', count: applications.length },
                        { key: 'pending', label: 'На рассмотрении', count: statusCounts.pending },
                        { key: 'accepted', label: 'Принято', count: statusCounts.accepted },
                        { key: 'rejected', label: 'Отклонено', count: statusCounts.rejected },
                    ]}
                    value={statusFilter}
                    onChange={setStatusFilter}
                />

                <FilterBar>
                    <label className="block space-y-2">
                        <span className="qd-field-label block">Поиск</span>
                        <span className="relative block">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <Input
                                type="text"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Поиск по ФИО, email, группе, телефону"
                                className="pl-9"
                            />
                        </span>
                    </label>
                    <div className="mt-4 border-t border-slate-200 pt-3 text-xs font-medium text-slate-500">
                        Показано {filteredApplications.length} из {applications.length}
                    </div>
                </FilterBar>

                {filteredApplications.length === 0 ? (
                    <EmptyState
                        title="Заявки не найдены"
                        description={applications.length === 0
                            ? 'Студенты ещё не подавали заявки на академическую мобильность.'
                            : 'Измените поиск или выберите другой статус.'}
                    />
                ) : (
                    <DataTable>
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr>
                                    <th className="px-5 text-left">Студент</th>
                                    <th className="px-5 text-left">Контакты</th>
                                    <th className="px-5 text-left">Группа</th>
                                    <th className="px-5 text-left">Статус</th>
                                    <th className="px-5 text-left">Дата подачи</th>
                                    <th className="px-5 text-right">Действие</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredApplications.map((application) => {
                                    const statusMeta = getStatusMeta(application.status);

                                    return (
                                        <tr key={application.id} className="border-b border-slate-200 last:border-0 hover:bg-slate-50">
                                            <td className="px-5 py-3.5">
                                                <div className="font-medium text-slate-900">{application.full_name}</div>
                                                <div className="text-xs tabular-nums text-slate-500">#{application.id}</div>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <div className="text-slate-700">{application.user?.email ?? '—'}</div>
                                                <div className="text-xs tabular-nums text-slate-500">{application.phone}</div>
                                            </td>
                                            <td className="px-5 py-3.5 text-slate-700">{application.student_group}</td>
                                            <td className="px-5 py-3.5">
                                                <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                                            </td>
                                            <td className="whitespace-nowrap px-5 py-3.5 tabular-nums text-slate-700">{application.created_at}</td>
                                            <td className="px-5 py-3.5 text-right">
                                                <Button type="button" size="sm" variant="outline" onClick={() => openDetails(application)}>
                                                    Открыть
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </DataTable>
                )}
            </div>

            <Dialog open={Boolean(selectedApplication)} onOpenChange={(open) => { if (!open) closeDetails(); }}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
                    {selectedApplication ? (
                        <>
                            <DialogHeader>
                                <DialogTitle>Заявка #{selectedApplication.id}: {selectedApplication.full_name}</DialogTitle>
                                <DialogDescription className="flex flex-wrap items-center gap-2">
                                    <Badge variant={getStatusMeta(selectedApplication.status).variant}>
                                        {getStatusMeta(selectedApplication.status).label}
                                    </Badge>
                                    {getStatusMeta(selectedApplication.status).description}
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-5 text-sm text-slate-700">
                                <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                                    <InfoField label="Email">{selectedApplication.user?.email ?? '—'}</InfoField>
                                    <InfoField label="Телефон">{selectedApplication.phone}</InfoField>
                                    <InfoField label="Группа">{selectedApplication.student_group}</InfoField>
                                    <InfoField label="Дата подачи">{selectedApplication.created_at}</InfoField>
                                    <InfoField label="Дата рассмотрения">{selectedApplication.reviewed_at ?? '—'}</InfoField>
                                </div>

                                <div>
                                    <p className="qd-field-label text-slate-500">Документы</p>
                                    <ul className="mt-2 divide-y divide-slate-200 rounded-xl border border-slate-200">
                                        {(selectedApplication.document_files ?? []).map((file) => (
                                            <li key={file.path} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                                                <FileText className="h-4 w-4 shrink-0 text-teal-700" />
                                                <span className="font-medium text-slate-900">{file.document_type}:</span>
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
                                </div>

                                {selectedApplication.notes ? (
                                    <div>
                                        <p className="qd-field-label text-slate-500">Комментарий студента</p>
                                        <p className="mt-2 border-l-2 border-teal-500 pl-3 leading-relaxed text-slate-800">{selectedApplication.notes}</p>
                                    </div>
                                ) : null}

                                <div className="space-y-2">
                                    <Label className="block" htmlFor={`review-notes-${selectedApplication.id}`}>
                                        Комментарий сотрудника
                                    </Label>
                                    <Textarea
                                        id={`review-notes-${selectedApplication.id}`}
                                        value={reviewNotes[selectedApplication.id] ?? ''}
                                        onChange={(event) => setReviewNotes((prev) => ({
                                            ...prev,
                                            [selectedApplication.id]: event.target.value,
                                        }))}
                                        rows="4"
                                        placeholder="Добавьте комментарий к решению"
                                    />
                                </div>
                            </div>

                            <DialogFooter className="gap-2 sm:justify-between">
                                {selectedApplication.status === 'pending' ? (
                                    <div className="flex flex-wrap gap-2">
                                        <Button type="button" onClick={() => accept(selectedApplication.id)}>
                                            <CircleCheck />
                                            Принять заявку
                                        </Button>
                                        <Button type="button" variant="destructive" onClick={() => reject(selectedApplication.id)}>
                                            <CircleX />
                                            Отклонить заявку
                                        </Button>
                                    </div>
                                ) : <div />}
                                <Button type="button" variant="outline" onClick={closeDetails}>
                                    Закрыть
                                </Button>
                            </DialogFooter>
                        </>
                    ) : null}
                </DialogContent>
            </Dialog>
        </AuthenticatedLayout>
    );
}
