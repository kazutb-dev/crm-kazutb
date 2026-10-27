import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Notice, PageHeader, StatGrid, StatTile } from '@/components/platform';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import { BarChart3, ClipboardList, Clock3, GraduationCap, Search, Star, UserRound, UsersRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const answerScore = (answer) => {
    if (answer?.option?.score !== null && answer?.option?.score !== undefined) {
        return Number(answer.option.score);
    }

    if (answer?.numeric_answer !== null && answer?.numeric_answer !== undefined && answer?.numeric_answer !== '') {
        return Number(answer.numeric_answer);
    }

    return null;
};

const responseScores = (row) => (row.answers || []).map(answerScore).filter((score) => score !== null && Number.isFinite(score));

const average = (values) => (values.length ? values.reduce((acc, value) => acc + value, 0) / values.length : null);

const formatScore = (value) => (value === null || value === undefined ? '—' : Number(value).toFixed(2));

const responseDate = (row) => row.created_at || row.submitted_at || null;

function Breakdown({ title, icon: Icon, rows, emptyLabel = 'Нет данных' }) {
    return (
        <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
                <CardTitle className="flex items-center gap-2">
                    <Icon />
                    {title}
                </CardTitle>
                <span className="text-xs tabular-nums text-slate-500">{rows.length}</span>
            </CardHeader>
            <CardContent className="p-0">
                {rows.length === 0 ? (
                    <p className="px-5 py-4 text-sm text-slate-500 sm:px-6">{emptyLabel}</p>
                ) : (
                    <ul className="max-h-72 divide-y divide-slate-200 overflow-y-auto">
                        {rows.map((row) => (
                            <li key={row.key} className="flex items-center justify-between gap-3 px-5 py-2 text-sm sm:px-6">
                                <span className="min-w-0 truncate text-slate-900" title={row.label}>{row.label}</span>
                                <span className="flex shrink-0 items-baseline gap-3 tabular-nums">
                                    <span className="text-slate-500">{row.count} отв.</span>
                                    <span className="w-10 text-right font-semibold text-[#102945]">{formatScore(row.average)}</span>
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </CardContent>
        </Card>
    );
}

function groupRows(responses, keyOf, labelOf) {
    const map = new Map();

    for (const row of responses) {
        const key = String(keyOf(row) ?? '—');
        if (!map.has(key)) {
            map.set(key, { key, label: labelOf(row) || key, count: 0, scores: [] });
        }

        const entry = map.get(key);
        entry.count += 1;
        entry.scores.push(...responseScores(row));
    }

    return Array.from(map.values())
        .map((entry) => ({ ...entry, average: average(entry.scores) }))
        .sort((a, b) => b.count - a.count || String(a.label).localeCompare(String(b.label), 'ru'));
}

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

    const teacherName = (row) => row.teacher?.name || row.teacher?.display_name || (row.teacher_id ? `ID ${row.teacher_id}` : null);

    const byTeacher = useMemo(() => groupRows(filteredResponses, (row) => row.teacher_id ?? row.teacher?.id, teacherName), [filteredResponses]);
    const bySurvey = useMemo(() => groupRows(filteredResponses, (row) => row.survey_id ?? row.survey?.id, (row) => row.survey?.title), [filteredResponses]);
    const byGroup = useMemo(() => groupRows(filteredResponses, (row) => row.group_id ?? row.group?.id, (row) => row.group?.name), [filteredResponses]);
    const filteredAverage = average(filteredResponses.flatMap(responseScores));
    const lastResponseAt = responses.reduce((latest, row) => {
        const value = responseDate(row);
        return value && (!latest || new Date(value) > new Date(latest)) ? value : latest;
    }, null);

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="Анкетирование"
                    title="Отчеты"
                    description="Сводка результатов анкетирования по преподавателям и дисциплинам."
                />
            )}
        >
            <Head title="Анкетирование - Отчеты" />

            <div className="admin-page-wrap space-y-6">
                <StatGrid className="xl:max-2xl:[grid-template-columns:repeat(4,minmax(0,1fr))]">
                    <StatTile label="Всего ответов" value={summary?.total_responses ?? 0} tone="teal" icon={UsersRound} />
                    <StatTile label="Средний балл" value={summary?.average_score ?? '—'} tone="gold" icon={Star} hint={search.trim() ? `В выборке: ${formatScore(filteredAverage)}` : null} />
                    <StatTile label="В выборке" value={filteredResponses.length} tone="info" icon={BarChart3} hint={search.trim() ? 'С учётом поиска' : null} />
                    <StatTile label="Анкет" value={new Set(responses.map((item) => item.survey_id)).size} tone="navy" icon={ClipboardList} />
                    <StatTile label="Преподавателей" value={new Set(responses.map((item) => item.teacher_id)).size} tone="success" icon={UserRound} />
                    <StatTile label="Групп" value={new Set(responses.map((item) => item.group_id).filter(Boolean)).size} tone="copper" icon={GraduationCap} />
                    <StatTile label="Последний ответ" value={<span className="text-xl">{lastResponseAt ? new Date(lastResponseAt).toLocaleDateString('ru-RU') : '—'}</span>} tone="neutral" icon={Clock3} hint={lastResponseAt ? new Date(lastResponseAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : null} />
                </StatGrid>

                {error && <Notice tone="danger" title="Ошибка загрузки">{error}</Notice>}

                <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                    <Card>
                        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
                            <CardTitle className="flex items-center gap-2">
                                <BarChart3 />
                                Последние ответы
                            </CardTitle>
                            <span className="text-sm tabular-nums text-slate-500">Показано: {filteredResponses.length} из {responses.length}</span>
                        </CardHeader>
                        <div className="border-b border-slate-200 px-5 py-3 sm:px-6">
                            <div className="relative w-full sm:max-w-md">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <Input className="pl-9" placeholder="Поиск по анкете, студенту, дисциплине" aria-label="Поиск" value={search} onChange={(e) => setSearch(e.target.value)} />
                            </div>
                        </div>
                        <CardContent className="p-0">
                            {filteredResponses.length === 0 ? (
                                <div className="px-5 py-8 text-center sm:px-6">
                                    <p className="font-semibold text-[#102945]">Ответов пока нет</p>
                                    <p className="mt-1 text-sm text-slate-600">
                                        {responses.length > 0 ? 'По запросу ничего не найдено — измените поиск.' : 'Ответы появятся, когда студенты начнут проходить анкеты.'}
                                    </p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-slate-200">
                                                <th className="whitespace-nowrap text-left">Анкета</th>
                                                <th className="whitespace-nowrap text-left">Студент</th>
                                                <th className="whitespace-nowrap text-left">Группа</th>
                                                <th className="whitespace-nowrap text-left">Преподаватель</th>
                                                <th className="whitespace-nowrap text-left">Дисциплина</th>
                                                <th className="whitespace-nowrap text-right">Ответов</th>
                                                <th className="whitespace-nowrap text-right">Ср. балл</th>
                                                <th className="whitespace-nowrap text-right">Создано</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredResponses.map((row) => {
                                                const scores = responseScores(row);
                                                const date = responseDate(row);
                                                const period = [row.academic_year || row.survey?.academic_year, row.semester || row.survey?.semester].filter(Boolean).join(' · ');
                                                return (
                                                    <tr key={row.id} className="border-b border-slate-200 last:border-b-0 hover:bg-slate-50">
                                                        <td className="font-medium text-slate-900">
                                                            <span className="block">{row.survey?.title || row.survey_id}</span>
                                                            {period && <span className="block text-xs font-normal tabular-nums text-slate-500">{period}</span>}
                                                        </td>
                                                        <td className="text-slate-700">{row.student?.full_name || row.student_id}</td>
                                                        <td className="whitespace-nowrap text-slate-700">{row.group?.name || '—'}</td>
                                                        <td className="text-slate-700">{teacherName(row)}</td>
                                                        <td className="text-slate-700">{row.discipline?.name || row.discipline_id}</td>
                                                        <td className="text-right tabular-nums text-slate-700">{(row.answers || []).length}</td>
                                                        <td className="text-right font-semibold tabular-nums text-[#102945]">{formatScore(average(scores))}</td>
                                                        <td className="whitespace-nowrap text-right tabular-nums text-slate-600">{date ? new Date(date).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <div className="space-y-4">
                        <Breakdown title="По преподавателям" icon={UserRound} rows={byTeacher} />
                        <Breakdown title="По анкетам" icon={ClipboardList} rows={bySurvey} />
                        <Breakdown title="По группам" icon={GraduationCap} rows={byGroup} />
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
