import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { EmptyState, FilterBar, FormField, PageHeader, StatGrid, StatTile, UnderlineTabs, qdFieldClass } from '@/components/platform';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Head, router } from '@inertiajs/react';
import { CheckCircle2, Search, Users } from 'lucide-react';
import { useRef } from 'react';

const entityTypeLabels = {
    teacher: 'ППС',
    department_head: 'Заведующий кафедрой',
    dean: 'Декан',
};

function formatDate(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
}

export default function ApprovedEmployees({ employees = [], filters = {}, academicYears = [], periods = [] }) {
    const searchRef = useRef(null);

    const applyFilter = (changes) => {
        router.get(route('kpi.approved-employees'), { ...filters, ...changes }, {
            preserveState: true,
            replace: true,
        });
    };

    const handleSearch = (e) => {
        e.preventDefault();
        applyFilter({ search: searchRef.current?.value ?? '' });
    };

    const entityTypes = [
        { value: 'teacher', label: 'ППС' },
        { value: 'department_head', label: 'Зав. кафедрой' },
        { value: 'dean', label: 'Декан' },
    ];

    const approvedTotal = employees.reduce((sum, emp) => sum + (Number(emp.approved_count) || 0), 0);

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="KPI · Проверка"
                    title="Сотрудники, прошедшие полную проверку"
                    description="Список сотрудников, у которых есть KPI-записи со статусом «Утверждено» (прошли все этапы проверки). Используйте фильтры для отображения по категории, учебному году и периоду."
                />
            )}
        >
            <Head title="KPI — Прошедшие полную проверку" />

            <div className="admin-page-wrap space-y-6">
                <StatGrid className="xl:grid-cols-3">
                    <StatTile label="Сотрудников" value={employees.length} tone="success" icon={CheckCircle2} hint={entityTypeLabels[filters.entity_type] ?? 'Все категории'} />
                    <StatTile label="Утверждённых записей" value={approvedTotal} tone="teal" icon={Users} hint="Суммарно по списку" />
                </StatGrid>

                <UnderlineTabs
                    items={entityTypes.map((et) => ({ key: et.value, label: et.label }))}
                    value={filters.entity_type}
                    onChange={(key) => applyFilter({ entity_type: key, search: '' })}
                />

                <FilterBar>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_2fr]">
                        <FormField label="Учебный год">
                            <select
                                className={qdFieldClass}
                                value={filters.academic_year_id ?? ''}
                                onChange={(e) => applyFilter({ academic_year_id: e.target.value || undefined, period_id: undefined })}
                            >
                                <option value="">Все учебные годы</option>
                                {academicYears.map((y) => (
                                    <option key={y.id} value={y.id}>{y.name}</option>
                                ))}
                            </select>
                        </FormField>

                        <FormField label="Период">
                            <select
                                className={qdFieldClass}
                                value={filters.period_id ?? ''}
                                onChange={(e) => applyFilter({ period_id: e.target.value || undefined })}
                            >
                                <option value="">Все периоды</option>
                                {periods.map((p) => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </FormField>

                        <form onSubmit={handleSearch} className="space-y-2 md:col-span-2 xl:col-span-1">
                            <span className="qd-field-label block">Поиск</span>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <Input
                                        ref={searchRef}
                                        type="text"
                                        placeholder="Поиск по имени, email, кафедре..."
                                        defaultValue={filters.search ?? ''}
                                        className="pl-9"
                                    />
                                </div>
                                <Button type="submit">Найти</Button>
                            </div>
                        </form>
                    </div>
                </FilterBar>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            {entityTypeLabels[filters.entity_type] ?? 'Сотрудники'}: {employees.length} чел.
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {employees.length === 0 ? (
                            <div className="p-5">
                                <EmptyState
                                    title="Список пуст"
                                    description="Нет сотрудников с утверждёнными KPI-записями по выбранным фильтрам"
                                />
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="border-b border-slate-200">
                                        <tr>
                                            <th className="px-5 py-3 text-left">#</th>
                                            <th className="px-5 py-3 text-left">Сотрудник</th>
                                            <th className="px-5 py-3 text-left">Кафедра / Факультет</th>
                                            <th className="px-5 py-3 text-right">Утверждённых записей</th>
                                            <th className="px-5 py-3 text-right">Итого баллов</th>
                                            <th className="px-5 py-3 text-right">Последнее утверждение</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {employees.map((emp, index) => (
                                            <tr key={`${emp.user_id}-${emp.kpi_period_id}`} className="border-b border-slate-200 last:border-0 transition-colors hover:bg-slate-50">
                                                <td className="px-5 py-3 tabular-nums text-slate-500">{index + 1}</td>
                                                <td className="px-5 py-3">
                                                    <div className="font-medium text-slate-900">{emp.name}</div>
                                                    <div className="text-xs text-slate-500">{emp.email}</div>
                                                    {emp.ad_title && (
                                                        <div className="text-xs text-slate-500">{emp.ad_title}</div>
                                                    )}
                                                </td>
                                                <td className="px-5 py-3 text-slate-600">
                                                    {emp.department ?? emp.faculty ?? emp.ad_department ?? '—'}
                                                </td>
                                                <td className="px-5 py-3 text-right">
                                                    <Badge variant="secondary" className="tabular-nums">{emp.approved_count}</Badge>
                                                </td>
                                                <td className="px-5 py-3 text-right">
                                                    <span className="font-display text-base font-bold tabular-nums text-emerald-700">
                                                        {Number(emp.total_points).toFixed(2)}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3 text-right text-xs tabular-nums text-slate-500">
                                                    {formatDate(emp.last_approved_at)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}
