import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Button, DataTable, EmptyState, FormField, Input, StatusBadge } from '@/components/platform';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Head, Link, router } from '@inertiajs/react';
import { BookOpenText, ChevronLeft, ChevronRight, Download, Search, X } from 'lucide-react';
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
        <AuthenticatedLayout>
            <Head title="Проверка знаний языка — Статистика" />

            <div className="admin-page-wrap space-y-6">
                <Card className="overflow-hidden border-0 bg-gradient-to-br from-[#123153] via-[#1b4d74] to-[#139AA4] text-white shadow-[0_20px_50px_-20px_rgba(12,45,78,0.55)] rounded-3xl">
                    <CardContent className="relative flex flex-col gap-5 p-6 sm:p-8 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-3xl space-y-3">
                            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-white/90 backdrop-blur-sm">
                                <BookOpenText className="h-3.5 w-3.5" />
                                Language Testing
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-white/70">
                                <Link href={route('testing.index')} className="transition hover:text-white">Тестирование</Link>
                                <span>/</span>
                                <Link href={route('language-testing.tests.index')} className="transition hover:text-white">Тесты</Link>
                                <span>/</span>
                                <span className="text-white/90">Статистика</span>
                            </div>
                            <h1 className="text-3xl font-semibold leading-tight text-white tracking-tight">
                                Результаты языкового тестирования
                            </h1>
                            <p className="max-w-2xl text-sm leading-6 text-white/80">
                                Отслеживайте прохождения, применяйте фильтры и выгружайте результаты в привычном стиле CRM Testing.
                            </p>
                            {canExport ? (
                                <div className="flex flex-wrap items-center gap-3 mt-4 pt-1">
                                    <Button type="button" onClick={() => exportRoute('language-testing.statistics.export.csv')} className="bg-white text-[#132844] hover:bg-white/95 gap-2 rounded-xl transition-all font-semibold shadow-md border-0 h-10 px-5">
                                        <Download className="h-4 w-4 text-[#132844]" />
                                        CSV
                                    </Button>
                                    <Button type="button" variant="outline" onClick={() => exportRoute('language-testing.statistics.export.excel')} className="gap-2 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white rounded-xl transition-all shadow-md h-10 px-5">
                                        <Download className="h-4 w-4 text-white" />
                                        Excel
                                    </Button>
                                </div>
                            ) : null}
                        </div>

                        <div className="grid min-w-[240px] grid-cols-2 gap-3 shrink-0">
                            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]">
                                <div className="text-xs uppercase tracking-[0.15em] text-white/70">Результатов</div>
                                <div className="mt-2 text-3xl font-bold tracking-tight">{pagination.total ?? results.length}</div>
                            </div>
                            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]">
                                <div className="text-xs uppercase tracking-[0.15em] text-white/70">Активных фильтров</div>
                                <div className="mt-2 text-3xl font-bold tracking-tight">{activeFilterCount}</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="flex flex-col gap-4">
                    <div className="relative max-w-md shadow-sm rounded-xl">
                        <Search className="absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
                        <Input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Быстрый поиск по ID, имени, email…"
                            className="pl-10 pr-9 h-11 border-slate-200 focus-visible:ring-2 focus-visible:ring-[#139AA4]/20 focus-visible:border-[#139AA4] rounded-xl bg-white shadow-sm"
                        />
                        {search && (
                            <button type="button" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>

                    <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.02)]">
                        <form
                            className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.85fr)_minmax(0,0.85fr)_auto]"
                            onSubmit={(event) => {
                                event.preventDefault();
                                applyFilters();
                            }}
                        >
                            <FormField label="Тест">
                                <select value={testId} onChange={(event) => setTestId(event.target.value)} className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#139AA4]/50">
                                    <option value="">Все тесты</option>
                                    {tests.map((test) => (
                                        <option key={test.id} value={test.id}>{test.name}</option>
                                    ))}
                                </select>
                            </FormField>
                            <FormField label="Язык">
                                <select value={language} onChange={(event) => setLanguage(event.target.value)} className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#139AA4]/50">
                                    <option value="">Все языки</option>
                                    {Object.entries(languageOptions).map(([value, label]) => (
                                        <option key={value} value={value}>{label}</option>
                                    ))}
                                </select>
                            </FormField>
                            <FormField label="Статус">
                                <select value={status} onChange={(event) => setStatus(event.target.value)} className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#139AA4]/50">
                                    <option value="">Все статусы</option>
                                    {Object.entries(statusOptions).map(([value, label]) => (
                                        <option key={value} value={value}>{label}</option>
                                    ))}
                                </select>
                            </FormField>
                            <FormField label="С даты">
                                <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="h-10 rounded-md border-slate-300 shadow-sm focus-visible:ring-[#139AA4]/50" />
                            </FormField>
                            <FormField label="По дату">
                                <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="h-10 rounded-md border-slate-300 shadow-sm focus-visible:ring-[#139AA4]/50" />
                            </FormField>
                            <div className="flex items-end gap-2 xl:col-start-7">
                                <Button type="submit" className="gap-2 bg-gradient-to-r from-[#1b4d74] to-[#139AA4] hover:opacity-90 shadow-md transition-all active:scale-[0.98]">
                                    Применить
                                </Button>
                                <Button type="button" variant="outline" onClick={clearFilters} className="h-10 rounded-xl border-slate-200 hover:bg-slate-50">
                                    Сбросить
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>

                {results.length === 0 ? (
                    <EmptyState title="Нет результатов" description="После первого завершённого теста записи появятся в этой таблице." />
                ) : (
                    <Card className="border border-slate-200/60 shadow-[0_4px_20px_rgba(15,23,42,0.02)] rounded-2xl">
                        <CardHeader className="pb-3 flex flex-row items-center justify-between border-b border-slate-100">
                            <CardTitle className="text-xl font-bold text-[#132844] font-sans">Журнал прохождений</CardTitle>
                            <Badge className="bg-[#139AA4]/10 text-[#139AA4] border-0 px-2.5 py-0.5 rounded-lg font-semibold hover:bg-[#139AA4]/10">
                                Всего: {pagination.total ?? results.length}
                            </Badge>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <DataTable>
                                <table className="min-w-full text-sm">
                            <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.08em] text-slate-500">
                                <tr>
                                    <th className="px-4 py-3">ID</th>
                                    <th className="px-4 py-3">Имя</th>
                                    <th className="px-4 py-3">Фамилия</th>
                                    <th className="px-4 py-3">Email</th>
                                    <th className="px-4 py-3">Телефон</th>
                                    <th className="px-4 py-3">Язык</th>
                                    <th className="px-4 py-3">Тест</th>
                                    <th className="px-4 py-3 text-center">Верно</th>
                                    <th className="px-4 py-3 text-center">Всего</th>
                                    <th className="px-4 py-3 text-center">Балл</th>
                                    <th className="px-4 py-3 text-center">%</th>
                                    <th className="px-4 py-3 text-center">Статус</th>
                                    <th className="px-4 py-3">Дата</th>
                                </tr>
                            </thead>
                            <tbody>
                                {results.map((result) => (
                                    <tr key={result.id} className="border-t align-top hover:bg-slate-50/70">
                                        <td className="px-4 py-4 font-medium">{result.id}</td>
                                        <td className="px-4 py-4">{result.first_name}</td>
                                        <td className="px-4 py-4">{result.last_name}</td>
                                        <td className="px-4 py-4">{result.email}</td>
                                        <td className="px-4 py-4">{result.phone || '—'}</td>
                                        <td className="px-4 py-4">{result.language_label}</td>
                                        <td className="px-4 py-4">{result.test_name}</td>
                                        <td className="px-4 py-4 text-center">{result.correct_answers}</td>
                                        <td className="px-4 py-4 text-center">{result.total_questions}</td>
                                        <td className="px-4 py-4 text-center">{result.score}</td>
                                        <td className="px-4 py-4 text-center font-semibold text-[#132844]">{result.percentage}%</td>
                                        <td className="px-4 py-4 text-center">
                                            <StatusBadge tone={result.status === 'passed' ? 'success' : 'danger'}>{result.status_label}</StatusBadge>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap">{formatDate(result.submitted_at)}</td>
                                    </tr>
                                ))}
                            </tbody>
                                </table>
                            </DataTable>
                        </CardContent>
                    </Card>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                    <div>Показано {results.length} из {pagination.total ?? results.length}</div>
                    <div className="flex items-center gap-2">
                        <Button type="button" size="sm" variant="outline" disabled={(pagination.current_page ?? 1) <= 1} onClick={() => goToPage((pagination.current_page ?? 1) - 1)}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span>Страница {pagination.current_page ?? 1} / {pagination.last_page ?? 1}</span>
                        <Button type="button" size="sm" variant="outline" disabled={(pagination.current_page ?? 1) >= (pagination.last_page ?? 1)} onClick={() => goToPage((pagination.current_page ?? 1) + 1)}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}