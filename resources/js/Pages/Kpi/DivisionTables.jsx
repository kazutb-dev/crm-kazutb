import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { EmptyState, PageHeader, StatGrid, StatTile, StatusBadge } from '@/components/platform';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Head } from '@inertiajs/react';
import { Building2, CircleCheck, ListChecks, Unlink } from 'lucide-react';

const entityLabels = {
    teacher: 'ППС',
    department_head: 'Зав. кафедрой',
    dean: 'Декан',
    structural_division: 'Структурное подразделение',
};

const sectionLabels = {
    teaching: 'Учебная',
    science: 'Научная',
    social: 'Социальная',
    qualification: 'Квалификация',
    survey: 'Анкетирование',
};

export default function DivisionTables({ divisions = [] }) {
    const indicatorTotal = divisions.reduce((sum, division) => sum + (division.indicators?.length ?? 0), 0);
    const activeTotal = divisions.reduce((sum, division) => sum + (division.indicators ?? []).filter((indicator) => indicator.is_active).length, 0);
    const emptyDivisions = divisions.filter((division) => !division.indicators || division.indicators.length === 0).length;

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="KPI · Структурные подразделения"
                    title="Таблицы структурных подразделений KPI"
                    description="Просмотр привязанных индикаторов по каждому структурному подразделению."
                    meta={(
                        <div className="flex flex-wrap gap-2">
                            <StatusBadge tone="default">Подразделений: {divisions.length}</StatusBadge>
                            <StatusBadge tone="info">Индикаторов: {indicatorTotal}</StatusBadge>
                        </div>
                    )}
                />
            )}
        >
            <Head title="Таблицы структурных подразделений" />

            <div className="admin-page-wrap space-y-4">
                <StatGrid>
                    <StatTile label="Подразделений" value={divisions.length} tone="teal" icon={Building2} />
                    <StatTile label="Привязано индикаторов" value={indicatorTotal} tone="info" icon={ListChecks} />
                    <StatTile label="Активных индикаторов" value={activeTotal} tone="success" icon={CircleCheck} hint={`Неактивных: ${indicatorTotal - activeTotal}`} />
                    <StatTile label="Без индикаторов" value={emptyDivisions} tone={emptyDivisions > 0 ? 'warning' : 'neutral'} icon={Unlink} hint="Подразделения без привязок" />
                </StatGrid>

                {divisions.length === 0 && (
                    <EmptyState
                        title="Подразделений нет"
                        description="Структурные подразделения ещё не созданы."
                    />
                )}

                <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2 2xl:items-start">
                {divisions.map((division) => (
                    <Card key={division.id}>
                        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                            <CardTitle className="flex items-center gap-2">
                                <Building2 className="h-4 w-4" />
                                <span>{division.name}</span>
                            </CardTitle>
                            <div className="flex flex-wrap items-center gap-2">
                                {division.code && <Badge variant="outline">{division.code}</Badge>}
                                <Badge variant="secondary">{division.indicators?.length ?? 0} индикаторов</Badge>
                            </div>
                        </CardHeader>
                        <CardContent className={!division.indicators || division.indicators.length === 0 ? '' : 'p-0'}>
                            {!division.indicators || division.indicators.length === 0 ? (
                                <p className="text-sm text-slate-500">Индикаторы не привязаны.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[640px] text-sm">
                                        <thead>
                                            <tr className="border-b border-slate-200 text-left">
                                                <th>Код</th>
                                                <th>Индикатор</th>
                                                <th>Уровень</th>
                                                <th>Секция</th>
                                                <th>Статус</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {division.indicators.map((indicator) => (
                                                <tr key={indicator.id} className="border-b border-slate-200 last:border-0 hover:bg-slate-50">
                                                    <td className="whitespace-nowrap font-mono text-xs text-slate-600">{indicator.code}</td>
                                                    <td className="font-medium text-slate-900">{indicator.name}</td>
                                                    <td className="text-slate-700">{entityLabels[indicator.entity_type] ?? indicator.entity_type}</td>
                                                    <td className="text-slate-700">{sectionLabels[indicator.section] ?? indicator.section}</td>
                                                    <td>
                                                        <StatusBadge tone={indicator.is_active ? 'success' : 'default'}>
                                                            {indicator.is_active ? 'Активен' : 'Неактивен'}
                                                        </StatusBadge>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
