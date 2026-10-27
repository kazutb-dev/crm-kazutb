import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Notice, PageHeader, StatGrid, StatTile, StatusBadge } from '@/components/platform';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    CalendarDays,
    Check,
    CheckCircle2,
    Clock3,
    ExternalLink,
    Link2,
    Plus,
    Radio,
    Search,
    Video,
    X,
} from 'lucide-react';
import { useMemo, useState } from 'react';

function fmt(dt, opts) {
    if (!dt) return '—';
    return new Date(dt).toLocaleString('ru-RU', opts);
}

function minutesBetween(startsAt, endsAt) {
    if (!startsAt || !endsAt) return 0;

    const start = new Date(startsAt);
    const end = new Date(endsAt);
    const minutes = Math.round((end - start) / 60000);

    return Number.isFinite(minutes) && minutes > 0 ? minutes : 0;
}

function durationText(minutes) {
    if (!minutes) return '—';

    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;

    if (hours === 0) return `${rest} мин`;
    if (rest === 0) return `${hours} ч`;

    return `${hours} ч ${rest} мин`;
}

function initials(name) {
    return String(name ?? '')
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(part => part[0])
        .join('')
        .toUpperCase() || '—';
}

const STATUS_META = {
    live: {
        label: 'Идет сейчас',
        tone: 'danger',
        icon: Radio,
        iconWrap: 'border-red-200 bg-red-50 text-red-700',
        rail: 'bg-red-600',
    },
    confirmed: {
        label: 'Запланирована',
        tone: 'success',
        icon: Clock3,
        iconWrap: 'border-blue-200 bg-blue-50 text-blue-700',
        rail: 'bg-emerald-600',
    },
    pending: {
        label: 'Ожидает',
        tone: 'warning',
        icon: Clock3,
        iconWrap: 'border-amber-200 bg-amber-50 text-amber-700',
        rail: 'bg-amber-500',
    },
    conflict: {
        label: 'Конфликт',
        tone: 'danger',
        icon: AlertTriangle,
        iconWrap: 'border-red-200 bg-red-50 text-red-700',
        rail: 'bg-red-600',
    },
    completed: {
        label: 'Завершена',
        tone: 'default',
        icon: CheckCircle2,
        iconWrap: 'border-slate-200 bg-slate-100 text-slate-500',
        rail: 'bg-slate-300',
    },
};

const statusOptions = [
    { value: 'all', label: 'Все статусы' },
    { value: 'live', label: 'Идет сейчас' },
    { value: 'confirmed', label: 'Запланированные' },
    { value: 'pending', label: 'Ожидают' },
    { value: 'conflict', label: 'Конфликты' },
    { value: 'completed', label: 'Завершенные' },
];

export default function CalendarConferences({ conferences = [], employees = [] }) {
    const { flash = {} } = usePage().props;
    const now = new Date();
    const [employeeSearch, setEmployeeSearch] = useState('');
    const [meetingSearch, setMeetingSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    const form = useForm({
        title: '',
        description: '',
        starts_at: '',
        ends_at: '',
        attendee_ids: [],
    });

    const tagged = useMemo(() => conferences.map(conference => {
        const start = new Date(conference.starts_at);
        const end = new Date(conference.ends_at);
        let tag = conference.status ?? 'confirmed';

        if (end < now) tag = 'completed';
        else if (start <= now && end >= now) tag = 'live';

        return {
            ...conference,
            tag,
            durationMinutes: minutesBetween(conference.starts_at, conference.ends_at),
        };
    }), [conferences]);

    const filteredEmployees = useMemo(() => {
        const query = employeeSearch.trim().toLowerCase();
        if (query === '') return employees;

        return employees.filter((employee) => {
            const haystack = `${employee.name ?? ''} ${employee.title ?? ''} ${employee.email ?? ''}`.toLowerCase();
            return haystack.includes(query);
        });
    }, [employees, employeeSearch]);

    const selectedEmployees = useMemo(() => {
        const selectedIds = new Set((form.data.attendee_ids ?? []).map(Number));
        return employees.filter(employee => selectedIds.has(Number(employee.id)));
    }, [employees, form.data.attendee_ids]);

    const visibleConferences = useMemo(() => {
        const query = meetingSearch.trim().toLowerCase();

        return tagged.filter((conference) => {
            const statusMatches = statusFilter === 'all' || conference.tag === statusFilter;
            const searchMatches = query === '' || `${conference.title ?? ''} ${conference.organizer ?? ''} ${conference.organizer_title ?? ''}`.toLowerCase().includes(query);

            return statusMatches && searchMatches;
        });
    }, [meetingSearch, statusFilter, tagged]);

    const selectedCount = (form.data.attendee_ids ?? []).length;
    const formDuration = minutesBetween(form.data.starts_at, form.data.ends_at);
    const liveCount = tagged.filter(item => item.tag === 'live').length;
    const upcomingCount = tagged.filter(item => ['confirmed', 'pending', 'conflict'].includes(item.tag)).length;
    const conflictCount = tagged.filter(item => item.tag === 'conflict').length;
    const isFormReady = form.data.title.trim() !== ''
        && form.data.starts_at !== ''
        && form.data.ends_at !== ''
        && selectedCount > 0;

    const summaryItems = [
        { label: 'Всего за неделю', value: tagged.length, icon: CalendarDays, tone: 'teal' },
        { label: 'Идут сейчас', value: liveCount, icon: Video, tone: liveCount > 0 ? 'danger' : 'neutral' },
        { label: 'Предстоящие', value: upcomingCount, icon: Clock3, tone: 'info' },
        { label: 'Конфликты', value: conflictCount, icon: AlertTriangle, tone: conflictCount > 0 ? 'danger' : 'neutral' },
    ];

    function toggleAttendee(id) {
        const attendeeId = Number(id);
        const current = new Set((form.data.attendee_ids ?? []).map(Number));

        if (current.has(attendeeId)) {
            current.delete(attendeeId);
        } else {
            current.add(attendeeId);
        }

        form.setData('attendee_ids', Array.from(current));
    }

    function selectVisibleEmployees() {
        const current = new Set((form.data.attendee_ids ?? []).map(Number));
        filteredEmployees.forEach(employee => current.add(Number(employee.id)));
        form.setData('attendee_ids', Array.from(current));
    }

    function clearAttendees() {
        form.setData('attendee_ids', []);
    }

    function submitConference(e) {
        e.preventDefault();
        form.post(route('calendar.conferences.store'), {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                setEmployeeSearch('');
            },
        });
    }

    function cancelConference(conference) {
        const reason = window.prompt('Укажите причину отмены конференции');
        if (!reason) return;

        router.patch(route('calendar.events.cancel', conference.id), { reason }, { preserveScroll: true });
    }

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="Smart Calendar"
                    title="Zoom конференции"
                    description="Онлайн-встречи текущей недели, быстрый запуск Zoom и приглашения выбранным сотрудникам."
                    meta={<StatusBadge tone="default">Каталог: {employees.length}</StatusBadge>}
                />
            )}
        >
            <Head title="Smart Calendar — Конференции" />
            <div className="admin-page-wrap space-y-6">
                {!!flash?.error && <Notice tone="danger"><span className="whitespace-pre-line">{flash.error}</span></Notice>}
                {!!flash?.warning && <Notice tone="warning"><span className="whitespace-pre-line">{flash.warning}</span></Notice>}
                {!!flash?.success && <Notice tone="success"><span className="whitespace-pre-line">{flash.success}</span></Notice>}

                <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(22rem,30rem)]">
                    <StatGrid>
                        {summaryItems.map(item => (
                            <StatTile key={item.label} label={item.label} value={item.value} icon={item.icon} tone={item.tone} />
                        ))}
                    </StatGrid>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Video className="shrink-0" />
                                Ближайшая встреча
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {tagged[0] ? (
                                <div className="space-y-3">
                                    <div className="flex items-start gap-3">
                                        <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-blue-200 bg-blue-50 text-blue-700">
                                            <Video className="size-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-display text-lg font-bold leading-snug text-[#102945]">{tagged[0].title}</p>
                                            <p className="mt-1 text-sm tabular-nums text-slate-600">{fmt(tagged[0].starts_at, { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} — {fmt(tagged[0].ends_at, { hour: '2-digit', minute: '2-digit' })}</p>
                                            {tagged[0].organizer && <p className="mt-0.5 truncate text-xs text-slate-500">{tagged[0].organizer}{tagged[0].organizer_title ? ` · ${tagged[0].organizer_title}` : ''}</p>}
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-3">
                                        <StatusBadge tone={STATUS_META[tagged[0].tag]?.tone ?? 'success'}>{STATUS_META[tagged[0].tag]?.label ?? 'Запланирована'}</StatusBadge>
                                        <Badge variant="outline">{durationText(tagged[0].durationMinutes)}</Badge>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-slate-500">На этой неделе конференций нет.</p>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] 2xl:items-start">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Plus className="shrink-0" />
                                Создать конференцию
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={submitConference} className="space-y-4">
                                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                    <div className="space-y-2 md:col-span-2">
                                        <Label>Тема</Label>
                                        <Input
                                            value={form.data.title}
                                            onChange={(e) => form.setData('title', e.target.value)}
                                            placeholder="Например: Встреча по аккредитации"
                                            required
                                        />
                                        {form.errors.title && <p className="text-xs text-red-600">{form.errors.title}</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Начало</Label>
                                        <Input
                                            type="datetime-local"
                                            value={form.data.starts_at}
                                            onChange={(e) => form.setData('starts_at', e.target.value)}
                                            required
                                        />
                                        {form.errors.starts_at && <p className="text-xs text-red-600">{form.errors.starts_at}</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Окончание</Label>
                                        <Input
                                            type="datetime-local"
                                            value={form.data.ends_at}
                                            onChange={(e) => form.setData('ends_at', e.target.value)}
                                            required
                                        />
                                        {form.errors.ends_at && <p className="text-xs text-red-600">{form.errors.ends_at}</p>}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Описание</Label>
                                    <Textarea
                                        value={form.data.description}
                                        onChange={(e) => form.setData('description', e.target.value)}
                                        placeholder="Повестка, материалы, ожидаемый результат"
                                        className="min-h-20"
                                    />
                                    {form.errors.description && <p className="text-xs text-red-600">{form.errors.description}</p>}
                                </div>

                                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                                    <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                                        <div className="min-w-0">
                                            <Label>Участники <span className="ml-1 tabular-nums text-slate-500">{selectedCount} / {employees.length}</span></Label>
                                            {form.errors.attendee_ids && <p className="mt-1 text-xs text-red-600">{form.errors.attendee_ids}</p>}
                                        </div>
                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                            <div className="relative sm:w-72">
                                                <Search className="pointer-events-none absolute left-3 top-3 size-4 text-slate-400" />
                                                <Input
                                                    className="pl-9"
                                                    value={employeeSearch}
                                                    onChange={(e) => setEmployeeSearch(e.target.value)}
                                                    placeholder="ФИО, должность, email"
                                                />
                                            </div>
                                            <div className="flex gap-2">
                                                <Button type="button" variant="outline" onClick={selectVisibleEmployees} disabled={filteredEmployees.length === 0}>Выбрать</Button>
                                                <Button type="button" variant="ghost" onClick={clearAttendees} disabled={selectedCount === 0}>Очистить</Button>
                                            </div>
                                        </div>
                                    </div>

                                    {selectedEmployees.length > 0 && (
                                        <div className="flex flex-wrap gap-2 border-b border-slate-200 bg-teal-50/50 p-3">
                                            {selectedEmployees.slice(0, 8).map(employee => (
                                                <button
                                                    key={employee.id}
                                                    type="button"
                                                    onClick={() => toggleAttendee(employee.id)}
                                                    className="inline-flex max-w-full items-center gap-2 rounded-full border border-teal-200 bg-white px-3 py-1 text-xs font-medium text-[#102945] hover:border-teal-400"
                                                >
                                                    <span className="truncate">{employee.name}</span>
                                                    <X className="size-3 text-slate-500" />
                                                </button>
                                            ))}
                                            {selectedEmployees.length > 8 && <Badge variant="secondary">+{selectedEmployees.length - 8}</Badge>}
                                        </div>
                                    )}

                                    <div className="grid max-h-[22rem] overflow-auto md:grid-cols-2 xl:grid-cols-3">
                                        {filteredEmployees.length === 0 ? (
                                            <p className="col-span-full px-3 py-6 text-center text-sm text-slate-500">Сотрудники не найдены.</p>
                                        ) : (
                                            filteredEmployees.map((employee) => {
                                                const checked = (form.data.attendee_ids ?? []).includes(Number(employee.id));

                                                return (
                                                    <button
                                                        key={employee.id}
                                                        type="button"
                                                        onClick={() => toggleAttendee(employee.id)}
                                                        className={`flex min-w-0 items-center gap-2.5 border-b border-r border-slate-200 px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/30 ${checked ? 'bg-teal-50/60' : 'hover:bg-slate-50'}`}
                                                    >
                                                        <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${checked ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
                                                            {checked ? <Check className="size-4" /> : initials(employee.name)}
                                                        </span>
                                                        <span className="min-w-0">
                                                            <span className="block truncate text-sm font-medium text-slate-900">{employee.name}</span>
                                                            <span className="mt-0.5 block truncate text-xs text-slate-500">{employee.title || employee.email || 'Без должности'}</span>
                                                        </span>
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                                        <span>Длительность: <span className="font-semibold tabular-nums text-[#102945]">{durationText(formDuration)}</span></span>
                                        <span>Участники: <span className="font-semibold tabular-nums text-[#102945]">{selectedCount}</span></span>
                                        <span>Тема, время, описание и участники уходят в Zoom и календарь; приглашения — выбранным сотрудникам.</span>
                                    </div>
                                    <Button type="submit" disabled={form.processing || !isFormReady}>
                                        <Video className="size-4" />
                                        Сгенерировать Zoom
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                            <CardTitle className="flex items-center gap-2">
                                <CalendarDays className="shrink-0" />
                                Онлайн-встречи недели
                            </CardTitle>
                            <span className="text-xs font-medium tabular-nums text-slate-500">{visibleConferences.length} из {tagged.length}</span>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
                                <label className="relative block space-y-2">
                                    <span className="qd-field-label block">Поиск</span>
                                    <Search className="pointer-events-none absolute bottom-3 left-3 size-4 text-slate-400" />
                                    <Input
                                        className="pl-9"
                                        value={meetingSearch}
                                        onChange={(e) => setMeetingSearch(e.target.value)}
                                        placeholder="Тема или организатор"
                                    />
                                </label>
                                <div className="space-y-2">
                                    <span className="qd-field-label block">Статус</span>
                                    <NativeSelect value={statusFilter} onValueChange={setStatusFilter} options={statusOptions} />
                                </div>
                            </div>

                            {visibleConferences.length === 0 && (
                                <div className="flex flex-col items-center gap-2 py-8 text-center">
                                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-700"><Video className="h-5 w-5" /></span>
                                    <p className="font-display text-base font-bold text-[#102945]">Нет конференций по выбранным условиям.</p>
                                    <p className="max-w-sm text-sm text-slate-500">Измените поиск или статус, либо создайте конференцию в форме «Создать конференцию».</p>
                                </div>
                            )}

                            {visibleConferences.length > 0 && (
                                <div className="divide-y divide-slate-200 border-t border-slate-200">
                                    {visibleConferences.map(conference => {
                                        const meta = STATUS_META[conference.tag] ?? STATUS_META.confirmed;
                                        const StatusIcon = meta.icon;

                                        return (
                                            <div key={conference.id} className={`flex gap-3 py-2.5 ${conference.tag === 'completed' ? 'opacity-80' : ''}`}>
                                                <span className={`w-1 shrink-0 rounded-full ${meta.rail}`} />
                                                <div className="flex min-w-0 flex-1 flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                                    <div className="flex min-w-0 gap-3">
                                                        <div className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-[10px] border ${meta.iconWrap}`}>
                                                            <Video className="size-4" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <StatusBadge tone={meta.tone} className={`gap-1 ${conference.tag === 'live' ? 'animate-pulse' : ''}`}>
                                                                    <StatusIcon className="size-3" />
                                                                    {meta.label}
                                                                </StatusBadge>
                                                                <Badge variant="outline">{durationText(conference.durationMinutes)}</Badge>
                                                            </div>
                                                            <p className="mt-1 truncate text-sm font-semibold text-slate-900">{conference.title}</p>
                                                            <p className="mt-0.5 truncate text-xs text-slate-600">{conference.organizer} · {conference.organizer_title || 'Без должности'}</p>
                                                            <p className="mt-0.5 text-xs tabular-nums text-slate-500">
                                                                {fmt(conference.starts_at, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} — {fmt(conference.ends_at, { hour: '2-digit', minute: '2-digit' })}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex shrink-0 flex-wrap gap-2 md:justify-end">
                                                        {conference.can_cancel && conference.tag !== 'completed' && (
                                                            <Button size="sm" variant="destructive" onClick={() => cancelConference(conference)}>Отменить</Button>
                                                        )}
                                                        {conference.zoom_join_url ? (
                                                            <Button asChild size="sm" variant={conference.tag === 'live' ? 'default' : 'outline'}>
                                                                <a href={conference.zoom_join_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                                                                    {conference.tag === 'live' ? <ExternalLink className="size-3.5" /> : <Link2 className="size-3.5" />}
                                                                    Войти
                                                                </a>
                                                            </Button>
                                                        ) : (
                                                            <Badge variant="outline">Ссылка недоступна</Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
