import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Button, EmptyState, FilterBar, FormField, Input, PageHeader, StatGrid, StatTile, StatusBadge, qdFieldClass } from '@/components/platform';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Head, Link, router } from '@inertiajs/react';
import { CheckCircle2, ChevronLeft, ChevronRight, Download, Filter, ListChecks, Search, Target, X, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';

function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';

    return new Intl.DateTimeFormat('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}

export default function LanguageTestingStatisticsIndex({ results = [], filters = {}, pagination = {}, options = {}, permissions = {} }) {
    const canExport = Boolean(permissions.canExport);
    const tests = options.tests ?? [];
    const languageOptions = options.languages ?? {};
    const statusOptions = options.statuses ?? {};

    const [search, setSearch] = useState(filters.q ?? '');
    const [testId, setTestId] = useState(filters.test_id ?? '');
    const [language, setLanguage] = useState(filters.language ?? '');
    const [status, setStatus] = useState(filters.status ?? '');
    const [fromDate, setFromDate] = useState(filters.from_date ?? '');
    const [toDate, setToDate] = useState(filters.to_date ?? '');

    const passedCount = results.filter((result) => result.status === 'passed').length;
    const avgPercent = results.length ? Math.round(results.reduce((sum, result) => sum + (Number(result.percentage) || 0), 0) / results.length) : null;

    const activeFilterCount = useMemo(() => [search, testId, language, status, fromDate, toDate].filter((value) => String(value ?? '').trim() !== '').length, [fromDate, language, search, status, testId, toDate]);

    const applyFilters = (patch = {}, resetPage = true) => {
        const payload = {
            ...filters,
            q: search,
            test_id: testId,
            language,
            status,
            from_date: fromDate,
            to_date: toDate,
            ...patch,
        };

        if (resetPage) payload.page = 1;

        router.get(route('language-testing.statistics.index'), payload, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const clearFilters = () => {
        setSearch('');
        setTestId('');
        setLanguage('');
        setStatus('');
        setFromDate('');
        setToDate('');

        router.get(route('language-testing.statistics.index'), {
            per_page: filters.per_page ?? pagination.per_page ?? 15,
        }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const goToPage = (page) => {
        if (!page || page < 1 || page > (pagination.last_page ?? 1)) return;
        applyFilters({ page }, false);
    };

    const exportRoute = (name) => {
        const params = new URLSearchParams({
            q: search,
            test_id: testId,
            language,
            status,
            from_date: fromDate,
            to_date: toDate,
        });

        const query = params.toString();
        const url = route(name);
        window.location.href = query ? `${url}?${query}` : url;
    };

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow={(
                        <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
                            <Link href={route('testing.index')} className="transition hover:text-[#102945]">Тестирование</Link>
                            <span>/</span>
                            <Link href={route('language-testing.tests.index')} className="transition hover:text-[#102945]">Тесты</Link>
                            <span>/</span>
                            <span>Статистика</span>
                        </span>
                    )}
                    title="Результаты языкового тестирования"
                    description="Отслеживайте прохождения, применяйте фильтры и выгружайте результаты в CSV или Excel."
                    actions={canExport ? (
                        <>
                            <Button type="button" variant="outline" onClick={() => exportRoute('language-testing.statistics.export.csv')} className="gap-2">
                                <Download className="h-4 w-4" />
                                CSV
                            </Button>
                            <Button type="button" variant="outline" onClick={() => exportRoute('language-testing.statistics.export.excel')} className="gap-2">
                                <Download className="h-4 w-4" />
                                Excel
                            </Button>
                        </>
                    ) : null}
                />
            )}
        >
            <Head title="Проверка знаний языка — Статистика" />

            <div className="admin-page-wrap space-y-6">
                <StatGrid>
                    <StatTile label="Результатов" value={pagination.total ?? results.length} tone="teal" icon={ListChecks} />
                    <StatTile label="Сдали" value={passedCount} tone="success" icon={CheckCircle2} hint={results.length ? `${Math.round((passedCount / results.length) * 100)}% на странице` : 'на странице'} />
                    <StatTile label="Не сдали" value={results.length - passedCount} tone="danger" icon={XCircle} hint="на странице" />
                    <StatTile label="Средний %" value={avgPercent === null ? '—' : `${avgPercent}%`} tone="gold" icon={Target} hint="на странице" />
                    <StatTile label="Активных фильтров" value={activeFilterCount} tone="neutral" icon={Filter} />
                </StatGrid>

                <FilterBar>
                    <form
                        className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1.3fr)_repeat(4,minmax(0,1fr))_auto] xl:items-end"
                        onSubmit={(event) => {
                            event.preventDefault();
                            applyFilters();
                        }}
                    >
                        <div className="md:col-span-2 xl:col-span-1">
                            <FormField label="Поиск">
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <Input
                                        value={search}
                                        onChange={(event) => setSearch(event.target.value)}
                                        placeholder="Быстрый поиск по ID, имени, email…"
                                        className="pl-9 pr-9"
                                    />
                                    {search && (
                                        <button type="button" aria-label="Очистить поиск" onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>
                            </FormField>
                        </div>
                        <FormField label="Тест">
                            <select value={testId} onChange={(event) => setTestId(event.target.value)} className={qdFieldClass}>
                                <option value="">Все тесты</option>
                                {tests.map((test) => (
                                    <option key={test.id} value={test.id}>{test.name}</option>
                                ))}
                            </select>
                        </FormField>
                        <FormField label="Язык">
                            <select value={language} onChange={(event) => setLanguage(event.target.value)} className={qdFieldClass}>
                                <option value="">Все языки</option>
                                {Object.entries(languageOptions).map(([value, label]) => (
                                    <option key={value} value={value}>{label}</option>
                                ))}
                            </select>
                        </FormField>
                        <FormField label="Статус">
                            <select value={status} onChange={(event) => setStatus(event.target.value)} className={qdFieldClass}>
                                <option value="">Все статусы</option>
                                {Object.entries(statusOptions).map(([value, label]) => (
                                    <option key={value} value={value}>{label}</option>
                                ))}
                            </select>
                        </FormField>
                        <FormField label="С даты">
                            <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
                        </FormField>
                        <FormField label="По дату">
                            <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
                        </FormField>
                        <div className="flex flex-wrap items-center gap-2 md:col-span-2 xl:col-span-1">
                            <Button type="submit">Применить</Button>
                            <Button type="button" variant="outline" onClick={clearFilters}>Сбросить</Button>
                        </div>
                    </form>
                </FilterBar>

                {results.length === 0 ? (
                    <EmptyState title="Нет результатов" description="После первого завершённого теста записи появятся в этой таблице." />
                ) : (
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0">
                            <CardTitle className="flex items-center gap-2">
                                <ListChecks className="h-4 w-4" />
                                Журнал прохождений
                            </CardTitle>
                            <Badge variant="default" className="tabular-nums">
                                Всего: {pagination.total ?? results.length}
                            </Badge>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead className="text-left">
                                        <tr>
                                            <th>ID</th>
                                            <th>Студент</th>
                                            <th>Контакты</th>
                                            <th>Язык</th>
                                            <th>Тест</th>
                                            <th className="text-right">Верно</th>
                                            <th className="text-right">Всего</th>
                                            <th className="text-right">Балл</th>
                                            <th className="text-right">%</th>
                                            <th>Статус</th>
                                            <th>Дата</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {results.map((result) => (
                                            <tr key={result.id} className="hover:bg-slate-50">
                                                <td className="font-medium tabular-nums text-slate-900">{result.id}</td>
                                                <td className="font-medium text-slate-900">{result.last_name} {result.first_name}</td>
                                                <td className="text-slate-600">
                                                    {result.email}
                                                    <span className="ml-2 tabular-nums text-xs text-slate-500">{result.phone || '—'}</span>
                                                </td>
                                                <td>{result.language_label}</td>
                                                <td>{result.test_name}</td>
                                                <td className="text-right tabular-nums">{result.correct_answers}</td>
                                                <td className="text-right tabular-nums">{result.total_questions}</td>
                                                <td className="text-right tabular-nums">{result.score}</td>
                                                <td className="text-right">
                                                    <div className="ml-auto flex w-24 items-center justify-end gap-2">
                                                        <div className="h-1.5 flex-1 rounded-full bg-slate-100">
                                                            <div className={`h-1.5 rounded-full ${result.status === 'passed' ? 'bg-emerald-600' : 'bg-red-500'}`} style={{ width: `${Math.min(100, Math.max(0, Number(result.percentage) || 0))}%` }} />
                                                        </div>
                                                        <span className="font-semibold tabular-nums text-[#102945]">{result.percentage}%</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <StatusBadge tone={result.status === 'passed' ? 'success' : 'danger'}>{result.status_label}</StatusBadge>
                                                </td>
                                                <td className="whitespace-nowrap tabular-nums text-slate-600">{formatDate(result.submitted_at)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 text-sm text-slate-600 sm:px-6">
                                <div className="tabular-nums">Показано {results.length} из {pagination.total ?? results.length}</div>
                                <div className="flex items-center gap-2">
                                    <Button type="button" size="sm" variant="outline" aria-label="Предыдущая страница" disabled={(pagination.current_page ?? 1) <= 1} onClick={() => goToPage((pagination.current_page ?? 1) - 1)}>
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <span className="tabular-nums">Страница {pagination.current_page ?? 1} / {pagination.last_page ?? 1}</span>
                                    <Button type="button" size="sm" variant="outline" aria-label="Следующая страница" disabled={(pagination.current_page ?? 1) >= (pagination.last_page ?? 1)} onClick={() => goToPage((pagination.current_page ?? 1) + 1)}>
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

            </div>
        </AuthenticatedLayout>
    );
}
