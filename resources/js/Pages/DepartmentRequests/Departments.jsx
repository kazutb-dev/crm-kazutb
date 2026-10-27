import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState, FormField, Notice, PageHeader, SectionHeader, StatGrid, StatTile, qdFieldClass } from '@/components/platform';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { ArrowLeft, Building2, CirclePlus, Plus, Trash2, UserRoundX, Users } from 'lucide-react';
import { useMemo, useState } from 'react';

function FieldError({ message }) {
    return message ? <p className="mt-1.5 text-xs text-red-700">{message}</p> : null;
}

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

    const withoutHandlers = departments.filter((department) => (handlersByDepartment.get(department.department_id) ?? []).length === 0).length;

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
            header={(
                <PageHeader
                    eyebrow="Обращения"
                    title="Отделы для заявок"
                    description="Список отделов, которые получают пользовательские заявки, и ответственные за их обработку."
                    actions={(
                        <Button variant="outline" asChild>
                            <Link href={route('dept-requests.index')}>
                                <ArrowLeft />
                                К форме заявки
                            </Link>
                        </Button>
                    )}
                />
            )}
        >
            <Head title="Отделы для заявок" />

            <div className="admin-page-wrap space-y-6">
                {flash.success && <Notice tone="success">{flash.success}</Notice>}
                {flash.error && <Notice tone="danger">{flash.error}</Notice>}

                {!isAdmin && (
                    <Notice tone="info">
                        Отправка заявок доступна в отделы ниже. Управление списком отделов и ответственными доступно только администраторам.
                    </Notice>
                )}

                <StatGrid>
                    <StatTile label="Отделов-получателей" value={departments.length} icon={Building2} tone="teal" hint="Доступны в форме заявки" />
                    <StatTile label="Назначений ответственных" value={handlers.length} icon={Users} tone="navy" hint="Пользователи, обрабатывающие заявки" />
                    <StatTile
                        label="Без ответственных"
                        value={withoutHandlers}
                        icon={UserRoundX}
                        tone={withoutHandlers > 0 ? 'warning' : 'success'}
                        hint={withoutHandlers > 0 ? 'Заявки в эти отделы некому обработать' : 'У каждого отдела есть ответственный'}
                    />
                </StatGrid>

                <section>
                    <SectionHeader title="Отделы-получатели" description="Подсказки видят пользователи при выборе отдела в форме заявки." />
                    {departments.length === 0 ? (
                        <EmptyState
                            title="Отделов-получателей пока нет"
                            description={isAdmin ? 'Добавьте существующий отдел или создайте новый в блоке «Управление» ниже.' : 'Администратор ещё не настроил отделы для заявок.'}
                        />
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 [&>*]:min-w-0">
                            {departments.map((department) => {
                                const assignedHandlers = handlersByDepartment.get(department.department_id) ?? [];
                                return (
                                    <Card key={department.id}>
                                        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                                            <CardTitle className="flex items-center gap-2">
                                                <Building2 className="shrink-0" />
                                                {department.name}
                                            </CardTitle>
                                            {isAdmin && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-red-700 hover:bg-red-50"
                                                    title="Удалить из получателей"
                                                    aria-label="Удалить из получателей"
                                                    onClick={() => removeRecipientDepartment(department.id)}
                                                >
                                                    <Trash2 />
                                                </Button>
                                            )}
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="border-b border-slate-200 pb-3">
                                                <span className="qd-field-label text-slate-500">Подсказка</span>
                                                <p className="mt-1 text-sm leading-relaxed text-slate-700">{department.hint || 'Подсказка не указана.'}</p>
                                            </div>

                                            <div>
                                                <span className="qd-field-label text-slate-500">Ответственные</span>
                                                {assignedHandlers.length === 0 ? (
                                                    <div className="mt-2"><Badge variant="warning">Не назначены</Badge></div>
                                                ) : (
                                                    <div className="mt-1 divide-y divide-slate-200">
                                                        {assignedHandlers.map((handler) => (
                                                            <div key={handler.id} className="flex items-center justify-between gap-2 py-2">
                                                                <div className="min-w-0">
                                                                    <p className="truncate text-sm font-medium text-slate-900">{handler.user}</p>
                                                                    <p className="truncate text-xs text-slate-500">{handler.email}</p>
                                                                </div>
                                                                {isAdmin && (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="text-red-700 hover:bg-red-50"
                                                                        title="Снять ответственного"
                                                                        aria-label="Снять ответственного"
                                                                        onClick={() => removeHandler(handler.id)}
                                                                    >
                                                                        <Trash2 />
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
                    )}
                </section>

                {isAdmin && (
                    <section className="space-y-4">
                        <SectionHeader title="Управление" description="Доступно только администраторам." compact />

                        <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Plus className="shrink-0" />
                                        Добавить отдел-получатель
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <form onSubmit={addDepartment} className="space-y-4">
                                        <div>
                                            <FormField label="Отдел">
                                                <select
                                                    className={qdFieldClass}
                                                    value={addDepartmentForm.data.department_id}
                                                    onChange={(e) => addDepartmentForm.setData('department_id', e.target.value)}
                                                >
                                                    <option value="">— Выберите отдел —</option>
                                                    {availableDepartments.map((department) => (
                                                        <option key={department.id} value={department.id}>{department.name}</option>
                                                    ))}
                                                </select>
                                            </FormField>
                                            <FieldError message={addDepartmentForm.errors.department_id} />
                                        </div>

                                        <div>
                                            <FormField label="Подсказка">
                                                <Input
                                                    placeholder="Например: баги на сайте, разработка, интеграции"
                                                    value={addDepartmentForm.data.hint}
                                                    onChange={(e) => addDepartmentForm.setData('hint', e.target.value)}
                                                />
                                            </FormField>
                                            <FieldError message={addDepartmentForm.errors.hint} />
                                        </div>

                                        <div className="flex justify-end border-t border-slate-200 pt-4">
                                            <Button type="submit" disabled={addDepartmentForm.processing}>
                                                <Plus />
                                                Добавить отдел
                                            </Button>
                                        </div>
                                    </form>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <CirclePlus className="shrink-0" />
                                        Создать отдел с нуля
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <form onSubmit={createDepartmentFromScratch} className="space-y-4">
                                        <div className="grid gap-4 md:grid-cols-2 [&>*]:min-w-0">
                                            <div>
                                                <FormField label="Название отдела">
                                                    <Input
                                                        placeholder="Например: Центр цифровых продуктов"
                                                        value={createDepartmentForm.data.department_name}
                                                        onChange={(e) => createDepartmentForm.setData('department_name', e.target.value)}
                                                    />
                                                </FormField>
                                                <FieldError message={createDepartmentForm.errors.department_name} />
                                            </div>

                                            <div>
                                                <FormField label="Подсказка для пользователей">
                                                    <Input
                                                        placeholder="Например: интеграции, API, портал"
                                                        value={createDepartmentForm.data.hint}
                                                        onChange={(e) => createDepartmentForm.setData('hint', e.target.value)}
                                                    />
                                                </FormField>
                                                <FieldError message={createDepartmentForm.errors.hint} />
                                            </div>
                                        </div>

                                        <div>
                                            <FormField label="Описание отдела (опционально)">
                                                <Textarea
                                                    className="min-h-20"
                                                    placeholder="Короткое описание роли отдела"
                                                    value={createDepartmentForm.data.department_description}
                                                    onChange={(e) => createDepartmentForm.setData('department_description', e.target.value)}
                                                />
                                            </FormField>
                                            <FieldError message={createDepartmentForm.errors.department_description} />
                                        </div>

                                        <div className="flex justify-end border-t border-slate-200 pt-4">
                                            <Button type="submit" disabled={createDepartmentForm.processing} className="h-auto min-h-10 whitespace-normal text-center">
                                                <Plus />
                                                Создать отдел и добавить в получатели
                                            </Button>
                                        </div>
                                    </form>
                                </CardContent>
                            </Card>
                        </div>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Users className="shrink-0" />
                                    Привязать ответственного пользователя
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={addHandler} className="grid items-end gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] [&>*]:min-w-0">
                                    <FormField label="Отдел-получатель">
                                        <select
                                            className={qdFieldClass}
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
                                    </FormField>

                                    <FormField label="Пользователь">
                                        <select
                                            className={qdFieldClass}
                                            value={addHandlerForm.data.user_id}
                                            onChange={(e) => addHandlerForm.setData('user_id', e.target.value)}
                                        >
                                            <option value="">— Пользователь —</option>
                                            {users.map((user) => (
                                                <option key={user.id} value={user.id}>{user.name} ({user.email})</option>
                                            ))}
                                        </select>
                                    </FormField>

                                    <Button type="submit" disabled={addHandlerForm.processing}>
                                        Назначить
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    </section>
                )}
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
