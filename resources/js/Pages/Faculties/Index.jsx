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

export default function Index({ faculties }) {
    const items = faculties?.data ?? [];
    const links = faculties?.links ?? [];

    const [createOpen, setCreateOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [editingFaculty, setEditingFaculty] = useState(null);

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

    const handleDelete = (faculty) => {
        if (!window.confirm(`Удалить факультет "${faculty.name}"?`)) {
            return;
        }

        router.delete(route('faculties.destroy', faculty.id));
    };

    const openEditDialog = (faculty) => {
        setEditingFaculty(faculty);
        editForm.setData({
            name: faculty.name ?? '',
            code: faculty.code ?? '',
            description: faculty.description ?? '',
        });
        editForm.clearErrors();
        setEditOpen(true);
    };

    const submitCreate = (e) => {
        e.preventDefault();

        createForm.post(route('faculties.store'), {
            preserveScroll: true,
            onSuccess: () => {
                createForm.reset();
                setCreateOpen(false);
            },
        });
    };

    const submitEdit = (e) => {
        e.preventDefault();

        if (!editingFaculty) {
            return;
        }

        editForm.patch(route('faculties.update', editingFaculty.id), {
            preserveScroll: true,
            onSuccess: () => {
                setEditOpen(false);
                setEditingFaculty(null);
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
                            Добавить факультет
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Новый факультет</DialogTitle>
                            <DialogDescription>
                                Заполните данные для создания факультета.
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
                                    placeholder="Например: Факультет инженерии"
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
                                    placeholder="Например: ENG"
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
                                    placeholder="Краткое описание факультета"
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
            <Head title="Факультеты" />

            <Dialog
                open={editOpen}
                onOpenChange={(open) => {
                    setEditOpen(open);
                    if (!open) {
                        setEditingFaculty(null);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Редактирование факультета</DialogTitle>
                        <DialogDescription>
                            Измените данные выбранного факультета.
                        </DialogDescription>
                    </DialogHeader>
                    <form className="space-y-4" onSubmit={submitEdit}>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Название</label>
                            <Input
                                value={editForm.data.name}
                                onChange={(e) => editForm.setData('name', e.target.value)}
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
                                onChange={(e) => editForm.setData('code', e.target.value)}
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
                                className="min-h-24 w-full rounded-md border border-input bg-background/70 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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

            <div className="admin-page-wrap">
                <Card className="admin-surface">
                    <CardHeader>
                        <CardTitle>Список факультетов</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {items.length === 0 ? (
                            <div className="admin-empty-state">
                                Пока нет факультетов. Создайте первую запись.
                            </div>
                        ) : (
                            <div className="admin-table-wrap">
                                <table className="admin-data-table min-w-[700px]">
                                    <thead>
                                        <tr>
                                            <th>Название</th>
                                            <th>Код</th>
                                            <th>Описание</th>
                                            <th className="text-right">Действия</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((faculty) => (
                                            <tr key={faculty.id}>
                                                <td className="py-3 pe-3 font-medium">
                                                    {faculty.name}
                                                </td>
                                                <td className="py-3 pe-3">
                                                    {faculty.code ? (
                                                        <Badge variant="outline">
                                                            {faculty.code}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-muted-foreground">
                                                            -
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="max-w-md py-3 pe-3 text-muted-foreground">
                                                    {faculty.description || '-'}
                                                </td>
                                                <td className="py-3 text-right">
                                                    <div className="admin-row-actions">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() =>
                                                                openEditDialog(faculty)
                                                            }
                                                        >
                                                            <Pencil />
                                                            Редактировать
                                                        </Button>
                                                        <Button
                                                            variant="destructive"
                                                            size="sm"
                                                            onClick={() =>
                                                                handleDelete(faculty)
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
    );
}
