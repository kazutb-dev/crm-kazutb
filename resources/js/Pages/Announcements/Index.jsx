import { ConfirmDialog } from '@/components/ConfirmDialog';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { EmptyState, PageHeader, StatGrid, StatTile, qdFieldClass } from '@/components/platform';
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
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { CircleAlert, FilePen, ImageOff, Megaphone, Pencil, Plus, Radio, Trash2 } from 'lucide-react';
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

export default function Index({ announcements }) {
    const items = announcements?.data ?? [];
    const links = announcements?.links ?? [];
    const total = announcements?.total ?? items.length;

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

    const activeCount = items.filter((item) => item.is_active).length;
    const draftCount = items.length - activeCount;
    const importantCount = items.filter((item) => item.is_important).length;

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

    const renderFields = (form, { isCreate, existingImage = null, existingTitle = '' }) => (
        <>
            <Field label="Заголовок" error={form.errors.title}>
                <Input
                    value={form.data.title}
                    onChange={(e) => form.setData('title', e.target.value)}
                    placeholder={isCreate ? 'Например: Важное обновление расписания' : undefined}
                />
            </Field>

            <Field label="Текст" error={form.errors.content}>
                <Textarea
                    className="min-h-28"
                    value={form.data.content}
                    onChange={(e) => form.setData('content', e.target.value)}
                    placeholder={isCreate ? 'Текст объявления' : undefined}
                />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Статус">
                    <select
                        className={qdFieldClass}
                        value={form.data.is_active ? '1' : '0'}
                        onChange={(e) => form.setData('is_active', e.target.value === '1')}
                    >
                        <option value="1">Активно</option>
                        <option value="0">Черновик</option>
                    </select>
                </Field>

                <Field label="Дата мероприятия" error={form.errors.event_date}>
                    <Input
                        type="datetime-local"
                        value={form.data.event_date}
                        onChange={(e) => form.setData('event_date', e.target.value)}
                    />
                </Field>
            </div>

            <Field label="Картинка" error={form.errors.image}>
                <div className="flex items-center gap-3">
                    {existingImage && (
                        <img
                            src={existingImage}
                            alt={existingTitle}
                            className="h-16 w-16 shrink-0 rounded-[10px] border border-slate-200 object-cover"
                        />
                    )}
                    <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => form.setData('image', e.target.files?.[0] ?? null)}
                    />
                </div>
            </Field>

            <div className="border-t border-slate-200 pt-4">
                <label className="inline-flex items-center gap-2.5 text-sm font-medium text-slate-800">
                    <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                        checked={form.data.is_important}
                        onChange={(e) => form.setData('is_important', e.target.checked)}
                    />
                    Важное
                </label>
                {form.errors.is_important && (
                    <p className="mt-1 text-sm text-red-700">{form.errors.is_important}</p>
                )}
            </div>
        </>
    );

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="Коммуникации"
                    title="Объявления"
                    description="Новости и анонсы мероприятий для сотрудников и студентов. Черновики не публикуются, важные выделяются."
                    actions={(
                        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                            <DialogTrigger asChild>
                                <Button>
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
                                    {renderFields(createForm, { isCreate: true })}
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
                        {renderFields(editForm, {
                            isCreate: false,
                            existingImage: editingAnnouncement?.image_url ?? null,
                            existingTitle: editingAnnouncement?.title ?? '',
                        })}
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Отмена</Button>
                            <Button type="submit" form="edit-announcement-form" disabled={editForm.processing}>
                                Сохранить изменения
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <div className="admin-page-wrap space-y-6">
                <StatGrid>
                    <StatTile label="Всего объявлений" value={total} icon={Megaphone} tone="teal" hint="Во всём разделе" />
                    <StatTile label="Активные" value={activeCount} icon={Radio} tone="success" hint="Среди показанных" />
                    <StatTile label="Черновики" value={draftCount} icon={FilePen} tone="neutral" hint="Среди показанных" />
                    <StatTile label="Важные" value={importantCount} icon={CircleAlert} tone="danger" hint="Среди показанных" />
                </StatGrid>

                {items.length === 0 ? (
                    <EmptyState
                        title="Пока нет объявлений"
                        description="Создайте первую запись — активные объявления увидят пользователи платформы."
                        action={(
                            <Button onClick={() => setCreateOpen(true)}>
                                <Plus />
                                Добавить объявление
                            </Button>
                        )}
                    />
                ) : (
                    <Card className="overflow-hidden">
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[900px] text-sm">
                                    <thead>
                                        <tr>
                                            <th className="text-left">Объявление</th>
                                            <th className="text-left">Важное</th>
                                            <th className="text-left">Статус</th>
                                            <th className="text-left">Дата мероприятия</th>
                                            <th className="text-left">Автор</th>
                                            <th className="text-left">Создано</th>
                                            <th className="text-right">Действия</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((announcement) => (
                                            <tr key={announcement.id} className="border-b border-slate-200 last:border-0 hover:bg-slate-50">
                                                <td>
                                                    <div className="flex items-start gap-3">
                                                        {announcement.image_url ? (
                                                            <img
                                                                src={announcement.image_url}
                                                                alt={announcement.title}
                                                                className="h-14 w-14 shrink-0 rounded-[10px] border border-slate-200 object-cover"
                                                            />
                                                        ) : (
                                                            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[10px] border border-dashed border-slate-300 text-slate-400" title="Без картинки">
                                                                <ImageOff className="h-5 w-5" />
                                                            </span>
                                                        )}
                                                        <div className="min-w-0">
                                                            <div className="font-medium text-slate-900">{announcement.title}</div>
                                                            <p className="mt-1 line-clamp-2 max-w-md text-xs text-slate-500">
                                                                {announcement.content}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <Badge variant={announcement.is_important ? 'destructive' : 'secondary'}>
                                                        {announcement.is_important ? 'Да' : 'Нет'}
                                                    </Badge>
                                                </td>
                                                <td>
                                                    <Badge variant={announcement.is_active ? 'success' : 'secondary'}>
                                                        {announcement.is_active ? 'Активно' : 'Черновик'}
                                                    </Badge>
                                                </td>
                                                <td className="whitespace-nowrap tabular-nums text-slate-700">
                                                    {announcement.event_date_human ?? '—'}
                                                </td>
                                                <td className="text-slate-700">{announcement.author_name}</td>
                                                <td className="whitespace-nowrap tabular-nums text-slate-500">{announcement.created_at_human}</td>
                                                <td className="text-right">
                                                    <div className="inline-flex items-center gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            title="Редактировать"
                                                            aria-label="Редактировать"
                                                            onClick={() => openEditDialog(announcement)}
                                                        >
                                                            <Pencil />
                                                        </Button>
                                                        <Button
                                                            variant="destructive"
                                                            size="icon"
                                                            title="Удалить"
                                                            aria-label="Удалить"
                                                            onClick={() => handleDelete(announcement)}
                                                        >
                                                            <Trash2 />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {links.length > 3 && (
                                <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 px-5 py-3 sm:px-6 justify-between">
                                    <span className="text-xs font-medium text-slate-500">
                                        Показано {announcements?.from ?? 0}–{announcements?.to ?? 0} из {total}
                                    </span>
                                    <div className="flex flex-wrap gap-1.5">
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
                                                        <span dangerouslySetInnerHTML={{ __html: link.label }} />
                                                    </Link>
                                                ) : (
                                                    <span dangerouslySetInnerHTML={{ __html: link.label }} />
                                                )}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
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
