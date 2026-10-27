import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Notice, PageHeader, StatGrid, StatTile, qdFieldClass } from '@/components/platform';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Head, router, usePage } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, CircleCheck, CircleX, Inbox, Layers, Loader, Search } from 'lucide-react';

const statusMeta = {
    new:         { label: 'Новая',      variant: 'info' },
    in_progress: { label: 'В работе',   variant: 'warning' },
    resolved:    { label: 'Решена',     variant: 'success' },
    rejected:    { label: 'Отклонена',  variant: 'destructive' },
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

    const { data, current_page, last_page } = requests;

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

    const pctHint = (count) => (stats.total > 0
        ? `${Math.round((count / stats.total) * 100)}% заявок на странице`
        : 'Статистика по текущей странице');

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="Обращения"
                    title={`Заявки — ${isAdmin ? 'Все отделы' : 'Мои отделы'}`}
                    description={isAdmin ? 'Административный просмотр всех заявок' : 'Заявки по вашим отделам'}
                    meta={<Badge variant="secondary">Найдено: {requests.total ?? 0}</Badge>}
                />
            )}
        >
            <Head title="Заявки — Администрирование" />

            <div className="admin-page-wrap space-y-6">
                {flash.success && <Notice tone="success">{flash.success}</Notice>}

                <StatGrid>
                    <StatTile label="На странице" value={stats.total} icon={Layers} tone="navy" hint={`Найдено всего: ${requests.total ?? 0}`} />
                    <StatTile label="Новые" value={stats.new} icon={Inbox} tone="info" hint={pctHint(stats.new)} />
                    <StatTile label="В работе" value={stats.in_progress} icon={Loader} tone="warning" hint={pctHint(stats.in_progress)} />
                    <StatTile label="Решённые" value={stats.resolved} icon={CircleCheck} tone="success" hint={pctHint(stats.resolved)} />
                    <StatTile label="Отклонённые" value={stats.rejected} icon={CircleX} tone="danger" hint={pctHint(stats.rejected)} />
                </StatGrid>

                <Card className="overflow-hidden">
                    <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-12">
                            <label className={`space-y-2 md:col-span-2 ${departments.length > 0 ? 'xl:col-span-6' : 'xl:col-span-8'}`}>
                                <span className="qd-field-label block">Поиск</span>
                                <span className="relative block">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <Input
                                        className="pl-9"
                                        placeholder="Поиск по теме или описанию..."
                                        defaultValue={filters.search}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') applyFilter({ search: e.target.value, page: 1 });
                                        }}
                                        onBlur={(e) => applyFilter({ search: e.target.value, page: 1 })}
                                    />
                                </span>
                            </label>

                            <label className={`space-y-2 ${departments.length > 0 ? 'xl:col-span-3' : 'md:col-span-2 xl:col-span-4'}`}>
                                <span className="qd-field-label block">Статус</span>
                                <select
                                    className={qdFieldClass}
                                    value={filters.status ?? ''}
                                    onChange={(e) => applyFilter({ status: e.target.value, page: 1 })}
                                >
                                    {statusOptions.map((o) => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
                            </label>

                            {departments.length > 0 && (
                                <label className="space-y-2 xl:col-span-3">
                                    <span className="qd-field-label block">Отдел</span>
                                    <select
                                        className={qdFieldClass}
                                        value={filters.department_id ?? 0}
                                        onChange={(e) => applyFilter({ department_id: e.target.value, page: 1 })}
                                    >
                                        <option value="0">Все отделы</option>
                                        {departments.map((d) => (
                                            <option key={d.id} value={d.id}>{d.name}</option>
                                        ))}
                                    </select>
                                </label>
                            )}
                        </div>
                    </div>

                    {data.length === 0 ? (
                        <CardContent>
                            <div className="flex flex-col items-center gap-2 py-8 text-center">
                                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 text-teal-700">
                                    <Inbox className="h-5 w-5" />
                                </span>
                                <p className="font-semibold text-[#102945]">Заявок не найдено</p>
                                <p className="max-w-md text-sm text-slate-600">По выбранным условиям заявок нет. Измените поиск, статус или отдел.</p>
                            </div>
                        </CardContent>
                    ) : (
                            <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-sm">
                                        <thead>
                                            <tr>
                                                <th className="text-left">ID / Тема</th>
                                                <th className="text-left">Отдел</th>
                                                <th className="text-left">Автор</th>
                                                <th className="text-left">Дата отправки</th>
                                                <th className="text-left">Дата решения</th>
                                                <th className="text-left">Статус</th>
                                                <th className="text-left">Ответ</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.map((req) => {
                                                const meta = statusMeta[req.status] ?? { label: req.status, variant: 'secondary' };

                                                const departmentText = asText(req.department);
                                                const submittedByText = asText(req.submitted_by);
                                                const closedByText = asText(req.closed_by, '—');

                                                return (
                                                    <tr key={req.id} className="border-b border-slate-200 align-top last:border-0 hover:bg-slate-50">
                                                        <td>
                                                            <p className="font-medium text-slate-900">
                                                                <span className="tabular-nums text-slate-500">#{req.id}</span> {req.title}
                                                            </p>
                                                            {req.room && (
                                                                <p className="mt-1 text-xs text-slate-500">Кабинет: {req.room}</p>
                                                            )}
                                                            {req.description && (
                                                                <p className="mt-1 line-clamp-2 max-w-md text-xs text-slate-500">{req.description}</p>
                                                            )}
                                                        </td>
                                                        <td className="text-slate-700">{departmentText}</td>
                                                        <td className="text-slate-700">{submittedByText}</td>
                                                        <td className="whitespace-nowrap tabular-nums text-slate-700">{req.created_at ?? '—'}</td>
                                                        <td className="whitespace-nowrap tabular-nums text-slate-700">{req.closed_at ?? '—'}</td>
                                                        <td>
                                                            <Badge variant={meta.variant}>{meta.label}</Badge>
                                                        </td>
                                                        <td className="text-slate-700">
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

                                {last_page > 1 && (
                                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 sm:px-6">
                                        <span className="text-xs font-medium text-slate-500">
                                            Страница {current_page} из {last_page}
                                        </span>
                                        <div className="flex gap-1.5">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={current_page <= 1}
                                                onClick={() => applyFilter({ page: current_page - 1 })}
                                                aria-label="Предыдущая страница"
                                            >
                                                <ChevronLeft />
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={current_page >= last_page}
                                                onClick={() => applyFilter({ page: current_page + 1 })}
                                                aria-label="Следующая страница"
                                            >
                                                <ChevronRight />
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                    )}
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}
