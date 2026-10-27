import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { EmptyState, FilterBar, PageHeader, StatGrid, StatTile, UnderlineTabs, qdFieldClass } from '@/components/platform';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Head, Link, router } from '@inertiajs/react';
import { CalendarClock, CalendarDays, CircleCheck, Clock3, Inbox, Layers, Loader, RefreshCw, Search } from 'lucide-react';
import { useState } from 'react';

const statusMeta = {
    new: { label: 'Новая', variant: 'info' },
    in_progress: { label: 'В работе', variant: 'warning' },
    closed: { label: 'Закрыта', variant: 'success' },
};

const statusFilterChips = [
    { key: '', label: 'Все', countKey: 'total' },
    { key: 'new', label: 'Новые', countKey: 'new' },
    { key: 'in_progress', label: 'В работе', countKey: 'in_progress' },
    { key: 'closed', label: 'Закрытые', countKey: 'closed' },
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

    const meta = statusMeta[value] ?? { label: value, variant: 'secondary' };

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
                <Badge variant={meta.variant}>{meta.label}</Badge>
                {isOverdue && value !== 'closed' && (
                    <Badge variant="destructive">Просрочена</Badge>
                )}
            </div>

            <select
                className="h-8 w-full rounded-[10px] border border-slate-300 bg-white px-2 text-xs text-slate-800 transition-colors hover:border-slate-400 focus:border-teal-600 focus:outline-none focus:ring-[3px] focus:ring-teal-600/20 disabled:bg-slate-100"
                value={value}
                onChange={handleChange}
                disabled={saving}
                aria-label="Изменить статус"
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

    const overdue = summaryCounts?.overdue ?? 0;

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
                <PageHeader
                    eyebrow="Service Desk"
                    title="Заявки"
                    description="Поступившие заявки и обращения пользователей: назначение, статус и сроки обработки."
                    meta={(
                        <>
                            <Badge variant="secondary">Всего: {summaryCounts?.total ?? 0}</Badge>
                            <Badge variant={overdue > 0 ? 'destructive' : 'success'}>Просроченные: {overdue}</Badge>
                        </>
                    )}
                />
            )}
        >
            <Head title="Заявки" />

            <div className="admin-page-wrap space-y-6">
                <StatGrid>
                    <StatTile label="Новые" value={summaryCounts?.new ?? 0} icon={Inbox} tone="info" />
                    <StatTile label="В работе" value={summaryCounts?.in_progress ?? 0} icon={Loader} tone="warning" />
                    <StatTile label="Закрытые" value={summaryCounts?.closed ?? 0} icon={CircleCheck} tone="success" />
                    <StatTile label="Всего" value={summaryCounts?.total ?? 0} icon={Layers} tone="navy" />
                    <StatTile label="Сегодня" value={summaryCounts?.today ?? 0} icon={CalendarClock} tone="teal" />
                    <StatTile label="За неделю" value={summaryCounts?.week ?? 0} icon={CalendarDays} tone="gold" />
                </StatGrid>

                <UnderlineTabs
                    items={statusFilterChips.map((chip) => ({
                        key: chip.key,
                        label: chip.label,
                        count: summaryCounts?.[chip.countKey] ?? 0,
                    }))}
                    value={localFilters.status}
                    onChange={(key) => {
                        const next = { ...localFilters, status: key };
                        setLocalFilters(next);
                        applyFilters(next);
                    }}
                />

                <FilterBar>
                    <div className="grid min-w-0 gap-x-3 gap-y-4 md:grid-cols-2 xl:grid-cols-12">
                        <label className={`space-y-2 md:col-span-2 ${canFilterByDepartment ? 'xl:col-span-4' : 'xl:col-span-6'}`}>
                            <span className="qd-field-label block">Поиск</span>
                            <span className="relative block">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <Input
                                    value={localFilters.q}
                                    onChange={(event) => setFilter('q', event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                            applyFilters();
                                        }
                                    }}
                                    placeholder="#ID, тип, контакт, отправитель, описание"
                                    className="pl-9"
                                />
                            </span>
                        </label>

                        {canFilterByDepartment && (
                            <label className="space-y-2 xl:col-span-2">
                                <span className="qd-field-label block">Подразделение</span>
                                <select
                                    className={qdFieldClass}
                                    value={localFilters.department}
                                    onChange={(event) => setFilter('department', event.target.value)}
                                >
                                    <option value="">Подразделение: все</option>
                                    {departments.map((department) => (
                                        <option key={department} value={department}>{department}</option>
                                    ))}
                                </select>
                            </label>
                        )}

                        <label className="space-y-2 xl:col-span-2">
                            <span className="qd-field-label block">Тип</span>
                            <select
                                className={qdFieldClass}
                                value={localFilters.type}
                                onChange={(event) => setFilter('type', event.target.value)}
                            >
                                <option value="">Тип: все</option>
                                {types.map((ticketType) => (
                                    <option key={ticketType} value={ticketType}>{ticketType}</option>
                                ))}
                            </select>
                        </label>

                        <label className="space-y-2 xl:col-span-2">
                            <span className="qd-field-label block">Ответственный</span>
                            <select
                                className={qdFieldClass}
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
                        </label>

                        <label className="space-y-2 xl:col-span-2">
                            <span className="qd-field-label block">Период</span>
                            <select
                                className={qdFieldClass}
                                value={localFilters.period}
                                onChange={(event) => setFilter('period', event.target.value)}
                            >
                                {periodOptions.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                        </label>

                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4 md:col-span-2 xl:col-span-12">
                            <span className="text-xs font-medium text-slate-500">
                                Показано {tickets?.from ?? 0}–{tickets?.to ?? 0} из {tickets?.total ?? items.length}
                            </span>
                            <div className="ml-auto flex items-center gap-2">
                                <Button type="button" onClick={() => applyFilters()}>
                                    Применить
                                </Button>
                                <Button type="button" variant="outline" onClick={resetFilters}>
                                    <RefreshCw />
                                    Сбросить
                                </Button>
                            </div>
                        </div>
                    </div>
                </FilterBar>

                {items.length === 0 ? (
                    <EmptyState
                        title="Пока нет поступивших заявок"
                        description="Когда пользователи отправят обращение, оно появится здесь. Если заявки ожидаются — проверьте фильтры."
                        action={(
                            <Button variant="outline" onClick={resetFilters}>
                                <RefreshCw />
                                Сбросить фильтры
                            </Button>
                        )}
                    />
                ) : (
                    <Card className="overflow-hidden">
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[1260px] table-fixed text-[13px] leading-[1.3]">
                                    <thead>
                                        <tr>
                                            <th className="w-[5%] text-left">ID</th>
                                            <th className="w-[10%] text-left">Тип</th>
                                            <th className="w-[11%] text-left">Локация</th>
                                            <th className="w-[10%] text-left">Контакт</th>
                                            <th className="w-[19%] text-left">Описание</th>
                                            <th className="w-[12%] text-left">Отправитель</th>
                                            <th className="w-[10%] text-left">Подразделение</th>
                                            <th className="w-[10%] text-left">Кто принял</th>
                                            <th className="w-[8%] text-left">Статус</th>
                                            <th className="w-[11%] text-left">Дата</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((ticket) => (
                                            <tr key={ticket.id} className="border-b border-slate-200 align-top last:border-0 hover:bg-slate-50">
                                                <td className="font-semibold tabular-nums text-slate-900">#{ticket.id}</td>

                                                <td>
                                                    <Badge variant="secondary" className="max-w-full truncate">
                                                        {ticket.type_label || ticket.type || '-'}
                                                    </Badge>
                                                </td>

                                                <td>
                                                    <div className="line-clamp-2 text-slate-700" title={ticket.location_label || ''}>
                                                        {ticket.location_label || '-'}
                                                    </div>
                                                </td>

                                                <td>
                                                    <div className="truncate font-medium text-slate-700" title={ticket.contact || ''}>
                                                        {ticket.contact || '-'}
                                                    </div>
                                                </td>

                                                <td>
                                                    <div className="line-clamp-2 text-slate-600" title={ticket.description || ''}>
                                                        {ticket.description || '-'}
                                                    </div>
                                                </td>

                                                <td>
                                                    <div className="line-clamp-1 font-semibold text-slate-900" title={ticket.sender_label || ''}>
                                                        {ticket.sender_label || 'Гость'}
                                                    </div>
                                                    <div className="line-clamp-1 text-xs text-slate-500" title={ticket.sender_email || ''}>
                                                        {ticket.sender_email || '—'}
                                                    </div>
                                                </td>

                                                <td>
                                                    <div className="line-clamp-2 text-slate-600" title={ticket.department_label || ''}>
                                                        {ticket.department_label || '-'}
                                                    </div>
                                                </td>

                                                <td>
                                                    <div className="line-clamp-2 text-slate-700" title={ticket.accepted_by_label || ''}>
                                                        {ticket.accepted_by_label || '—'}
                                                    </div>
                                                    {ticket.is_unassigned && (
                                                        <Badge variant="warning" className="mt-1">Не назначена</Badge>
                                                    )}
                                                </td>

                                                <td>
                                                    <StatusControl
                                                        ticketId={ticket.id}
                                                        current={ticket.status}
                                                        isOverdue={Boolean(ticket.is_overdue)}
                                                    />
                                                </td>

                                                <td>
                                                    <div className="flex items-start gap-1.5 text-slate-600">
                                                        <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                                                        <div className="min-w-0 space-y-0.5">
                                                            <div className="truncate font-medium tabular-nums text-slate-700" title={ticket.created_at_display || ''}>
                                                                {ticket.created_at_display || '-'}
                                                            </div>
                                                            <div className="truncate text-[11px] text-slate-500" title={ticket.created_at_human || ''}>
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
                            {links.length > 3 && (
                                <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 px-5 py-3 sm:px-6 justify-end">
                                    {links.map((link, index) => (
                                        <Button
                                            key={`${link.label}-${index}`}
                                            variant={link.active ? 'default' : 'outline'}
                                            size="sm"
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
                )}
            </div>
        </AuthenticatedLayout>
    );
}
