import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { InfoField, PageHeader, StatGrid, StatTile, UnderlineTabs } from '@/components/platform';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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

    const decided = statusCounts.accepted + statusCounts.rejected;
    const filesTotal = applications.reduce((sum, item) => sum + (item.document_files?.length ?? 0), 0);

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
                    <StatTile label="Принято" value={statusCounts.accepted} icon={CircleCheck} tone="success" hint={decided ? `${Math.round((statusCounts.accepted / decided) * 100)}% решений` : null} />
                    <StatTile label="Отклонено" value={statusCounts.rejected} icon={CircleX} tone="danger" />
                    <StatTile label="Файлов в заявках" value={filesTotal} icon={FileText} tone="neutral" hint={applications.length ? `≈ ${(filesTotal / applications.length).toFixed(1)} на заявку` : null} />
                </StatGrid>

                <Card className="overflow-hidden">
                    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-slate-200 px-5 pt-3 sm:px-6">
                        <UnderlineTabs
                            className="border-b-0"
                            items={[
                                { key: 'all', label: 'Все', count: applications.length },
                                { key: 'pending', label: 'На рассмотрении', count: statusCounts.pending },
                                { key: 'accepted', label: 'Принято', count: statusCounts.accepted },
                                { key: 'rejected', label: 'Отклонено', count: statusCounts.rejected },
                            ]}
                            value={statusFilter}
                            onChange={setStatusFilter}
                        />
                        <div className="flex w-full flex-wrap items-center gap-3 pb-3 sm:w-auto">
                            <span className="text-xs font-medium tabular-nums text-slate-500">
                                Показано {filteredApplications.length} из {applications.length}
                            </span>
                            <span className="relative block w-full sm:w-80">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <Input
                                    type="text"
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder="Поиск по ФИО, email, группе, телефону"
                                    aria-label="Поиск"
                                    className="pl-9"
                                />
                            </span>
                        </div>
                    </div>

                    <CardContent className="p-0">
                        {filteredApplications.length === 0 ? (
                            <div className="flex flex-col items-center gap-1.5 px-5 py-8 text-center">
                                <Plane className="h-5 w-5 text-teal-700" aria-hidden="true" />
                                <p className="font-semibold text-[#102945]">Заявки не найдены</p>
                                <p className="text-sm text-slate-600">
                                    {applications.length === 0
                                        ? 'Студенты ещё не подавали заявки на академическую мобильность.'
                                        : 'Измените поиск или выберите другой статус.'}
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[1000px] text-sm">
                                    <thead>
                                        <tr>
                                            <th className="text-left">Студент</th>
                                            <th className="text-left">Контакты</th>
                                            <th className="text-left">Группа</th>
                                            <th className="text-left">Документы</th>
                                            <th className="text-left">Статус</th>
                                            <th className="text-left">Подана</th>
                                            <th className="text-left">Рассмотрена</th>
                                            <th className="text-right">Действие</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredApplications.map((application) => {
                                            const statusMeta = getStatusMeta(application.status);
                                            const files = application.document_files ?? [];

                                            return (
                                                <tr key={application.id} className="align-top hover:bg-slate-50">
                                                    <td>
                                                        <div className="font-medium text-slate-900">{application.full_name}</div>
                                                        <div className="text-xs tabular-nums text-slate-500">
                                                            #{application.id}
                                                            {application.notes ? <span className="ml-2 text-teal-700" title={application.notes}>есть комментарий</span> : null}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="text-slate-700">{application.user?.email ?? '—'}</div>
                                                        <div className="text-xs tabular-nums text-slate-500">{application.phone}</div>
                                                    </td>
                                                    <td className="text-slate-700">{application.student_group}</td>
                                                    <td>
                                                        <div className="font-medium tabular-nums text-slate-900">{files.length}</div>
                                                        <div className="max-w-[260px] truncate text-xs text-slate-500" title={files.map((file) => file.document_type).join(', ')}>
                                                            {files.map((file) => file.document_type).join(', ') || '—'}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                                                    </td>
                                                    <td className="whitespace-nowrap tabular-nums text-slate-700">{application.created_at}</td>
                                                    <td className="whitespace-nowrap tabular-nums text-slate-500">{application.reviewed_at ?? '—'}</td>
                                                    <td className="text-right">
                                                        <Button type="button" size="sm" variant={application.status === 'pending' ? 'default' : 'outline'} onClick={() => openDetails(application)}>
                                                            Открыть
                                                        </Button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
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

                            <div className="space-y-4 text-sm text-slate-700">
                                <div className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
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
