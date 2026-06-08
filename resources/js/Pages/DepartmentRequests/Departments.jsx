import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { ArrowLeft, Building2, Info, Plus, Trash2, Users } from 'lucide-react';
import { useMemo, useState } from 'react';

export default function DepartmentRequestsDepartments({
    departments = [],
    isAdmin = false,
    availableDepartments = [],
    handlers = [],
    users = [],
}) {
    const flash = usePage().props.flash ?? {};

    const addDepartmentForm = useForm({
        department_id: '',
        hint: '',
    });

    const createDepartmentForm = useForm({
        department_name: '',
        department_description: '',
        hint: '',
    });

    const addHandlerForm = useForm({
        department_id: '',
        user_id: '',
    });

    const [confirmState, setConfirmState] = useState({ open: false, description: '', onConfirm: null });

    const handlersByDepartment = useMemo(() => {
        const map = new Map();
        handlers.forEach((item) => {
            const list = map.get(item.department_id) ?? [];
            list.push(item);
            map.set(item.department_id, list);
        });
        return map;
    }, [handlers]);

    const addDepartment = (e) => {
        e.preventDefault();
        addDepartmentForm.post(route('dept-requests.departments.store'), {
            preserveScroll: true,
            onSuccess: () => addDepartmentForm.reset(),
        });
    };

    const addHandler = (e) => {
        e.preventDefault();
        addHandlerForm.post(route('dept-request-handlers.store'), {
            preserveScroll: true,
            onSuccess: () => addHandlerForm.reset(),
        });
    };

    const createDepartmentFromScratch = (e) => {
        e.preventDefault();
        createDepartmentForm.post(route('dept-requests.departments.store-new'), {
            preserveScroll: true,
            onSuccess: () => createDepartmentForm.reset(),
        });
    };

    const removeRecipientDepartment = (id) => {
        setConfirmState({
            open: true,
            description: 'Удалить отдел из получателей заявок? Все его назначения ответственных будут удалены.',
            onConfirm: () => router.delete(route('dept-requests.departments.destroy', id), { preserveScroll: true }),
        });
    };

    const removeHandler = (id) => {
        setConfirmState({
            open: true,
            description: 'Удалить назначение ответственного пользователя?',
            onConfirm: () => router.delete(route('dept-request-handlers.destroy', id), { preserveScroll: true }),
        });
    };

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-2xl font-semibold leading-tight text-gray-900">Отделы для заявок</h2>
                        <p className="mt-1 text-sm text-gray-500">
                            Список отделов, которые получают пользовательские заявки
                        </p>
                    </div>
                    <Link href={route('dept-requests.index')}>
                        <Button variant="outline" size="sm">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            К форме заявки
                        </Button>
                    </Link>
                </div>
            }
        >
            <Head title="Отделы для заявок" />

            <div className="admin-page-wrap space-y-6">
                {flash.success && (
                    <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                        {flash.success}
                    </div>
                )}
                {flash.error && (
                    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                        {flash.error}
                    </div>
                )}

                {!isAdmin && (
                    <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                        Отправка заявок доступна в отделы ниже. Управление списком отделов и ответственными доступно только администраторам.
                    </div>
                )}

                {isAdmin && (
                    <>
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Plus className="h-5 w-5" />
                                    Добавить отдел-получатель
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={addDepartment} className="grid gap-3 md:grid-cols-3">
                                    <div>
                                        <label className="mb-1 block text-sm font-medium">Отдел</label>
                                        <select
                                            className="w-full rounded-md border px-3 py-2 text-sm"
                                            value={addDepartmentForm.data.department_id}
                                            onChange={(e) => addDepartmentForm.setData('department_id', e.target.value)}
                                        >
                                            <option value="">— Выберите отдел —</option>
                                            {availableDepartments.map((department) => (
                                                <option key={department.id} value={department.id}>{department.name}</option>
                                            ))}
                                        </select>
                                        {addDepartmentForm.errors.department_id && (
                                            <p className="mt-1 text-xs text-red-600">{addDepartmentForm.errors.department_id}</p>
                                        )}
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="mb-1 block text-sm font-medium">Подсказка</label>
                                        <input
                                            className="w-full rounded-md border px-3 py-2 text-sm"
                                            placeholder="Например: баги на сайте, разработка, интеграции"
                                            value={addDepartmentForm.data.hint}
                                            onChange={(e) => addDepartmentForm.setData('hint', e.target.value)}
                                        />
                                        {addDepartmentForm.errors.hint && (
                                            <p className="mt-1 text-xs text-red-600">{addDepartmentForm.errors.hint}</p>
                                        )}
                                    </div>

                                    <div className="md:col-span-3">
                                        <Button type="submit" disabled={addDepartmentForm.processing}>
                                            <Plus className="mr-2 h-4 w-4" />
                                            Добавить отдел
                                        </Button>
                                    </div>
                                </form>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Plus className="h-5 w-5" />
                                    Создать отдел с нуля
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={createDepartmentFromScratch} className="grid gap-3 md:grid-cols-2">
                                    <div>
                                        <label className="mb-1 block text-sm font-medium">Название отдела</label>
                                        <input
                                            className="w-full rounded-md border px-3 py-2 text-sm"
                                            placeholder="Например: Центр цифровых продуктов"
                                            value={createDepartmentForm.data.department_name}
                                            onChange={(e) => createDepartmentForm.setData('department_name', e.target.value)}
                                        />
                                        {createDepartmentForm.errors.department_name && (
                                            <p className="mt-1 text-xs text-red-600">{createDepartmentForm.errors.department_name}</p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="mb-1 block text-sm font-medium">Подсказка для пользователей</label>
                                        <input
                                            className="w-full rounded-md border px-3 py-2 text-sm"
                                            placeholder="Например: интеграции, API, портал"
                                            value={createDepartmentForm.data.hint}
                                            onChange={(e) => createDepartmentForm.setData('hint', e.target.value)}
                                        />
                                        {createDepartmentForm.errors.hint && (
                                            <p className="mt-1 text-xs text-red-600">{createDepartmentForm.errors.hint}</p>
                                        )}
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="mb-1 block text-sm font-medium">Описание отдела (опционально)</label>
                                        <textarea
                                            className="min-h-20 w-full rounded-md border px-3 py-2 text-sm"
                                            placeholder="Короткое описание роли отдела"
                                            value={createDepartmentForm.data.department_description}
                                            onChange={(e) => createDepartmentForm.setData('department_description', e.target.value)}
                                        />
                                        {createDepartmentForm.errors.department_description && (
                                            <p className="mt-1 text-xs text-red-600">{createDepartmentForm.errors.department_description}</p>
                                        )}
                                    </div>

                                    <div className="md:col-span-2">
                                        <Button type="submit" disabled={createDepartmentForm.processing}>
                                            <Plus className="mr-2 h-4 w-4" />
                                            Создать отдел и добавить в получатели
                                        </Button>
                                    </div>
                                </form>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Users className="h-5 w-5" />
                                    Привязать ответственного пользователя
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={addHandler} className="flex flex-wrap gap-3">
                                    <select
                                        className="min-w-56 flex-1 rounded-md border px-3 py-2 text-sm"
                                        value={addHandlerForm.data.department_id}
                                        onChange={(e) => addHandlerForm.setData('department_id', e.target.value)}
                                    >
                                        <option value="">— Отдел-получатель —</option>
                                        {departments.map((department) => (
                                            <option key={department.department_id} value={department.department_id}>
                                                {department.name}
                                            </option>
                                        ))}
                                    </select>

                                    <select
                                        className="min-w-56 flex-1 rounded-md border px-3 py-2 text-sm"
                                        value={addHandlerForm.data.user_id}
                                        onChange={(e) => addHandlerForm.setData('user_id', e.target.value)}
                                    >
                                        <option value="">— Пользователь —</option>
                                        {users.map((user) => (
                                            <option key={user.id} value={user.id}>{user.name} ({user.email})</option>
                                        ))}
                                    </select>

                                    <Button type="submit" disabled={addHandlerForm.processing}>
                                        Назначить
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    </>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                    {departments.map((department) => {
                        const assignedHandlers = handlersByDepartment.get(department.department_id) ?? [];
                        return (
                            <Card key={department.id}>
                                <CardHeader>
                                    <CardTitle className="flex items-start justify-between gap-2 text-base">
                                        <span className="inline-flex items-center gap-2">
                                            <Building2 className="h-5 w-5" />
                                            {department.name}
                                        </span>
                                        {isAdmin && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                                onClick={() => removeRecipientDepartment(department.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="rounded-md bg-muted/50 px-3 py-2 text-sm leading-relaxed text-muted-foreground">
                                        <span className="inline-flex items-center gap-1 font-medium text-foreground">
                                            <Info className="h-4 w-4" />
                                            Подсказка:
                                        </span>
                                        <p className="mt-1">{department.hint || 'Подсказка не указана.'}</p>
                                    </div>

                                    <div>
                                        <p className="mb-2 text-xs font-medium text-muted-foreground">Ответственные:</p>
                                        {assignedHandlers.length === 0 ? (
                                            <Badge variant="outline" className="text-xs">Не назначены</Badge>
                                        ) : (
                                            <div className="space-y-2">
                                                {assignedHandlers.map((handler) => (
                                                    <div key={handler.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                                                        <div className="min-w-0">
                                                            <p className="truncate text-sm font-medium">{handler.user}</p>
                                                            <p className="truncate text-xs text-muted-foreground">{handler.email}</p>
                                                        </div>
                                                        {isAdmin && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                                                onClick={() => removeHandler(handler.id)}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </div>

            <ConfirmDialog
                open={confirmState.open}
                onOpenChange={(open) => !open && setConfirmState({ open: false, description: '', onConfirm: null })}
                description={confirmState.description}
                confirmLabel="Удалить"
                onConfirm={() => {
                    confirmState.onConfirm?.();
                    setConfirmState({ open: false, description: '', onConfirm: null });
                }}
            />
        </AuthenticatedLayout>
    );
}
