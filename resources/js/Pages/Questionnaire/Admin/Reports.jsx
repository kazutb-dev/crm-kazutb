import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import { BarChart3, Search, Star, UsersRound } from 'lucide-react';
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
        <AuthenticatedLayout>
            <Head title="Анкетирование - Отчеты" />

            <div className="admin-page-wrap">
                <Card className="border-border/80 bg-white/90 shadow-sm">
                    <CardContent className="flex flex-col gap-4 pt-6 md:flex-row md:items-center md:justify-between">
                        <div>
                            <h1 className="text-2xl font-semibold tracking-tight text-[#132844]">Анкетирование - Отчеты</h1>
                            <p className="mt-1 text-sm text-muted-foreground">Сводка результатов анкетирования по преподавателям и дисциплинам.</p>
                        </div>
                        <Badge variant="secondary" className="w-fit">{responses.length} ответов</Badge>
                    </CardContent>
                </Card>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <StatCard title="Всего ответов" value={summary?.total_responses ?? 0} icon={<UsersRound className="h-5 w-5 text-[#139AA4]" />} />
                    <StatCard title="Средний балл" value={summary?.average_score ?? '—'} icon={<Star className="h-5 w-5 text-amber-500" />} />
                    <StatCard title="В выборке" value={filteredResponses.length} icon={<BarChart3 className="h-5 w-5 text-[#139AA4]" />} />
                    <StatCard title="Анкет" value={new Set(responses.map((item) => item.survey_id)).size} />
                </div>

                {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

                <Card className="border-border/80 bg-white/90 shadow-sm">
                    <CardHeader className="pb-2">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <CardTitle className="text-base text-[#132844]">Последние ответы</CardTitle>
                            <div className="relative w-full sm:w-80">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input className="pl-9" placeholder="Поиск по анкете, студенту, дисциплине" value={search} onChange={(e) => setSearch(e.target.value)} />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {filteredResponses.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Ответов пока нет.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead>
                                        <tr className="border-b text-muted-foreground">
                                            <th className="px-3 py-2 text-left font-medium">Анкета</th>
                                            <th className="px-3 py-2 text-left font-medium">Студент</th>
                                            <th className="px-3 py-2 text-left font-medium">Преподаватель</th>
                                            <th className="px-3 py-2 text-left font-medium">Дисциплина</th>
                                            <th className="px-3 py-2 text-left font-medium">Создано</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredResponses.map((row) => (
                                            <tr key={row.id} className="border-b last:border-b-0">
                                                <td className="px-3 py-2 font-medium text-[#132844]">{row.survey?.title || row.survey_id}</td>
                                                <td className="px-3 py-2">{row.student?.full_name || row.student_id}</td>
                                                <td className="px-3 py-2">{row.teacher?.name || row.teacher?.display_name || row.teacher_id}</td>
                                                <td className="px-3 py-2">{row.discipline?.name || row.discipline_id}</td>
                                                <td className="px-3 py-2">{row.created_at ? new Date(row.created_at).toLocaleString() : '—'}</td>
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

function StatCard({ title, value, icon = null }) {
    return (
        <Card className="border-border/80 bg-white/90 shadow-sm">
            <CardContent className="flex items-center justify-between pt-6">
                <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
                    <p className="text-2xl font-semibold text-[#132844]">{value}</p>
                </div>
                {icon}
            </CardContent>
        </Card>
    );
}
