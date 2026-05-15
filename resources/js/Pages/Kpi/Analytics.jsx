import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { BarChart3, Building2, Download, FileText, GraduationCap, Users } from 'lucide-react';

const entityLabels = {
    teacher: 'Преподаватели',
    department_head: 'Заведующие кафедрой',
    dean: 'Деканы',
};

function score(value) {
    const parsed = Number(value ?? 0);

    return Number.isFinite(parsed) ? parsed.toFixed(2) : '0.00';
}

function RankingTable({ title, icon: Icon, rows, emptyMessage }) {
    return (
        <Card className="admin-surface">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <Icon className="h-4 w-4" />
                    {title}
                </CardTitle>
            </CardHeader>
            <CardContent>
                {rows.length === 0 ? (
                    <div className="admin-empty-state">{emptyMessage}</div>
                ) : (
                    <div className="admin-table-wrap">
                        <table className="admin-data-table min-w-[520px]">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Название</th>
                                    <th>Утверждено</th>
                                    <th>Итоговый балл</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, index) => (
                                    <tr key={row.id}>
                                        <td className="py-3 pe-3">{index + 1}</td>
                                        <td className="py-3 pe-3 font-medium">{row.entity_name}</td>
                                        <td className="py-3 pe-3">{row.approved_entries_count}</td>
                                        <td className="py-3 pe-3 font-semibold">{score(row.total_score)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default function Analytics({
    widgets = {},
    rankings = {},
    filters = {},
    filterOptions = {},
    aggregationExamples = {},
}) {
    const { flash } = usePage().props;
    const teachers = rankings.teachers ?? [];
    const departments = rankings.departments ?? [];
    const faculties = rankings.faculties ?? [];

    const form = useForm({
        academic_year_id: filters.academic_year_id ? String(filters.academic_year_id) : '',
        period_id: filters.period_id ? String(filters.period_id) : '',
        entity_type: filters.entity_type ?? '',
    });

    const applyFilters = (event) => {
        event.preventDefault();

        router.get(route('kpi.analytics.index'), {
            academic_year_id: form.data.academic_year_id || undefined,
            period_id: form.data.period_id || undefined,
            entity_type: form.data.entity_type || undefined,
        }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const resetFilters = () => {
        form.setData({ academic_year_id: '', period_id: '', entity_type: '' });

        router.get(route('kpi.analytics.index'), {}, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const exportReport = (routeName) => {
        router.post(route(routeName), {
            ...form.data,
        }, {
            preserveScroll: true,
        });
    };

    return (
        <AuthenticatedLayout>
            <Head title="KPI Аналитика" />

            <div className="admin-page-wrap">
                <Card className="admin-surface border-0 bg-gradient-to-r from-sky-50 via-white to-emerald-50 shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-xl">
                            <BarChart3 className="h-5 w-5" />
                            KPI аналитика и рейтинги
                        </CardTitle>
                        <CardDescription>
                            Режим только просмотра для superadmin. Данные ранжируются по `total_score DESC` на основе `kpi_results`.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-xl border bg-white/80 p-4 shadow-sm">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Всего записей</p>
                            <p className="mt-2 text-2xl font-semibold">{widgets.total_entries ?? 0}</p>
                        </div>
                        <div className="rounded-xl border bg-white/80 p-4 shadow-sm">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Черновик</p>
                            <p className="mt-2 text-2xl font-semibold">{widgets.draft ?? 0}</p>
                        </div>
                        <div className="rounded-xl border bg-white/80 p-4 shadow-sm">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Отправлено</p>
                            <p className="mt-2 text-2xl font-semibold">{widgets.submitted ?? 0}</p>
                        </div>
                        <div className="rounded-xl border bg-white/80 p-4 shadow-sm">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Утверждено</p>
                            <p className="mt-2 text-2xl font-semibold">{widgets.approved ?? 0}</p>
                        </div>
                    </CardContent>
                </Card>

                {flash?.success && (
                    <Card className="border-l-4 border-l-emerald-600">
                        <CardContent className="pt-6 text-sm text-emerald-700">
                            {flash.success}
                        </CardContent>
                    </Card>
                )}

                <Card className="admin-surface">
                    <CardHeader>
                        <CardTitle className="text-base">Фильтры</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form className="space-y-4" onSubmit={applyFilters}>
                            <div className="grid gap-4 md:grid-cols-3">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Учебный год</label>
                                    <select
                                        className="h-9 w-full rounded-md border border-input bg-background/70 px-3 text-sm shadow-sm"
                                        value={form.data.academic_year_id}
                                        onChange={(event) => form.setData('academic_year_id', event.target.value)}
                                    >
                                        <option value="">Все</option>
                                        {(filterOptions.academicYears ?? []).map((year) => (
                                            <option key={year.id} value={year.id}>{year.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Период</label>
                                    <select
                                        className="h-9 w-full rounded-md border border-input bg-background/70 px-3 text-sm shadow-sm"
                                        value={form.data.period_id}
                                        onChange={(event) => form.setData('period_id', event.target.value)}
                                    >
                                        <option value="">Все</option>
                                        {(filterOptions.periods ?? []).map((period) => (
                                            <option key={period.id} value={period.id}>{period.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Уровень</label>
                                    <select
                                        className="h-9 w-full rounded-md border border-input bg-background/70 px-3 text-sm shadow-sm"
                                        value={form.data.entity_type}
                                        onChange={(event) => form.setData('entity_type', event.target.value)}
                                    >
                                        <option value="">Все</option>
                                        {(filterOptions.entityTypes ?? []).map((item) => (
                                            <option key={item} value={item}>{entityLabels[item] ?? item}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <Button type="submit">Применить</Button>
                                <Button type="button" variant="outline" onClick={resetFilters}>Сбросить</Button>
                                <Button type="button" variant="outline" onClick={() => exportReport('kpi.analytics.export-excel')}>
                                    <Download className="h-4 w-4" />
                                    Excel
                                </Button>
                                <Button type="button" variant="outline" onClick={() => exportReport('kpi.analytics.export-pdf')}>
                                    <FileText className="h-4 w-4" />
                                    PDF
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                <div className="grid gap-6 xl:grid-cols-3">
                    <RankingTable
                        title="Топ-10 ППС"
                        icon={Users}
                        rows={teachers}
                        emptyMessage="Данные рейтинга ППС отсутствуют для выбранных фильтров."
                    />
                    <RankingTable
                        title="Топ кафедр"
                        icon={Building2}
                        rows={departments}
                        emptyMessage="Данные рейтинга кафедр отсутствуют для выбранных фильтров."
                    />
                    <RankingTable
                        title="Топ факультетов"
                        icon={GraduationCap}
                        rows={faculties}
                        emptyMessage="Данные рейтинга факультетов отсутствуют для выбранных фильтров."
                    />
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Примеры агрегации</CardTitle>
                        <CardDescription>
                            Пример Eloquent-агрегации и SQL-шаблон для секционных KPI-расчетов.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <p className="mb-2 text-sm font-medium">Результат Eloquent</p>
                            <div className="flex flex-wrap gap-2">
                                {(aggregationExamples.eloquent ?? []).map((item) => (
                                    <Badge key={item.section} variant="outline">
                                        {item.section}: {score(item.section_score)}
                                    </Badge>
                                ))}
                            </div>
                        </div>

                        <div>
                            <p className="mb-2 text-sm font-medium">SQL-шаблон</p>
                            <pre className="overflow-x-auto rounded-lg border bg-muted/30 p-3 text-xs">
                                {aggregationExamples.sql}
                            </pre>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}