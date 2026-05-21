import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import { formatStructuralUnitLabel } from '@/utils/kpi-structure-label';

const entityLabels = {
    teacher: 'ППС',
    department_head: 'Зав. кафедрой',
    dean: 'Декан',
    structural_division: 'Структурное подразделение',
};

function employeeSearchText(user) {
    return [
        user?.name,
        user?.email,
        user?.role_label,
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
}

export default function StructuralUnitShow() {
    const { unit, unassignedStaffOptions = [], availableRecords = [] } = usePage().props;
    const [employeeSearch, setEmployeeSearch] = useState('');

    const normalizedEmployeeSearch = employeeSearch.trim().toLowerCase();

    const filteredUnassignedStaffOptions = useMemo(() => {
        if (!normalizedEmployeeSearch) {
            return unassignedStaffOptions;
        }

        return unassignedStaffOptions.filter((user) => employeeSearchText(user).includes(normalizedEmployeeSearch));
    }, [unassignedStaffOptions, normalizedEmployeeSearch]);

    const filteredUnitUsers = useMemo(() => {
        const users = Array.isArray(unit.users) ? unit.users : [];

        if (!normalizedEmployeeSearch) {
            return users;
        }

        return users.filter((user) => employeeSearchText(user).includes(normalizedEmployeeSearch));
    }, [unit.users, normalizedEmployeeSearch]);

    const quickAddEmployee = (userId) => {
        router.post(route('kpi.structural-units.users.attach', unit.id), {
            user_id: userId,
        }, {
            preserveScroll: true,
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
                            <div className="mb-3">
                                <Input
                                    value={employeeSearch}
                                    onChange={(event) => setEmployeeSearch(event.target.value)}
                                    placeholder="Поиск по сотрудникам (ФИО, email, роль)"
                                    className="h-9"
                                    aria-label="Поиск по ответственным сотрудникам"
                                />
                            </div>

                            {Array.isArray(unassignedStaffOptions) && unassignedStaffOptions.length > 0 && (
                                <div className="mb-4 rounded-md border border-dashed border-border/70 bg-muted/20 p-3">
                                    <div className="mb-2 flex items-center justify-between gap-2">
                                        <p className="text-sm font-medium text-foreground">Без структурного подразделения</p>
                                        <Badge variant="outline">{filteredUnassignedStaffOptions.length}</Badge>
                                    </div>
                                    <div className="flex max-h-56 flex-col gap-2 overflow-y-auto">
                                        {filteredUnassignedStaffOptions.map((user) => (
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
                                        {filteredUnassignedStaffOptions.length === 0 && (
                                            <p className="rounded-md bg-background px-3 py-2 text-xs text-muted-foreground">
                                                Ничего не найдено по текущему запросу.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {Array.isArray(unit.users) && unit.users.length > 0 ? (
                                <div className="space-y-2">
                                    {filteredUnitUsers.map((user) => (
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
                                    {filteredUnitUsers.length === 0 && (
                                        <p className="text-sm text-muted-foreground">По запросу сотрудники не найдены.</p>
                                    )}
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
