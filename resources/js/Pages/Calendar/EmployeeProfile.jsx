import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Notice, PageHeader, StatusBadge, qdFieldClass } from '@/components/platform';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { ArrowLeft, CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, Clock, Mail, MapPin, Phone, User } from 'lucide-react';
import { useMemo, useState } from 'react';

// ── constants ─────────────────────────────────────────────────────────────────
const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTH_NAMES = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

const STATUS_LABELS = { available: 'Доступен', busy: 'Занят', soon: 'Скоро', dnd: 'Не беспокоить' };
const STATUS_COLORS = { available: 'bg-emerald-600', busy: 'bg-red-600', soon: 'bg-amber-500', dnd: 'bg-slate-400' };
const STATUS_TONES = { available: 'success', busy: 'danger', soon: 'warning', dnd: 'default' };

const TYPE_META = {
    meeting: { label: 'Встреча', bg: 'bg-blue-50 border-blue-600', text: 'text-blue-800', dot: 'bg-blue-600' },
    vacation: { label: 'Отпуск', bg: 'bg-emerald-50 border-emerald-600', text: 'text-emerald-800', dot: 'bg-emerald-600' },
    business_trip: { label: 'Командировка', bg: 'bg-orange-50 border-orange-600', text: 'text-orange-800', dot: 'bg-orange-600' },
    sick_leave: { label: 'Больничный', bg: 'bg-amber-50 border-amber-500', text: 'text-amber-800', dot: 'bg-amber-500' },
    personal: { label: 'Личное', bg: 'bg-slate-100 border-[#102945]', text: 'text-[#102945]', dot: 'bg-[#102945]' },
    remote: { label: 'Удалённая работа', bg: 'bg-teal-50 border-teal-600', text: 'text-teal-800', dot: 'bg-teal-600' },
    other: { label: 'Другое', bg: 'bg-slate-100 border-slate-400', text: 'text-slate-700', dot: 'bg-slate-400' },
};

const EVENT_STYLE = {
    conflict: { bg: 'bg-red-50 border-red-600', text: 'text-red-800', label: 'Конфликт' },
};

// ── helpers ───────────────────────────────────────────────────────────────────
function getMonthCells(year, month) {
    const firstDay = new Date(year, month, 1);
    const totalDays = new Date(year, month + 1, 0).getDate();
    const startOffset = (firstDay.getDay() + 6) % 7;
    const cells = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) cells.push(d);
    return cells;
}
function fmtTime(dt) {
    if (!dt) return '';
    return new Date(dt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

// ── EventChip ─────────────────────────────────────────────────────────────────
function EventChip({ event }) {
    const s = event.status === 'conflict' ? EVENT_STYLE.conflict : (TYPE_META[event.type] ?? TYPE_META.other);
    return (
        <div className={`rounded-[6px] border-l-[3px] px-1.5 py-0.5 ${s.bg} text-[10px] leading-tight`}>
            <p className={`font-medium truncate ${s.text}`}>{event.title}</p>
        </div>
    );
}

// ── MonthCalendar ─────────────────────────────────────────────────────────────
function MonthCalendar({ year, month, events, selectedDay, onDayClick, title = null, toolbar = null }) {
    const cells = useMemo(() => getMonthCells(year, month), [year, month]);
    const today = new Date();

    const byDay = useMemo(() => {
        const m = {};
        events.forEach(e => {
            const start = new Date(e.starts_at);
            const end = e.ends_at ? new Date(e.ends_at) : new Date(e.starts_at);
            const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
            const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
            while (cursor <= last) {
                if (cursor.getFullYear() === year && cursor.getMonth() === month) {
                    const day = cursor.getDate();
                    if (!m[day]) m[day] = [];
                    m[day].push(e);
                }
                cursor.setDate(cursor.getDate() + 1);
            }
        });
        return m;
    }, [events, year, month]);

    return (
        <Card>
            {(title || toolbar) && (
                <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <CardTitle className="flex items-center gap-2 capitalize">
                            <CalendarDays className="shrink-0" />
                            {title}
                        </CardTitle>
                        {toolbar}
                    </div>
                </CardHeader>
            )}
            <CardContent className="p-0">
                <div className="grid grid-cols-7 border-b border-slate-200">
                    {WEEKDAYS_SHORT.map((wd, i) => (
                        <div key={wd} className={`py-2 text-center text-[0.6875rem] font-bold uppercase tracking-[0.1em] ${i >= 5 ? 'text-red-600/70' : 'text-slate-500'}`}>
                            {wd}
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-7">
                    {cells.map((day, idx) => {
                        const isWeekend = idx % 7 >= 5;
                        const isToday = day && today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
                        const isPastDay = day && new Date(year, month, day).setHours(0, 0, 0, 0) < new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
                        const isSelected = day === selectedDay;
                        const dayEvts = day ? (byDay[day] ?? []) : [];

                        return (
                            <div
                                key={idx}
                                onClick={() => day && onDayClick(day)}
                                className={[
                                    'min-h-[84px] border-b border-r border-slate-200 p-1.5 flex flex-col gap-1 last:border-r-0 [&:nth-child(7n)]:border-r-0',
                                    day ? 'cursor-pointer hover:bg-teal-50/60 transition-colors' : 'bg-slate-50',
                                    isPastDay ? 'bg-slate-50 text-slate-400' : '',
                                    isSelected ? 'bg-teal-50 ring-1 ring-inset ring-teal-600/40' : '',
                                ].join(' ')}
                            >
                                {day && (
                                    <>
                                        <span className={`text-xs font-semibold tabular-nums w-7 h-7 flex items-center justify-center rounded-full shrink-0 self-start
                                            ${isToday ? 'bg-teal-700 text-white' : isPastDay ? 'text-slate-400' : isWeekend ? 'text-red-600/80' : 'text-slate-800'}`}>
                                            {day}
                                        </span>
                                        {dayEvts.slice(0, 2).map((e, i) => <EventChip key={i} event={e} />)}
                                        {dayEvts.length > 2 && (
                                            <span className="text-[10px] font-medium text-slate-500">+{dayEvts.length - 2} ещё</span>
                                        )}
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-5 py-3 text-xs text-slate-600">
                    {Object.entries(TYPE_META).map(([key, meta]) => (
                        <span key={key} className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${meta.dot}`} />{meta.label}</span>
                    ))}
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-600" />Конфликт</span>
                </div>
            </CardContent>
        </Card>
    );
}

// ── DayPanel ──────────────────────────────────────────────────────────────────
function DayPanel({ day, year, month, events, onMeeting }) {
    if (!day) return null;

    const dayEvents = events.filter(e => {
        const currentDay = new Date(year, month, day);
        currentDay.setHours(0, 0, 0, 0);
        const start = new Date(e.starts_at);
        start.setHours(0, 0, 0, 0);
        const end = new Date(e.ends_at ?? e.starts_at);
        end.setHours(0, 0, 0, 0);
        return start <= currentDay && currentDay <= end;
    });

    const dateLabel = new Date(year, month, day).toLocaleDateString('ru-RU', {
        weekday: 'long', day: 'numeric', month: 'long',
    });

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <CardTitle className="flex items-center gap-2">
                        <Clock className="shrink-0" />
                        <span className="capitalize">{dateLabel}</span>
                    </CardTitle>
                    <Button size="sm" variant="outline" onClick={() => onMeeting(day)}>
                        <CalendarPlus className="size-3.5" />
                        Встреча на этот день
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                {dayEvents.length === 0 && (
                    <p className="py-4 text-center text-sm text-slate-500">Событий нет</p>
                )}
                {dayEvents.map(event => {
                    const s = event.status === 'conflict' ? EVENT_STYLE.conflict : (TYPE_META[event.type] ?? TYPE_META.other);
                    return (
                        <div key={event.id} className={`rounded-[10px] border-l-4 p-3.5 ${s.bg}`}>
                            <div className="flex flex-wrap items-center gap-2">
                                <p className={`text-sm font-semibold ${s.text}`}>{event.title}</p>
                                <Badge variant="outline" className="bg-white">
                                    {event.status === 'conflict' ? 'Конфликт' : (TYPE_META[event.type]?.label ?? event.type)}
                                </Badge>
                            </div>
                            <div className="flex items-center gap-1.5 mt-1.5">
                                <Clock className="size-3 text-slate-500" />
                                <p className="text-xs tabular-nums text-slate-600">
                                    {fmtTime(event.starts_at)} — {fmtTime(event.ends_at)}
                                </p>
                            </div>
                            {event.with_name && (
                                <p className="text-xs text-slate-600 mt-1">
                                    С участником:{' '}
                                    {event.with_id
                                        ? <Link href={route('calendar.employees.profile', { employee: event.with_id })} className="font-semibold text-teal-700 underline underline-offset-2 hover:text-[#102945]">{event.with_name}</Link>
                                        : <span className="font-medium">{event.with_name}</span>
                                    }
                                </p>
                            )}
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
}

// ── helpers for datetime-local input ─────────────────────────────────────────
function toLocalISO(date) {
    const pad = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function nowLocalISO() {
    return toLocalISO(new Date());
}

function normalizeRange(startValue, endValue, minValue) {
    const safeStart = startValue < minValue ? minValue : startValue;
    let safeEnd = endValue;

    if (safeEnd <= safeStart) {
        const d = new Date(safeStart);
        d.setHours(d.getHours() + 1);
        safeEnd = toLocalISO(d);
    }

    return { starts_at: safeStart, ends_at: safeEnd };
}

// ── MeetingModal ──────────────────────────────────────────────────────────────
const BLOCKING_TYPES = ['vacation', 'business_trip', 'sick_leave', 'personal', 'remote', 'other'];
const BLOCKING_TYPE_LABELS = {
    vacation: 'в отпуске',
    business_trip: 'в командировке',
    sick_leave: 'на больничном',
    personal: 'занят личными делами',
    remote: 'на удалённой работе',
    other: 'занят',
};

function MeetingModal({ open, onClose, employee, defaultDay, events = [] }) {
    const buildInitialRange = () => {
        const minDateTime = nowLocalISO();
        const d = defaultDay ? new Date(defaultDay) : new Date();
        const start = new Date(d);
        const end = new Date(d);
        start.setHours(10, 0, 0, 0);
        end.setHours(11, 0, 0, 0);
        return normalizeRange(toLocalISO(start), toLocalISO(end), minDateTime);
    };

    const minDateTime = nowLocalISO();
    const initialRange = buildInitialRange();

    const { data, setData, post, processing, errors, reset } = useForm({
        type: 'meeting',
        title: '',
        attendee_id: employee?.id ?? '',
        starts_at: initialRange.starts_at,
        ends_at: initialRange.ends_at,
        description: '',
        format: 'offline',
        room: employee?.room ?? '',
    });

    // reset times when defaultDay changes
    const handleOpen = () => {
        const nextRange = buildInitialRange();
        setData(prev => ({
            ...prev,
            starts_at: nextRange.starts_at,
            ends_at: nextRange.ends_at,
            attendee_id: employee?.id ?? '',
            room: employee?.room ?? prev.room,
        }));
    };

    // Check if employee has a blocking event overlapping the selected time
    const busyConflict = useMemo(() => {
        if (!data.starts_at || !data.ends_at) return null;
        const selStart = new Date(data.starts_at);
        const selEnd = new Date(data.ends_at);
        return events.find(e => {
            if (!BLOCKING_TYPES.includes(e.type)) return false;
            const eStart = new Date(e.starts_at);
            const eEnd = e.ends_at ? new Date(e.ends_at) : new Date(e.starts_at);
            return selStart < eEnd && selEnd > eStart;
        }) ?? null;
    }, [events, data.starts_at, data.ends_at]);

    const submit = (e) => {
        e.preventDefault();
        post(route('calendar.events.store'), {
            onSuccess: () => { reset(); onClose(); },
        });
    };

    return (
        <Dialog open={open} onOpenChange={v => { if (!v) onClose(); else handleOpen(); }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Предложить встречу</DialogTitle>
                </DialogHeader>
                <form onSubmit={submit} className="space-y-4 pt-1">
                    {/* attendee (readonly) */}
                    <div className="space-y-2">
                        <Label>Участник</Label>
                        <div className="flex items-center gap-2 rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2">
                            <User className="size-4 text-teal-700" />
                            <span className="text-sm font-medium text-slate-900">{employee?.name}</span>
                            {employee?.title && <Badge variant="outline">{employee.title}</Badge>}
                        </div>
                    </div>

                    {/* title */}
                    <div className="space-y-2">
                        <Label htmlFor="m-title">Тема встречи <span className="text-destructive">*</span></Label>
                        <Input
                            id="m-title"
                            value={data.title}
                            onChange={e => setData('title', e.target.value)}
                            placeholder="Обсуждение проекта..."
                            required
                        />
                        {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
                    </div>

                    {/* time */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label htmlFor="m-start">Начало <span className="text-destructive">*</span></Label>
                            <Input
                                id="m-start"
                                type="datetime-local"
                                min={minDateTime}
                                value={data.starts_at}
                                onChange={e => setData('starts_at', e.target.value)}
                                required
                            />
                            {errors.starts_at && <p className="text-xs text-destructive">{errors.starts_at}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="m-end">Конец <span className="text-destructive">*</span></Label>
                            <Input
                                id="m-end"
                                type="datetime-local"
                                min={data.starts_at || minDateTime}
                                value={data.ends_at}
                                onChange={e => setData('ends_at', e.target.value)}
                                required
                            />
                            {errors.ends_at && <p className="text-xs text-destructive">{errors.ends_at}</p>}
                        </div>
                    </div>

                    {/* availability warning */}
                    {busyConflict && (
                        <Notice tone="warning">
                            <strong>{employee?.name}</strong> {BLOCKING_TYPE_LABELS[busyConflict.type] ?? 'занят'} в это время
                            {busyConflict.title ? ` («${busyConflict.title}»)` : ''}. Пожалуйста, выберите другую дату.
                        </Notice>
                    )}

                    {/* description */}
                    <div className="space-y-2">
                        <Label htmlFor="m-desc">Описание</Label>
                        <Textarea
                            id="m-desc"
                            value={data.description}
                            onChange={e => setData('description', e.target.value)}
                            placeholder="Повестка, место встречи..."
                            rows={3}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label>Формат</Label>
                            <select
                                className={qdFieldClass}
                                value={data.format}
                                onChange={e => setData('format', e.target.value)}
                            >
                                <option value="offline">Офлайн</option>
                                <option value="online">Онлайн</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label>Кабинет</Label>
                            <Input value={data.room} onChange={e => setData('room', e.target.value)} placeholder="Кабинет" />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose} disabled={processing}>Отмена</Button>
                        <Button type="submit" disabled={processing || !!busyConflict}>
                            {processing ? 'Отправка...' : 'Отправить встречу'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function CalendarEmployeeProfile({ employee, events = [], year, month }) {
    const { flash = {} } = usePage().props;
    // month is 1-based from backend, convert to 0-based for JS Date
    const monthIdx = (month ?? 1) - 1;
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === monthIdx;

    const [selectedDay, setSelectedDay] = useState(isCurrentMonth ? today.getDate() : 1);
    const [meetingOpen, setMeetingOpen] = useState(false);
    const [meetingDay, setMeetingDay] = useState(null);

    const openMeeting = (day = null) => {
        const d = day
            ? new Date(year, monthIdx, day)
            : new Date();
        setMeetingDay(d);
        setMeetingOpen(true);
    };

    const prev = new Date(year, monthIdx - 1, 1);
    const next = new Date(year, monthIdx + 1, 1);

    const monthLabel = `${MONTH_NAMES[monthIdx]} ${year}`;

    const statusKey = employee?.calendar_status;

    const monthNav = (
        <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" asChild>
                <Link href={route('calendar.employees.profile', { employee: employee.id, year: prev.getFullYear(), month: prev.getMonth() + 1 })} aria-label="Предыдущий месяц">
                    <ChevronLeft className="size-4" />
                </Link>
            </Button>
            {!isCurrentMonth && (
                <Button variant="outline" size="sm" asChild>
                    <Link href={route('calendar.employees.profile', { employee: employee.id, year: today.getFullYear(), month: today.getMonth() + 1 })}>
                        Сегодня
                    </Link>
                </Button>
            )}
            <Button variant="outline" size="icon" asChild>
                <Link href={route('calendar.employees.profile', { employee: employee.id, year: next.getFullYear(), month: next.getMonth() + 1 })} aria-label="Следующий месяц">
                    <ChevronRight className="size-4" />
                </Link>
            </Button>
        </div>
    );

    return (
        <AuthenticatedLayout
            header={(
                <div className="space-y-5">
                    <PageHeader
                        eyebrow="Календарь сотрудника"
                        title={employee?.name ?? 'Сотрудник'}
                        description={[employee?.title, employee?.department].filter(Boolean).join(' · ') || null}
                        meta={(
                            <StatusBadge tone={STATUS_TONES[statusKey] ?? 'default'}>
                                <span className={`mr-1.5 h-2 w-2 rounded-full ${STATUS_COLORS[statusKey] ?? 'bg-slate-400'}`} />
                                {STATUS_LABELS[statusKey] ?? 'Нет статуса'}
                            </StatusBadge>
                        )}
                        actions={(
                            <>
                                <Button variant="outline" asChild>
                                    <Link href={route('calendar.employees')}>
                                        <ArrowLeft className="size-4" />Назад к сотрудникам
                                    </Link>
                                </Button>
                                <Button onClick={() => openMeeting()}>
                                    <CalendarPlus className="size-4" />
                                    Предложить встречу
                                </Button>
                            </>
                        )}
                    />
                    {(employee?.room || employee?.email || employee?.phone) && (
                        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
                            {employee?.room && <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-teal-700" />Каб. {employee.room}</span>}
                            {employee?.email && <span className="flex items-center gap-1.5"><Mail className="h-4 w-4 text-teal-700" />{employee.email}</span>}
                            {employee?.phone && <span className="flex items-center gap-1.5"><Phone className="h-4 w-4 text-teal-700" />{employee.phone}</span>}
                        </div>
                    )}
                </div>
            )}
        >
            <Head title={`Календарь — ${employee?.name ?? 'Сотрудник'}`} />
            <div className="admin-page-wrap space-y-6">
                {!!flash?.warning && (
                    <Notice tone="warning">{flash.warning}</Notice>
                )}
                {!!flash?.error && (
                    <Notice tone="danger"><span className="whitespace-pre-line">{flash.error}</span></Notice>
                )}
                {!!flash?.success && (
                    <Notice tone="success">{flash.success}</Notice>
                )}

                {/* calendar grid */}
                <MonthCalendar
                    year={year}
                    month={monthIdx}
                    events={events}
                    selectedDay={selectedDay}
                    onDayClick={setSelectedDay}
                    title={monthLabel}
                    toolbar={monthNav}
                />

                {/* selected day events */}
                <DayPanel
                    day={selectedDay}
                    year={year}
                    month={monthIdx}
                    events={events}
                    onMeeting={openMeeting}
                />

                <MeetingModal
                    open={meetingOpen}
                    onClose={() => setMeetingOpen(false)}
                    employee={employee}
                    defaultDay={meetingDay}
                    events={events}
                />
            </div>
        </AuthenticatedLayout>
    );
}
