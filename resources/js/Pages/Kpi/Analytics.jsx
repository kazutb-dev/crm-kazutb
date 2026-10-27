import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { FilterBar, FormField, PageHeader, StatGrid, StatTile, qdFieldClass } from '@/components/platform';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Head, router, useForm } from '@inertiajs/react';
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
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    {title}
                </CardTitle>
            </CardHeader>
            <CardContent className={rows.length === 0 ? '' : 'p-0'}>
                {rows.length === 0 ? (
                    <p className="py-4 text-center text-sm text-slate-500">{emptyMessage}</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[420px] text-sm">
                            <thead className="border-b border-slate-200">
                                <tr>
                                    <th className="text-left">#</th>
                                    <th className="text-left">Название</th>
                                    <th className="text-right">Утверждено</th>
                                    <th className="text-right">Итоговый балл</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, index) => (
                                    <tr key={row.id} className="border-b border-slate-200 last:border-0 hover:bg-slate-50">
                                        <td>
                                            <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold tabular-nums ${index === 0 ? 'bg-amber-400 text-[#102945]' : 'bg-slate-100 text-slate-600'}`}>
                                                {index + 1}
                                            </span>
                                        </td>
                                        <td className="font-medium text-slate-900">{row.entity_name}</td>
                                        <td className="text-right tabular-nums text-slate-600">{row.approved_entries_count}</td>
                                        <td className="text-right font-semibold tabular-nums text-[#102945]">{score(row.total_score)}</td>
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
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="KPI · Аналитика"
                    title="KPI аналитика и рейтинги"
                    description="Режим только просмотра для superadmin. Данные ранжируются по total_score DESC на основе kpi_results."
                    actions={(
                        <>
                            <Button type="button" variant="outline" onClick={() => exportReport('kpi.analytics.export-excel')}>
                                <Download className="h-4 w-4" />
                                Excel
                            </Button>
                            <Button type="button" variant="outline" onClick={() => exportReport('kpi.analytics.export-pdf')}>
                                <FileText className="h-4 w-4" />
                                PDF
                            </Button>
                        </>
                    )}
                />
            )}
        >
            <Head title="KPI Аналитика" />

            <div className="admin-page-wrap space-y-6">
                <StatGrid>
                    <StatTile label="Всего записей" value={widgets.total_entries ?? 0} tone="navy" icon={BarChart3} />
                    <StatTile label="Черновик" value={widgets.draft ?? 0} tone="neutral" />
                    <StatTile label="Отправлено" value={widgets.submitted ?? 0} tone="info" />
                    <StatTile label="Утверждено" value={widgets.approved ?? 0} tone="success" />
                </StatGrid>

                <FilterBar>
                    <form className="space-y-4" onSubmit={applyFilters}>
                        <div className="grid gap-4 md:grid-cols-3">
                            <FormField label="Учебный год">
                                <select
                                    className={qdFieldClass}
                                    value={form.data.academic_year_id}
                                    onChange={(event) => form.setData('academic_year_id', event.target.value)}
                                >
                                    <option value="">Все</option>
                                    {(filterOptions.academicYears ?? []).map((year) => (
                                        <option key={year.id} value={year.id}>{year.name}</option>
                                    ))}
                                </select>
                            </FormField>

                            <FormField label="Период">
                                <select
                                    className={qdFieldClass}
                                    value={form.data.period_id}
                                    onChange={(event) => form.setData('period_id', event.target.value)}
                                >
                                    <option value="">Все</option>
                                    {(filterOptions.periods ?? []).map((period) => (
                                        <option key={period.id} value={period.id}>{period.name}</option>
                                    ))}
                                </select>
                            </FormField>

                            <FormField label="Уровень">
                                <select
                                    className={qdFieldClass}
                                    value={form.data.entity_type}
                                    onChange={(event) => form.setData('entity_type', event.target.value)}
                                >
                                    <option value="">Все</option>
                                    {(filterOptions.entityTypes ?? []).map((item) => (
                                        <option key={item} value={item}>{entityLabels[item] ?? item}</option>
                                    ))}
                                </select>
                            </FormField>
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4">
                            <Button type="button" variant="outline" onClick={resetFilters}>Сбросить</Button>
                            <Button type="submit">Применить</Button>
                        </div>
                    </form>
                </FilterBar>

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
                        <CardTitle>Примеры агрегации</CardTitle>
                        <CardDescription>
                            Пример Eloquent-агрегации и SQL-шаблон для секционных KPI-расчетов.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        <div className="space-y-2">
                            <span className="qd-field-label block text-slate-500">Результат Eloquent</span>
                            <div className="flex flex-wrap gap-2">
                                {(aggregationExamples.eloquent ?? []).map((item) => (
                                    <Badge key={item.section} variant="outline" className="tabular-nums">
                                        {item.section}: {score(item.section_score)}
                                    </Badge>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <span className="qd-field-label block text-slate-500">SQL-шаблон</span>
                            <pre className="overflow-x-auto rounded-[10px] border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
                                {aggregationExamples.sql}
                            </pre>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}
