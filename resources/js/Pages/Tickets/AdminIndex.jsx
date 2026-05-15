import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Head, Link, router } from '@inertiajs/react';
import { Clock3, Search, Ticket } from 'lucide-react';
import { useMemo, useState } from 'react';

const statusMeta = {
    new: {
        label: 'Новая',
        badgeClass: 'border-blue-200 bg-blue-50 text-blue-800',
    },
    in_progress: {
        label: 'В работе',
        badgeClass: 'border-amber-200 bg-amber-50 text-amber-800',
    },
    closed: {
        label: 'Закрыта',
        badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    },
};

const statusFilterChips = [
    { key: '', label: 'Все' },
    { key: 'new', label: 'Новые' },
    { key: 'in_progress', label: 'В работе' },
    { key: 'closed', label: 'Закрытые' },
];

const periodOptions = [
    { value: 'all', label: 'Период: любой' },
    { value: 'today', label: 'Сегодня' },
    { value: 'week', label: 'За неделю' },
    { value: 'month', label: 'За месяц' },
];

const getCsrfToken = () => decodeURIComponent(document.cookie.match(/XSRF-TOKEN=([^;]+)/)?.[1] ?? '');

function StatusControl({ ticketId, current, isOverdue }) {
    const [value, setValue] = useState(current);
    const [saving, setSaving] = useState(false);

    const meta = statusMeta[value] ?? {
        label: value,
        badgeClass: 'border-slate-200 bg-slate-50 text-slate-700',
    };

    const handleChange = async (event) => {
        const newStatus = event.target.value;
        setSaving(true);

        try {
            const res = await fetch(`/admin/tickets/${ticketId}/status`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-XSRF-TOKEN': getCsrfToken(),
                },
                credentials: 'include',
                body: JSON.stringify({ status: newStatus }),
            });

            if (res.ok) {
                setValue(newStatus);
            }
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className={`inline-flex h-6 items-center rounded-full px-2 py-0 text-[10px] font-semibold ${meta.badgeClass}`}>
                    {meta.label}
                </Badge>
                {isOverdue && value !== 'closed' && (
                    <Badge variant="outline" className="inline-flex h-6 items-center rounded-full border-red-200 bg-red-50 px-2 py-0 text-[10px] font-semibold text-red-700">
                        Просрочена
                    </Badge>
                )}
            </div>

            <select
                className="h-7 w-full rounded-md border border-slate-300 bg-white px-2 text-[11px] shadow-sm"
                value={value}
                onChange={handleChange}
                disabled={saving}
            >
                <option value="new">Новая</option>
                <option value="in_progress">В работе</option>
                <option value="closed">Закрыта</option>
            </select>
        </div>
    );
}

export default function AdminIndex({
    tickets,
    departments = [],
    types = [],
    assignees = [],
    summaryCounts = {},
    filters = {},
    canFilterByDepartment = false,
}) {
    const items = tickets?.data ?? [];
    const links = tickets?.links ?? [];

    const [localFilters, setLocalFilters] = useState({
        q: filters?.q ?? '',
        department: filters?.department ?? '',
        type: filters?.type ?? '',
        status: filters?.status ?? '',
        period: filters?.period ?? 'all',
        accepted_by: filters?.accepted_by ?? '',
    });

    const summaryTiles = useMemo(() => [
        { key: 'new', label: 'Новые', value: summaryCounts?.new ?? 0, tone: 'border-blue-200 bg-blue-50 text-blue-800' },
        { key: 'in_progress', label: 'В работе', value: summaryCounts?.in_progress ?? 0, tone: 'border-amber-200 bg-amber-50 text-amber-800' },
        { key: 'closed', label: 'Закрытые', value: summaryCounts?.closed ?? 0, tone: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
        { key: 'total', label: 'Всего', value: summaryCounts?.total ?? 0, tone: 'border-slate-300 bg-slate-50 text-slate-800' },
        { key: 'today', label: 'Сегодня', value: summaryCounts?.today ?? 0, tone: 'border-indigo-200 bg-indigo-50 text-indigo-800' },
        { key: 'week', label: 'За неделю', value: summaryCounts?.week ?? 0, tone: 'border-cyan-200 bg-cyan-50 text-cyan-800' },
    ], [summaryCounts]);

    const topTotals = [
        { label: 'Всего', value: summaryCounts?.total ?? 0 },
        { label: 'Новые', value: summaryCounts?.new ?? 0 },
        { label: 'В работе', value: summaryCounts?.in_progress ?? 0 },
        { label: 'Закрытые', value: summaryCounts?.closed ?? 0 },
        { label: 'Просроченные', value: summaryCounts?.overdue ?? 0 },
    ];

    const buildFilterPayload = (data) => {
        const payload = {
            q: data.q?.trim() ?? '',
            department: data.department ?? '',
            type: data.type ?? '',
            status: data.status ?? '',
            period: data.period ?? 'all',
            accepted_by: data.accepted_by ?? '',
        };

        Object.keys(payload).forEach((key) => {
            if (payload[key] === '' || payload[key] === 'all') {
                delete payload[key];
            }
        });

        return payload;
    };

    const applyFilters = (nextFilters = localFilters) => {
        router.get(route('tickets.admin'), buildFilterPayload(nextFilters), {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const setFilter = (key, value) => {
        setLocalFilters((prev) => ({ ...prev, [key]: value }));
    };

    const resetFilters = () => {
        const resetData = {
            q: '',
            department: canFilterByDepartment ? '' : (filters?.department ?? ''),
            type: '',
            status: '',
            period: 'all',
            accepted_by: '',
        };

        setLocalFilters(resetData);
        applyFilters(resetData);
    };

    return (
        <AuthenticatedLayout
            header={(
                <div className="mx-auto flex w-full max-w-[1580px] min-w-0 flex-col gap-2 px-4 lg:px-6 xl:px-0 lg:flex-row lg:items-end lg:justify-between">
                    <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500">Service Desk</p>
                        <h2 className="mt-0.5 text-[1.64rem] font-semibold leading-none tracking-[-0.01em] text-slate-950">Заявки</h2>
                        <p className="mt-1 text-[12px] text-slate-600">Поступившие заявки и обращения пользователей</p>
                    </div>

                    <div className="flex flex-wrap gap-1.5 lg:justify-end">
                        {topTotals.map((stat) => (
                            <span key={stat.label} className="inline-flex h-7 items-center rounded-full border border-slate-300 bg-white px-2.5 text-[11px] font-semibold text-slate-700 shadow-sm">
                                {stat.label}: {stat.value}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        >
            <Head title="Заявки" />

            <div className="admin-page-wrap overflow-x-hidden px-4 lg:px-6">
                <div className="mx-auto w-full max-w-[1580px] min-w-0 overflow-hidden">
                    <Card className="admin-surface min-w-0 overflow-hidden rounded-2xl border-slate-300/80 bg-gradient-to-b from-white via-white to-slate-50/50 shadow-[0_14px_34px_-22px_rgba(15,23,42,0.45)]">
                        <CardHeader className="border-b border-slate-200 bg-slate-50/80 px-4 py-3.5 sm:px-5 sm:py-4">
                            <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-950">
                                <Ticket className="h-5 w-5 text-slate-700" />
                                Операционный реестр заявок
                            </CardTitle>
                        </CardHeader>

                        <CardContent className="space-y-3 p-3.5 sm:p-4">
                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                                {summaryTiles.map((tile) => (
                                    <div key={tile.key} className={`rounded-xl border px-3 py-2 shadow-sm ${tile.tone}`}>
                                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-75">{tile.label}</div>
                                        <div className="mt-1 text-xl font-semibold leading-none">{tile.value}</div>
                                    </div>
                                ))}
                            </div>

                            <div className="sticky top-[76px] z-20 rounded-xl border border-slate-200 bg-slate-100/85 p-2.5 shadow-[0_10px_20px_-18px_rgba(15,23,42,0.7)] backdrop-blur">
                                <div className="grid min-w-0 gap-2 md:grid-cols-2 xl:grid-cols-12">
                                    <div className="relative md:col-span-2 xl:col-span-4">
                                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                        <input
                                            value={localFilters.q}
                                            onChange={(event) => setFilter('q', event.target.value)}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter') {
                                                    applyFilters();
                                                }
                                            }}
                                            placeholder="Поиск: #ID, тип, контакт, отправитель, описание"
                                            className="h-8.5 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-2.5 text-sm shadow-sm"
                                        />
                                    </div>

                                    {canFilterByDepartment && (
                                        <select
                                            className="h-8.5 rounded-lg border border-slate-300 bg-white px-2.5 text-[12px] shadow-sm xl:col-span-2"
                                            value={localFilters.department}
                                            onChange={(event) => setFilter('department', event.target.value)}
                                        >
                                            <option value="">Подразделение: все</option>
                                            {departments.map((department) => (
                                                <option key={department} value={department}>{department}</option>
                                            ))}
                                        </select>
                                    )}

                                    <select
                                        className="h-8.5 rounded-lg border border-slate-300 bg-white px-2.5 text-[12px] shadow-sm xl:col-span-2"
                                        value={localFilters.type}
                                        onChange={(event) => setFilter('type', event.target.value)}
                                    >
                                        <option value="">Тип: все</option>
                                        {types.map((ticketType) => (
                                            <option key={ticketType} value={ticketType}>{ticketType}</option>
                                        ))}
                                    </select>

                                    <select
                                        className="h-8.5 rounded-lg border border-slate-300 bg-white px-2.5 text-[12px] shadow-sm xl:col-span-2"
                                        value={localFilters.accepted_by}
                                        onChange={(event) => setFilter('accepted_by', event.target.value)}
                                    >
                                        <option value="">Ответственный: все</option>
                                        <option value="unassigned">Без ответственного</option>
                                        <option value="assigned">Назначенные</option>
                                        {assignees.map((assignee) => (
                                            <option key={assignee.id} value={String(assignee.id)}>{assignee.label}</option>
                                        ))}
                                    </select>

                                    <select
                                        className="h-8.5 rounded-lg border border-slate-300 bg-white px-2.5 text-[12px] shadow-sm xl:col-span-2"
                                        value={localFilters.period}
                                        onChange={(event) => setFilter('period', event.target.value)}
                                    >
                                        {periodOptions.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </select>

                                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 pt-1 md:col-span-2 xl:col-span-12">
                                        <div className="flex flex-wrap gap-1.5">
                                            {statusFilterChips.map((chip) => {
                                                const active = localFilters.status === chip.key;
                                                return (
                                                    <button
                                                        key={chip.label}
                                                        type="button"
                                                        onClick={() => {
                                                            const next = { ...localFilters, status: chip.key };
                                                            setLocalFilters(next);
                                                            applyFilters(next);
                                                        }}
                                                        className={`inline-flex h-7 items-center rounded-full border px-2.5 text-[11px] font-semibold transition-colors ${active
                                                            ? 'border-[#17314f] bg-[#17314f] text-white'
                                                            : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}`}
                                                    >
                                                        {chip.label}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <div className="ml-auto flex items-center gap-1.5">
                                            <Button type="button" className="h-8 rounded-md bg-[#17314f] px-3 text-[11px] font-semibold text-white shadow-sm hover:bg-[#10263f]" onClick={() => applyFilters()}>
                                                Применить
                                            </Button>
                                            <Button type="button" variant="outline" className="h-8 rounded-md border-slate-300 px-3 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-white" onClick={resetFilters}>
                                                Сбросить
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {items.length === 0 ? (
                                <div className="admin-empty-state">Пока нет поступивших заявок.</div>
                            ) : (
                                <div className="rounded-2xl border border-slate-300/80 bg-white shadow-[0_12px_24px_-18px_rgba(15,23,42,0.45)]">
                                    <div className="admin-table-wrap min-w-0 overflow-x-auto border-0 shadow-none">
                                        <table className="admin-data-table w-full min-w-[1260px] table-fixed text-[13px] leading-[1.25] [&_th]:bg-slate-100/95 [&_th]:text-[11px] [&_th]:uppercase [&_th]:tracking-[0.14em] [&_th]:text-slate-700 [&_tr]:border-b [&_tr]:border-slate-200/85">
                                            <thead className="sticky top-0 z-10 backdrop-blur">
                                                <tr>
                                                    <th className="w-[5%]">ID</th>
                                                    <th className="w-[10%]">Тип</th>
                                                    <th className="w-[11%]">Локация</th>
                                                    <th className="w-[10%]">Контакт</th>
                                                    <th className="w-[19%]">Описание</th>
                                                    <th className="w-[12%]">Отправитель</th>
                                                    <th className="w-[10%]">Подразделение</th>
                                                    <th className="w-[10%]">Кто принял</th>
                                                    <th className="w-[8%]">Статус</th>
                                                    <th className="w-[11%]">Дата</th>
                                                </tr>
                                            </thead>
                                            <tbody className="[&_tr:hover]:bg-slate-50/70 [&_tr]:transition-colors">
                                                {items.map((ticket) => (
                                                    <tr key={ticket.id}>
                                                        <td className="px-2.5 py-2.5 align-top text-[12px] font-semibold text-slate-700">#{ticket.id}</td>

                                                        <td className="px-2.5 py-2.5 align-top">
                                                            <Badge variant="outline" className="inline-flex h-6 max-w-full items-center truncate rounded-full border-slate-300 bg-slate-100 px-2 py-0 text-[10px] font-semibold text-slate-700">
                                                                {ticket.type_label || ticket.type || '-'}
                                                            </Badge>
                                                        </td>

                                                        <td className="px-2.5 py-2.5 align-top">
                                                            <div className="line-clamp-2 text-[12px] leading-[1.1rem] text-slate-700" title={ticket.location_label || ''}>
                                                                {ticket.location_label || '-'}
                                                            </div>
                                                        </td>

                                                        <td className="px-2.5 py-2.5 align-top">
                                                            <div className="truncate text-[12px] font-medium text-slate-700" title={ticket.contact || ''}>
                                                                {ticket.contact || '-'}
                                                            </div>
                                                        </td>

                                                        <td className="px-2.5 py-2.5 align-top">
                                                            <div className="line-clamp-2 text-[12px] leading-[1.1rem] text-slate-600" title={ticket.description || ''}>
                                                                {ticket.description || '-'}
                                                            </div>
                                                        </td>

                                                        <td className="px-2.5 py-2.5 align-top">
                                                            <div className="space-y-0.5">
                                                                <div className="line-clamp-1 text-[12px] font-semibold text-slate-800" title={ticket.sender_label || ''}>
                                                                    {ticket.sender_label || 'Гость'}
                                                                </div>
                                                                <div className="line-clamp-1 text-[11px] text-slate-500" title={ticket.sender_email || ''}>
                                                                    {ticket.sender_email || '—'}
                                                                </div>
                                                            </div>
                                                        </td>

                                                        <td className="px-2.5 py-2.5 align-top">
                                                            <div className="line-clamp-2 text-[12px] text-slate-600" title={ticket.department_label || ''}>
                                                                {ticket.department_label || '-'}
                                                            </div>
                                                        </td>

                                                        <td className="px-2.5 py-2.5 align-top">
                                                            <div className="line-clamp-2 text-[12px] text-slate-700" title={ticket.accepted_by_label || ''}>
                                                                {ticket.accepted_by_label || '—'}
                                                            </div>
                                                            {ticket.is_unassigned && (
                                                                <div className="mt-1 inline-flex h-5 items-center rounded-full border border-amber-200 bg-amber-50 px-1.5 text-[10px] font-semibold text-amber-800">
                                                                    Не назначена
                                                                </div>
                                                            )}
                                                        </td>

                                                        <td className="px-2.5 py-2.5 align-top">
                                                            <StatusControl
                                                                ticketId={ticket.id}
                                                                current={ticket.status}
                                                                isOverdue={Boolean(ticket.is_overdue)}
                                                            />
                                                        </td>

                                                        <td className="px-2.5 py-2.5 align-top">
                                                            <div className="flex items-start gap-1.5 text-slate-600">
                                                                <Clock3 className="mt-0.5 h-3 w-3 shrink-0" />
                                                                <div className="min-w-0 space-y-0.5">
                                                                    <div className="truncate text-[12px] font-medium text-slate-700" title={ticket.created_at_display || ''}>
                                                                        {ticket.created_at_display || '-'}
                                                                    </div>
                                                                    <div className="truncate text-[10px] text-slate-500" title={ticket.created_at_human || ''}>
                                                                        {ticket.created_at_human || '-'}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {links.length > 3 && (
                                <div className="flex flex-wrap items-center justify-end gap-1.5 rounded-xl border border-slate-200 bg-slate-100/80 px-3 py-2">
                                    {links.map((link, index) => (
                                        <Button
                                            key={`${link.label}-${index}`}
                                            variant={link.active ? 'default' : 'outline'}
                                            size="sm"
                                            className={`h-8 rounded-md px-2.5 text-xs shadow-sm ${link.active ? 'bg-[#17314f] hover:bg-[#10263f]' : 'border-slate-300 bg-white'}`}
                                            disabled={!link.url}
                                            asChild={Boolean(link.url)}
                                        >
                                            {link.url ? (
                                                <Link href={link.url} dangerouslySetInnerHTML={{ __html: link.label }} />
                                            ) : (
                                                <span dangerouslySetInnerHTML={{ __html: link.label }} />
                                            )}
                                        </Button>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
