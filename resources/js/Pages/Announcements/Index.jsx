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
import { useState } from 'react';

export default function Index({ announcements }) {
    const items = announcements?.data ?? [];
    const links = announcements?.links ?? [];

    const [confirmState, setConfirmState] = useState({ open: false, description: '', onConfirm: null });
    const [createOpen, setCreateOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [editingAnnouncement, setEditingAnnouncement] = useState(null);

    const createForm = useForm({
        title: '',
        content: '',
        is_active: true,
        is_important: false,
        event_date: '',
        image: null,
    });

    const editForm = useForm({
        title: '',
        content: '',
        is_active: true,
        is_important: false,
        event_date: '',
        image: null,
    });

    const handleDelete = (announcement) => {
        setConfirmState({
            open: true,
            description: `Удалить объявление "${announcement.title}"?`,
            onConfirm: () => router.delete(route('announcements.destroy', announcement.id)),
        });
    };

    const openEditDialog = (announcement) => {
        setEditingAnnouncement(announcement);
        editForm.setData({
            title: announcement.title ?? '',
            content: announcement.content ?? '',
            is_active: Boolean(announcement.is_active),
            is_important: Boolean(announcement.is_important),
            event_date: announcement.event_date ?? '',
            image: null,
        });
        editForm.clearErrors();
        setEditOpen(true);
    };

    const submitCreate = (e) => {
        e.preventDefault();

        createForm.post(route('announcements.store'), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                createForm.reset();
                createForm.setData('is_active', true);
                createForm.setData('is_important', false);
                createForm.setData('image', null);
                setCreateOpen(false);
            },
        });
    };

    const submitEdit = (e) => {
        e.preventDefault();

        if (!editingAnnouncement) {
            return;
        }

        editForm.transform((data) => ({
            ...data,
            _method: 'patch',
        }));

        editForm.post(route('announcements.update', editingAnnouncement.id), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                setEditOpen(false);
                setEditingAnnouncement(null);
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
                            Добавить объявление
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Новое объявление</DialogTitle>
                            <DialogDescription>
                                Заполните данные для публикации объявления.
                            </DialogDescription>
                        </DialogHeader>
                        <form className="space-y-4" onSubmit={submitCreate}>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Заголовок</label>
                                <Input
                                    value={createForm.data.title}
                                    onChange={(e) => createForm.setData('title', e.target.value)}
                                    placeholder="Например: Важное обновление расписания"
                                />
                                {createForm.errors.title && (
                                    <p className="text-sm text-destructive">{createForm.errors.title}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Текст</label>
                                <textarea
                                    className="min-h-28 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    value={createForm.data.content}
                                    onChange={(e) => createForm.setData('content', e.target.value)}
                                    placeholder="Текст объявления"
                                />
                                {createForm.errors.content && (
                                    <p className="text-sm text-destructive">{createForm.errors.content}</p>
                                )}
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Статус</label>
                                    <select
                                        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                        value={createForm.data.is_active ? '1' : '0'}
                                        onChange={(e) => createForm.setData('is_active', e.target.value === '1')}
                                    >
                                        <option value="1">Активно</option>
                                        <option value="0">Черновик</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Дата мероприятия</label>
                                    <Input
                                        type="datetime-local"
                                        value={createForm.data.event_date}
                                        onChange={(e) =>
                                            createForm.setData('event_date', e.target.value)
                                        }
                                    />
                                    {createForm.errors.event_date && (
                                        <p className="text-sm text-destructive">
                                            {createForm.errors.event_date}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Картинка</label>
                                <Input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) =>
                                        createForm.setData('image', e.target.files?.[0] ?? null)
                                    }
                                />
                                {createForm.errors.image && (
                                    <p className="text-sm text-destructive">{createForm.errors.image}</p>
                                )}
                            </div>

                            <label className="inline-flex items-center gap-2 text-sm font-medium">
                                <input
                                    type="checkbox"
                                    checked={createForm.data.is_important}
                                    onChange={(e) =>
                                        createForm.setData('is_important', e.target.checked)
                                    }
                                />
                                Важное
                            </label>
                            {createForm.errors.is_important && (
                                <p className="text-sm text-destructive">{createForm.errors.is_important}</p>
                            )}

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
            <Head title="Объявления" />

            <Dialog
                open={editOpen}
                onOpenChange={(open) => {
                    setEditOpen(open);
                    if (!open) {
                        setEditingAnnouncement(null);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Редактирование объявления</DialogTitle>
                        <DialogDescription>
                            Измените данные выбранного объявления.
                        </DialogDescription>
                    </DialogHeader>
                    <form id="edit-announcement-form" className="space-y-4" onSubmit={submitEdit}>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Заголовок</label>
                            <Input
                                value={editForm.data.title}
                                onChange={(e) => editForm.setData('title', e.target.value)}
                            />
                            {editForm.errors.title && (
                                <p className="text-sm text-destructive">{editForm.errors.title}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Текст</label>
                            <textarea
                                className="min-h-28 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                value={editForm.data.content}
                                onChange={(e) => editForm.setData('content', e.target.value)}
                            />
                            {editForm.errors.content && (
                                <p className="text-sm text-destructive">{editForm.errors.content}</p>
                            )}
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Статус</label>
                                <select
                                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    value={editForm.data.is_active ? '1' : '0'}
                                    onChange={(e) => editForm.setData('is_active', e.target.value === '1')}
                                >
                                    <option value="1">Активно</option>
                                    <option value="0">Черновик</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Дата мероприятия</label>
                                <Input
                                    type="datetime-local"
                                    value={editForm.data.event_date}
                                    onChange={(e) => editForm.setData('event_date', e.target.value)}
                                />
                                {editForm.errors.event_date && (
                                    <p className="text-sm text-destructive">{editForm.errors.event_date}</p>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Картинка</label>
                            <Input
                                type="file"
                                accept="image/*"
                                onChange={(e) => editForm.setData('image', e.target.files?.[0] ?? null)}
                            />
                            {editingAnnouncement?.image_url && (
                                <img
                                    src={editingAnnouncement.image_url}
                                    alt={editingAnnouncement.title}
                                    className="h-24 w-24 rounded-md border object-cover"
                                />
                            )}
                            {editForm.errors.image && (
                                <p className="text-sm text-destructive">{editForm.errors.image}</p>
                            )}
                        </div>

                        <label className="inline-flex items-center gap-2 text-sm font-medium">
                            <input
                                type="checkbox"
                                checked={editForm.data.is_important}
                                onChange={(e) => editForm.setData('is_important', e.target.checked)}
                            />
                            Важное
                        </label>
                        {editForm.errors.is_important && (
                            <p className="text-sm text-destructive">{editForm.errors.is_important}</p>
                        )}

                        <DialogFooter>
                            <Button type="submit" form="edit-announcement-form" disabled={editForm.processing}>
                                Сохранить изменения
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <div className="admin-page-wrap">
                <Card>
                    <CardHeader>
                        <CardTitle>Список объявлений</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {items.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                Пока нет объявлений. Создайте первую запись.
                            </p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[900px] text-sm">
                                    <thead>
                                        <tr className="border-b text-left text-muted-foreground">
                                            <th className="py-3 pe-3 font-medium">Заголовок</th>
                                            <th className="py-3 pe-3 font-medium">Картинка</th>
                                            <th className="py-3 pe-3 font-medium">Важное</th>
                                            <th className="py-3 pe-3 font-medium">Статус</th>
                                            <th className="py-3 pe-3 font-medium">Дата мероприятия</th>
                                            <th className="py-3 pe-3 font-medium">Автор</th>
                                            <th className="py-3 pe-3 font-medium">Создано</th>
                                            <th className="py-3 text-right font-medium">Действия</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((announcement) => (
                                            <tr key={announcement.id} className="border-b last:border-0">
                                                <td className="py-3 pe-3">
                                                    <div className="font-medium">{announcement.title}</div>
                                                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                                        {announcement.content}
                                                    </p>
                                                </td>
                                                <td className="py-3 pe-3">
                                                    {announcement.image_url ? (
                                                        <img
                                                            src={announcement.image_url}
                                                            alt={announcement.title}
                                                            className="h-14 w-14 rounded-md border object-cover"
                                                        />
                                                    ) : (
                                                        '—'
                                                    )}
                                                </td>
                                                <td className="py-3 pe-3">
                                                    <Badge variant={announcement.is_important ? 'destructive' : 'secondary'}>
                                                        {announcement.is_important ? 'Да' : 'Нет'}
                                                    </Badge>
                                                </td>
                                                <td className="py-3 pe-3">
                                                    <Badge variant={announcement.is_active ? 'default' : 'secondary'}>
                                                        {announcement.is_active ? 'Активно' : 'Черновик'}
                                                    </Badge>
                                                </td>
                                                <td className="py-3 pe-3">
                                                    {announcement.event_date_human ?? '—'}
                                                </td>
                                                <td className="py-3 pe-3">{announcement.author_name}</td>
                                                <td className="py-3 pe-3">{announcement.created_at_human}</td>
                                                <td className="py-3 text-right">
                                                    <div className="inline-flex items-center gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            onClick={() => openEditDialog(announcement)}
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="destructive"
                                                            size="icon"
                                                            onClick={() => handleDelete(announcement)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
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
                                        key={index}
                                        asChild={Boolean(link.url)}
                                        variant={link.active ? 'default' : 'outline'}
                                        size="sm"
                                        disabled={!link.url}
                                    >
                                        {link.url ? (
                                            <Link href={link.url} preserveScroll>
                                                <span
                                                    dangerouslySetInnerHTML={{
                                                        __html: link.label,
                                                    }}
                                                />
                                            </Link>
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
