import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { EmptyState, PageHeader, StatGrid, StatTile, qdFieldClass } from '@/components/platform';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Head, router, useForm } from '@inertiajs/react';
import { Building2, Crown, Landmark, Pencil, Plus, Trash2, UserCog, Users } from 'lucide-react';
import { useMemo, useState } from 'react';

const ROLE_BADGE_VARIANTS = {
    teacher: 'info',
    hod: 'warning',
    dean: 'default',
    structural: 'success',
    admin: 'secondary',
    superadmin: 'secondary',
};

function roleBadgeVariant(roleSlug) {
    return ROLE_BADGE_VARIANTS[roleSlug] ?? 'secondary';
}

function Field({ label, error, children }) {
    return (
        <div className="space-y-2">
            <Label className="block">{label}</Label>
            {children}
            {error && <p className="text-sm text-red-700">{error}</p>}
        </div>
    );
}

export default function Index({
    faculties = [],
    facultyOptions = [],
    departmentOptions = [],
    staffOptions = [],
    roleOptions = [],
}) {
    const items = faculties ?? [];

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

    const stats = useMemo(() => ({
        faculties: items.length,
        departments: items.reduce((sum, faculty) => sum + Number(faculty.department_count ?? faculty.departments?.length ?? 0), 0),
        staff: items.reduce((sum, faculty) => sum + Number(faculty.staff_count ?? 0), 0),
        withoutDean: items.filter((faculty) => (faculty.deans ?? []).length === 0).length,
    }), [items]);

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
        if (!window.confirm(`Удалить кафедру "${department.name}"?`)) {
            return;
        }

        router.delete(route('departments.destroy', department.id), {
            preserveScroll: true,
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
            window.alert('Для роли декана нужно выбрать факультет.');
            return;
        }

        if (role === 'hod' && !departmentId) {
            window.alert('Для роли заведующего кафедрой нужно выбрать кафедру.');
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

    const createFacultyDialog = (
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
                <Button>
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
                    <Field label="Название" error={createForm.errors.name}>
                        <Input
                            value={createForm.data.name}
                            onChange={(e) => createForm.setData('name', e.target.value)}
                        />
                    </Field>
                    <Field label="Код" error={createForm.errors.code}>
                        <Input
                            value={createForm.data.code}
                            onChange={(e) => createForm.setData('code', e.target.value)}
                        />
                    </Field>
                    <Field label="Описание" error={createForm.errors.description}>
                        <Textarea
                            value={createForm.data.description}
                            onChange={(e) => createForm.setData('description', e.target.value)}
                        />
                    </Field>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Отмена</Button>
                        <Button type="submit" disabled={createForm.processing}>Сохранить</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );

    const createDepartmentDialog = (
        <Dialog open={createDepartmentOpen} onOpenChange={setCreateDepartmentOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">
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
                    <Field label="Факультет" error={createDepartmentForm.errors.faculty_id}>
                        <select
                            className={qdFieldClass}
                            value={createDepartmentForm.data.faculty_id}
                            onChange={(e) => createDepartmentForm.setData('faculty_id', e.target.value)}
                        >
                            <option value="">Выберите факультет</option>
                            {facultyOptions.map((faculty) => (
                                <option key={faculty.id} value={faculty.id}>{faculty.name}</option>
                            ))}
                        </select>
                    </Field>
                    <Field label="Название кафедры" error={createDepartmentForm.errors.name}>
                        <Input
                            value={createDepartmentForm.data.name}
                            onChange={(e) => createDepartmentForm.setData('name', e.target.value)}
                        />
                    </Field>
                    <Field label="Код" error={createDepartmentForm.errors.code}>
                        <Input
                            value={createDepartmentForm.data.code}
                            onChange={(e) => createDepartmentForm.setData('code', e.target.value)}
                        />
                    </Field>
                    <Field label="Описание" error={createDepartmentForm.errors.description}>
                        <Textarea
                            value={createDepartmentForm.data.description}
                            onChange={(e) => createDepartmentForm.setData('description', e.target.value)}
                        />
                    </Field>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setCreateDepartmentOpen(false)}>Отмена</Button>
                        <Button type="submit" disabled={createDepartmentForm.processing}>Сохранить</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="Справочники"
                    title="Факультеты и кафедры"
                    description="Единая структура факультетов, кафедр и сотрудников: руководство, состав и привязки."
                    actions={(
                        <>
                            {createFacultyDialog}
                            {createDepartmentDialog}
                            <Button variant="secondary" onClick={() => openStaffDialog()}>
                                <UserCog />
                                Управление сотрудником
                            </Button>
                        </>
                    )}
                />
            )}
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
                        <Field label="Факультет" error={editDepartmentForm.errors.faculty_id}>
                            <select
                                className={qdFieldClass}
                                value={editDepartmentForm.data.faculty_id}
                                onChange={(e) => editDepartmentForm.setData('faculty_id', e.target.value)}
                            >
                                <option value="">Выберите факультет</option>
                                {facultyOptions.map((faculty) => (
                                    <option key={faculty.id} value={faculty.id}>{faculty.name}</option>
                                ))}
                            </select>
                        </Field>
                        <Field label="Название" error={editDepartmentForm.errors.name}>
                            <Input
                                value={editDepartmentForm.data.name}
                                onChange={(e) => editDepartmentForm.setData('name', e.target.value)}
                            />
                        </Field>
                        <Field label="Код" error={editDepartmentForm.errors.code}>
                            <Input
                                value={editDepartmentForm.data.code}
                                onChange={(e) => editDepartmentForm.setData('code', e.target.value)}
                            />
                        </Field>
                        <Field label="Описание" error={editDepartmentForm.errors.description}>
                            <Textarea
                                value={editDepartmentForm.data.description}
                                onChange={(e) => editDepartmentForm.setData('description', e.target.value)}
                            />
                        </Field>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setEditDepartmentOpen(false)}>Отмена</Button>
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
                        <Field label="Сотрудник">
                            <select
                                className={qdFieldClass}
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
                        </Field>

                        <Field label="Роль">
                            <select
                                className={qdFieldClass}
                                value={staffForm.data.role}
                                onChange={(e) => staffForm.setData('role', e.target.value)}
                            >
                                {roleOptions.map((role) => (
                                    <option key={role.slug} value={role.slug}>{role.label}</option>
                                ))}
                            </select>
                        </Field>

                        <Field label="Факультет">
                            <select
                                className={qdFieldClass}
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
                        </Field>

                        <Field label="Кафедра">
                            <select
                                className={qdFieldClass}
                                value={staffForm.data.department_id}
                                onChange={(e) => staffForm.setData('department_id', e.target.value)}
                            >
                                <option value="">Без кафедры</option>
                                {availableDepartments.map((department) => (
                                    <option key={department.id} value={department.id}>{department.name}</option>
                                ))}
                            </select>
                        </Field>

                        {selectedStaff && (
                            <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-3 text-sm">
                                <span className="qd-field-label text-slate-500">Текущее состояние</span>
                                <Badge variant={roleBadgeVariant(selectedStaff.role_slug)}>{selectedStaff.role_label}</Badge>
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

            <div className="admin-page-wrap space-y-4">
                <StatGrid>
                    <StatTile label="Факультеты" value={stats.faculties} icon={Landmark} tone="teal" hint="В единой структуре" />
                    <StatTile label="Кафедры" value={stats.departments} icon={Building2} tone="navy" hint="Привязаны к факультетам" />
                    <StatTile label="Сотрудники" value={stats.staff} icon={Users} tone="info" hint="С привязкой к факультету" />
                    <StatTile
                        label="Без декана"
                        value={stats.withoutDean}
                        icon={Crown}
                        tone={stats.withoutDean > 0 ? 'warning' : 'success'}
                        hint={stats.withoutDean > 0 ? 'Назначьте руководство' : 'Руководство назначено везде'}
                    />
                </StatGrid>

                {items.length === 0 ? (
                    <EmptyState
                        title="Пока нет факультетов"
                        description="Создайте первую запись — после этого можно добавлять кафедры и назначать руководство."
                        action={(
                            <Button onClick={() => setCreateOpen(true)}>
                                <Plus />
                                Добавить факультет
                            </Button>
                        )}
                    />
                ) : (
                    <div className="space-y-4">
                        {items.map((faculty) => (
                            <Card key={faculty.id}>
                                <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                                    <CardTitle className="flex items-center gap-2">
                                        <Landmark className="shrink-0" />
                                        {faculty.name}
                                    </CardTitle>
                                    <div className="flex flex-wrap items-center gap-2">
                                        {faculty.code && <Badge variant="outline">{faculty.code}</Badge>}
                                        <Button variant="outline" size="sm" onClick={() => openEditDialog(faculty)}>
                                            <Pencil />
                                            Редактировать
                                        </Button>
                                        <Button variant="destructive" size="sm" onClick={() => handleDelete(faculty)}>
                                            <Trash2 />
                                            Удалить
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="grid gap-x-6 gap-y-3 border-b border-slate-200 pb-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto] lg:items-center">
                                        <div className="min-w-0">
                                            <span className="qd-field-label block text-slate-500">Описание</span>
                                            <p className="mt-1 text-sm leading-snug text-slate-600">
                                                {faculty.description || 'Описание не заполнено'}
                                            </p>
                                        </div>
                                        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 lg:border-l lg:border-slate-200 lg:pl-6">
                                            <div className="min-w-0 space-y-1">
                                                <span className="qd-field-label block text-slate-500">Руководство факультета (декан)</span>
                                                {faculty.deans.length === 0 ? (
                                                    <Badge variant="warning">Декан не назначен</Badge>
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
                                                                className="flex items-center gap-2 rounded-[10px] border border-teal-200 bg-teal-50 px-2.5 py-1 text-left transition-colors hover:border-teal-400"
                                                            >
                                                                <Crown className="h-4 w-4 shrink-0 text-teal-700" />
                                                                <span>
                                                                    <span className="block text-sm font-semibold text-[#102945]">{dean.name}</span>
                                                                    <span className="block text-xs text-slate-500">{dean.email || 'без email'}</span>
                                                                </span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
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
                                        <div className="flex gap-6 text-sm lg:border-l lg:border-slate-200 lg:pl-6">
                                            <div>
                                                <div className="qd-field-label text-slate-500">Кафедр</div>
                                                <div className="text-xl font-bold tabular-nums text-[#102945]">{faculty.department_count}</div>
                                            </div>
                                            <div>
                                                <div className="qd-field-label text-slate-500">Сотрудников</div>
                                                <div className="text-xl font-bold tabular-nums text-[#102945]">{faculty.staff_count}</div>
                                            </div>
                                            <div>
                                                <div className="qd-field-label text-slate-500">Без зав.</div>
                                                <div className="text-xl font-bold tabular-nums text-[#102945]">
                                                    {faculty.departments.filter((department) => (department.heads ?? []).length === 0).length}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <span className="qd-field-label block text-slate-500">Кафедры</span>
                                        {faculty.departments.length === 0 ? (
                                            <p className="pt-2 text-sm text-slate-500">Кафедры ещё не добавлены.</p>
                                        ) : (
                                            <div className="divide-y divide-slate-200">
                                                {faculty.departments.map((department) => (
                                                    <div key={department.id} className="grid gap-3 py-2.5 last:pb-0 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)_auto] xl:items-center">
                                                        <div className="min-w-0">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <p className="font-semibold text-slate-900">{department.name}</p>
                                                                {department.code && <Badge variant="outline">{department.code}</Badge>}
                                                            </div>
                                                            <p className="text-xs text-slate-500">
                                                                Сотрудников: <span className="tabular-nums">{department.staff_count}</span>
                                                                {' · '}
                                                                {(department.heads ?? []).length > 0
                                                                    ? <>Зав.: <span className="font-medium text-slate-700">{department.heads.map((head) => head.name).join(', ')}</span></>
                                                                    : <span className="text-amber-700">Заведующий не назначен</span>}
                                                            </p>
                                                            {department.description ? (
                                                                <p className="line-clamp-2 text-xs text-slate-500" title={department.description}>{department.description}</p>
                                                            ) : null}
                                                        </div>

                                                        {department.staff.length === 0 ? (
                                                            <p className="text-xs text-slate-500">Сотрудники кафедры не привязаны.</p>
                                                        ) : (
                                                            <div className="flex min-w-0 flex-wrap gap-2">
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
                                                                        className="rounded-[10px] border border-slate-200 bg-white px-2.5 py-1 text-left transition-colors hover:border-teal-400"
                                                                    >
                                                                        <span className="flex items-center gap-1.5 text-sm font-medium text-slate-900">
                                                                            <Users className="h-3.5 w-3.5 text-slate-400" />
                                                                            {employee.name}
                                                                            <Badge variant={roleBadgeVariant(employee.role_slug)} className="text-[10px]">
                                                                                {employee.role_label}
                                                                            </Badge>
                                                                        </span>
                                                                        <span className="block text-xs text-slate-500">{employee.email || 'без email'}</span>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}

                                                        <div className="flex flex-wrap gap-2 xl:justify-end">
                                                            <Button
                                                                variant="ghost"
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
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
