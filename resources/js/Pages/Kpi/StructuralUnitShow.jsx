import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { formatStructuralUnitLabel } from '@/utils/kpi-structure-label';

const entityLabels = {
    teacher: 'ППС',
    department_head: 'Зав. кафедрой',
    dean: 'Декан',
    structural_division: 'Структурное подразделение',
};

export default function StructuralUnitShow() {
    const { unit, staffOptions = [], unassignedStaffOptions = [], availableRecords = [] } = usePage().props;
    const addForm = useForm({ user_id: '' });

    const submitAddEmployee = (event) => {
        event.preventDefault();

        addForm.post(route('kpi.structural-units.users.attach', unit.id), {
            preserveScroll: true,
            onSuccess: () => addForm.reset(),
        });
    };

    const quickAddEmployee = (userId) => {
        router.post(route('kpi.structural-units.users.attach', unit.id), {
            user_id: userId,
        }, {
            preserveScroll: true,
            onSuccess: () => addForm.reset(),
        });
    };

    const removeEmployee = (userId) => {
        router.delete(route('kpi.structural-units.users.detach', [unit.id, userId]), {
            preserveScroll: true,
        });
    };

    const removeRecord = (record) => {
        const confirmed = window.confirm('Отвязать эту запись от структурного подразделения?');
        if (!confirmed) {
            return;
        }

        router.delete(route('kpi.structural-units.records.detach', [unit.id, record.id]), {
            preserveScroll: true,
        });
    };

    const attachRecord = (record) => {
        router.post(route('kpi.structural-units.records.attach', unit.id), {
            indicator_id: record.id,
        }, {
            preserveScroll: true,
        });
    };

    return (
        <AuthenticatedLayout>
            <Head title={`Структура ${formatStructuralUnitLabel(unit)}`} />

            <div className="space-y-4 p-4 sm:p-6 lg:p-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-3xl font-bold">{formatStructuralUnitLabel(unit)}</h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Код: {unit.code}
                        </p>
                    </div>
                    <Button asChild variant="outline">
                        <Link href={route('kpi.structural-units.index')}>Назад к списку</Link>
                    </Button>
                </div>

                <Card className="border-border/80 bg-white/90 shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base text-[#132844]">Информация о подразделении</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">
                            {unit.description || 'Описание отсутствует'}
                        </p>
                    </CardContent>
                </Card>

                <div className="grid gap-4 lg:grid-cols-2">
                    <Card className="border-border/80 bg-white/90 shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center justify-between text-base text-[#132844]">
                                <span>Ответственные сотрудники</span>
                                <Badge variant="outline">{unit.users?.length || 0}</Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form className="mb-4 flex flex-col gap-2 sm:flex-row" onSubmit={submitAddEmployee}>
                                <select
                                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
                                    value={addForm.data.user_id}
                                    onChange={(event) => addForm.setData('user_id', event.target.value)}
                                >
                                    <option value="">Выберите сотрудника</option>
                                    {staffOptions.map((user) => (
                                        <option key={user.id} value={user.id}>
                                            {user.name}{user.email ? ` (${user.email})` : ''}
                                        </option>
                                    ))}
                                </select>
                                <Button type="submit" disabled={addForm.processing || !addForm.data.user_id}>
                                    Добавить
                                </Button>
                            </form>
                            {addForm.errors.user_id && (
                                <p className="mb-3 text-sm text-destructive">{addForm.errors.user_id}</p>
                            )}

                            {Array.isArray(unassignedStaffOptions) && unassignedStaffOptions.length > 0 && (
                                <div className="mb-4 rounded-md border border-dashed border-border/70 bg-muted/20 p-3">
                                    <div className="mb-2 flex items-center justify-between gap-2">
                                        <p className="text-sm font-medium text-foreground">Без структурного подразделения</p>
                                        <Badge variant="outline">{unassignedStaffOptions.length}</Badge>
                                    </div>
                                    <div className="flex max-h-56 flex-col gap-2 overflow-y-auto">
                                        {unassignedStaffOptions.map((user) => (
                                            <div key={user.id} className="flex items-center justify-between gap-2 rounded-md bg-background px-3 py-2 text-sm">
                                                <div className="min-w-0">
                                                    <p className="truncate font-medium text-foreground">{user.name}</p>
                                                    <p className="truncate text-xs text-muted-foreground">
                                                        {user.role_label || 'Без роли'}{user.email ? ` · ${user.email}` : ''}
                                                    </p>
                                                </div>
                                                <Button type="button" size="sm" variant="outline" onClick={() => quickAddEmployee(user.id)}>
                                                    Добавить
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {Array.isArray(unit.users) && unit.users.length > 0 ? (
                                <div className="space-y-2">
                                    {unit.users.map((user) => (
                                        <div
                                            key={user.id}
                                            className="flex items-start justify-between gap-3 rounded-md border border-border/60 bg-background p-3"
                                        >
                                            <div>
                                                <p className="text-sm font-medium text-foreground">{user.name}</p>
                                                <p className="text-xs text-muted-foreground">{user.role_label || 'Без роли'}</p>
                                                <p className="text-xs text-muted-foreground">{user.email || 'Email не указан'}</p>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => removeEmployee(user.id)}
                                            >
                                                Убрать
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">Сотрудники не привязаны к этому подразделению.</p>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-border/80 bg-white/90 shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center justify-between text-base text-[#132844]">
                                <span>Привязанные записи</span>
                                <Badge variant="secondary">{unit.records?.length || 0}</Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {Array.isArray(unit.records) && unit.records.length > 0 ? (
                                <div className="space-y-2">
                                    {unit.records.map((record) => (
                                        <div
                                            key={record.id}
                                            className="flex items-start justify-between gap-3 rounded-md border border-border/60 bg-background p-3"
                                        >
                                            <div>
                                                <p className="text-sm font-semibold text-foreground">
                                                    {formatStructuralUnitLabel(record)}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    Тип: {entityLabels[record.entity_type] || record.entity_type || 'Не указан'}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    Привязка: {record.source === 'direct' ? 'прямая' : 'через список'}
                                                </p>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => removeRecord(record)}
                                            >
                                                Убрать
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">Записи не привязаны к этому подразделению.</p>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <Card className="border-border/80 bg-white/90 shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center justify-between text-base text-[#132844]">
                            <span>Записи без структурного подразделения</span>
                            <Badge variant="outline">{availableRecords.length}</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {Array.isArray(availableRecords) && availableRecords.length > 0 ? (
                            <div className="space-y-2">
                                {availableRecords.map((record) => (
                                    <div
                                        key={record.id}
                                        className="flex items-start justify-between gap-3 rounded-md border border-dashed border-border/70 bg-background p-3"
                                    >
                                        <div>
                                            <p className="text-sm font-semibold text-foreground">
                                                {formatStructuralUnitLabel(record)}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                Тип: {entityLabels[record.entity_type] || record.entity_type || 'Не указан'}
                                            </p>
                                        </div>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => attachRecord(record)}
                                        >
                                            Привязать
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">Свободных записей без подразделения нет.</p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}
