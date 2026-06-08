import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Head, router, usePage } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';

const statusMeta = {
    new:         { label: 'Новая',      className: 'border-blue-200 bg-blue-50 text-blue-800' },
    in_progress: { label: 'В работе',   className: 'border-amber-200 bg-amber-50 text-amber-800' },
    resolved:    { label: 'Решена',     className: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
    rejected:    { label: 'Отклонена',  className: 'border-red-200 bg-red-50 text-red-800' },
};

const statusOptions = [
    { value: '', label: 'Все статусы' },
    { value: 'new', label: 'Новые' },
    { value: 'in_progress', label: 'В работе' },
    { value: 'resolved', label: 'Решённые' },
    { value: 'rejected', label: 'Отклонённые' },
];

const asText = (value, fallback = '-') => {
    if (value == null) {
        return fallback;
    }

    if (typeof value === 'string' || typeof value === 'number') {
        const text = String(value).trim();
        return text === '' ? fallback : text;
    }

    if (typeof value === 'object') {
        const candidate = value.display_name ?? value.name ?? value.email ?? value.title;
        if (candidate != null) {
            const text = String(candidate).trim();
            return text === '' ? fallback : text;
        }
    }

    return fallback;
};

export default function AdminIndex({ requests, departments = [], isAdmin = false, filters = {} }) {
    const flash = usePage().props.flash ?? {};

    const applyFilter = (patch) => {
        router.get(route('dept-requests.admin'), { ...filters, ...patch }, { preserveState: true, replace: true });
    };

    const { data, links, current_page, last_page } = requests;

    const stats = data.reduce(
        (acc, req) => {
            acc.total += 1;
            if (req.status === 'new') acc.new += 1;
            if (req.status === 'in_progress') acc.in_progress += 1;
            if (req.status === 'resolved') acc.resolved += 1;
            if (req.status === 'rejected') acc.rejected += 1;
            return acc;
        },
        { total: 0, new: 0, in_progress: 0, resolved: 0, rejected: 0 },
    );

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-2xl font-semibold leading-tight text-gray-900">
                            Заявки — {isAdmin ? 'Все отделы' : 'Мои отделы'}
                        </h2>
                        <p className="mt-1 text-sm text-gray-500">
                            {isAdmin ? 'Административный просмотр всех заявок' : 'Заявки по вашим отделам'}
                        </p>
                    </div>
                </div>
            }
        >
            <Head title="Заявки — Администрирование" />

            <div className="admin-page-wrap space-y-4">

                <Card>
                    <CardHeader>
                        <CardTitle>Статистика (текущая страница)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                <p className="text-xs text-slate-500">Всего</p>
                                <p className="text-xl font-semibold text-slate-900">{stats.total}</p>
                            </div>
                            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
                                <p className="text-xs text-blue-700">Новые</p>
                                <p className="text-xl font-semibold text-blue-900">{stats.new}</p>
                            </div>
                            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                                <p className="text-xs text-amber-700">В работе</p>
                                <p className="text-xl font-semibold text-amber-900">{stats.in_progress}</p>
                            </div>
                            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                                <p className="text-xs text-emerald-700">Решённые</p>
                                <p className="text-xl font-semibold text-emerald-900">{stats.resolved}</p>
                            </div>
                            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
                                <p className="text-xs text-rose-700">Отклонённые</p>
                                <p className="text-xl font-semibold text-rose-900">{stats.rejected}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* ── Filters ── */}
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex flex-wrap gap-3">
                            <div className="relative flex-1 min-w-48">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <input
                                    className="w-full rounded-md border pl-8 pr-3 py-2 text-sm"
                                    placeholder="Поиск по теме или описанию..."
                                    defaultValue={filters.search}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') applyFilter({ search: e.target.value, page: 1 });
                                    }}
                                    onBlur={(e) => applyFilter({ search: e.target.value, page: 1 })}
                                />
                            </div>

                            <select
                                className="rounded-md border px-3 py-2 text-sm"
                                value={filters.status ?? ''}
                                onChange={(e) => applyFilter({ status: e.target.value, page: 1 })}
                            >
                                {statusOptions.map((o) => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>

                            {departments.length > 0 && (
                                <select
                                    className="rounded-md border px-3 py-2 text-sm"
                                    value={filters.department_id ?? 0}
                                    onChange={(e) => applyFilter({ department_id: e.target.value, page: 1 })}
                                >
                                    <option value="0">Все отделы</option>
                                    {departments.map((d) => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* ── List ── */}
                <Card>
                    <CardHeader>
                        <CardTitle>
                            Заявки
                            <span className="ml-2 text-sm font-normal text-muted-foreground">
                                ({requests.total ?? 0})
                            </span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {flash.success && (
                            <div className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                                {flash.success}
                            </div>
                        )}

                        {data.length === 0 ? (
                            <p className="py-6 text-center text-sm text-muted-foreground">Заявок не найдено.</p>
                        ) : (
                            <div className="overflow-x-auto rounded-xl border border-slate-200">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                                        <tr>
                                            <th className="px-4 py-3">ID / Тема</th>
                                            <th className="px-4 py-3">Отдел</th>
                                            <th className="px-4 py-3">Автор</th>
                                            <th className="px-4 py-3">Дата отправки</th>
                                            <th className="px-4 py-3">Дата решения</th>
                                            <th className="px-4 py-3">Статус</th>
                                            <th className="px-4 py-3">Ответ</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 bg-white">
                                        {data.map((req) => {
                                            const meta = statusMeta[req.status] ?? {
                                                label: req.status,
                                                className: 'border-slate-200 bg-slate-50 text-slate-700',
                                            };

                                            const departmentText = asText(req.department);
                                            const submittedByText = asText(req.submitted_by);
                                            const closedByText = asText(req.closed_by, '—');

                                            return (
                                                <tr key={req.id} className="align-top">
                                                    <td className="px-4 py-3">
                                                        <p className="font-medium text-slate-900">#{req.id} {req.title}</p>
                                                        {req.room && (
                                                            <p className="mt-1 text-xs text-slate-500">Кабинет: {req.room}</p>
                                                        )}
                                                        {req.description && (
                                                            <p className="mt-1 line-clamp-2 max-w-md text-xs text-slate-500">{req.description}</p>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-700">{departmentText}</td>
                                                    <td className="px-4 py-3 text-slate-700">{submittedByText}</td>
                                                    <td className="px-4 py-3 text-slate-700">{req.created_at ?? '—'}</td>
                                                    <td className="px-4 py-3 text-slate-700">{req.closed_at ?? '—'}</td>
                                                    <td className="px-4 py-3">
                                                        <Badge variant="outline" className={`text-[11px] font-semibold ${meta.className}`}>
                                                            {meta.label}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-700">
                                                        {req.note ? (
                                                            <div>
                                                                <p>{req.note}</p>
                                                                {req.closed_by && (
                                                                    <p className="mt-1 text-xs text-slate-500">Обработал: {closedByText}</p>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            '—'
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Pagination */}
                        {last_page > 1 && (
                            <div className="flex items-center justify-between pt-3">
                                <span className="text-xs text-muted-foreground">
                                    Страница {current_page} из {last_page}
                                </span>
                                <div className="flex gap-1">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={current_page <= 1}
                                        onClick={() => applyFilter({ page: current_page - 1 })}
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={current_page >= last_page}
                                        onClick={() => applyFilter({ page: current_page + 1 })}
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}
