import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { DataTable, EmptyState, FilterBar, PageHeader, qdFieldClass, Segmented, StatusBadge } from '@/components/platform';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { Search, Phone, Mail, Pencil, Image as ImageIcon, UserCircle2, GripVertical, Plus, Trash2, LayoutGrid, Table2 } from 'lucide-react';
import { useEffect, useState } from 'react';

const LOGO_AVATAR_URL = '/assets/images/logo.png';

export default function Index({ sections, totalUsers, departments, filters }) {
    const page = usePage();
    const roleSlug = page?.props?.auth?.roleSlug;
    const canManagePhotos = ['admin', 'superadmin', 'hr'].includes(roleSlug);
    const canManageDirectory = ['admin', 'superadmin', 'hr'].includes(roleSlug);

    const groupedSections = Array.isArray(sections) ? sections : [];
    const [localSections, setLocalSections] = useState(groupedSections);
    const [search, setSearch] = useState(filters?.search ?? '');
    const [departmentId, setDepartmentId] = useState(filters?.department_id ?? '');
    const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
    const [photoPreviewOpen, setPhotoPreviewOpen] = useState(false);
    const [photoPreview, setPhotoPreview] = useState({
        src: LOGO_AVATAR_URL,
        fullName: '',
    });
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [addDepartmentDialogOpen, setAddDepartmentDialogOpen] = useState(false);
    const [viewMode, setViewMode] = useState('cards');
    const [editingUser, setEditingUser] = useState(null);
    const [draggingUserId, setDraggingUserId] = useState(null);

    const photoForm = useForm({
        avatar_url: '',
    });

    const uploadForm = useForm({
        avatar: null,
    });

    const editForm = useForm({
        department_id: '',
        full_name: '',
        job_title: '',
        phone: '',
        inner_phone: '',
        email: '',
        office: '',
        sort_order: '',
    });

    const addForm = useForm({
        department_id: '',
        full_name: '',
        job_title: '',
        phone: '',
        inner_phone: '',
        email: '',
        office: '',
        sort_order: '',
    });

    const departmentForm = useForm({
        name: '',
    });

    useEffect(() => {
        setLocalSections(groupedSections);
    }, [groupedSections]);

    const submitFilters = (event) => {
        event.preventDefault();

        router.get(
            route('phonebook.index'),
            {
                search,
                department_id: departmentId,
            },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            }
        );
    };

    const clearFilters = () => {
        setSearch('');
        setDepartmentId('');

        router.get(route('phonebook.index'), {}, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const openPhotoDialog = (item) => {
        setEditingUser(item);
        photoForm.setData('avatar_url', item.avatar_url ?? '');
        photoForm.clearErrors();
        uploadForm.setData('avatar', null);
        uploadForm.clearErrors();
        setPhotoDialogOpen(true);
    };

    const openEditDialog = (item) => {
        setEditingUser(item);
        editForm.setData({
            department_id: item.department?.id ? String(item.department.id) : '',
            full_name: item.full_name ?? '',
            job_title: item.job_title ?? '',
            phone: item.phone ?? '',
            inner_phone: item.inner_phone ?? '',
            email: item.email ?? '',
            office: item.office ?? '',
            sort_order: item.sort_order == null ? '' : String(item.sort_order),
        });
        editForm.clearErrors();
        setEditDialogOpen(true);
    };

    const submitPhoto = (event) => {
        event.preventDefault();

        if (!editingUser) {
            return;
        }

        photoForm.patch(route('phonebook.users.avatar.update', editingUser.id), {
            preserveScroll: true,
            onSuccess: () => {
                setPhotoDialogOpen(false);
                setEditingUser(null);
            },
        });
    };

    const submitPhotoUpload = (event) => {
        event.preventDefault();

        if (!editingUser) {
            return;
        }

        uploadForm.post(route('phonebook.users.avatar.upload', editingUser.id), {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => {
                setPhotoDialogOpen(false);
                setEditingUser(null);
            },
        });
    };

    const submitEdit = (event) => {
        event.preventDefault();

        if (!editingUser) {
            return;
        }

        editForm.patch(route('phonebook.users.update', editingUser.id), {
            preserveScroll: true,
            onSuccess: () => {
                setEditDialogOpen(false);
                setEditingUser(null);
            },
        });
    };

    const openAddDialog = () => {
        addForm.setData({
            department_id: '',
            full_name: '',
            job_title: '',
            phone: '',
            inner_phone: '',
            email: '',
            office: '',
            sort_order: '',
        });
        addForm.clearErrors();
        setAddDialogOpen(true);
    };

    const submitAdd = (event) => {
        event.preventDefault();

        addForm.post(route('phonebook.users.store'), {
            preserveScroll: true,
            onSuccess: () => {
                setAddDialogOpen(false);
            },
        });
    };

    const openAddDepartmentDialog = () => {
        departmentForm.setData('name', '');
        departmentForm.clearErrors();
        setAddDepartmentDialogOpen(true);
    };

    const submitAddDepartment = (event) => {
        event.preventDefault();

        departmentForm.post(route('phonebook.departments.store'), {
            preserveScroll: true,
            onSuccess: () => {
                setAddDepartmentDialogOpen(false);
            },
        });
    };

    const handleDeleteUser = (item) => {
        if (!canManageDirectory) {
            return;
        }

        const ok = window.confirm(`Удалить сотрудника "${item.full_name}"?`);

        if (!ok) {
            return;
        }

        router.delete(route('phonebook.users.destroy', item.id), {
            preserveScroll: true,
        });
    };

    const openPhotoPreview = (item) => {
        const avatarUrl = (item.avatar_url ?? '').trim();

        setPhotoPreview({
            src: avatarUrl !== '' ? avatarUrl : LOGO_AVATAR_URL,
            fullName: item.full_name ?? '',
        });
        setPhotoPreviewOpen(true);
    };

    const sectionKey = (section) => {
        if (section.department_id == null) {
            return `without-${section.name}`;
        }

        return `department-${section.department_id}`;
    };

    const persistMove = (draggedUserId, targetUserId, targetDepartmentId) => {
        router.patch(route('phonebook.users.move', draggedUserId), {
            target_user_id: targetUserId,
            target_department_id: targetDepartmentId,
        }, {
            preserveScroll: true,
            onFinish: () => setDraggingUserId(null),
        });
    };

    const moveLocalCard = (draggedUserId, targetSectionKey, targetUserId = null) => {
        let draggedItem = null;

        const withoutDragged = localSections.map((section) => {
            const items = (section.items ?? []).filter((item) => {
                if (item.id === draggedUserId) {
                    draggedItem = item;
                    return false;
                }

                return true;
            });

            return { ...section, items };
        });

        if (!draggedItem) {
            return localSections;
        }

        return withoutDragged.map((section) => {
            if (sectionKey(section) !== targetSectionKey) {
                return section;
            }

            const items = [...(section.items ?? [])];
            const insertIndex = targetUserId == null
                ? items.length
                : Math.max(items.findIndex((item) => item.id === targetUserId), 0);

            items.splice(insertIndex, 0, {
                ...draggedItem,
                department: section.department_id == null
                    ? null
                    : {
                        id: section.department_id,
                        name: section.name,
                    },
            });

            return { ...section, items };
        });
    };

    const handleDragStart = (event, userId) => {
        if (!canManageDirectory) {
            return;
        }

        setDraggingUserId(userId);
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(userId));
    };

    const handleDropOnCard = (event, targetSection, targetUserId) => {
        event.preventDefault();
        event.stopPropagation();

        if (!canManageDirectory) {
            return;
        }

        const raw = event.dataTransfer.getData('text/plain');
        const draggedUserId = Number(raw);

        if (!Number.isFinite(draggedUserId) || draggedUserId === targetUserId) {
            return;
        }

        const key = sectionKey(targetSection);
        const nextSections = moveLocalCard(draggedUserId, key, targetUserId);
        setLocalSections(nextSections);
        persistMove(draggedUserId, targetUserId, targetSection.department_id ?? null);
    };

    const handleDropOnSection = (event, targetSection) => {
        event.preventDefault();
        event.stopPropagation();

        if (!canManageDirectory) {
            return;
        }

        const raw = event.dataTransfer.getData('text/plain');
        const draggedUserId = Number(raw);

        if (!Number.isFinite(draggedUserId)) {
            return;
        }

        const key = sectionKey(targetSection);
        const nextSections = moveLocalCard(draggedUserId, key, null);
        setLocalSections(nextSections);
        persistMove(draggedUserId, null, targetSection.department_id ?? null);
    };

    const initialsFromName = (fullName) => {
        const parts = String(fullName ?? '')
            .trim()
            .split(/\s+/)
            .filter(Boolean);

        if (parts.length === 0) {
            return '??';
        }

        return parts
            .slice(0, 2)
            .map((part) => part[0])
            .join('')
            .toUpperCase();
    };

    const renderAvatar = (item) => {
        const avatarUrl = (item.avatar_url ?? '').trim();
        const src = avatarUrl !== '' ? avatarUrl : LOGO_AVATAR_URL;

        return (
            <button
                type="button"
                draggable={false}
                className="shrink-0 rounded-[12px] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-teal-600/30"
                onClick={(event) => {
                    event.stopPropagation();
                    openPhotoPreview(item);
                }}
                title="Открыть фото"
            >
                <img
                    src={src}
                    alt={item.full_name}
                    draggable={false}
                    className="h-24 w-24 rounded-[12px] border border-slate-200 bg-slate-50 object-cover md:h-28 md:w-28"
                    onError={(event) => {
                        const image = event.currentTarget;

                        if (image.src.endsWith(LOGO_AVATAR_URL)) {
                            image.onerror = null;
                            return;
                        }

                        image.src = LOGO_AVATAR_URL;
                    }}
                />
            </button>
        );
    };

    const tableRows = localSections.flatMap((section) =>
        (section.items ?? []).map((item) => ({
            ...item,
            _sectionName: section.name,
            _sectionDepartmentId: section.department_id ?? null,
        }))
    ).map((item, index) => ({
        ...item,
        _globalOrder: index + 1,
    }));

    const findSectionByDepartmentId = (departmentId) => localSections.find((section) =>
        (section.department_id ?? null) === (departmentId ?? null)
    );

    const handleDropOnTableRow = (event, targetItem) => {
        event.preventDefault();
        event.stopPropagation();

        if (!canManageDirectory) {
            return;
        }

        const raw = event.dataTransfer.getData('text/plain');
        const draggedUserId = Number(raw);

        if (!Number.isFinite(draggedUserId) || draggedUserId === targetItem.id) {
            return;
        }

        const targetSection = findSectionByDepartmentId(targetItem._sectionDepartmentId);

        if (!targetSection) {
            return;
        }

        const key = sectionKey(targetSection);
        const nextSections = moveLocalCard(draggedUserId, key, targetItem.id);
        setLocalSections(nextSections);
        persistMove(draggedUserId, targetItem.id, targetSection.department_id ?? null);
    };

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="Справочник"
                    title="Телефонные справочники"
                    description="Единый каталог контактов и сотрудников."
                    actions={canManageDirectory ? (
                        <>
                            <Button type="button" variant="outline" onClick={openAddDepartmentDialog}>
                                Добавить отдел
                            </Button>
                            <Button type="button" className="gap-2" onClick={openAddDialog}>
                                <Plus className="h-4 w-4" />
                                Добавить сотрудника
                            </Button>
                        </>
                    ) : null}
                    meta={<StatusBadge tone="info">{totalUsers} сотрудников</StatusBadge>}
                />
            )}
        >
            <Head title="Телефонные справочники" />

            <Dialog
                open={photoPreviewOpen}
                onOpenChange={setPhotoPreviewOpen}
            >
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>{photoPreview.fullName || 'Фото сотрудника'}</DialogTitle>
                    </DialogHeader>

                    <div className="overflow-hidden rounded-lg border bg-muted/20 p-2">
                        <img
                            src={photoPreview.src}
                            alt={photoPreview.fullName || 'Фото сотрудника'}
                            className="mx-auto max-h-[82vh] w-full rounded-md object-contain"
                            onError={(event) => {
                                const image = event.currentTarget;

                                if (image.src.endsWith(LOGO_AVATAR_URL)) {
                                    image.onerror = null;
                                    return;
                                }

                                image.src = LOGO_AVATAR_URL;
                            }}
                        />
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog
                open={photoDialogOpen}
                onOpenChange={(open) => {
                    setPhotoDialogOpen(open);

                    if (!open) {
                        setEditingUser(null);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Фото сотрудника</DialogTitle>
                        <DialogDescription>
                            Укажите ссылку на изображение для карточки сотрудника.
                        </DialogDescription>
                    </DialogHeader>

                    <form className="space-y-3" onSubmit={submitPhoto}>
                        <div className="space-y-2">
                            <label className="qd-field-label block">URL изображения</label>
                            <Input
                                value={photoForm.data.avatar_url}
                                onChange={(event) => photoForm.setData('avatar_url', event.target.value)}
                                placeholder="https://..."
                            />
                            {photoForm.errors.avatar_url && (
                                <p className="text-sm text-destructive">{photoForm.errors.avatar_url}</p>
                            )}
                        </div>

                        <div className="space-y-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
                            <label className="qd-field-label block">Или загрузить файл</label>
                            <Input
                                type="file"
                                accept="image/*"
                                onChange={(event) => {
                                    const file = event.target.files?.[0] ?? null;
                                    uploadForm.setData('avatar', file);
                                }}
                            />
                            {uploadForm.errors.avatar && (
                                <p className="text-sm text-destructive">{uploadForm.errors.avatar}</p>
                            )}
                            <div className="flex justify-end">
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={uploadForm.processing || !uploadForm.data.avatar}
                                    onClick={submitPhotoUpload}
                                >
                                    Загрузить файл
                                </Button>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setPhotoDialogOpen(false)}>
                                Отмена
                            </Button>
                            <Button type="submit" disabled={photoForm.processing}>Сохранить</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog
                open={editDialogOpen}
                onOpenChange={(open) => {
                    setEditDialogOpen(open);

                    if (!open) {
                        setEditingUser(null);
                    }
                }}
            >
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Редактирование сотрудника</DialogTitle>
                        <DialogDescription>
                            Измените данные карточки, включая департамент и порядок отображения.
                        </DialogDescription>
                    </DialogHeader>

                    <form className="space-y-3" onSubmit={submitEdit}>
                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                                <label className="qd-field-label block">ФИО</label>
                                <Input
                                    value={editForm.data.full_name}
                                    onChange={(event) => editForm.setData('full_name', event.target.value)}
                                />
                                {editForm.errors.full_name && <p className="text-sm text-destructive">{editForm.errors.full_name}</p>}
                            </div>

                            <div className="space-y-2">
                                <label className="qd-field-label block">Департамент</label>
                                <select
                                    className={qdFieldClass}
                                    value={editForm.data.department_id}
                                    onChange={(event) => editForm.setData('department_id', event.target.value)}
                                >
                                    <option value="">Без департамента</option>
                                    {departments.map((department) => (
                                        <option key={department.id} value={department.id}>
                                            {department.name}
                                        </option>
                                    ))}
                                </select>
                                {editForm.errors.department_id && <p className="text-sm text-destructive">{editForm.errors.department_id}</p>}
                            </div>

                            <div className="space-y-2">
                                <label className="qd-field-label block">Должность</label>
                                <Input
                                    value={editForm.data.job_title}
                                    onChange={(event) => editForm.setData('job_title', event.target.value)}
                                />
                                {editForm.errors.job_title && <p className="text-sm text-destructive">{editForm.errors.job_title}</p>}
                            </div>

                            <div className="space-y-2">
                                <label className="qd-field-label block">Порядок (order)</label>
                                <Input
                                    type="number"
                                    min="0"
                                    value={editForm.data.sort_order}
                                    onChange={(event) => editForm.setData('sort_order', event.target.value)}
                                />
                                {editForm.errors.sort_order && <p className="text-sm text-destructive">{editForm.errors.sort_order}</p>}
                            </div>

                            <div className="space-y-2">
                                <label className="qd-field-label block">Телефон</label>
                                <Input
                                    value={editForm.data.phone}
                                    onChange={(event) => editForm.setData('phone', event.target.value)}
                                />
                                {editForm.errors.phone && <p className="text-sm text-destructive">{editForm.errors.phone}</p>}
                            </div>

                            <div className="space-y-2">
                                <label className="qd-field-label block">Внутренний телефон</label>
                                <Input
                                    value={editForm.data.inner_phone}
                                    onChange={(event) => editForm.setData('inner_phone', event.target.value)}
                                />
                                {editForm.errors.inner_phone && <p className="text-sm text-destructive">{editForm.errors.inner_phone}</p>}
                            </div>

                            <div className="space-y-1 md:col-span-2">
                                <label className="qd-field-label block">Email</label>
                                <Input
                                    value={editForm.data.email}
                                    onChange={(event) => editForm.setData('email', event.target.value)}
                                />
                                {editForm.errors.email && <p className="text-sm text-destructive">{editForm.errors.email}</p>}
                            </div>

                            <div className="space-y-2">
                                <label className="qd-field-label block">Кабинет</label>
                                <Input
                                    value={editForm.data.office}
                                    onChange={(event) => editForm.setData('office', event.target.value)}
                                />
                                {editForm.errors.office && <p className="text-sm text-destructive">{editForm.errors.office}</p>}
                            </div>

                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                                Отмена
                            </Button>
                            <Button type="submit" disabled={editForm.processing}>Сохранить изменения</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog
                open={addDialogOpen}
                onOpenChange={setAddDialogOpen}
            >
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Добавить сотрудника</DialogTitle>
                        <DialogDescription>
                            Создайте новую запись в телефонном справочнике.
                        </DialogDescription>
                    </DialogHeader>

                    <form className="space-y-3" onSubmit={submitAdd}>
                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                                <label className="qd-field-label block">ФИО</label>
                                <Input
                                    value={addForm.data.full_name}
                                    onChange={(event) => addForm.setData('full_name', event.target.value)}
                                />
                                {addForm.errors.full_name && <p className="text-sm text-destructive">{addForm.errors.full_name}</p>}
                            </div>

                            <div className="space-y-2">
                                <label className="qd-field-label block">Департамент</label>
                                <select
                                    className={qdFieldClass}
                                    value={addForm.data.department_id}
                                    onChange={(event) => addForm.setData('department_id', event.target.value)}
                                >
                                    <option value="">Без департамента</option>
                                    {departments.map((department) => (
                                        <option key={department.id} value={department.id}>
                                            {department.name}
                                        </option>
                                    ))}
                                </select>
                                {addForm.errors.department_id && <p className="text-sm text-destructive">{addForm.errors.department_id}</p>}
                            </div>

                            <div className="space-y-2">
                                <label className="qd-field-label block">Должность</label>
                                <Input
                                    value={addForm.data.job_title}
                                    onChange={(event) => addForm.setData('job_title', event.target.value)}
                                />
                                {addForm.errors.job_title && <p className="text-sm text-destructive">{addForm.errors.job_title}</p>}
                            </div>

                            <div className="space-y-2">
                                <label className="qd-field-label block">Порядок (order)</label>
                                <Input
                                    type="number"
                                    min="0"
                                    value={addForm.data.sort_order}
                                    onChange={(event) => addForm.setData('sort_order', event.target.value)}
                                />
                                {addForm.errors.sort_order && <p className="text-sm text-destructive">{addForm.errors.sort_order}</p>}
                            </div>

                            <div className="space-y-2">
                                <label className="qd-field-label block">Телефон</label>
                                <Input
                                    value={addForm.data.phone}
                                    onChange={(event) => addForm.setData('phone', event.target.value)}
                                />
                                {addForm.errors.phone && <p className="text-sm text-destructive">{addForm.errors.phone}</p>}
                            </div>

                            <div className="space-y-2">
                                <label className="qd-field-label block">Внутренний телефон</label>
                                <Input
                                    value={addForm.data.inner_phone}
                                    onChange={(event) => addForm.setData('inner_phone', event.target.value)}
                                />
                                {addForm.errors.inner_phone && <p className="text-sm text-destructive">{addForm.errors.inner_phone}</p>}
                            </div>

                            <div className="space-y-1 md:col-span-2">
                                <label className="qd-field-label block">Email</label>
                                <Input
                                    value={addForm.data.email}
                                    onChange={(event) => addForm.setData('email', event.target.value)}
                                />
                                {addForm.errors.email && <p className="text-sm text-destructive">{addForm.errors.email}</p>}
                            </div>

                            <div className="space-y-2">
                                <label className="qd-field-label block">Кабинет</label>
                                <Input
                                    value={addForm.data.office}
                                    onChange={(event) => addForm.setData('office', event.target.value)}
                                />
                                {addForm.errors.office && <p className="text-sm text-destructive">{addForm.errors.office}</p>}
                            </div>

                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>
                                Отмена
                            </Button>
                            <Button type="submit" disabled={addForm.processing}>Добавить</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog
                open={addDepartmentDialogOpen}
                onOpenChange={(open) => {
                    setAddDepartmentDialogOpen(open);

                    if (!open) {
                        departmentForm.clearErrors();
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Добавить отдел</DialogTitle>
                        <DialogDescription>
                            Новый отдел сразу появится в фильтре и в карточках сотрудников.
                        </DialogDescription>
                    </DialogHeader>

                    <form className="space-y-3" onSubmit={submitAddDepartment}>
                        <div className="space-y-1">
                            <label className="qd-field-label block">Название отдела</label>
                            <Input
                                value={departmentForm.data.name}
                                onChange={(event) => departmentForm.setData('name', event.target.value)}
                                placeholder="Например: Отдел кадров"
                            />
                            {departmentForm.errors.name && <p className="text-sm text-destructive">{departmentForm.errors.name}</p>}
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setAddDepartmentDialogOpen(false)}>
                                Отмена
                            </Button>
                            <Button type="submit" disabled={departmentForm.processing}>Добавить отдел</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <div className="admin-page-wrap space-y-6">
                <FilterBar>
                    <form className="grid gap-4 md:grid-cols-[minmax(0,1fr)_280px]" onSubmit={submitFilters}>
                            <div className="space-y-2">
                                <label className="qd-field-label block">Поиск</label>
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                    <Input
                                        className="pl-9"
                                        value={search}
                                        onChange={(event) => setSearch(event.target.value)}
                                        placeholder="ФИО, телефон, почта, должность"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="qd-field-label block">Департамент</label>
                                <select
                                    className={qdFieldClass}
                                    value={departmentId}
                                    onChange={(event) => setDepartmentId(event.target.value)}
                                >
                                    <option value="">Все департаменты</option>
                                    {departments.map((department) => (
                                        <option key={department.id} value={department.id}>
                                            {department.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4 md:col-span-2">
                                <Button type="button" variant="outline" onClick={clearFilters}>
                                    Сбросить
                                </Button>
                                <Button type="submit">Применить</Button>
                            </div>
                        </form>
                </FilterBar>

                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="font-display text-lg font-bold text-[#102945]">Результаты каталога</h2>
                        <p className="text-sm text-slate-500">
                            {tableRows.length} в выдаче{canManageDirectory ? ' · порядок меняется перетаскиванием' : ''}
                        </p>
                    </div>
                    <Segmented
                        items={[
                            { key: 'cards', label: <span className="inline-flex items-center gap-1.5"><LayoutGrid className="h-4 w-4" />Карточки</span> },
                            { key: 'table', label: <span className="inline-flex items-center gap-1.5"><Table2 className="h-4 w-4" />Таблица</span> },
                        ]}
                        value={viewMode}
                        onChange={setViewMode}
                    />
                </div>

                <div>
                    <div>
                        {localSections.length === 0 ? (
                            <EmptyState title="Записей не найдено" description="Измените запрос или выберите другой департамент." action={<Button type="button" variant="outline" onClick={clearFilters}>Сбросить фильтры</Button>} />
                        ) : viewMode === 'table' ? (
                            <DataTable>
                                <table className="min-w-full text-sm">
                                    <thead className="text-left">
                                        <tr className="border-b border-slate-200">
                                            <th className="px-3 py-3">№</th>
                                            <th className="px-3 py-3">ФИО</th>
                                            <th className="px-3 py-3">Должность</th>
                                            <th className="px-3 py-3">Департамент</th>
                                            <th className="px-3 py-3">Телефон</th>
                                            <th className="px-3 py-3">Внутренний</th>
                                            <th className="px-3 py-3">Email</th>
                                            <th className="px-3 py-3">Кабинет</th>
                                            {(canManageDirectory || canManagePhotos) && <th className="px-3 py-3 text-right">Действия</th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tableRows.map((item) => (
                                            <tr
                                                key={item.id}
                                                className={`border-t border-slate-200 align-top hover:bg-slate-50 ${draggingUserId === item.id ? 'opacity-60' : ''}`}
                                                onDragOver={(event) => {
                                                    if (canManageDirectory) {
                                                        event.preventDefault();
                                                    }
                                                }}
                                                onDrop={(event) => handleDropOnTableRow(event, item)}
                                            >
                                                <td className="px-3 py-3 tabular-nums text-slate-500">
                                                    <div className="flex items-center gap-2">
                                                        {canManageDirectory && (
                                                            <span
                                                                draggable
                                                                onDragStart={(event) => handleDragStart(event, item.id)}
                                                                onDragEnd={() => setDraggingUserId(null)}
                                                                className="inline-flex cursor-grab text-slate-400 hover:text-teal-700 active:cursor-grabbing"
                                                                title="Перетащить"
                                                            >
                                                                <GripVertical className="h-4 w-4" />
                                                            </span>
                                                        )}
                                                        <span>{item._globalOrder}</span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3">
                                                    <div className="font-medium text-slate-900">{item.full_name}</div>
                                                </td>
                                                <td className="px-3 py-3 text-slate-600">{item.job_title || '-'}</td>
                                                <td className="px-3 py-3">
                                                    <Badge variant="outline">{item.department?.name || item._sectionName || 'Без департамента'}</Badge>
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-3 tabular-nums">{item.phone || '-'}</td>
                                                <td className="px-3 py-3 tabular-nums">{item.inner_phone || '-'}</td>
                                                <td className="px-3 py-3">{item.email || '-'}</td>
                                                <td className="px-3 py-3">{item.office || '-'}</td>

                                                {(canManageDirectory || canManagePhotos) && (
                                                    <td className="px-3 py-3 text-right">
                                                        <div className="flex flex-wrap justify-end gap-2">
                                                            {canManageDirectory && (
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="gap-1"
                                                                    onClick={() => openEditDialog(item)}
                                                                >
                                                                    <Pencil className="h-4 w-4" />
                                                                    Редактировать
                                                                </Button>
                                                            )}

                                                            {canManageDirectory && (
                                                                <Button
                                                                    type="button"
                                                                    variant="destructive"
                                                                    size="sm"
                                                                    className="gap-1"
                                                                    onClick={() => handleDeleteUser(item)}
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                    Удалить
                                                                </Button>
                                                            )}

                                                            {canManagePhotos && (
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="gap-1"
                                                                    onClick={() => openPhotoDialog(item)}
                                                                >
                                                                    <ImageIcon className="h-4 w-4" />
                                                                    Фото
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </DataTable>
                        ) : (
                            <div className="space-y-8">
                                {localSections.map((section) => (
                                    <section
                                        key={sectionKey(section)}
                                        className="space-y-3"
                                        onDragOver={(event) => {
                                            if (canManageDirectory) {
                                                event.preventDefault();
                                            }
                                        }}
                                        onDrop={(event) => handleDropOnSection(event, section)}
                                    >
                                        <div className="flex items-baseline justify-between gap-3 border-b border-slate-200 pb-2">
                                            <h3 className="font-display text-lg font-bold text-[#102945]">{section.name}</h3>
                                            <span className="text-xs font-semibold tabular-nums text-slate-500">{(section.items ?? []).length}</span>
                                        </div>

                                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                            {(section.items ?? []).map((item, index) => (
                                                <article
                                                    key={item.id}
                                                    className={`relative flex flex-col overflow-hidden rounded-[14px] border border-slate-200 bg-white p-4 shadow-[0_1px_2px_0_rgba(25,28,29,0.04)] transition-colors hover:border-teal-600/40 ${canManageDirectory ? 'cursor-grab active:cursor-grabbing' : ''} ${draggingUserId === item.id ? 'opacity-60' : ''}`}
                                                    draggable={canManageDirectory}
                                                    onDragStart={(event) => handleDragStart(event, item.id)}
                                                    onDragEnd={() => setDraggingUserId(null)}
                                                    onDragOver={(event) => {
                                                        if (canManageDirectory) {
                                                            event.preventDefault();
                                                        }
                                                    }}
                                                    onDrop={(event) => handleDropOnCard(event, section, item.id)}
                                                >
                                                    <div className="mb-3 flex items-center justify-between">
                                                        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-100 px-2 text-xs font-bold tabular-nums text-[#102945]">
                                                            #{index + 1}
                                                        </span>
                                                        {canManageDirectory && <GripVertical className="h-4 w-4 text-slate-400" />}
                                                    </div>

                                                    <div className="flex items-start gap-3">
                                                        {renderAvatar(item)}

                                                        <div className="min-w-0 flex-1">
                                                            <h3 className="line-clamp-2 font-display text-base font-bold leading-snug text-[#102945]">
                                                                {item.full_name}
                                                            </h3>
                                                            <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                                                                {item.job_title || 'Должность не указана'}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="mt-4 border-t border-slate-200 text-sm">
                                                        <div className="flex items-center gap-2 border-b border-slate-100 py-2 text-slate-800">
                                                            <Phone className="h-4 w-4 shrink-0 text-teal-700" />
                                                            <span className="tabular-nums">{item.phone || '-'}</span>
                                                            <span className="ml-auto text-xs tabular-nums text-slate-500">вн: {item.inner_phone || '-'}</span>
                                                        </div>

                                                        <div className="flex items-center gap-2 border-b border-slate-100 py-2 text-slate-800">
                                                            <Mail className="h-4 w-4 shrink-0 text-teal-700" />
                                                            <span className="truncate">{item.email || '-'}</span>
                                                        </div>

                                                        <div className="flex items-center gap-2 py-2 text-slate-800">
                                                            <UserCircle2 className="h-4 w-4 shrink-0 text-teal-700" />
                                                            <span>Кабинет: {item.office || '-'}</span>
                                                        </div>
                                                    </div>

                                                    {(canManageDirectory || canManagePhotos) && (
                                                        <div className="mt-auto flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-3">
                                                            {canManageDirectory && (
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="gap-1"
                                                                    onClick={() => openEditDialog(item)}
                                                                >
                                                                    <Pencil className="h-4 w-4" />
                                                                    Редактировать
                                                                </Button>
                                                            )}

                                                            {canManageDirectory && (
                                                                <Button
                                                                    type="button"
                                                                    variant="destructive"
                                                                    size="sm"
                                                                    className="gap-1"
                                                                    onClick={() => handleDeleteUser(item)}
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                    Удалить
                                                                </Button>
                                                            )}

                                                            {canManagePhotos && (
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                className="gap-1"
                                                                onClick={() => openPhotoDialog(item)}
                                                            >
                                                                <ImageIcon className="h-4 w-4" />
                                                                Фото
                                                            </Button>
                                                            )}
                                                        </div>
                                                    )}
                                                </article>
                                            ))}
                                        </div>
                                    </section>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
