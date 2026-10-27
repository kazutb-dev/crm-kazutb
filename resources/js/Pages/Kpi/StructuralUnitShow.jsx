import { ConfirmDialog } from '@/components/ConfirmDialog';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Notice, PageHeader, StatGrid, StatTile, StatusBadge } from '@/components/platform';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { ArrowLeft, Link2, Plus, Search, Unlink, UserPlus, Users } from 'lucide-react';
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
        ...(Array.isArray(user?.structural_units)
            ? user.structural_units.flatMap((unit) => [unit?.code, unit?.name])
            : []),
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
}

function formatAttachedUnits(user) {
    if (!Array.isArray(user?.structural_units) || user.structural_units.length === 0) {
        return 'Без других структурных подразделений';
    }

    return user.structural_units
        .map((unit) => unit?.code ? `${unit.code} — ${unit.name}` : unit?.name)
        .filter(Boolean)
        .join(', ');
}

export default function StructuralUnitShow() {
    const { unit, unassignedStaffOptions = [], assignedElsewhereStaffOptions = [], availableRecords = [] } = usePage().props;
    const [confirmState, setConfirmState] = useState({ open: false, description: '', onConfirm: null });
    const [employeeSearch, setEmployeeSearch] = useState('');

    const normalizedEmployeeSearch = employeeSearch.trim().toLowerCase();

    const filteredUnassignedStaffOptions = useMemo(() => {
        if (!normalizedEmployeeSearch) {
            return unassignedStaffOptions;
        }

        return unassignedStaffOptions.filter((user) => employeeSearchText(user).includes(normalizedEmployeeSearch));
    }, [unassignedStaffOptions, normalizedEmployeeSearch]);

    const filteredAssignedElsewhereStaffOptions = useMemo(() => {
        if (!normalizedEmployeeSearch) {
            return assignedElsewhereStaffOptions;
        }

        return assignedElsewhereStaffOptions.filter((user) => employeeSearchText(user).includes(normalizedEmployeeSearch));
    }, [assignedElsewhereStaffOptions, normalizedEmployeeSearch]);

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
        setConfirmState({
            open: true,
            description: 'Отвязать эту запись от структурного подразделения?',
            onConfirm: () => router.delete(route('kpi.structural-units.records.detach', [unit.id, record.id]), { preserveScroll: true }),
        });
    };

    const attachRecord = (record) => {
        router.post(route('kpi.structural-units.records.attach', unit.id), {
            indicator_id: record.id,
        }, {
            preserveScroll: true,
        });
    };

    const renderCandidatePool = (title, list, filtered, showUnits) => (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                <span className="qd-field-label text-slate-600">{title}</span>
                <Badge variant="outline" className="tabular-nums">{filtered.length}</Badge>
            </div>
            <div className="max-h-56 overflow-y-auto">
                {filtered.map((user) => (
                    <div key={user.id} className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-2.5 text-sm last:border-0">
                        <div className="min-w-0">
                            <p className="truncate font-medium text-slate-900">{user.name}</p>
                            <p className="truncate text-xs text-slate-500">
                                {user.role_label || 'Без роли'}{user.email ? ` · ${user.email}` : ''}
                            </p>
                            {showUnits && (
                                <p className="truncate text-xs text-slate-500">
                                    Уже отвечает за: {formatAttachedUnits(user)}
                                </p>
                            )}
                        </div>
                        <Button type="button" size="sm" variant="outline" onClick={() => quickAddEmployee(user.id)}>
                            <Plus className="h-3.5 w-3.5" />
                            Добавить
                        </Button>
                    </div>
                ))}
                {filtered.length === 0 && (
                    <p className="px-4 py-3 text-xs text-slate-500">
                        Ничего не найдено по текущему запросу.
                    </p>
                )}
            </div>
        </div>
    );

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow={`KPI · Структура · ${unit.code}`}
                    title={formatStructuralUnitLabel(unit)}
                    description={unit.description || 'Описание отсутствует'}
                    meta={<StatusBadge tone="default">Код: {unit.code}</StatusBadge>}
                    actions={(
                        <Button asChild variant="outline">
                            <Link href={route('kpi.structural-units.index')}>
                                <ArrowLeft className="h-4 w-4" />
                                Назад к списку
                            </Link>
                        </Button>
                    )}
                />
            )}
        >
            <Head title={`Структура ${formatStructuralUnitLabel(unit)}`} />

            <div className="admin-page-wrap space-y-4">
                <StatGrid>
                    <StatTile label="Ответственные сотрудники" value={unit.users?.length || 0} tone="teal" icon={Users} />
                    <StatTile label="Привязанные записи" value={unit.records?.length || 0} tone="info" icon={Link2} />
                    <StatTile label="Записи без подразделения" value={availableRecords.length} tone="warning" icon={Unlink} />
                    <StatTile
                        label="Кандидаты"
                        value={unassignedStaffOptions.length + assignedElsewhereStaffOptions.length}
                        tone="navy"
                        icon={UserPlus}
                        hint={`Без СП: ${unassignedStaffOptions.length} · в других СП: ${assignedElsewhereStaffOptions.length}`}
                    />
                </StatGrid>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3 lg:items-start">
                    <Card>
                        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                            <CardTitle className="flex items-center gap-2"><Users className="h-4 w-4" />Ответственные сотрудники</CardTitle>
                            <Badge variant="outline" className="tabular-nums">{unit.users?.length || 0}</Badge>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <label className="block">
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <Input
                                        value={employeeSearch}
                                        onChange={(event) => setEmployeeSearch(event.target.value)}
                                        placeholder="Поиск по сотрудникам (ФИО, email, роль)"
                                        className="pl-9"
                                        aria-label="Поиск по ответственным сотрудникам"
                                    />
                                </div>
                            </label>

                            {(Array.isArray(unassignedStaffOptions) && unassignedStaffOptions.length > 0) &&
                                renderCandidatePool('Без структурного подразделения', unassignedStaffOptions, filteredUnassignedStaffOptions, false)}

                            {(Array.isArray(assignedElsewhereStaffOptions) && assignedElsewhereStaffOptions.length > 0) &&
                                renderCandidatePool('Уже привязаны к другим подразделениям', assignedElsewhereStaffOptions, filteredAssignedElsewhereStaffOptions, true)}

                            <div className="space-y-2">
                                <span className="qd-field-label block text-slate-500">Привязаны к подразделению</span>
                                {Array.isArray(unit.users) && unit.users.length > 0 ? (
                                    <div className="border-t border-slate-200">
                                        {filteredUnitUsers.map((user) => (
                                            <div
                                                key={user.id}
                                                className="flex items-center justify-between gap-3 border-b border-slate-200 py-2.5"
                                            >
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-slate-900">{user.name}</p>
                                                    <p className="text-xs text-slate-500">{user.role_label || 'Без роли'} · {user.email || 'Email не указан'}</p>
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => removeEmployee(user.id)}
                                                >
                                                    Убрать
                                                </Button>
                                            </div>
                                        ))}
                                        {filteredUnitUsers.length === 0 && (
                                            <p className="py-3 text-sm text-slate-500">По запросу сотрудники не найдены.</p>
                                        )}
                                    </div>
                                ) : (
                                    <Notice tone="info">Сотрудники не привязаны к этому подразделению.</Notice>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                            <CardTitle className="flex items-center gap-2"><Link2 className="h-4 w-4" />Привязанные записи</CardTitle>
                            <Badge variant="secondary" className="tabular-nums">{unit.records?.length || 0}</Badge>
                        </CardHeader>
                        <CardContent className={Array.isArray(unit.records) && unit.records.length > 0 ? 'p-0' : ''}>
                            {Array.isArray(unit.records) && unit.records.length > 0 ? (
                                <div>
                                    {unit.records.map((record) => (
                                        <div
                                            key={record.id}
                                            className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-2.5 last:border-0 sm:px-6"
                                        >
                                            <div className="min-w-0 space-y-1">
                                                <p className="text-sm font-semibold text-slate-900">
                                                    {formatStructuralUnitLabel(record)}
                                                </p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    <StatusBadge tone="info">
                                                        Тип: {entityLabels[record.entity_type] || record.entity_type || 'Не указан'}
                                                    </StatusBadge>
                                                    <StatusBadge tone={record.source === 'direct' ? 'success' : 'default'}>
                                                        Привязка: {record.source === 'direct' ? 'прямая' : 'через список'}
                                                    </StatusBadge>
                                                </div>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => removeRecord(record)}
                                            >
                                                Убрать
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <Notice tone="info">Записи не привязаны к этому подразделению.</Notice>
                            )}
                        </CardContent>
                    </Card>

                <Card className="lg:col-span-2 2xl:col-span-1">
                    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                        <CardTitle className="flex items-center gap-2"><Unlink className="h-4 w-4" />Записи без структурного подразделения</CardTitle>
                        <Badge variant="outline" className="tabular-nums">{availableRecords.length}</Badge>
                    </CardHeader>
                    <CardContent className={Array.isArray(availableRecords) && availableRecords.length > 0 ? 'p-0' : ''}>
                        {Array.isArray(availableRecords) && availableRecords.length > 0 ? (
                            <div>
                                {availableRecords.map((record) => (
                                    <div
                                        key={record.id}
                                        className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-2.5 last:border-0 sm:px-6"
                                    >
                                        <div className="min-w-0 space-y-0.5">
                                            <p className="text-sm font-semibold text-slate-900">
                                                {formatStructuralUnitLabel(record)}
                                            </p>
                                            <p className="text-xs text-slate-500">
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
                            <Notice tone="success">Свободных записей без подразделения нет.</Notice>
                        )}
                    </CardContent>
                </Card>
                </div>
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
