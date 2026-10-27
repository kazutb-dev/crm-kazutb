import { ConfirmDialog } from '@/components/ConfirmDialog';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { DataTable, EmptyState, PageHeader, StatGrid, StatTile } from '@/components/platform';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { Building2, FileText, Hash, Layers, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

function Field({ label, error, children }) {
    return (
        <div className="space-y-2">
            <Label className="block">{label}</Label>
            {children}
            {error && <p className="text-sm text-red-700">{error}</p>}
        </div>
    );
}

export default function Index({ departments }) {
    const items = departments?.data ?? [];
    const links = departments?.links ?? [];
    const total = departments?.total ?? items.length;

    const [confirmState, setConfirmState] = useState({ open: false, description: '', onConfirm: null });
    const [createOpen, setCreateOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [editingDepartment, setEditingDepartment] = useState(null);

    const createForm = useForm({
        name: '',
        code: '',
        description: '',
    });

    const editForm = useForm({
        name: '',
        code: '',
        description: '',
    });

    const withCode = items.filter((department) => Boolean(department.code)).length;
    const withoutDescription = items.filter((department) => !department.description).length;

    const handleDelete = (department) => {
        setConfirmState({
            open: true,
            description: `Удалить кафедру "${department.name}"?`,
            onConfirm: () => router.delete(route('departments.destroy', department.id)),
        });
    };

    const openEditDialog = (department) => {
        setEditingDepartment(department);
        editForm.setData({
            name: department.name ?? '',
            code: department.code ?? '',
            description: department.description ?? '',
        });
        editForm.clearErrors();
        setEditOpen(true);
    };

    const submitCreate = (e) => {
        e.preventDefault();

        createForm.post(route('departments.store'), {
            preserveScroll: true,
            onSuccess: () => {
                createForm.reset();
                setCreateOpen(false);
            },
        });
    };

    const submitEdit = (e) => {
        e.preventDefault();

        if (!editingDepartment) {
            return;
        }

        editForm.patch(route('departments.update', editingDepartment.id), {
            preserveScroll: true,
            onSuccess: () => {
                setEditOpen(false);
                setEditingDepartment(null);
            },
        });
    };

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="Справочники"
                    title="Кафедры"
                    description="Справочник кафедр университета: названия, коды и краткие описания."
                    actions={(
                        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                            <DialogTrigger asChild>
                                <Button>
                                    <Plus />
                                    Добавить кафедру
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Новая кафедра</DialogTitle>
                                    <DialogDescription>
                                        Заполните данные для создания кафедры.
                                    </DialogDescription>
                                </DialogHeader>
                                <form className="space-y-4" onSubmit={submitCreate}>
                                    <Field label="Название" error={createForm.errors.name}>
                                        <Input
                                            value={createForm.data.name}
                                            onChange={(e) => createForm.setData('name', e.target.value)}
                                            placeholder="Например: Кафедра информатики"
                                        />
                                    </Field>
                                    <Field label="Код" error={createForm.errors.code}>
                                        <Input
                                            value={createForm.data.code}
                                            onChange={(e) => createForm.setData('code', e.target.value)}
                                            placeholder="Например: CS"
                                        />
                                    </Field>
                                    <Field label="Описание" error={createForm.errors.description}>
                                        <Textarea
                                            value={createForm.data.description}
                                            onChange={(e) => createForm.setData('description', e.target.value)}
                                            placeholder="Краткое описание кафедры"
                                        />
                                    </Field>
                                    <DialogFooter>
                                        <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Отмена</Button>
                                        <Button type="submit" disabled={createForm.processing}>
                                            Сохранить
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </DialogContent>
                        </Dialog>
                    )}
                />
            )}
        >
            <Head title="Кафедры" />

            <Dialog
                open={editOpen}
                onOpenChange={(open) => {
                    setEditOpen(open);
                    if (!open) {
                        setEditingDepartment(null);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Редактирование кафедры</DialogTitle>
                        <DialogDescription>
                            Измените данные выбранной кафедры.
                        </DialogDescription>
                    </DialogHeader>
                    <form className="space-y-4" onSubmit={submitEdit}>
                        <Field label="Название" error={editForm.errors.name}>
                            <Input
                                value={editForm.data.name}
                                onChange={(e) => editForm.setData('name', e.target.value)}
                            />
                        </Field>
                        <Field label="Код" error={editForm.errors.code}>
                            <Input
                                value={editForm.data.code}
                                onChange={(e) => editForm.setData('code', e.target.value)}
                            />
                        </Field>
                        <Field label="Описание" error={editForm.errors.description}>
                            <Textarea
                                value={editForm.data.description}
                                onChange={(e) => editForm.setData('description', e.target.value)}
                            />
                        </Field>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Отмена</Button>
                            <Button type="submit" disabled={editForm.processing}>
                                Сохранить изменения
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <div className="admin-page-wrap space-y-6">
                <StatGrid>
                    <StatTile label="Всего кафедр" value={total} icon={Building2} tone="teal" hint="Во всём справочнике" />
                    <StatTile label="На странице" value={items.length} icon={Layers} tone="navy" hint={departments?.last_page > 1 ? `Страница ${departments.current_page} из ${departments.last_page}` : 'Все записи на одной странице'} />
                    <StatTile label="С кодом" value={withCode} icon={Hash} tone="info" hint="Среди показанных" />
                    <StatTile label="Без описания" value={withoutDescription} icon={FileText} tone={withoutDescription > 0 ? 'warning' : 'success'} hint="Среди показанных" />
                </StatGrid>

                {items.length === 0 ? (
                    <EmptyState
                        title="Пока нет кафедр"
                        description="Создайте первую запись — кафедры используются в профилях сотрудников и заявках."
                        action={(
                            <Button onClick={() => setCreateOpen(true)}>
                                <Plus />
                                Добавить кафедру
                            </Button>
                        )}
                    />
                ) : (
                    <DataTable>
                        <table className="w-full min-w-[700px] text-sm">
                            <thead>
                                <tr>
                                    <th className="px-5 text-left">Название</th>
                                    <th className="px-5 text-left">Код</th>
                                    <th className="px-5 text-left">Описание</th>
                                    <th className="px-5 text-right">Действия</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((department) => (
                                    <tr key={department.id} className="border-b border-slate-200 last:border-0 hover:bg-slate-50">
                                        <td className="px-5 py-3.5 font-medium text-slate-900">
                                            {department.name}
                                        </td>
                                        <td className="px-5 py-3.5">
                                            {department.code ? (
                                                <Badge variant="outline">{department.code}</Badge>
                                            ) : (
                                                <span className="text-slate-400">—</span>
                                            )}
                                        </td>
                                        <td className="max-w-md px-5 py-3.5 text-slate-600">
                                            {department.description || <span className="text-slate-400">—</span>}
                                        </td>
                                        <td className="px-5 py-3.5 text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button variant="outline" size="sm" onClick={() => openEditDialog(department)}>
                                                    <Pencil />
                                                    Редактировать
                                                </Button>
                                                <Button variant="destructive" size="sm" onClick={() => handleDelete(department)}>
                                                    <Trash2 />
                                                    Удалить
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </DataTable>
                )}

                {links.length > 3 && (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="text-xs font-medium text-slate-500">
                            Показано {departments?.from ?? 0}–{departments?.to ?? 0} из {total}
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                            {links.map((link, index) => (
                                <Button
                                    key={`${link.label}-${index}`}
                                    variant={link.active ? 'default' : 'outline'}
                                    size="sm"
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
                    </div>
                )}
            </div>
            <ConfirmDialog
                open={confirmState.open}
                onOpenChange={(open) => !open && setConfirmState({ open: false, description: '', onConfirm: null })}
                description={confirmState.description}
                onConfirm={() => {
                    confirmState.onConfirm?.();
                    setConfirmState({ open: false, description: '', onConfirm: null });
                }}
            />
        </AuthenticatedLayout>
    );
}
