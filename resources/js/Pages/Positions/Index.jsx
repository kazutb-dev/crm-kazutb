import { ConfirmDialog } from '@/components/ConfirmDialog';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Head, Link, router, useForm } from '@inertiajs/react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

export default function Index({ positions, divisions }) {
    const items = positions?.data ?? [];
    const links = positions?.links ?? [];

    const [confirmState, setConfirmState] = useState({ open: false, description: '', onConfirm: null });
    const [createOpen, setCreateOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [editingPosition, setEditingPosition] = useState(null);
    const [createDivisionSearch, setCreateDivisionSearch] = useState('');
    const [editDivisionSearch, setEditDivisionSearch] = useState('');

    const createForm = useForm({
        division_id: divisions?.[0]?.id ? String(divisions[0].id) : '',
        name: '',
        code: '',
        description: '',
    });

    const editForm = useForm({
        division_id: '',
        name: '',
        code: '',
        description: '',
    });

    const handleDelete = (position) => {
        setConfirmState({
            open: true,
            description: `Удалить должность "`${position.name}"?`,
            onConfirm: () => router.delete(route('positions.destroy', position.id)),
        });
    };

    const openEditDialog = (position) => {
        setEditingPosition(position);
        editForm.setData({
            division_id: position.division_id ? String(position.division_id) : '',
            name: position.name ?? '',
            code: position.code ?? '',
            description: position.description ?? '',
        });
        editForm.clearErrors();
        setEditOpen(true);
    };

    const submitCreate = (e) => {
        e.preventDefault();

        createForm.post(route('positions.store'), {
            preserveScroll: true,
            onSuccess: () => {
                createForm.reset({
                    division_id: divisions?.[0]?.id ? String(divisions[0].id) : '',
                    name: '',
                    code: '',
                    description: '',
                });
                setCreateOpen(false);
            },
        });
    };

    const submitEdit = (e) => {
        e.preventDefault();

        if (!editingPosition) {
            return;
        }

        editForm.patch(route('positions.update', editingPosition.id), {
            preserveScroll: true,
            onSuccess: () => {
                setEditOpen(false);
                setEditingPosition(null);
            },
        });
    };

    const filteredCreateDivisions = useMemo(() => {
        const query = createDivisionSearch.trim().toLowerCase();

        if (query === '') {
            return divisions;
        }

        return divisions.filter((division) =>
            String(division.name ?? '').toLowerCase().includes(query)
        );
    }, [divisions, createDivisionSearch]);

    const filteredEditDivisions = useMemo(() => {
        const query = editDivisionSearch.trim().toLowerCase();

        if (query === '') {
            return divisions;
        }

        return divisions.filter((division) =>
            String(division.name ?? '').toLowerCase().includes(query)
        );
    }, [divisions, editDivisionSearch]);

    return (
        <AuthenticatedLayout
            headerRight={
                <Dialog
                    open={createOpen}
                    onOpenChange={(open) => {
                        setCreateOpen(open);

                        if (!open) {
                            setCreateDivisionSearch('');
                        }
                    }}
                >
                    <DialogTrigger asChild>
                        <Button size="sm">
                            <Plus />
                            Добавить должность
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Новая должность</DialogTitle>
                            <DialogDescription>
                                При создании должности выберите департамент и заполните основные данные.
                            </DialogDescription>
                        </DialogHeader>
                        <form className="space-y-4" onSubmit={submitCreate}>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Департамент</label>
                                <Input
                                    value={createDivisionSearch}
                                    onChange={(e) => setCreateDivisionSearch(e.target.value)}
                                    placeholder="Поиск департамента"
                                />
                                <select
                                    className="flex h-9 w-full rounded-md border border-input bg-background/70 px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    value={createForm.data.division_id}
                                    onChange={(e) =>
                                        createForm.setData('division_id', e.target.value)
                                    }
                                >
                                    <option value="">Выберите департамент</option>
                                    {filteredCreateDivisions.map((division) => (
                                        <option key={division.id} value={division.id}>
                                            {division.name}
                                        </option>
                                    ))}
                                </select>
                                {createForm.errors.division_id && (
                                    <p className="text-sm text-destructive">
                                        {createForm.errors.division_id}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Название</label>
                                <Input
                                    value={createForm.data.name}
                                    onChange={(e) => createForm.setData('name', e.target.value)}
                                    placeholder="Например: Руководитель отдела"
                                />
                                {createForm.errors.name && (
                                    <p className="text-sm text-destructive">
                                        {createForm.errors.name}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Код</label>
                                <Input
                                    value={createForm.data.code}
                                    onChange={(e) => createForm.setData('code', e.target.value)}
                                    placeholder="Например: HEAD"
                                />
                                {createForm.errors.code && (
                                    <p className="text-sm text-destructive">
                                        {createForm.errors.code}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Описание</label>
                                <textarea
                                    className="min-h-24 w-full rounded-md border border-input bg-background/70 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    value={createForm.data.description}
                                    onChange={(e) =>
                                        createForm.setData('description', e.target.value)
                                    }
                                    placeholder="Краткое описание должности"
                                />
                                {createForm.errors.description && (
                                    <p className="text-sm text-destructive">
                                        {createForm.errors.description}
                                    </p>
                                )}
                            </div>

                            <DialogFooter>
                                <Button type="submit" disabled={createForm.processing}>
                                    Сохранить
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            }
        >
            <Head title="Должности" />

            <Dialog
                open={editOpen}
                onOpenChange={(open) => {
                    setEditOpen(open);
                    if (!open) {
                        setEditingPosition(null);
                        setEditDivisionSearch('');
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Редактирование должности</DialogTitle>
                        <DialogDescription>
                            Обновите департамент и данные должности.
                        </DialogDescription>
                    </DialogHeader>
                    <form className="space-y-4" onSubmit={submitEdit}>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Департамент</label>
                            <Input
                                value={editDivisionSearch}
                                onChange={(e) => setEditDivisionSearch(e.target.value)}
                                placeholder="Поиск департамента"
                            />
                            <select
                                className="flex h-9 w-full rounded-md border border-input bg-background/70 px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                value={editForm.data.division_id}
                                onChange={(e) => editForm.setData('division_id', e.target.value)}
                            >
                                <option value="">Выберите департамент</option>
                                {filteredEditDivisions.map((division) => (
                                    <option key={division.id} value={division.id}>
                                        {division.name}
                                    </option>
                                ))}
                            </select>
                            {editForm.errors.division_id && (
                                <p className="text-sm text-destructive">
                                    {editForm.errors.division_id}
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Название</label>
                            <Input
                                value={editForm.data.name}
                                onChange={(e) => editForm.setData('name', e.target.value)}
                            />
                            {editForm.errors.name && (
                                <p className="text-sm text-destructive">{editForm.errors.name}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Код</label>
                            <Input
                                value={editForm.data.code}
                                onChange={(e) => editForm.setData('code', e.target.value)}
                            />
                            {editForm.errors.code && (
                                <p className="text-sm text-destructive">{editForm.errors.code}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Описание</label>
                            <textarea
                                className="min-h-24 w-full rounded-md border border-input bg-background/70 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                value={editForm.data.description}
                                onChange={(e) => editForm.setData('description', e.target.value)}
                            />
                            {editForm.errors.description && (
                                <p className="text-sm text-destructive">
                                    {editForm.errors.description}
                                </p>
                            )}
                        </div>

                        <DialogFooter>
                            <Button type="submit" disabled={editForm.processing}>
                                Сохранить изменения
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <div className="admin-page-wrap">
                <Card className="admin-surface">
                    <CardHeader>
                        <CardTitle>Список должностей</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {items.length === 0 ? (
                            <div className="admin-empty-state">
                                Пока нет должностей. Создайте первую запись.
                            </div>
                        ) : (
                            <div className="admin-table-wrap">
                                <table className="admin-data-table min-w-[760px]">
                                    <thead>
                                        <tr>
                                            <th>Название</th>
                                            <th>Департамент</th>
                                            <th>Код</th>
                                            <th>Описание</th>
                                            <th className="text-right">Действия</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((position) => (
                                            <tr key={position.id}>
                                                <td className="py-3 pe-3 font-medium">{position.name}</td>
                                                <td className="py-3 pe-3 text-muted-foreground">
                                                    {position.division?.name ?? '-'}
                                                </td>
                                                <td className="py-3 pe-3">
                                                    {position.code ? (
                                                        <Badge variant="outline">{position.code}</Badge>
                                                    ) : (
                                                        <span className="text-muted-foreground">-</span>
                                                    )}
                                                </td>
                                                <td className="max-w-md py-3 pe-3 text-muted-foreground">
                                                    {position.description || '-'}
                                                </td>
                                                <td className="py-3 text-right">
                                                    <div className="admin-row-actions">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => openEditDialog(position)}
                                                        >
                                                            <Pencil />
                                                            Редактировать
                                                        </Button>
                                                        <Button
                                                            variant="destructive"
                                                            size="sm"
                                                            onClick={() => handleDelete(position)}
                                                        >
                                                            <Trash2 />
                                                            Удалить
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {links.length > 3 && (
                            <div className="admin-pagination">
                                {links.map((link, index) => (
                                    <Button
                                        key={`${link.label}-${index}`}
                                        variant={link.active ? 'default' : 'outline'}
                                        size="sm"
                                        disabled={!link.url}
                                        asChild={Boolean(link.url)}
                                    >
                                        {link.url ? (
                                            <Link
                                                href={link.url}
                                                dangerouslySetInnerHTML={{
                                                    __html: link.label,
                                                }}
                                            />
                                        ) : (
                                            <span
                                                dangerouslySetInnerHTML={{
                                                    __html: link.label,
                                                }}
                                            />
                                        )}
                                    </Button>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
        <ConfirmDialog
            open={confirmState.open}
            onOpenChange={(open) => !open && setConfirmState({ open: false, description: '', onConfirm: null })}
            description={confirmState.description}
            onConfirm={() => {
                confirmState.onConfirm?.();
                setConfirmState({ open: false, description: '', onConfirm: null });
            }}
        />
    );
}
