import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { ArrowLeft, CalendarPlus, ChevronLeft, ChevronRight, Clock, User } from 'lucide-react';
import { useMemo, useState } from 'react';

// ── constants ─────────────────────────────────────────────────────────────────
const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTH_NAMES = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

const STATUS_LABELS = { available: 'Доступен', busy: 'Занят', soon: 'Скоро', dnd: 'Не беспокоить' };
const STATUS_COLORS = { available: 'bg-green-500', busy: 'bg-red-500', soon: 'bg-yellow-400', dnd: 'bg-gray-400' };

const TYPE_META = {
    meeting: { label: 'Встреча', bg: 'bg-blue-500/15 border-blue-500', text: 'text-blue-700 dark:text-blue-300' },
    vacation: { label: 'Отпуск', bg: 'bg-green-500/15 border-green-500', text: 'text-green-700 dark:text-green-300' },
    business_trip: { label: 'Командировка', bg: 'bg-violet-500/15 border-violet-500', text: 'text-violet-700 dark:text-violet-300' },
    sick_leave: { label: 'Больничный', bg: 'bg-orange-500/15 border-orange-400', text: 'text-orange-700 dark:text-orange-300' },
    personal: { label: 'Личное', bg: 'bg-pink-500/15 border-pink-400', text: 'text-pink-700 dark:text-pink-300' },
    remote: { label: 'Удалённая работа', bg: 'bg-teal-500/15 border-teal-500', text: 'text-teal-700 dark:text-teal-300' },
    other: { label: 'Другое', bg: 'bg-gray-200 border-gray-400', text: 'text-gray-700 dark:text-gray-300' },
};

const EVENT_STYLE = {
    conflict: { bg: 'bg-red-500/15 border-red-500', text: 'text-red-700 dark:text-red-300', label: 'Конфликт' },
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
        <div className={`rounded border-l-[3px] px-1.5 py-0.5 ${s.bg} text-[10px] leading-tight`}>
            <p className={`font-medium truncate ${s.text}`}>{event.title}</p>
        </div>
    );
}

// ── MonthCalendar ─────────────────────────────────────────────────────────────
function MonthCalendar({ year, month, events, selectedDay, onDayClick }) {
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
            <CardContent className="p-0">
                <div className="grid grid-cols-7 border-b">
                    {WEEKDAYS_SHORT.map((wd, i) => (
                        <div key={wd} className={`py-2 text-center text-xs font-medium text-muted-foreground ${i >= 5 ? 'text-destructive/60' : ''}`}>
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
                                    'min-h-[80px] border-b border-r p-1.5 flex flex-col gap-1 last:border-r-0',
                                    day ? 'cursor-pointer hover:bg-muted/40 transition-colors' : 'bg-muted/10',
                                    isPastDay ? 'bg-gray-100/80 text-muted-foreground' : '',
                                    isSelected ? 'bg-primary/5 ring-1 ring-inset ring-primary/20' : '',
                                ].join(' ')}
                            >
                                {day && (
                                    <>
                                        <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full shrink-0 self-start
                                            ${isToday ? 'bg-primary text-primary-foreground' : isPastDay ? 'text-muted-foreground' : isWeekend ? 'text-destructive/70' : ''}`}>
                                            {day}
                                        </span>
                                        {dayEvts.slice(0, 2).map((e, i) => <EventChip key={i} event={e} />)}
                                        {dayEvts.length > 2 && (
                                            <span className="text-[10px] text-muted-foreground">+{dayEvts.length - 2} ещё</span>
                                        )}
                                    </>
                                )}
                            </div>
                        );
                    })}
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
            <CardHeader className="py-3 px-4 border-b flex flex-row items-center justify-between">
                <CardTitle className="text-sm capitalize">{dateLabel}</CardTitle>
                <Button size="sm" variant="outline" onClick={() => onMeeting(day)}>
                    <CalendarPlus className="size-3.5 mr-1" />
                    Встреча на этот день
                </Button>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
                {dayEvents.length === 0 && (
                    <p className="text-sm text-muted-foreground">Событий нет</p>
                )}
                {dayEvents.map(event => {
                    const s = event.status === 'conflict' ? EVENT_STYLE.conflict : (TYPE_META[event.type] ?? TYPE_META.other);
                    return (
                        <div key={event.id} className={`rounded-lg border-l-4 p-3 ${s.bg}`}>
                            <div className="flex flex-wrap items-center gap-2">
                                <p className={`text-sm font-semibold ${s.text}`}>{event.title}</p>
                                <Badge variant="outline" className="text-[10px] py-0">
                                    {event.status === 'conflict' ? 'Конфликт' : (TYPE_META[event.type]?.label ?? event.type)}
                                </Badge>
                            </div>
                            <div className="flex items-center gap-1.5 mt-1.5">
                                <Clock className="size-3 text-muted-foreground" />
                                <p className="text-xs text-muted-foreground">
                                    {fmtTime(event.starts_at)} — {fmtTime(event.ends_at)}
                                </p>
                            </div>
                            {event.with_name && (
                                <p className="text-xs text-muted-foreground mt-1">
                                    С участником:{' '}
                                    {event.with_id
                                        ? <Link href={route('calendar.employees.profile', { employee: event.with_id })} className="font-medium underline hover:opacity-75">{event.with_name}</Link>
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
                    <div className="space-y-1">
                        <Label>Участник</Label>
                        <div className="flex items-center gap-2 rounded-md border px-3 py-2 bg-muted/40">
                            <User className="size-4 text-muted-foreground" />
                            <span className="text-sm">{employee?.name}</span>
                            {employee?.title && <Badge variant="outline" className="text-[10px] py-0">{employee.title}</Badge>}
                        </div>
                    </div>

                    {/* title */}
                    <div className="space-y-1">
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
                        <div className="space-y-1">
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
                        <div className="space-y-1">
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
                        <div className="rounded-md border border-amber-300 bg-amber-50 text-amber-800 px-3 py-2 text-sm flex gap-2">
                            <span>⚠️</span>
                            <span>
                                <strong>{employee?.name}</strong> {BLOCKING_TYPE_LABELS[busyConflict.type] ?? 'занят'} в это время
                                {busyConflict.title ? ` («${busyConflict.title}»)` : ''}. Пожалуйста, выберите другую дату.
                            </span>
                        </div>
                    )}

                    {/* description */}
                    <div className="space-y-1">
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
                        <div className="space-y-1">
                            <Label>Формат</Label>
                            <select
                                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                                value={data.format}
                                onChange={e => setData('format', e.target.value)}
                            >
                                <option value="offline">Офлайн</option>
                                <option value="online">Онлайн</option>
                            </select>
                        </div>
                        <div className="space-y-1">
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

    return (
        <AuthenticatedLayout>
            <Head title={`Календарь — ${employee?.name ?? 'Сотрудник'}`} />
            <div className="admin-page-wrap">
                {!!flash?.warning && (
                    <div className="rounded-md border border-amber-300 bg-amber-50 text-amber-800 px-3 py-2 text-sm">
                        {flash.warning}
                    </div>
                )}
                {!!flash?.error && (
                    <div className="rounded-md border border-red-300 bg-red-50 text-red-800 px-3 py-2 text-sm whitespace-pre-line">
                        {flash.error}
                    </div>
                )}
                {!!flash?.success && (
                    <div className="rounded-md border border-emerald-300 bg-emerald-50 text-emerald-800 px-3 py-2 text-sm">
                        {flash.success}
                    </div>
                )}

                {/* top bar */}
                <div className="flex flex-wrap items-center gap-2 justify-between">
                    <Button variant="outline" size="sm" asChild>
                        <Link href={route('calendar.employees')}>
                            <ArrowLeft className="size-4 mr-1" />Назад к сотрудникам
                        </Link>
                    </Button>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" asChild>
                            <Link href={route('calendar.employees.profile', { employee: employee.id, year: prev.getFullYear(), month: prev.getMonth() + 1 })}>
                                <ChevronLeft className="size-4" />
                            </Link>
                        </Button>
                        <span className="text-sm font-semibold min-w-[200px] text-center capitalize">{monthLabel}</span>
                        <Button variant="outline" size="icon" asChild>
                            <Link href={route('calendar.employees.profile', { employee: employee.id, year: next.getFullYear(), month: next.getMonth() + 1 })}>
                                <ChevronRight className="size-4" />
                            </Link>
                        </Button>
                    </div>
                    {!isCurrentMonth && (
                        <Button variant="outline" size="sm" asChild>
                            <Link href={route('calendar.employees.profile', { employee: employee.id, year: today.getFullYear(), month: today.getMonth() + 1 })}>
                                Сегодня
                            </Link>
                        </Button>
                    )}
                </div>

                {/* employee info */}
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0">
                            <User className="size-6 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-base font-semibold leading-tight">{employee?.name}</p>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                                {employee?.title && <Badge variant="outline">{employee.title}</Badge>}
                                {employee?.department && <Badge variant="outline">{employee.department}</Badge>}
                                {employee?.room && <Badge variant="outline">Каб. {employee.room}</Badge>}
                                {employee?.email && <Badge variant="outline">{employee.email}</Badge>}
                                {employee?.phone && <Badge variant="outline">{employee.phone}</Badge>}
                            </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                            <div className="flex items-center gap-1.5">
                                <span className={`w-2.5 h-2.5 rounded-full ${STATUS_COLORS[employee?.calendar_status] ?? 'bg-gray-400'}`} />
                                <span className="text-sm text-muted-foreground">
                                    {STATUS_LABELS[employee?.calendar_status] ?? 'Нет статуса'}
                                </span>
                            </div>
                            <Button size="sm" onClick={() => openMeeting()}>
                                <CalendarPlus className="size-4 mr-1.5" />
                                Предложить встречу
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* calendar grid */}
                <MonthCalendar
                    year={year}
                    month={monthIdx}
                    events={events}
                    selectedDay={selectedDay}
                    onDayClick={setSelectedDay}
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
