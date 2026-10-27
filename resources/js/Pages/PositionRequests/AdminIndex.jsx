import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { EmptyState, InfoField, Notice, PageHeader, StatGrid, StatTile, UnderlineTabs } from '@/components/platform';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { CheckCircle, CircleCheck, CircleX, Clock3, XCircle } from 'lucide-react';
import { useState } from 'react';

const STATUS_LABEL = {
    pending: 'На рассмотрении',
    approved: 'Одобрено',
    rejected: 'Отклонено',
};

const STATUS_VARIANT = {
    pending: 'warning',
    approved: 'success',
    rejected: 'destructive',
};

const EMPTY_TEXT = {
    pending: 'Новых заявок на рассмотрении нет.',
    approved: 'Одобренных заявок пока нет.',
    rejected: 'Отклонённых заявок пока нет.',
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
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="Кадры"
                    title="Заявки на изменение должности"
                    description="Сотрудники запрашивают смену должности в профиле — примите или отклоните заявку с примечанием."
                />
            )}
        >
            <Head title="Заявки на изменение должности" />

            <div className="admin-page-wrap space-y-4">
                {flash.success && (
                    <Notice tone="success">{flash.success}</Notice>
                )}

                <StatGrid>
                    <StatTile
                        label="Всего заявок"
                        value={(counts.pending ?? 0) + (counts.approved ?? 0) + (counts.rejected ?? 0)}
                        icon={CheckCircle}
                        tone="navy"
                        hint={`Показано на странице: ${requests.data.length}`}
                    />
                    <StatTile label="На рассмотрении" value={counts.pending ?? 0} icon={Clock3} tone="warning" hint="Ждут решения администратора" />
                    <StatTile label="Одобрено" value={counts.approved ?? 0} icon={CircleCheck} tone="success" hint="Должность обновлена" />
                    <StatTile label="Отклонено" value={counts.rejected ?? 0} icon={CircleX} tone="danger" hint="С примечанием для сотрудника" />
                </StatGrid>

                <UnderlineTabs
                    items={[
                        { key: 'pending', label: 'На рассмотрении', count: counts.pending },
                        { key: 'approved', label: 'Одобренные', count: counts.approved },
                        { key: 'rejected', label: 'Отклонённые', count: counts.rejected },
                    ]}
                    value={statusFilter}
                    onChange={setFilter}
                />

                {requests.data.length === 0 ? (
                    <EmptyState
                        title="Заявок нет"
                        description={EMPTY_TEXT[statusFilter] ?? 'В этом разделе пока пусто.'}
                    />
                ) : (
                    <Card className="overflow-hidden">
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[800px] text-sm">
                                    <thead>
                                        <tr>
                                            <th className="text-left">Сотрудник</th>
                                            <th className="text-left">Отдел</th>
                                            <th className="text-left">Текущая должность</th>
                                            <th className="text-left">Запрошена</th>
                                            <th className="text-left">Дата заявки</th>
                                            <th className="text-left">Статус</th>
                                            {statusFilter === 'pending' && (
                                                <th className="text-right">Действия</th>
                                            )}
                                            {statusFilter !== 'pending' && (
                                                <th className="text-left">Примечание</th>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {requests.data.map((r) => (
                                            <tr key={r.id} className="border-b border-slate-200 last:border-0 hover:bg-slate-50">
                                                <td>
                                                    <div className="font-medium text-slate-900">{r.user?.name}</div>
                                                    <div className="text-xs text-slate-500">{r.user?.email}</div>
                                                </td>
                                                <td className="text-slate-600">
                                                    {r.user?.department || '—'}
                                                </td>
                                                <td className="text-slate-700">
                                                    {r.current_position || '—'}
                                                </td>
                                                <td className="font-semibold text-[#102945]">
                                                    {r.requested_position}
                                                </td>
                                                <td className="whitespace-nowrap tabular-nums text-slate-600">
                                                    {r.created_at?.slice(0, 10)}
                                                </td>
                                                <td>
                                                    <Badge variant={STATUS_VARIANT[r.status] ?? 'secondary'}>
                                                        {STATUS_LABEL[r.status] ?? r.status}
                                                    </Badge>
                                                </td>
                                                {statusFilter === 'pending' && (
                                                    <td className="text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <Button size="sm" onClick={() => openDialog('approve', r)}>
                                                                <CheckCircle />
                                                                Принять
                                                            </Button>
                                                            <Button size="sm" variant="outline" onClick={() => openDialog('reject', r)}>
                                                                <XCircle />
                                                                Отклонить
                                                            </Button>
                                                        </div>
                                                    </td>
                                                )}
                                                {statusFilter !== 'pending' && (
                                                    <td className="text-slate-600">
                                                        {r.admin_note || '—'}
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {requests.links?.length > 3 && (
                                <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 px-5 py-3 sm:px-6 justify-end">
                                    {requests.links.map((link, i) => (
                                        <Button
                                            key={i}
                                            size="sm"
                                            variant={link.active ? 'default' : 'outline'}
                                            disabled={!link.url}
                                            asChild={Boolean(link.url)}
                                        >
                                            {link.url ? (
                                                <Link href={link.url} dangerouslySetInnerHTML={{ __html: link.label }} />
                                            ) : (
                                                <span dangerouslySetInnerHTML={{ __html: link.label }} />
                                            )}
                                        </Button>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
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
                        <div className="grid gap-4 sm:grid-cols-2">
                            <InfoField label="Сотрудник">{actionDialog.request.user?.name}</InfoField>
                            <InfoField label="Запрашиваемая должность">
                                <span className="font-semibold text-[#102945]">{actionDialog.request.requested_position}</span>
                            </InfoField>
                        </div>
                    )}

                    <form onSubmit={submitAction} className="space-y-4">
                        <div className="space-y-2">
                            <Label className="block">
                                Примечание <span className="font-medium normal-case tracking-normal text-slate-400">(необязательно)</span>
                            </Label>
                            <Textarea
                                rows={3}
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
