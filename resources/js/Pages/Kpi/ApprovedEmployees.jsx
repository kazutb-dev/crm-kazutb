import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
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

    return (
        <AuthenticatedLayout>
            <Head title="KPI — Прошедшие полную проверку" />

            <div className="admin-page-wrap">
                {/* Заголовок */}
                <Card className="border-0 bg-gradient-to-r from-emerald-50 via-white to-teal-50 shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-xl">
                            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                            KPI — Сотрудники, прошедшие полную проверку
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 lg:grid-cols-[2fr_1fr]">
                        <p className="text-sm text-muted-foreground">
                            Список сотрудников, у которых есть KPI-записи со статусом «Утверждено» (прошли все этапы проверки).
                            Используйте фильтры для отображения по категории, учебному году и периоду.
                        </p>
                        <div className="rounded-xl border bg-white/80 p-4 shadow-sm text-center">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Сотрудников</p>
                            <p className="mt-2 text-3xl font-bold text-emerald-600">{employees.length}</p>
                        </div>
                    </CardContent>
                </Card>

                {/* Фильтры */}
                <Card>
                    <CardContent className="pt-6 space-y-4">
                        {/* Вкладки по типу */}
                        <div className="flex flex-wrap gap-2">
                            {entityTypes.map((et) => (
                                <Button
                                    key={et.value}
                                    size="sm"
                                    variant={filters.entity_type === et.value ? 'default' : 'outline'}
                                    onClick={() => applyFilter({ entity_type: et.value, search: '' })}
                                >
                                    {et.label}
                                </Button>
                            ))}
                        </div>

                        {/* Год + период + поиск */}
                        <div className="flex flex-wrap gap-3">
                            <select
                                className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm"
                                value={filters.academic_year_id ?? ''}
                                onChange={(e) => applyFilter({ academic_year_id: e.target.value || undefined, period_id: undefined })}
                            >
                                <option value="">Все учебные годы</option>
                                {academicYears.map((y) => (
                                    <option key={y.id} value={y.id}>{y.name}</option>
                                ))}
                            </select>

                            <select
                                className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm"
                                value={filters.period_id ?? ''}
                                onChange={(e) => applyFilter({ period_id: e.target.value || undefined })}
                            >
                                <option value="">Все периоды</option>
                                {periods.map((p) => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>

                            <form onSubmit={handleSearch} className="flex gap-2">
                                <div className="relative">
                                    <Input
                                        ref={searchRef}
                                        type="text"
                                        placeholder="Поиск по имени, email, кафедре..."
                                        defaultValue={filters.search ?? ''}
                                        className="w-64 pr-8"
                                    />
                                    <Search className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                                </div>
                                <Button type="submit" size="sm" variant="outline">Найти</Button>
                            </form>
                        </div>
                    </CardContent>
                </Card>

                {/* Таблица */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            {entityTypeLabels[filters.entity_type] ?? 'Сотрудники'}: {employees.length} чел.
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {employees.length === 0 ? (
                            <div className="py-12 text-center text-muted-foreground">
                                <CheckCircle2 className="mx-auto mb-3 h-10 w-10 opacity-30" />
                                <p>Нет сотрудников с утверждёнными KPI-записями по выбранным фильтрам</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="border-b bg-muted/50">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-semibold">#</th>
                                            <th className="px-4 py-3 text-left font-semibold">Сотрудник</th>
                                            <th className="px-4 py-3 text-left font-semibold">Кафедра / Факультет</th>
                                            <th className="px-4 py-3 text-center font-semibold">Утверждённых записей</th>
                                            <th className="px-4 py-3 text-center font-semibold">Итого баллов</th>
                                            <th className="px-4 py-3 text-center font-semibold">Последнее утверждение</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {employees.map((emp, index) => (
                                            <tr key={`${emp.user_id}-${emp.kpi_period_id}`} className="border-b hover:bg-muted/30 transition-colors">
                                                <td className="px-4 py-3 text-muted-foreground">{index + 1}</td>
                                                <td className="px-4 py-3">
                                                    <div className="font-medium">{emp.name}</div>
                                                    <div className="text-xs text-muted-foreground">{emp.email}</div>
                                                    {emp.ad_title && (
                                                        <div className="text-xs text-muted-foreground">{emp.ad_title}</div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-muted-foreground">
                                                    {emp.department ?? emp.faculty ?? emp.ad_department ?? '—'}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <Badge variant="secondary">{emp.approved_count}</Badge>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className="font-semibold text-emerald-700">
                                                        {Number(emp.total_points).toFixed(2)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center text-muted-foreground text-xs">
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
