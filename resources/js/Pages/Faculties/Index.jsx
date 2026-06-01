import { toast } from 'sonner';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { ConfirmDialog } from '@/components/ConfirmDialog';
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
import { Head, router, useForm } from '@inertiajs/react';
import { Pencil, Plus, Trash2, UserCog, Users } from 'lucide-react';
import { useMemo, useState } from 'react';

const ROLE_COLORS = {
    teacher: 'bg-sky-50 text-sky-700 border-sky-200',
    hod: 'bg-amber-50 text-amber-800 border-amber-200',
    dean: 'bg-violet-50 text-violet-800 border-violet-200',
    structural: 'bg-teal-50 text-teal-800 border-teal-200',
    admin: 'bg-slate-100 text-slate-700 border-slate-200',
    superadmin: 'bg-slate-100 text-slate-700 border-slate-200',
};

function roleBadgeClass(roleSlug) {
    return ROLE_COLORS[roleSlug] ?? 'bg-slate-50 text-slate-700 border-slate-200';
}

export default function Index({
    faculties = [],
    facultyOptions = [],
    departmentOptions = [],
    staffOptions = [],
    roleOptions = [],
}) {
    const items = faculties ?? [];

    const [confirmState, setConfirmState] = useState({ open: false, description: '', onConfirm: null });
    const [createOpen, setCreateOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [createDepartmentOpen, setCreateDepartmentOpen] = useState(false);
    const [editDepartmentOpen, setEditDepartmentOpen] = useState(false);
    const [manageStaffOpen, setManageStaffOpen] = useState(false);
    const [editingFaculty, setEditingFaculty] = useState(null);
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

    const createDepartmentForm = useForm({
        name: '',
        code: '',
        description: '',
        faculty_id: '',
    });

    const editDepartmentForm = useForm({
        name: '',
        code: '',
        description: '',
        faculty_id: '',
    });

    const staffForm = useForm({
        user_id: '',
        role: 'teacher',
        faculty_id: '',
        department_id: '',
    });

    const selectedStaff = useMemo(
        () => staffOptions.find((item) => String(item.id) === String(staffForm.data.user_id)) ?? null,
        [staffOptions, staffForm.data.user_id],
    );

    const availableDepartments = useMemo(() => {
        if (!staffForm.data.faculty_id) {
            return departmentOptions;
        }

        return departmentOptions.filter(
            (department) => String(department.faculty_id) === String(staffForm.data.faculty_id),
        );
    }, [departmentOptions, staffForm.data.faculty_id]);

    const handleDelete = (faculty) => {
        setConfirmState({
            open: true,
            description: `Удалить факультет "${faculty.name}"?`,
            onConfirm: () => router.delete(route('faculties.destroy', faculty.id)),
        });
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

    const submitCreateDepartment = (e) => {
        e.preventDefault();

        createDepartmentForm.post(route('departments.store'), {
            preserveScroll: true,
            onSuccess: () => {
                createDepartmentForm.reset();
                setCreateDepartmentOpen(false);
            },
        });
    };

    const openDepartmentEditDialog = (department, facultyId) => {
        setEditingDepartment(department);
        editDepartmentForm.setData({
            name: department.name ?? '',
            code: department.code ?? '',
            description: department.description ?? '',
            faculty_id: String(facultyId ?? ''),
        });
        editDepartmentForm.clearErrors();
        setEditDepartmentOpen(true);
    };

    const submitEditDepartment = (e) => {
        e.preventDefault();

        if (!editingDepartment) {
            return;
        }

        editDepartmentForm.patch(route('departments.update', editingDepartment.id), {
            preserveScroll: true,
            onSuccess: () => {
                setEditDepartmentOpen(false);
                setEditingDepartment(null);
            },
        });
    };

    const handleDeleteDepartment = (department) => {
        setConfirmState({
            open: true,
            description: `Удалить кафедру "${department.name}"?`,
            onConfirm: () => router.delete(route('departments.destroy', department.id), {
                preserveScroll: true,
            }),
        });
    };

    const openStaffDialog = ({ userId = '', role = 'teacher', facultyId = '', departmentId = '' } = {}) => {
        staffForm.setData({
            user_id: userId ? String(userId) : '',
            role,
            faculty_id: facultyId ? String(facultyId) : '',
            department_id: departmentId ? String(departmentId) : '',
        });
        staffForm.clearErrors();
        setManageStaffOpen(true);
    };

    const submitStaff = (e) => {
        e.preventDefault();

        const userId = staffForm.data.user_id;
        const role = staffForm.data.role;
        const facultyId = staffForm.data.faculty_id || null;
        let departmentId = staffForm.data.department_id || null;

        if (!userId) {
            return;
        }

        if (role === 'dean' && !facultyId) {
            toast.error('Для роли декана нужно выбрать факультет.');
            return;
        }

        if (role === 'hod' && !departmentId) {
            toast.error('Для роли заведующего кафедрой нужно выбрать кафедру.');
            return;
        }

        if (role === 'dean') {
            departmentId = null;
        }

        router.patch(route('users.role.update', userId), {
            role,
        }, {
            preserveScroll: true,
            onSuccess: () => {
                router.patch(route('users.binding.update', userId), {
                    faculty_id: facultyId,
                    department_id: departmentId,
                }, {
                    preserveScroll: true,
                    onSuccess: () => {
                        setManageStaffOpen(false);
                    },
                });
            },
        });
    };

    return (
        <AuthenticatedLayout
            headerRight={
                <div className="flex flex-wrap gap-2">
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
                                    Создание факультета в единой структуре.
                                </DialogDescription>
                            </DialogHeader>
                            <form className="space-y-4" onSubmit={submitCreate}>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Название</label>
                                    <Input
                                        value={createForm.data.name}
                                        onChange={(e) => createForm.setData('name', e.target.value)}
                                    />
                                    {createForm.errors.name && <p className="text-sm text-destructive">{createForm.errors.name}</p>}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Код</label>
                                    <Input
                                        value={createForm.data.code}
                                        onChange={(e) => createForm.setData('code', e.target.value)}
                                    />
                                    {createForm.errors.code && <p className="text-sm text-destructive">{createForm.errors.code}</p>}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Описание</label>
                                    <textarea
                                        className="min-h-24 w-full rounded-md border border-input bg-background/70 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                        value={createForm.data.description}
                                        onChange={(e) => createForm.setData('description', e.target.value)}
                                    />
                                    {createForm.errors.description && <p className="text-sm text-destructive">{createForm.errors.description}</p>}
                                </div>

                                <DialogFooter>
                                    <Button type="submit" disabled={createForm.processing}>Сохранить</Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={createDepartmentOpen} onOpenChange={setCreateDepartmentOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm" variant="outline">
                                <Plus />
                                Добавить кафедру
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Новая кафедра</DialogTitle>
                                <DialogDescription>
                                    Кафедра будет привязана к выбранному факультету.
                                </DialogDescription>
                            </DialogHeader>
                            <form className="space-y-4" onSubmit={submitCreateDepartment}>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Факультет</label>
                                    <select
                                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                                        value={createDepartmentForm.data.faculty_id}
                                        onChange={(e) => createDepartmentForm.setData('faculty_id', e.target.value)}
                                    >
                                        <option value="">Выберите факультет</option>
                                        {facultyOptions.map((faculty) => (
                                            <option key={faculty.id} value={faculty.id}>{faculty.name}</option>
                                        ))}
                                    </select>
                                    {createDepartmentForm.errors.faculty_id && <p className="text-sm text-destructive">{createDepartmentForm.errors.faculty_id}</p>}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Название кафедры</label>
                                    <Input
                                        value={createDepartmentForm.data.name}
                                        onChange={(e) => createDepartmentForm.setData('name', e.target.value)}
                                    />
                                    {createDepartmentForm.errors.name && <p className="text-sm text-destructive">{createDepartmentForm.errors.name}</p>}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Код</label>
                                    <Input
                                        value={createDepartmentForm.data.code}
                                        onChange={(e) => createDepartmentForm.setData('code', e.target.value)}
                                    />
                                    {createDepartmentForm.errors.code && <p className="text-sm text-destructive">{createDepartmentForm.errors.code}</p>}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Описание</label>
                                    <textarea
                                        className="min-h-24 w-full rounded-md border border-input bg-background/70 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                        value={createDepartmentForm.data.description}
                                        onChange={(e) => createDepartmentForm.setData('description', e.target.value)}
                                    />
                                    {createDepartmentForm.errors.description && <p className="text-sm text-destructive">{createDepartmentForm.errors.description}</p>}
                                </div>

                                <DialogFooter>
                                    <Button type="submit" disabled={createDepartmentForm.processing}>Сохранить</Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>

                    <Button size="sm" variant="secondary" onClick={() => openStaffDialog()}>
                        <UserCog />
                        Управление сотрудником
                    </Button>
                </div>
            }
        >
            <Head title="Факультеты и кафедры" />

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

            <Dialog
                open={editDepartmentOpen}
                onOpenChange={(open) => {
                    setEditDepartmentOpen(open);
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
                    <form className="space-y-4" onSubmit={submitEditDepartment}>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Факультет</label>
                            <select
                                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                                value={editDepartmentForm.data.faculty_id}
                                onChange={(e) => editDepartmentForm.setData('faculty_id', e.target.value)}
                            >
                                <option value="">Выберите факультет</option>
                                {facultyOptions.map((faculty) => (
                                    <option key={faculty.id} value={faculty.id}>{faculty.name}</option>
                                ))}
                            </select>
                            {editDepartmentForm.errors.faculty_id && <p className="text-sm text-destructive">{editDepartmentForm.errors.faculty_id}</p>}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Название</label>
                            <Input
                                value={editDepartmentForm.data.name}
                                onChange={(e) => editDepartmentForm.setData('name', e.target.value)}
                            />
                            {editDepartmentForm.errors.name && <p className="text-sm text-destructive">{editDepartmentForm.errors.name}</p>}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Код</label>
                            <Input
                                value={editDepartmentForm.data.code}
                                onChange={(e) => editDepartmentForm.setData('code', e.target.value)}
                            />
                            {editDepartmentForm.errors.code && <p className="text-sm text-destructive">{editDepartmentForm.errors.code}</p>}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Описание</label>
                            <textarea
                                className="min-h-24 w-full rounded-md border border-input bg-background/70 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                value={editDepartmentForm.data.description}
                                onChange={(e) => editDepartmentForm.setData('description', e.target.value)}
                            />
                            {editDepartmentForm.errors.description && <p className="text-sm text-destructive">{editDepartmentForm.errors.description}</p>}
                        </div>

                        <DialogFooter>
                            <Button type="submit" disabled={editDepartmentForm.processing}>Сохранить изменения</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={manageStaffOpen} onOpenChange={setManageStaffOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Управление сотрудником</DialogTitle>
                        <DialogDescription>
                            Назначение роли и привязки к факультету/кафедре.
                        </DialogDescription>
                    </DialogHeader>

                    <form className="space-y-4" onSubmit={submitStaff}>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Сотрудник</label>
                            <select
                                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                                value={staffForm.data.user_id}
                                onChange={(e) => staffForm.setData('user_id', e.target.value)}
                            >
                                <option value="">Выберите сотрудника</option>
                                {staffOptions.map((staff) => (
                                    <option key={staff.id} value={staff.id}>
                                        {staff.name} ({staff.email || 'без email'})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Роль</label>
                            <select
                                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                                value={staffForm.data.role}
                                onChange={(e) => staffForm.setData('role', e.target.value)}
                            >
                                {roleOptions.map((role) => (
                                    <option key={role.slug} value={role.slug}>{role.label}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Факультет</label>
                            <select
                                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                                value={staffForm.data.faculty_id}
                                onChange={(e) => {
                                    staffForm.setData('faculty_id', e.target.value);
                                    if (staffForm.data.department_id) {
                                        const stillValid = departmentOptions.some(
                                            (department) => String(department.id) === String(staffForm.data.department_id)
                                                && String(department.faculty_id) === String(e.target.value),
                                        );

                                        if (!stillValid) {
                                            staffForm.setData('department_id', '');
                                        }
                                    }
                                }}
                            >
                                <option value="">Без факультета</option>
                                {facultyOptions.map((faculty) => (
                                    <option key={faculty.id} value={faculty.id}>{faculty.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Кафедра</label>
                            <select
                                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                                value={staffForm.data.department_id}
                                onChange={(e) => staffForm.setData('department_id', e.target.value)}
                            >
                                <option value="">Без кафедры</option>
                                {availableDepartments.map((department) => (
                                    <option key={department.id} value={department.id}>{department.name}</option>
                                ))}
                            </select>
                        </div>

                        {selectedStaff && (
                            <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                                Текущее состояние: {selectedStaff.role_label}
                            </div>
                        )}

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setManageStaffOpen(false)}>
                                Отмена
                            </Button>
                            <Button type="submit" disabled={staffForm.processing || !staffForm.data.user_id}>
                                Сохранить
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <div className="admin-page-wrap">
                <Card className="admin-surface">
                    <CardHeader>
                        <CardTitle>Единая структура факультетов, кафедр и сотрудников</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {items.length === 0 ? (
                            <div className="admin-empty-state">
                                Пока нет факультетов. Создайте первую запись.
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {items.map((faculty) => (
                                    <div key={faculty.id} className="rounded-xl border border-border/70 bg-background p-4">
                                        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                                            <div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h3 className="text-base font-semibold">{faculty.name}</h3>
                                                    {faculty.code && <Badge variant="outline">{faculty.code}</Badge>}
                                                </div>
                                                <p className="text-sm text-muted-foreground">
                                                    {faculty.description || 'Описание не заполнено'}
                                                </p>
                                                <p className="mt-1 text-xs text-muted-foreground">
                                                    Кафедр: {faculty.department_count} • Сотрудников: {faculty.staff_count}
                                                </p>
                                            </div>

                                            <div className="flex flex-wrap gap-2">
                                                <Button variant="outline" size="sm" onClick={() => openEditDialog(faculty)}>
                                                    <Pencil />
                                                    Редактировать
                                                </Button>
                                                <Button variant="destructive" size="sm" onClick={() => handleDelete(faculty)}>
                                                    <Trash2 />
                                                    Удалить
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="mb-4 rounded-lg border border-border/60 bg-muted/20 p-3">
                                            <div className="mb-2 flex items-center justify-between">
                                                <p className="text-sm font-medium">Руководство факультета (декан)</p>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => openStaffDialog({
                                                        userId: faculty.deans[0]?.id ?? '',
                                                        role: 'dean',
                                                        facultyId: faculty.id,
                                                        departmentId: '',
                                                    })}
                                                >
                                                    Назначить декана
                                                </Button>
                                            </div>
                                            {faculty.deans.length === 0 ? (
                                                <p className="text-xs text-muted-foreground">Декан не назначен.</p>
                                            ) : (
                                                <div className="flex flex-wrap gap-2">
                                                    {faculty.deans.map((dean) => (
                                                        <button
                                                            key={dean.id}
                                                            type="button"
                                                            onClick={() => openStaffDialog({
                                                                userId: dean.id,
                                                                role: 'dean',
                                                                facultyId: faculty.id,
                                                                departmentId: '',
                                                            })}
                                                            className="rounded-md border border-violet-200 bg-violet-50 px-2 py-1 text-left text-xs text-violet-800"
                                                        >
                                                            <div className="font-medium">{dean.name}</div>
                                                            <div>{dean.email || 'без email'}</div>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-3">
                                            {faculty.departments.map((department) => (
                                                <div key={department.id} className="rounded-lg border border-border/70 p-3">
                                                    <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                                                        <div>
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <p className="font-medium">{department.name}</p>
                                                                {department.code && <Badge variant="outline">{department.code}</Badge>}
                                                            </div>
                                                            <p className="text-xs text-muted-foreground">
                                                                Сотрудников: {department.staff_count}
                                                            </p>
                                                        </div>

                                                        <div className="flex flex-wrap gap-2">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => openDepartmentEditDialog(department, faculty.id)}
                                                            >
                                                                <Pencil />
                                                                Кафедра
                                                            </Button>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => openStaffDialog({
                                                                    userId: department.heads[0]?.id ?? '',
                                                                    role: 'hod',
                                                                    facultyId: faculty.id,
                                                                    departmentId: department.id,
                                                                })}
                                                            >
                                                                Назначить заведующего
                                                            </Button>
                                                            <Button
                                                                variant="destructive"
                                                                size="sm"
                                                                onClick={() => handleDeleteDepartment(department)}
                                                            >
                                                                <Trash2 />
                                                                Удалить
                                                            </Button>
                                                        </div>
                                                    </div>

                                                    {department.staff.length === 0 ? (
                                                        <p className="text-xs text-muted-foreground">Сотрудники кафедры не привязаны.</p>
                                                    ) : (
                                                        <div className="flex flex-wrap gap-2">
                                                            {department.staff.map((employee) => (
                                                                <button
                                                                    key={employee.id}
                                                                    type="button"
                                                                    onClick={() => openStaffDialog({
                                                                        userId: employee.id,
                                                                        role: employee.role_slug,
                                                                        facultyId: employee.faculty_id,
                                                                        departmentId: employee.department_id,
                                                                    })}
                                                                    className="rounded-md border border-border bg-card px-2 py-1 text-left text-xs"
                                                                >
                                                                    <div className="mb-1 flex items-center gap-1.5">
                                                                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                                                                        <span className="font-medium">{employee.name}</span>
                                                                    </div>
                                                                    <div className="mb-1 text-muted-foreground">{employee.email || 'без email'}</div>
                                                                    <span className={`inline-flex rounded-full border px-1.5 py-0.5 text-[10px] ${roleBadgeClass(employee.role_slug)}`}>
                                                                        {employee.role_label}
                                                                    </span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
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
