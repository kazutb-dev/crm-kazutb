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
import { useState } from 'react';

export default function Index({ departments }) {
    const items = departments?.data ?? [];
    const links = departments?.links ?? [];

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

    const handleDelete = (department) => {
        if (!window.confirm(`Удалить кафедру "${department.name}"?`)) {
            return;
        }

        router.delete(route('departments.destroy', department.id));
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
            headerRight={
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm">
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
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Название</label>
                                <Input
                                    value={createForm.data.name}
                                    onChange={(e) =>
                                        createForm.setData('name', e.target.value)
                                    }
                                    placeholder="Например: Кафедра информатики"
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
                                    onChange={(e) =>
                                        createForm.setData('code', e.target.value)
                                    }
                                    placeholder="Например: CS"
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
                                    className="min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    value={createForm.data.description}
                                    onChange={(e) =>
                                        createForm.setData('description', e.target.value)
                                    }
                                    placeholder="Краткое описание кафедры"
                                />
                                {createForm.errors.description && (
                                    <p className="text-sm text-destructive">
                                        {createForm.errors.description}
                                    </p>
                                )}
                            </div>

                            <DialogFooter>
                                <Button
                                    type="submit"
                                    disabled={createForm.processing}
                                >
                                    Сохранить
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            }
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
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Название</label>
                            <Input
                                value={editForm.data.name}
                                onChange={(e) =>
                                    editForm.setData('name', e.target.value)
                                }
                            />
                            {editForm.errors.name && (
                                <p className="text-sm text-destructive">
                                    {editForm.errors.name}
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Код</label>
                            <Input
                                value={editForm.data.code}
                                onChange={(e) =>
                                    editForm.setData('code', e.target.value)
                                }
                            />
                            {editForm.errors.code && (
                                <p className="text-sm text-destructive">
                                    {editForm.errors.code}
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Описание</label>
                            <textarea
                                className="min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                value={editForm.data.description}
                                onChange={(e) =>
                                    editForm.setData('description', e.target.value)
                                }
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

            <div className="p-4 sm:p-6 lg:p-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Список кафедр</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {items.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                Пока нет кафедр. Создайте первую запись.
                            </p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[700px] text-sm">
                                    <thead>
                                        <tr className="border-b text-left text-muted-foreground">
                                            <th className="py-3 pe-3 font-medium">Название</th>
                                            <th className="py-3 pe-3 font-medium">Код</th>
                                            <th className="py-3 pe-3 font-medium">Описание</th>
                                            <th className="py-3 text-right font-medium">Действия</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((department) => (
                                            <tr
                                                key={department.id}
                                                className="border-b last:border-0"
                                            >
                                                <td className="py-3 pe-3 font-medium">
                                                    {department.name}
                                                </td>
                                                <td className="py-3 pe-3">
                                                    {department.code ? (
                                                        <Badge variant="outline">
                                                            {department.code}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-muted-foreground">
                                                            -
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="max-w-md py-3 pe-3 text-muted-foreground">
                                                    {department.description || '-'}
                                                </td>
                                                <td className="py-3 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() =>
                                                                openEditDialog(department)
                                                            }
                                                        >
                                                            <Pencil />
                                                            Редактировать
                                                        </Button>
                                                        <Button
                                                            variant="destructive"
                                                            size="sm"
                                                            onClick={() =>
                                                                handleDelete(department)
                                                            }
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
                            <div className="mt-6 flex flex-wrap gap-2">
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
    );
}
