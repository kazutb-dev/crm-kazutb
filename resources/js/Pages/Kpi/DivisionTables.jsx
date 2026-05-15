import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Head } from '@inertiajs/react';

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
    return (
        <AuthenticatedLayout>
            <Head title="Таблицы структурных подразделений" />

            <div className="mx-auto max-w-7xl space-y-6 py-6">
                <div>
                    <h1 className="text-3xl font-bold">Таблицы структурных подразделений KPI</h1>
                    <p className="text-sm text-muted-foreground">Просмотр привязанных индикаторов по каждому структурному подразделению.</p>
                </div>

                {divisions.map((division) => (
                    <Card key={division.id}>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <span>{division.name}</span>
                                {division.code && <Badge variant="outline">{division.code}</Badge>}
                                <Badge variant="secondary">{division.indicators?.length ?? 0} индикаторов</Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {!division.indicators || division.indicators.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Индикаторы не привязаны.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[900px] text-sm">
                                        <thead>
                                            <tr className="border-b text-left text-muted-foreground">
                                                <th className="py-2 pe-3">Код</th>
                                                <th className="py-2 pe-3">Индикатор</th>
                                                <th className="py-2 pe-3">Уровень</th>
                                                <th className="py-2 pe-3">Секция</th>
                                                <th className="py-2 pe-3">Статус</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {division.indicators.map((indicator) => (
                                                <tr key={indicator.id} className="border-b last:border-0">
                                                    <td className="py-2 pe-3 font-mono">{indicator.code}</td>
                                                    <td className="py-2 pe-3">{indicator.name}</td>
                                                    <td className="py-2 pe-3">{entityLabels[indicator.entity_type] ?? indicator.entity_type}</td>
                                                    <td className="py-2 pe-3">{sectionLabels[indicator.section] ?? indicator.section}</td>
                                                    <td className="py-2 pe-3">{indicator.is_active ? 'Активен' : 'Неактивен'}</td>
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
        </AuthenticatedLayout>
    );
}