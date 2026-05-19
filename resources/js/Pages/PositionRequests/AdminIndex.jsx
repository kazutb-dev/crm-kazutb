import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { CheckCircle, ClipboardList, XCircle } from 'lucide-react';
import { useState } from 'react';

const STATUS_LABEL = {
    pending: 'На рассмотрении',
    approved: 'Одобрено',
    rejected: 'Отклонено',
};

const STATUS_VARIANT = {
    pending: 'secondary',
    approved: 'default',
    rejected: 'destructive',
};

export default function AdminIndex({ requests, counts, filters }) {
    const { flash = {} } = usePage().props;
    const [actionDialog, setActionDialog] = useState(null); // { type: 'approve'|'reject', request }

    const actionForm = useForm({ admin_note: '' });

    const openDialog = (type, request) => {
        actionForm.reset();
        setActionDialog({ type, request });
    };

    const closeDialog = () => {
        setActionDialog(null);
        actionForm.reset();
    };

    const submitAction = (e) => {
        e.preventDefault();
        const { type, request } = actionDialog;
        const routeName = type === 'approve' ? 'position-requests.approve' : 'position-requests.reject';

        actionForm.post(route(routeName, request.id), {
            preserveScroll: true,
            onSuccess: closeDialog,
        });
    };

    const statusFilter = filters?.status ?? 'pending';

    const setFilter = (status) => {
        router.get(route('position-requests.index'), { status }, { preserveScroll: true });
    };

    return (
        <AuthenticatedLayout>
            <Head title="Заявки на изменение должности" />

            <div className="admin-page-wrap space-y-6">
                {flash.success && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                        {flash.success}
                    </div>
                )}

                {/* Filter tabs + counters */}
                <div className="flex flex-wrap gap-2">
                    {[
                        { value: 'pending', label: 'На рассмотрении', count: counts.pending },
                        { value: 'approved', label: 'Одобренные', count: counts.approved },
                        { value: 'rejected', label: 'Отклонённые', count: counts.rejected },
                    ].map((tab) => (
                        <button
                            key={tab.value}
                            type="button"
                            onClick={() => setFilter(tab.value)}
                            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition ${
                                statusFilter === tab.value
                                    ? 'border-slate-700 bg-slate-700 text-white'
                                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            {tab.label}
                            <span
                                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                    statusFilter === tab.value
                                        ? 'bg-white/20 text-white'
                                        : 'bg-gray-100 text-gray-600'
                                }`}
                            >
                                {tab.count}
                            </span>
                        </button>
                    ))}
                </div>

                <Card className="admin-surface">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ClipboardList className="h-5 w-5" />
                            Заявки на изменение должности
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {requests.data.length === 0 ? (
                            <div className="admin-empty-state">Заявок нет.</div>
                        ) : (
                            <div className="admin-table-wrap">
                                <table className="admin-data-table min-w-[800px]">
                                    <thead>
                                        <tr>
                                            <th>Сотрудник</th>
                                            <th>Отдел</th>
                                            <th>Текущая должность</th>
                                            <th>Запрошена</th>
                                            <th>Дата заявки</th>
                                            <th>Статус</th>
                                            {statusFilter === 'pending' && (
                                                <th className="text-right">Действия</th>
                                            )}
                                            {statusFilter !== 'pending' && (
                                                <th>Примечание</th>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {requests.data.map((r) => (
                                            <tr key={r.id}>
                                                <td className="py-3 pe-3">
                                                    <div className="text-sm font-medium">{r.user?.name}</div>
                                                    <div className="text-xs text-muted-foreground">{r.user?.email}</div>
                                                </td>
                                                <td className="py-3 pe-3 text-sm text-muted-foreground">
                                                    {r.user?.department || '—'}
                                                </td>
                                                <td className="py-3 pe-3 text-sm">
                                                    {r.current_position || '—'}
                                                </td>
                                                <td className="py-3 pe-3 text-sm font-semibold">
                                                    {r.requested_position}
                                                </td>
                                                <td className="py-3 pe-3 text-sm text-muted-foreground whitespace-nowrap">
                                                    {r.created_at?.slice(0, 10)}
                                                </td>
                                                <td className="py-3 pe-3">
                                                    <Badge variant={STATUS_VARIANT[r.status]}>
                                                        {STATUS_LABEL[r.status] ?? r.status}
                                                    </Badge>
                                                </td>
                                                {statusFilter === 'pending' && (
                                                    <td className="py-3 text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <Button
                                                                size="sm"
                                                                variant="default"
                                                                onClick={() => openDialog('approve', r)}
                                                            >
                                                                <CheckCircle className="mr-1 h-4 w-4" />
                                                                Принять
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="destructive"
                                                                onClick={() => openDialog('reject', r)}
                                                            >
                                                                <XCircle className="mr-1 h-4 w-4" />
                                                                Отклонить
                                                            </Button>
                                                        </div>
                                                    </td>
                                                )}
                                                {statusFilter !== 'pending' && (
                                                    <td className="py-3 pe-3 text-sm text-muted-foreground">
                                                        {r.admin_note || '—'}
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Pagination */}
                        {requests.links?.length > 3 && (
                            <div className="mt-4 flex flex-wrap gap-1">
                                {requests.links.map((link, i) => (
                                    <Link
                                        key={i}
                                        href={link.url ?? '#'}
                                        className={`rounded-lg border px-3 py-1 text-sm ${
                                            link.active
                                                ? 'border-slate-700 bg-slate-700 text-white'
                                                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                                        } ${!link.url ? 'pointer-events-none opacity-40' : ''}`}
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                    />
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Approve / Reject dialog */}
            <Dialog open={actionDialog !== null} onOpenChange={(open) => !open && closeDialog()}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {actionDialog?.type === 'approve' ? 'Принять заявку' : 'Отклонить заявку'}
                        </DialogTitle>
                    </DialogHeader>

                    {actionDialog && (
                        <div className="mb-3 rounded-xl bg-gray-50 p-3 text-sm">
                            <p>
                                <span className="text-gray-500">Сотрудник: </span>
                                <span className="font-medium">{actionDialog.request.user?.name}</span>
                            </p>
                            <p className="mt-1">
                                <span className="text-gray-500">Запрашиваемая должность: </span>
                                <span className="font-semibold">{actionDialog.request.requested_position}</span>
                            </p>
                        </div>
                    )}

                    <form onSubmit={submitAction} className="space-y-4">
                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">
                                Примечание <span className="text-gray-400">(необязательно)</span>
                            </label>
                            <textarea
                                rows={3}
                                className="w-full rounded-xl border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:ring-slate-500"
                                value={actionForm.data.admin_note}
                                onChange={(e) => actionForm.setData('admin_note', e.target.value)}
                                placeholder="Причина или комментарий..."
                            />
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={closeDialog}>
                                Отмена
                            </Button>
                            <Button
                                type="submit"
                                variant={actionDialog?.type === 'approve' ? 'default' : 'destructive'}
                                disabled={actionForm.processing}
                            >
                                {actionDialog?.type === 'approve' ? 'Принять' : 'Отклонить'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </AuthenticatedLayout>
    );
}
