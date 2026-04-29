import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
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
        badge: 'border-red-300 bg-red-500 text-white',
        icon: Radio,
        iconWrap: 'border-red-200 bg-red-100 text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300',
        card: 'border-red-300 bg-red-50/50 dark:bg-red-950/10',
    },
    confirmed: {
        label: 'Запланирована',
        badge: 'border-emerald-300 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
        icon: Clock3,
        iconWrap: 'border-sky-200 bg-sky-50 text-sky-600 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-300',
        card: 'border-border/70',
    },
    pending: {
        label: 'Ожидает',
        badge: 'border-amber-300 bg-amber-500/10 text-amber-700 dark:text-amber-300',
        icon: Clock3,
        iconWrap: 'border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300',
        card: 'border-border/70',
    },
    conflict: {
        label: 'Конфликт',
        badge: 'border-red-300 bg-red-500/10 text-red-700 dark:text-red-300',
        icon: AlertTriangle,
        iconWrap: 'border-red-200 bg-red-50 text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300',
        card: 'border-red-300 bg-red-50/40 dark:bg-red-950/10',
    },
    completed: {
        label: 'Завершена',
        badge: 'border-border bg-muted/60 text-muted-foreground',
        icon: CheckCircle2,
        iconWrap: 'border-border bg-muted/60 text-muted-foreground',
        card: 'border-border/70 opacity-85',
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
        { label: 'Всего за неделю', value: tagged.length, icon: CalendarDays },
        { label: 'Идут сейчас', value: liveCount, icon: Video },
        { label: 'Предстоящие', value: upcomingCount, icon: Clock3 },
        { label: 'Конфликты', value: conflictCount, icon: AlertTriangle },
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
        <AuthenticatedLayout>
            <Head title="Smart Calendar — Конференции" />
            <div className="w-full max-w-none space-y-5 p-4 sm:p-6 xl:p-8">
                {!!flash?.error && <div className="whitespace-pre-line rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-200">{flash.error}</div>}
                {!!flash?.warning && <div className="whitespace-pre-line rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">{flash.warning}</div>}
                {!!flash?.success && <div className="whitespace-pre-line rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">{flash.success}</div>}

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(24rem,34rem)]">
                    <div className="rounded-lg border border-border/70 bg-background p-4 sm:p-5">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                                <p className="text-sm font-semibold">Zoom конференции</p>
                                <p className="mt-1 max-w-3xl text-xs text-muted-foreground">Онлайн-встречи текущей недели, быстрый запуск Zoom и приглашения выбранным сотрудникам.</p>
                            </div>
                            <Badge variant="outline" className="w-fit shrink-0">Каталог: {employees.length}</Badge>
                        </div>
                        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                            {summaryItems.map(item => (
                                <div key={item.label} className="rounded-md border border-border/70 bg-muted/20 px-3 py-2.5">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-[11px] text-muted-foreground">{item.label}</span>
                                        <item.icon className="size-3.5 text-muted-foreground" />
                                    </div>
                                    <p className="mt-1 text-xl font-semibold leading-none">{item.value}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <Card className="border-border/70">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Ближайшая встреча</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {tagged[0] ? (
                                <div className="space-y-3">
                                    <div className="flex items-start gap-3">
                                        <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-sky-200 bg-sky-50 text-sky-600 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-300">
                                            <Video className="size-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold">{tagged[0].title}</p>
                                            <p className="mt-1 text-xs text-muted-foreground">{fmt(tagged[0].starts_at, { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <Badge variant="outline" className={STATUS_META[tagged[0].tag]?.badge}>{STATUS_META[tagged[0].tag]?.label ?? 'Запланирована'}</Badge>
                                        <Badge variant="outline">{durationText(tagged[0].durationMinutes)}</Badge>
                                    </div>
                                </div>
                            ) : (
                                <p className="py-5 text-sm text-muted-foreground">На этой неделе конференций нет.</p>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] 2xl:items-start">
                    <Card className="border-border/70">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <CardTitle className="text-sm">Создать конференцию</CardTitle>
                                    <p className="mt-1 text-xs text-muted-foreground">Тема, время, описание и выбранные участники отправляются в Zoom и календарь.</p>
                                </div>
                                <Plus className="size-4 text-muted-foreground" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={submitConference} className="space-y-4">
                                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_12rem_12rem]">
                                    <div className="space-y-1">
                                        <Label>Тема</Label>
                                        <Input
                                            value={form.data.title}
                                            onChange={(e) => form.setData('title', e.target.value)}
                                            placeholder="Например: Встреча по аккредитации"
                                            required
                                        />
                                        {form.errors.title && <p className="text-xs text-red-600">{form.errors.title}</p>}
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Начало</Label>
                                        <Input
                                            type="datetime-local"
                                            value={form.data.starts_at}
                                            onChange={(e) => form.setData('starts_at', e.target.value)}
                                            required
                                        />
                                        {form.errors.starts_at && <p className="text-xs text-red-600">{form.errors.starts_at}</p>}
                                    </div>
                                    <div className="space-y-1">
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

                                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_12rem]">
                                    <div className="space-y-1">
                                        <Label>Описание</Label>
                                        <Textarea
                                            value={form.data.description}
                                            onChange={(e) => form.setData('description', e.target.value)}
                                            placeholder="Повестка, материалы, ожидаемый результат"
                                            className="min-h-24"
                                        />
                                        {form.errors.description && <p className="text-xs text-red-600">{form.errors.description}</p>}
                                    </div>
                                    <div className="rounded-md border border-border/70 bg-muted/20 p-3">
                                        <p className="text-[11px] text-muted-foreground">Длительность</p>
                                        <p className="mt-1 text-lg font-semibold">{durationText(formDuration)}</p>
                                        <p className="mt-3 text-[11px] text-muted-foreground">Участники</p>
                                        <p className="mt-1 text-lg font-semibold">{selectedCount}</p>
                                    </div>
                                </div>

                                <div className="rounded-lg border border-border/70">
                                    <div className="flex flex-col gap-3 border-b p-3 lg:flex-row lg:items-center lg:justify-between">
                                        <div className="min-w-0">
                                            <Label>Участники</Label>
                                            {form.errors.attendee_ids && <p className="mt-1 text-xs text-red-600">{form.errors.attendee_ids}</p>}
                                        </div>
                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                            <div className="relative sm:w-72">
                                                <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                                                <Input
                                                    className="pl-8"
                                                    value={employeeSearch}
                                                    onChange={(e) => setEmployeeSearch(e.target.value)}
                                                    placeholder="ФИО, должность, email"
                                                />
                                            </div>
                                            <Button type="button" variant="outline" onClick={selectVisibleEmployees} disabled={filteredEmployees.length === 0}>Выбрать</Button>
                                            <Button type="button" variant="outline" onClick={clearAttendees} disabled={selectedCount === 0}>Очистить</Button>
                                        </div>
                                    </div>

                                    {selectedEmployees.length > 0 && (
                                        <div className="flex flex-wrap gap-2 border-b bg-muted/20 p-3">
                                            {selectedEmployees.slice(0, 8).map(employee => (
                                                <button
                                                    key={employee.id}
                                                    type="button"
                                                    onClick={() => toggleAttendee(employee.id)}
                                                    className="inline-flex max-w-full items-center gap-2 rounded-md border bg-background px-2.5 py-1.5 text-xs hover:bg-muted"
                                                >
                                                    <span className="truncate">{employee.name}</span>
                                                    <X className="size-3" />
                                                </button>
                                            ))}
                                            {selectedEmployees.length > 8 && <Badge variant="outline">+{selectedEmployees.length - 8}</Badge>}
                                        </div>
                                    )}

                                    <div className="grid max-h-[24rem] overflow-auto md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-2">
                                        {filteredEmployees.length === 0 ? (
                                            <p className="col-span-full px-3 py-8 text-center text-sm text-muted-foreground">Сотрудники не найдены.</p>
                                        ) : (
                                            filteredEmployees.map((employee) => {
                                                const checked = (form.data.attendee_ids ?? []).includes(Number(employee.id));

                                                return (
                                                    <button
                                                        key={employee.id}
                                                        type="button"
                                                        onClick={() => toggleAttendee(employee.id)}
                                                        className="flex min-w-0 items-start gap-3 border-b border-r px-3 py-3 text-left transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                    >
                                                        <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold ${checked ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                                                            {checked ? <Check className="size-4" /> : initials(employee.name)}
                                                        </span>
                                                        <span className="min-w-0">
                                                            <span className="block truncate text-sm font-medium">{employee.name}</span>
                                                            <span className="mt-0.5 block truncate text-xs text-muted-foreground">{employee.title || employee.email || 'Без должности'}</span>
                                                        </span>
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
                                    <p className="text-xs text-muted-foreground">Zoom создается после сохранения, приглашения уходят выбранным сотрудникам.</p>
                                    <Button type="submit" disabled={form.processing || !isFormReady}>
                                        <Video className="mr-2 size-4" />
                                        Сгенерировать Zoom
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    <Card className="border-border/70">
                        <CardHeader className="pb-3">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                <div>
                                    <CardTitle className="text-sm">Онлайн-встречи недели</CardTitle>
                                    <p className="mt-1 text-xs text-muted-foreground">{visibleConferences.length} из {tagged.length}</p>
                                </div>
                                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem] lg:w-[26rem]">
                                    <div className="relative">
                                        <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                                        <Input
                                            className="pl-8"
                                            value={meetingSearch}
                                            onChange={(e) => setMeetingSearch(e.target.value)}
                                            placeholder="Тема или организатор"
                                        />
                                    </div>
                                    <NativeSelect value={statusFilter} onValueChange={setStatusFilter} options={statusOptions} />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {visibleConferences.length === 0 && (
                                <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">Нет конференций по выбранным условиям.</div>
                            )}

                            {visibleConferences.map(conference => {
                                const meta = STATUS_META[conference.tag] ?? STATUS_META.confirmed;
                                const StatusIcon = meta.icon;

                                return (
                                    <div key={conference.id} className={`rounded-lg border p-3 ${meta.card}`}>
                                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                            <div className="flex min-w-0 gap-3">
                                                <div className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md border ${meta.iconWrap}`}>
                                                    <Video className="size-4" />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <Badge variant="outline" className={`gap-1 text-[10px] ${conference.tag === 'live' ? 'animate-pulse' : ''} ${meta.badge}`}>
                                                            <StatusIcon className="size-3" />
                                                            {meta.label}
                                                        </Badge>
                                                        <Badge variant="outline" className="text-[10px]">{durationText(conference.durationMinutes)}</Badge>
                                                    </div>
                                                    <p className="mt-2 truncate text-sm font-semibold">{conference.title}</p>
                                                    <p className="mt-1 truncate text-xs text-muted-foreground">{conference.organizer} · {conference.organizer_title || 'Без должности'}</p>
                                                    <p className="mt-1 text-xs text-muted-foreground">
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
                                                    <Badge variant="outline" className="text-[10px]">Ссылка недоступна</Badge>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}