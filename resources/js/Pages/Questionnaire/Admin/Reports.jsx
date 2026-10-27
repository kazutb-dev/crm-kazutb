import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { EmptyState, FilterBar, FormField, Notice, PageHeader, StatGrid, StatTile, StatusBadge } from '@/components/platform';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import { BarChart3, ClipboardList, Search, Star, UsersRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

export default function Reports() {
    const [summary, setSummary] = useState(null);
    const [responses, setResponses] = useState([]);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');

    useEffect(() => {
        const load = async () => {
            try {
                const response = await axios.get('/api/questionnaire/admin/results');
                const data = response.data?.data ?? {};
                setSummary(data.summary ?? null);
                setResponses(data.responses ?? []);
            } catch (e) {
                setError(e?.response?.data?.message || 'Не удалось загрузить отчет.');
            }
        };

        load();
    }, []);

    const filteredResponses = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) {
            return responses;
        }

        return responses.filter((row) => {
            return [
                row.survey?.title,
                row.student?.full_name,
                row.teacher?.name,
                row.teacher?.display_name,
                row.discipline?.name,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .includes(term);
        });
    }, [responses, search]);

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="Анкетирование"
                    title="Отчеты"
                    description="Сводка результатов анкетирования по преподавателям и дисциплинам."
                    meta={<StatusBadge tone="info">{responses.length} ответов</StatusBadge>}
                />
            )}
        >
            <Head title="Анкетирование - Отчеты" />

            <div className="admin-page-wrap space-y-6">
                <StatGrid>
                    <StatTile label="Всего ответов" value={summary?.total_responses ?? 0} tone="teal" icon={UsersRound} />
                    <StatTile label="Средний балл" value={summary?.average_score ?? '—'} tone="gold" icon={Star} />
                    <StatTile label="В выборке" value={filteredResponses.length} tone="info" icon={BarChart3} hint={search.trim() ? 'С учётом поиска' : null} />
                    <StatTile label="Анкет" value={new Set(responses.map((item) => item.survey_id)).size} tone="navy" icon={ClipboardList} />
                </StatGrid>

                {error && <Notice tone="danger" title="Ошибка загрузки">{error}</Notice>}

                <FilterBar>
                    <FormField label="Поиск">
                        <div className="relative w-full sm:max-w-md">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <Input className="pl-9" placeholder="Поиск по анкете, студенту, дисциплине" value={search} onChange={(e) => setSearch(e.target.value)} />
                        </div>
                    </FormField>
                </FilterBar>

                {filteredResponses.length === 0 ? (
                    <EmptyState
                        title="Ответов пока нет"
                        description={responses.length > 0 ? 'По запросу ничего не найдено — измените поиск.' : 'Ответы появятся, когда студенты начнут проходить анкеты.'}
                    />
                ) : (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <BarChart3 />
                                Последние ответы
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-200">
                                            <th className="px-5 py-3 text-left">Анкета</th>
                                            <th className="px-5 py-3 text-left">Студент</th>
                                            <th className="px-5 py-3 text-left">Преподаватель</th>
                                            <th className="px-5 py-3 text-left">Дисциплина</th>
                                            <th className="px-5 py-3 text-right">Создано</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredResponses.map((row) => (
                                            <tr key={row.id} className="border-b border-slate-200 last:border-b-0 hover:bg-slate-50">
                                                <td className="px-5 py-3 font-medium text-slate-900">{row.survey?.title || row.survey_id}</td>
                                                <td className="px-5 py-3 text-slate-700">{row.student?.full_name || row.student_id}</td>
                                                <td className="px-5 py-3 text-slate-700">{row.teacher?.name || row.teacher?.display_name || row.teacher_id}</td>
                                                <td className="px-5 py-3 text-slate-700">{row.discipline?.name || row.discipline_id}</td>
                                                <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums text-slate-600">{row.created_at ? new Date(row.created_at).toLocaleString() : '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
