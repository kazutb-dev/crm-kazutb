import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { AlertTriangle, Bell, CalendarDays, ChevronLeft, ChevronRight, Clock, MapPin, MessageSquare, Pencil, Plus, Search, Trash2, Video, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTH_NAMES = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const HOURS = Array.from({ length: 11 }, (_, i) => i + 8);

const EVENT_STYLE = {
    confirmed: { bg: 'bg-blue-500/15 border-blue-500', text: 'text-blue-700 dark:text-blue-300' },
    pending: { bg: 'bg-yellow-500/15 border-yellow-500', text: 'text-yellow-700 dark:text-yellow-300' },
    conflict: { bg: 'bg-red-500/15 border-red-500', text: 'text-red-700 dark:text-red-300' },
    completed: { bg: 'bg-gray-100 border-gray-300 dark:bg-gray-800 dark:border-gray-600', text: 'text-muted-foreground' },
};

const TYPE_META = {
    meeting: { label: 'Встреча', bg: 'bg-blue-500/15 border-blue-500', text: 'text-blue-700 dark:text-blue-300' },
    vacation: { label: 'Отпуск', bg: 'bg-green-500/15 border-green-500', text: 'text-green-700 dark:text-green-300' },
    business_trip: { label: 'Командировка', bg: 'bg-violet-500/15 border-violet-500', text: 'text-violet-700 dark:text-violet-300' },
    sick_leave: { label: 'Больничный', bg: 'bg-orange-500/15 border-orange-400', text: 'text-orange-700 dark:text-orange-300' },
    personal: { label: 'Личное', bg: 'bg-pink-500/15 border-pink-400', text: 'text-pink-700 dark:text-pink-300' },
    remote: { label: 'Удалённая работа', bg: 'bg-teal-500/15 border-teal-500', text: 'text-teal-700 dark:text-teal-300' },
    other: { label: 'Другое', bg: 'bg-gray-200 border-gray-400', text: 'text-gray-700 dark:text-gray-300' },
};

const TYPE_COLOR_HEX = {
    meeting: '#3b82f6',
    vacation: '#10b981',
    business_trip: '#8b5cf6',
    sick_leave: '#f97316',
    personal: '#ec4899',
    remote: '#14b8a6',
    other: '#6b7280',
};

const PRESET_COLORS = [
    '#3b82f6', '#10b981', '#8b5cf6', '#f97316', '#ec4899',
    '#14b8a6', '#6b7280', '#ef4444', '#f59e0b', '#06b6d4',
    '#84cc16', '#a855f7',
];

function getMonthCells(year, month) {
    const firstDay = new Date(year, month, 1);
    const totalDays = new Date(year, month + 1, 0).getDate();
    const startOffset = (firstDay.getDay() + 6) % 7;
    const cells = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) cells.push(d);
    return cells;
}

function getWeekDates(year, month, day) {
    const d = new Date(year, month, day);
    const dow = (d.getDay() + 6) % 7;
    const monday = new Date(d);
    monday.setDate(d.getDate() - dow);
    return Array.from({ length: 7 }, (_, i) => {
        const dd = new Date(monday);
        dd.setDate(monday.getDate() + i);
        return dd;
    });
}

function fmt(dt, opts) {
    if (!dt) return '';
    return new Date(dt).toLocaleString('ru-RU', opts);
}

function fmtTime(dt) {
    return fmt(dt, { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(dt) {
    return fmt(dt, { day: '2-digit', month: 'long', year: 'numeric' });
}

function toLocalDateInput(date = new Date()) {
    const pad = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toLocalDateTimeInput(date = new Date()) {
    const pad = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function normalizeRange(startValue, endValue, minValue) {
    const safeStart = startValue < minValue ? minValue : startValue;
    let safeEnd = endValue;

    if (safeEnd <= safeStart) {
        const d = new Date(safeStart);
        d.setHours(d.getHours() + 1);
        safeEnd = toLocalDateTimeInput(d);
    }

    return { starts_at: safeStart, ends_at: safeEnd };
}

function EventChip({ event, small = false, onClick }) {
    const s = event.status === 'conflict'
        ? EVENT_STYLE.conflict
        : (event.type && TYPE_META[event.type] ? TYPE_META[event.type] : (EVENT_STYLE[event.status] ?? EVENT_STYLE.confirmed));

    const customStyle = event.color
        ? { borderColor: event.color, backgroundColor: event.color + '26' }
        : {};

    return (
        <div
            className={`rounded border-l-[3px] px-1.5 py-0.5 ${event.color ? '' : s.bg} ${small ? 'text-[10px]' : 'text-xs'} ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
            style={customStyle}
            onClick={onClick}
        >
            <p className={`font-medium truncate ${event.color ? '' : s.text}`} style={event.color ? { color: event.color } : {}}>{event.title}</p>
            {!small && (
                <p className="text-muted-foreground truncate">
                    {fmtDate(event.starts_at)} {fmtTime(event.starts_at)} - {fmtDate(event.ends_at)} {fmtTime(event.ends_at)}
                </p>
            )}
            {!small && event.with_name && <p className="text-muted-foreground truncate">{event.with_name}</p>}
        </div>
    );
}

function MonthView({ year, month, events, holidays, onDayClick, onDayDoubleClick, selectedDay }) {
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

    const holidayDates = useMemo(() => {
        const s = new Set();
        (holidays ?? []).forEach(h => {
            if (!h?.date) return;
            s.add(h.date?.slice(0, 10));
        });
        return s;
    }, [holidays]);

    return (
        <Card>
            <CardContent className="p-0">
                <div className="grid grid-cols-7 border-b">
                    {WEEKDAYS_SHORT.map((wd, i) => (
                        <div key={wd} className={`py-2 text-center text-xs font-medium text-muted-foreground ${i >= 5 ? 'text-destructive/60' : ''}`}>{wd}</div>
                    ))}
                </div>
                <div className="grid grid-cols-7">
                    {cells.map((day, idx) => {
                        const isWeekend = idx % 7 >= 5;
                        const isToday = day && today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
                        const isPastDay = day && new Date(year, month, day).setHours(0, 0, 0, 0) < new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
                        const isSelected = day === selectedDay;
                        const dateStr = day ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '';
                        const isHoliday = holidayDates.has(dateStr);
                        const dayEvts = day ? (byDay[day] ?? []) : [];

                        return (
                            <div
                                key={idx}
                                onClick={() => day && onDayClick(day)}
                                onDoubleClick={() => day && onDayDoubleClick && onDayDoubleClick(day)}
                                className={[
                                    'min-h-[80px] border-b border-r p-1.5 flex flex-col gap-1 last:border-r-0',
                                    day ? 'cursor-pointer hover:bg-muted/40 transition-colors' : 'bg-muted/10',
                                    isPastDay ? 'bg-gray-100/80 text-muted-foreground' : '',
                                    isSelected ? 'bg-primary/5 ring-1 ring-inset ring-primary/20' : '',
                                ].join(' ')}
                            >
                                {day && (
                                    <>
                                        <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full shrink-0 ${isToday ? 'bg-primary text-primary-foreground' : isPastDay ? 'text-muted-foreground' : isHoliday || isWeekend ? 'text-destructive/70' : ''}`}>
                                            {day}
                                        </span>
                                        {dayEvts.slice(0, 2).map((e, i) => <EventChip key={i} event={e} small />)}
                                        {dayEvts.length > 2 && <span className="text-[10px] text-muted-foreground">+{dayEvts.length - 2} ещё</span>}
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

function WeekView({ year, month, day, events, onEventClick }) {
    const weekDates = useMemo(() => getWeekDates(year, month, day), [year, month, day]);
    const today = new Date();

    const byDayHour = useMemo(() => {
        const m = {};
        events.forEach(e => {
            const startD = new Date(e.starts_at);
            const endD = e.ends_at ? new Date(e.ends_at) : new Date(e.starts_at);
            weekDates.forEach(d => {
                const dStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
                const dEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
                if (startD <= dEnd && endD >= dStart) {
                    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
                    if (!m[key]) m[key] = [];
                    m[key].push(e);
                }
            });
        });
        return m;
    }, [events, weekDates]);

    return (
        <Card>
            <CardContent className="p-0 overflow-x-auto">
                <div className="min-w-[640px]">
                    <div className="grid border-b" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
                        <div className="border-r" />
                        {weekDates.map((d, i) => {
                            const isToday = today.toDateString() === d.toDateString();
                            return (
                                <div key={i} className={`text-center py-2 border-r last:border-r-0 ${isToday ? 'bg-primary/5' : ''}`}>
                                    <p className="text-xs text-muted-foreground">{WEEKDAYS_SHORT[(d.getDay() + 6) % 7]}</p>
                                    <p className={`text-sm font-semibold ${isToday ? 'text-primary' : ''}`}>{d.getDate()}</p>
                                </div>
                            );
                        })}
                    </div>
                    {HOURS.map(h => (
                        <div key={h} className="grid border-b" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
                            <div className="border-r px-1 py-1 text-right text-[10px] text-muted-foreground">{String(h).padStart(2, '0')}:00</div>
                            {weekDates.map((d, i) => {
                                const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
                                const slotEvts = (byDayHour[key] ?? []).filter(e => {
                                    const startD = new Date(e.starts_at);
                                    const endD = e.ends_at ? new Date(e.ends_at) : new Date(e.starts_at);
                                    const isFirstDay = startD.toDateString() === d.toDateString();
                                    const isLastDay = endD.toDateString() === d.toDateString();
                                    if (isFirstDay && isLastDay) return startD.getHours() <= h && h <= endD.getHours();
                                    if (isFirstDay) return startD.getHours() <= h;
                                    if (isLastDay) return h <= endD.getHours();
                                    return true;
                                });
                                return (
                                    <div key={i} className="border-r last:border-r-0 min-h-[48px] p-0.5 space-y-0.5">
                                        {slotEvts.map((e, j) => <EventChip key={j} event={e} small onClick={() => onEventClick?.(e)} />)}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

function DayView({ year, month, day, events, onEventClick }) {
    const date = new Date(year, month, day);
    const dayEvts = useMemo(() => events.filter(e => {
        const currentDay = new Date(year, month, day);
        currentDay.setHours(0, 0, 0, 0);

        const start = new Date(e.starts_at);
        start.setHours(0, 0, 0, 0);

        const end = new Date(e.ends_at ?? e.starts_at);
        end.setHours(0, 0, 0, 0);

        return start <= currentDay && currentDay <= end;
    }), [events, year, month, day]);

    return (
        <Card>
            <CardContent className="p-0">
                <div className="border-b px-4 py-2 text-sm font-medium">{fmtDate(date)}</div>
                <div>
                    {HOURS.map(h => {
                        const currentDay = new Date(year, month, day);
                        const slotEvts = dayEvts.filter(e => {
                            const startD = new Date(e.starts_at);
                            const endD = e.ends_at ? new Date(e.ends_at) : new Date(e.starts_at);
                            const isFirstDay = startD.toDateString() === currentDay.toDateString();
                            const isLastDay = endD.toDateString() === currentDay.toDateString();
                            if (isFirstDay && isLastDay) return startD.getHours() <= h && h <= endD.getHours();
                            if (isFirstDay) return startD.getHours() <= h;
                            if (isLastDay) return h <= endD.getHours();
                            return true;
                        });
                        return (
                            <div key={h} className="flex border-b min-h-[56px]">
                                <div className="w-14 shrink-0 border-r px-2 py-1 text-right text-xs text-muted-foreground">{String(h).padStart(2, '0')}:00</div>
                                <div className="flex-1 p-1 space-y-1">
                                    {slotEvts.map((e, i) => <EventChip key={i} event={e} onClick={() => onEventClick?.(e)} />)}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}

function AgendaView({ events, onEventClick }) {
    if (events.length === 0) {
        return <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Нет событий</CardContent></Card>;
    }

    return (
        <Card>
            <CardContent className="p-0 divide-y">
                {events.map(e => {
                    const s = e.status === 'conflict'
                        ? EVENT_STYLE.conflict
                        : (e.type && TYPE_META[e.type] ? TYPE_META[e.type] : (EVENT_STYLE[e.status] ?? EVENT_STYLE.confirmed));
                    const typeLabel = e.type && TYPE_META[e.type] ? TYPE_META[e.type].label : null;
                    return (
                        <div key={e.id} className={`flex gap-4 p-3 hover:bg-muted/30 ${onEventClick ? 'cursor-pointer' : ''}`} onClick={() => onEventClick?.(e)}>
                            <div className="w-24 shrink-0 text-xs text-muted-foreground pt-0.5">
                                <p>{fmt(e.starts_at, { day: '2-digit', month: 'short' })}</p>
                                <p>{fmtTime(e.starts_at)}</p>
                            </div>
                            <div className={`flex-1 rounded-lg border-l-[3px] px-3 py-2 ${s.bg}`}>
                                <p className={`font-medium text-sm ${s.text}`}>{e.title}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    {typeLabel && <Badge variant="outline" className="text-[10px] py-0">{typeLabel}</Badge>}
                                    {e.with_name && <span className="text-xs text-muted-foreground">{e.with_name}</span>}
                                    {e.format === 'online' && e.zoom_join_url && (
                                        <a href={e.zoom_join_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-500">
                                            <Video className="size-3" />Zoom
                                        </a>
                                    )}
                                </div>
                                {e.room && <p className="text-xs text-muted-foreground mt-0.5">Кабинет: {e.room}</p>}
                            </div>
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
}

function CreateEventModal({ open, onClose, defaultDate, employees = [], ownerId = null }) {
    const getInitialRange = () => {
        const baseDate = defaultDate ?? toLocalDateInput(new Date());
        const minDateTime = toLocalDateTimeInput(new Date());
        const proposedStart = `${baseDate}T09:00`;
        const proposedEnd = `${baseDate}T10:00`;
        return normalizeRange(proposedStart, proposedEnd, minDateTime);
    };

    const initialRange = getInitialRange();
    const minDateTime = toLocalDateTimeInput(new Date());

    const { data, setData, post, processing, errors, reset } = useForm({
        title: '',
        type: 'meeting',
        attendee_id: '',
        owner_id: ownerId ?? '',
        starts_at: initialRange.starts_at,
        ends_at: initialRange.ends_at,
        description: '',
        color: TYPE_COLOR_HEX.meeting,
    });

    useEffect(() => {
        setData('owner_id', ownerId ?? '');
    }, [ownerId]);

    const [suggestLoading, setSuggestLoading] = useState(false);
    const [suggestMessage, setSuggestMessage] = useState('');
    const [availabilityLoading, setAvailabilityLoading] = useState(false);
    const [availabilityError, setAvailabilityError] = useState('');
    const [availability, setAvailability] = useState({ events: [], busy_days: [], absence_days: [] });
    const [calendarCursor, setCalendarCursor] = useState(new Date());
    const [selectedCalendarDay, setSelectedCalendarDay] = useState('');

    const selectedEmployee = useMemo(
        () => employees.find(emp => String(emp.id) === String(data.attendee_id)),
        [employees, data.attendee_id],
    );

    function handleTypeChange(val) {
        const knownTitles = Object.values(TYPE_META).map(m => m.label);
        const nextTitle = (!data.title || knownTitles.includes(data.title)) ? (TYPE_META[val]?.label ?? data.title) : data.title;
        setData({
            ...data,
            type: val,
            title: nextTitle,
            attendee_id: val === 'meeting' ? data.attendee_id : '',
            color: TYPE_COLOR_HEX[val] ?? TYPE_COLOR_HEX.other,
        });
    }

    function submit(e) {
        e.preventDefault();
        post(route('calendar.events.store'), {
            onSuccess: () => {
                reset();
                onClose();
            },
        });
    }

    async function suggestFreeSlot() {
        if (!data.attendee_id) {
            setSuggestMessage('Сначала выберите сотрудника.');
            return;
        }

        setSuggestLoading(true);
        setSuggestMessage('');

        try {
            const params = new URLSearchParams({
                attendee_id: String(data.attendee_id),
                owner_id: String(data.owner_id ?? ''),
                starts_at: data.starts_at,
                ends_at: data.ends_at,
            });

            const res = await fetch(`/calendar/events/suggest-slot?${params.toString()}`, {
                method: 'GET',
                headers: { Accept: 'application/json' },
            });
            const payload = await res.json();

            if (payload?.found && payload.starts_at && payload.ends_at) {
                setData(prev => ({ ...prev, starts_at: payload.starts_at, ends_at: payload.ends_at }));
                setSuggestMessage('Найден ближайший свободный слот и подставлен в форму.');
            } else {
                setSuggestMessage(payload?.message ?? 'Свободный слот не найден.');
            }
        } catch {
            setSuggestMessage('Не удалось подобрать слот. Попробуйте снова.');
        } finally {
            setSuggestLoading(false);
        }
    }

    useEffect(() => {
        if (!open || data.type !== 'meeting' || !data.attendee_id) return;

        const year = calendarCursor.getFullYear();
        const month = calendarCursor.getMonth() + 1;
        let isCancelled = false;

        async function loadAvailability() {
            setAvailabilityLoading(true);
            setAvailabilityError('');
            try {
                const params = new URLSearchParams({ year: String(year), month: String(month) });
                const url = route('calendar.employees.availability', { employee: data.attendee_id }) + `?${params.toString()}`;
                const response = await fetch(url, { headers: { Accept: 'application/json' } });
                const payload = await response.json();
                if (!isCancelled) {
                    setAvailability({
                        events: payload.events ?? [],
                        busy_days: payload.busy_days ?? [],
                        absence_days: payload.absence_days ?? [],
                    });
                }
            } catch {
                if (!isCancelled) {
                    setAvailabilityError('Не удалось загрузить календарь сотрудника.');
                }
            } finally {
                if (!isCancelled) {
                    setAvailabilityLoading(false);
                }
            }
        }

        loadAvailability();
        return () => {
            isCancelled = true;
        };
    }, [open, data.type, data.attendee_id, calendarCursor]);

    const calendarYear = calendarCursor.getFullYear();
    const calendarMonth = calendarCursor.getMonth();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const calendarCells = useMemo(() => getMonthCells(calendarYear, calendarMonth), [calendarYear, calendarMonth]);
    const busyDaysSet = useMemo(() => new Set(availability.busy_days ?? []), [availability.busy_days]);
    const absenceDaysSet = useMemo(() => new Set(availability.absence_days ?? []), [availability.absence_days]);

    const selectedDayEvents = useMemo(() => {
        if (!selectedCalendarDay) return [];
        return (availability.events ?? []).filter(event => {
            const start = new Date(event.starts_at);
            start.setHours(0, 0, 0, 0);
            const end = new Date(event.ends_at ?? event.starts_at);
            end.setHours(0, 0, 0, 0);
            const target = new Date(selectedCalendarDay);
            target.setHours(0, 0, 0, 0);
            return start <= target && target <= end;
        });
    }, [availability.events, selectedCalendarDay]);

    const selectedDayHourSlots = useMemo(() => {
        if (!selectedCalendarDay) return [];
        const now = new Date();

        return HOURS.map(hour => {
            const day = new Date(selectedCalendarDay);
            const slotStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, 0, 0);
            const slotEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour + 1, 0, 0);
            const isPast = slotEnd <= now;

            const eventsInHour = selectedDayEvents.filter(event => {
                const eventStart = new Date(event.starts_at);
                const eventEnd = new Date(event.ends_at ?? event.starts_at);
                return eventStart < slotEnd && eventEnd > slotStart;
            });

            return { hour, events: eventsInHour, isPast };
        });
    }, [selectedCalendarDay, selectedDayEvents]);

    return (
        <Dialog
            open={open}
            onOpenChange={v => {
                if (!v) {
                    reset();
                    setSuggestMessage('');
                    setAvailability({ events: [], busy_days: [], absence_days: [] });
                    setSelectedCalendarDay('');
                    setCalendarCursor(new Date());
                    onClose();
                    return;
                }
                const nextRange = getInitialRange();
                setData(prev => ({
                    ...prev,
                    owner_id: ownerId ?? '',
                    starts_at: nextRange.starts_at,
                    ends_at: nextRange.ends_at,
                    color: TYPE_COLOR_HEX[prev.type] ?? TYPE_COLOR_HEX.other,
                }));
                setSuggestMessage('');
                setSelectedCalendarDay('');
                setCalendarCursor(new Date(nextRange.starts_at));
            }}
        >
            <DialogContent className="max-w-5xl">
                <DialogHeader>
                    <DialogTitle>Добавить событие</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                    <form onSubmit={submit} className="space-y-4">
                        <div className="space-y-1">
                            <Label>Тип события</Label>
                            <NativeSelect
                                value={data.type}
                                onValueChange={handleTypeChange}
                                options={Object.entries(TYPE_META).map(([k, v]) => ({ value: k, label: v.label }))}
                            />
                        </div>
                        {data.type === 'meeting' && (
                            <div className="space-y-1">
                                <Label>С кем встреча</Label>
                                <NativeSelect
                                    value={String(data.attendee_id ?? '')}
                                    onValueChange={value => {
                                        setData('attendee_id', value);
                                        setSelectedCalendarDay('');
                                    }}
                                    options={[
                                        { value: '', label: 'Выберите сотрудника' },
                                        ...employees.map(emp => ({
                                            value: String(emp.id),
                                            label: emp.title ? `${emp.name} (${emp.title})` : emp.name,
                                        })),
                                    ]}
                                />
                                {errors.attendee_id && <p className="text-xs text-destructive">{errors.attendee_id}</p>}
                                <div className="pt-1 flex items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        onClick={suggestFreeSlot}
                                        disabled={suggestLoading || !data.attendee_id || processing}
                                    >
                                        {suggestLoading ? 'Поиск...' : 'Автоподбор свободного слота'}
                                    </Button>
                                    {suggestMessage && <span className="text-xs text-muted-foreground">{suggestMessage}</span>}
                                </div>
                            </div>
                        )}
                        <div className="space-y-1">
                            <Label>Название</Label>
                            <Input value={data.title} onChange={e => setData('title', e.target.value)} required />
                            {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label>Начало</Label>
                                <Input type="datetime-local" min={minDateTime} value={data.starts_at} onChange={e => setData('starts_at', e.target.value)} required />
                                {errors.starts_at && <p className="text-xs text-destructive">{errors.starts_at}</p>}
                            </div>
                            <div className="space-y-1">
                                <Label>Конец</Label>
                                <Input type="datetime-local" min={data.starts_at || minDateTime} value={data.ends_at} onChange={e => setData('ends_at', e.target.value)} required />
                                {errors.ends_at && <p className="text-xs text-destructive">{errors.ends_at}</p>}
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label>Комментарий / причина <span className="text-muted-foreground text-xs">(необязательно)</span></Label>
                            <Textarea rows={3} value={data.description} onChange={e => setData('description', e.target.value)} placeholder="Например: ежегодный отпуск, деловая поездка в Алматы..." />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => {
                                reset();
                                onClose();
                            }}>Отмена</Button>
                            <Button type="submit" disabled={processing}>Сохранить</Button>
                        </DialogFooter>
                    </form>

                    {data.type === 'meeting' && (
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm">Календарь сотрудника</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {!data.attendee_id && (
                                    <p className="text-sm text-muted-foreground">Выберите сотрудника, чтобы посмотреть свободные даты.</p>
                                )}

                                {data.attendee_id && (
                                    <>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-medium">{selectedEmployee?.name ?? 'Сотрудник'}</p>
                                                <p className="text-xs text-muted-foreground">{MONTH_NAMES[calendarMonth]} {calendarYear}</p>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Button type="button" variant="outline" size="icon" className="size-7" onClick={() => setCalendarCursor(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}>
                                                    <ChevronLeft className="size-4" />
                                                </Button>
                                                <Button type="button" variant="outline" size="icon" className="size-7" onClick={() => setCalendarCursor(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}>
                                                    <ChevronRight className="size-4" />
                                                </Button>
                                            </div>
                                        </div>

                                        {availabilityLoading && <p className="text-xs text-muted-foreground">Загрузка календаря...</p>}
                                        {availabilityError && <p className="text-xs text-destructive">{availabilityError}</p>}

                                        <div className="grid grid-cols-7 gap-1 text-[11px]">
                                            {WEEKDAYS_SHORT.map(dayName => (
                                                <div key={dayName} className="text-center text-muted-foreground">{dayName}</div>
                                            ))}
                                            {calendarCells.map((d, idx) => {
                                                if (!d) return <div key={`empty-${idx}`} className="h-7" />;
                                                const dateKey = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                                                const isBusy = busyDaysSet.has(dateKey);
                                                const isAbsence = absenceDaysSet.has(dateKey);
                                                const isSelected = selectedCalendarDay === dateKey;
                                                const cellDate = new Date(calendarYear, calendarMonth, d);
                                                cellDate.setHours(0, 0, 0, 0);
                                                const isPast = cellDate < todayStart;

                                                return (
                                                    <button
                                                        type="button"
                                                        key={dateKey}
                                                        onClick={() => setSelectedCalendarDay(dateKey)}
                                                        className={[
                                                            'h-7 rounded border text-xs transition-colors',
                                                            isSelected ? 'ring-1 ring-primary border-primary' : 'border-border',
                                                            isPast
                                                                ? 'bg-gray-100 text-muted-foreground border-gray-200'
                                                                : (isAbsence ? 'bg-red-100 text-red-700' : (isBusy ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700')),
                                                        ].join(' ')}
                                                    >
                                                        {d}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                                            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400" />Прошедшая дата</span>
                                            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-500" />Прошедший час</span>
                                            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />Свободно</span>
                                            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />Есть события</span>
                                            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />Отсутствие</span>
                                        </div>

                                        {selectedCalendarDay && (
                                            <div className="space-y-2 border-t pt-2">
                                                <p className="text-xs font-medium">Часы на {fmtDate(selectedCalendarDay)}</p>
                                                {selectedDayEvents.length === 0 && (
                                                    <p className="text-xs text-emerald-700">На выбранную дату сотрудник свободен.</p>
                                                )}
                                                <div className="space-y-1.5 max-h-64 overflow-auto pr-1">
                                                    {selectedDayHourSlots.map(slot => (
                                                        <div
                                                            key={slot.hour}
                                                            className={[
                                                                'grid grid-cols-[52px_1fr] gap-2 items-start rounded border p-1.5',
                                                                slot.isPast ? 'bg-gray-100 border-gray-200 text-muted-foreground' : '',
                                                            ].join(' ')}
                                                        >
                                                            <div className="text-[11px] text-muted-foreground pt-0.5">{String(slot.hour).padStart(2, '0')}:00</div>
                                                            <div className="space-y-1">
                                                                {slot.isPast ? (
                                                                    <p className="text-[11px] text-muted-foreground">Прошло</p>
                                                                ) : slot.events.length === 0 ? (
                                                                    <p className="text-[11px] text-emerald-700">Свободно</p>
                                                                ) : (
                                                                    slot.events.map(event => (
                                                                        <div key={`${slot.hour}-${event.id}`} className="rounded border p-1.5 text-[11px]">
                                                                            <p className="font-medium leading-tight">{event.title}</p>
                                                                            <p className="text-muted-foreground leading-tight mt-0.5">
                                                                                {fmtTime(event.starts_at)} - {fmtTime(event.ends_at)}
                                                                            </p>
                                                                            <div className="mt-1 flex items-center gap-1">
                                                                                <Badge variant="outline" className="text-[10px] py-0">{TYPE_META[event.type]?.label ?? event.type}</Badge>
                                                                            </div>
                                                                        </div>
                                                                    ))
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

function EventModal({ event, open, onClose }) {
    const s = event
        ? (event.status === 'conflict' ? EVENT_STYLE.conflict : (TYPE_META[event.type] ?? EVENT_STYLE.confirmed))
        : EVENT_STYLE.confirmed;

    const { data, setData, patch, processing, errors, reset } = useForm(
        event ? {
            title: event.title ?? '',
            type: event.type ?? 'other',
            starts_at: event.starts_at ? event.starts_at.slice(0, 16) : '',
            ends_at: event.ends_at ? event.ends_at.slice(0, 16) : '',
            description: event.description ?? '',
            color: event.color ?? '',
        } : { title: '', type: 'other', starts_at: '', ends_at: '', description: '', color: '' }
    );

    const [isEditing, setIsEditing] = useState(false);

    function handleDelete() {
        if (!confirm('Удалить это событие?')) return;
        router.delete(route('calendar.events.destroy', event.id), {
            onSuccess: onClose,
        });
    }

    function handleSave(e) {
        e.preventDefault();
        patch(route('calendar.events.update', event.id), {
            onSuccess: () => { setIsEditing(false); onClose(); },
        });
    }

    if (!event) return null;

    return (
        <Dialog open={open} onOpenChange={v => { if (!v) { reset(); setIsEditing(false); onClose(); } }}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {isEditing ? 'Редактировать событие' : event.title}
                        {!isEditing && event.type && TYPE_META[event.type] && (
                            <Badge variant="outline" className="text-[10px] py-0">{TYPE_META[event.type].label}</Badge>
                        )}
                    </DialogTitle>
                </DialogHeader>

                {!isEditing ? (
                    <div className="space-y-3 py-1">
                        <div className={`rounded-lg border-l-4 px-3 py-2 ${event.color ? '' : s.bg}`}
                            style={event.color ? { borderColor: event.color, backgroundColor: event.color + '26' } : {}}>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Clock className="size-3" />
                                <span>{fmtDate(event.starts_at)} {fmtTime(event.starts_at)} — {fmtDate(event.ends_at)} {fmtTime(event.ends_at)}</span>
                            </div>
                            {event.with_name && <p className="text-xs text-muted-foreground mt-1">С: {event.with_name}</p>}
                            {event.description && <p className="text-sm mt-2">{event.description}</p>}
                            {event.room && <p className="text-xs text-muted-foreground mt-1">Кабинет: {event.room}</p>}
                        </div>
                        {event.is_own && (
                            <div className="flex gap-2 pt-1">
                                <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
                                    <Pencil className="size-3.5 mr-1" />Редактировать
                                </Button>
                                <Button size="sm" variant="destructive" onClick={handleDelete}>
                                    <Trash2 className="size-3.5 mr-1" />Удалить
                                </Button>
                            </div>
                        )}
                    </div>
                ) : (
                    <form onSubmit={handleSave} className="space-y-4 pt-1">
                        <div className="space-y-1">
                            <Label>Тип события</Label>
                            <NativeSelect value={data.type} onValueChange={v => setData('type', v)}
                                options={Object.entries(TYPE_META).map(([k, v]) => ({ value: k, label: v.label }))} />
                        </div>
                        <div className="space-y-1">
                            <Label>Название</Label>
                            <Input value={data.title} onChange={e => setData('title', e.target.value)} required />
                            {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label>Начало</Label>
                                <Input type="datetime-local" value={data.starts_at} onChange={e => setData('starts_at', e.target.value)} required />
                                {errors.starts_at && <p className="text-xs text-destructive">{errors.starts_at}</p>}
                            </div>
                            <div className="space-y-1">
                                <Label>Конец</Label>
                                <Input type="datetime-local" value={data.ends_at} onChange={e => setData('ends_at', e.target.value)} required />
                                {errors.ends_at && <p className="text-xs text-destructive">{errors.ends_at}</p>}
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label>Описание</Label>
                            <Textarea rows={2} value={data.description} onChange={e => setData('description', e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <Label>Цвет метки</Label>
                            <div className="flex flex-wrap gap-1.5 items-center">
                                <button type="button" onClick={() => setData('color', '')}
                                    className={`w-6 h-6 rounded-full border-2 bg-muted ${!data.color ? 'border-primary ring-1 ring-primary' : 'border-muted-foreground/30'}`} />
                                {PRESET_COLORS.map(c => (
                                    <button key={c} type="button" onClick={() => setData('color', data.color === c ? '' : c)}
                                        className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${data.color === c ? 'border-gray-900 scale-110' : 'border-transparent'}`}
                                        style={{ backgroundColor: c }} />
                                ))}
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsEditing(false)} disabled={processing}>Отмена</Button>
                            <Button type="button" variant="destructive" size="sm" onClick={handleDelete} disabled={processing}>
                                <Trash2 className="size-3.5 mr-1" />Удалить
                            </Button>
                            <Button type="submit" disabled={processing}>Сохранить</Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}

const VIEWS = [
    { key: 'month', label: 'Месяц' },
    { key: 'week', label: 'Неделя' },
    { key: 'day', label: 'День' },
    { key: 'agenda', label: 'Повестка' },
];

export default function CalendarIndex({ events = [], stats = {}, upcomingEvents = [], meetingNotifications = [], holidays = [], employees = [], calendarOwner = null, managedCalendars = [], year: initYear, month: initMonth }) {
    const { flash = {}, auth = {} } = usePage().props;
    const selfUser = auth?.user ?? {};
    const selfOwnerOption = {
        id: selfUser?.id,
        name: selfUser?.display_name ?? selfUser?.name ?? 'Мой календарь',
        title: selfUser?.ad_title ?? null,
    };

    const activeOwnerId = String(calendarOwner?.id ?? selfOwnerOption.id ?? '');
    const today = new Date();
    const [view, setView] = useState('month');
    const [year, setYear] = useState(initYear ?? today.getFullYear());
    const [month, setMonth] = useState((initMonth ?? today.getMonth() + 1) - 1);
    const [day, setDay] = useState(today.getDate());
    const [createOpen, setCreateOpen] = useState(false);
    const [createDate, setCreateDate] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTypes, setActiveTypes] = useState(() => new Set(Object.keys(TYPE_META)));
    const [selectedEvent, setSelectedEvent] = useState(null);

    const filteredEvents = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        return events.filter(e => {
            if (!activeTypes.has(e.type ?? 'other')) return false;
            if (q && !e.title?.toLowerCase().includes(q)) return false;
            return true;
        });
    }, [events, searchQuery, activeTypes]);

    function toggleType(type) {
        setActiveTypes(prev => {
            const next = new Set(prev);
            if (next.has(type)) { next.delete(type); } else { next.add(type); }
            return next;
        });
    }

    function prev() {
        if (view === 'month') {
            if (month === 0) {
                setMonth(11);
                setYear(y => y - 1);
            } else {
                setMonth(m => m - 1);
            }
        } else if (view === 'week') {
            const d = new Date(year, month, day - 7);
            setYear(d.getFullYear());
            setMonth(d.getMonth());
            setDay(d.getDate());
        } else {
            const d = new Date(year, month, day - 1);
            setYear(d.getFullYear());
            setMonth(d.getMonth());
            setDay(d.getDate());
        }
    }

    function next() {
        if (view === 'month') {
            if (month === 11) {
                setMonth(0);
                setYear(y => y + 1);
            } else {
                setMonth(m => m + 1);
            }
        } else if (view === 'week') {
            const d = new Date(year, month, day + 7);
            setYear(d.getFullYear());
            setMonth(d.getMonth());
            setDay(d.getDate());
        } else {
            const d = new Date(year, month, day + 1);
            setYear(d.getFullYear());
            setMonth(d.getMonth());
            setDay(d.getDate());
        }
    }

    function goToday() {
        setYear(today.getFullYear());
        setMonth(today.getMonth());
        setDay(today.getDate());
    }

    function openCreateForDay(d) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        setCreateDate(dateStr);
        setCreateOpen(true);
    }

    const periodLabel = useMemo(() => {
        if (view === 'month') return `${MONTH_NAMES[month]} ${year}`;
        if (view === 'week') {
            const dates = getWeekDates(year, month, day);
            const first = dates[0];
            const last = dates[6];
            return `${first.getDate()} – ${last.getDate()} ${MONTH_NAMES[last.getMonth()]} ${last.getFullYear()}`;
        }
        return fmtDate(new Date(year, month, day));
    }, [view, year, month, day]);

    const hasMeetingNotifications = meetingNotifications.length > 0;
    const eventLegend = [
        { key: 'meeting', label: 'Встреча', cls: 'bg-blue-500' },
        { key: 'vacation', label: 'Отпуск', cls: 'bg-green-500' },
        { key: 'business_trip', label: 'Командировка', cls: 'bg-violet-500' },
        { key: 'sick_leave', label: 'Больничный', cls: 'bg-orange-500' },
        { key: 'personal', label: 'Личное', cls: 'bg-pink-500' },
        { key: 'remote', label: 'Удаленная работа', cls: 'bg-teal-500' },
        { key: 'other', label: 'Другое', cls: 'bg-gray-500' },
        { key: 'pending', label: 'Ожидает', cls: 'bg-yellow-500' },
        { key: 'conflict', label: 'Конфликт', cls: 'bg-red-500' },
    ];

    return (
        <AuthenticatedLayout>
            <Head title="Smart Calendar — Календарь" />
            <div className="min-h-screen bg-gradient-to-br from-blue-50/50 via-white to-blue-50/30 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900">
            <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-2.5">
                            <CalendarDays className="size-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-foreground">Смарт Календарь</h1>
                            <p className="text-sm text-muted-foreground">Управление встречами и расписанием</p>
                        </div>
                    </div>
                </div>
                {/* Alerts */}
                {!!flash?.error && <div className="rounded-lg border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm font-medium">{flash.error}</div>}
                {!!flash?.warning && <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-800 px-4 py-3 text-sm font-medium">{flash.warning}</div>}
                {!!flash?.success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 px-4 py-3 text-sm font-medium">{flash.success}</div>}

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    <Card className="hover:shadow-md transition-all duration-200">
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-medium text-muted-foreground">Встреч на неделе</p>
                                    <p className="text-3xl font-bold mt-2">{stats.week_count ?? 0}</p>
                                </div>
                                <CalendarDays className="size-5 text-blue-500/40" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="hover:shadow-md transition-all duration-200">
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-medium text-muted-foreground">Сегодня встреч</p>
                                    <p className="text-3xl font-bold mt-2">{stats.today_count ?? 0}</p>
                                </div>
                                <Clock className="size-5 text-blue-500/40" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-yellow-200/50 bg-gradient-to-br from-yellow-50/60 to-yellow-50/20 hover:shadow-md transition-all duration-200 dark:border-yellow-800/30 dark:from-yellow-900/20 dark:to-yellow-900/5">
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-medium text-muted-foreground">Ожидают ответа</p>
                                    <p className="text-3xl font-bold mt-2 text-yellow-600">{stats.pending_count ?? 0}</p>
                                </div>
                                <MessageSquare className="size-5 text-yellow-500/40" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className={(stats.conflict_count ?? 0) > 0 ? 'border-red-200/50 bg-gradient-to-br from-red-50/60 to-red-50/20 hover:shadow-md transition-all duration-200 dark:border-red-800/30 dark:from-red-900/20 dark:to-red-900/5' : 'hover:shadow-md transition-all duration-200'}>
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-medium text-muted-foreground">Конфликты</p>
                                    <p className={`text-3xl font-bold mt-2 ${(stats.conflict_count ?? 0) > 0 ? 'text-red-600' : ''}`}>{stats.conflict_count ?? 0}</p>
                                </div>
                                <AlertTriangle className={`size-5 ${(stats.conflict_count ?? 0) > 0 ? 'text-red-500/40' : 'text-muted-foreground/40'}`} />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-green-200/50 bg-gradient-to-br from-green-50/60 to-green-50/20 hover:shadow-md transition-all duration-200 dark:border-green-800/30 dark:from-green-900/20 dark:to-green-900/5">
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-medium text-muted-foreground">Дней отпуска</p>
                                    <p className="text-3xl font-bold mt-2 text-green-700">{stats.vacation_days ?? 0}</p>
                                </div>
                                <span className="text-[10px] text-muted-foreground/60">этот месяц</span>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-violet-200/50 bg-gradient-to-br from-violet-50/60 to-violet-50/20 hover:shadow-md transition-all duration-200 dark:border-violet-800/30 dark:from-violet-900/20 dark:to-violet-900/5">
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-medium text-muted-foreground">Дней командировок</p>
                                    <p className="text-3xl font-bold mt-2 text-violet-700">{stats.business_trip_days ?? 0}</p>
                                </div>
                                <span className="text-[10px] text-muted-foreground/60">этот месяц</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Upcoming Events */}
                <div className="space-y-2">
                    <h2 className="text-lg font-semibold text-foreground">Ближайшие встречи</h2>
                    <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm hidden">Ближайшие встречи</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {upcomingEvents.length === 0 ? (
                            <p className="text-xs text-muted-foreground">Нет предстоящих встреч</p>
                        ) : (
                            upcomingEvents.map(e => (
                                <div key={e.id} className="rounded-lg border border-border/60 p-2.5 text-xs">
                                    <p className="font-medium truncate">{e.title}</p>
                                    <p className="text-muted-foreground mt-0.5">{e.with}</p>
                                    <p className="text-muted-foreground mt-0.5">{fmtDate(e.starts_at)} {fmtTime(e.starts_at)}–{fmtTime(e.ends_at)}</p>
                                    <p className="text-muted-foreground mt-0.5">{e.room ? `Где: ${e.room}` : (e.format === 'online' ? 'Где: Online (Zoom)' : 'Где: не указано')}</p>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>
                </div>

                {/* Search + Filter */}
                <div className="space-y-2">
                    <h2 className="text-lg font-semibold text-foreground">Поиск и фильтры</h2>
                <Card>
                    <CardContent className="py-3 px-4 space-y-3">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                            <Input
                                className="pl-8 pr-8 h-9"
                                placeholder="Поиск по событиям..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                            {searchQuery && (
                                <button className="absolute right-2.5 top-1/2 -translate-y-1/2" onClick={() => setSearchQuery('')}>
                                    <X className="size-4 text-muted-foreground hover:text-foreground" />
                                </button>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {Object.entries(TYPE_META).map(([key, meta]) => (
                                <button
                                    key={key}
                                    onClick={() => toggleType(key)}
                                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border transition-opacity ${activeTypes.has(key) ? 'opacity-100' : 'opacity-40'} ${meta.bg} ${meta.text}`}
                                >
                                    {meta.label}
                                    {!activeTypes.has(key) && <X className="size-3" />}
                                </button>
                            ))}
                            {activeTypes.size < Object.keys(TYPE_META).length && (
                                <button onClick={() => setActiveTypes(new Set(Object.keys(TYPE_META)))}
                                    className="text-xs text-muted-foreground underline">
                                    Сбросить
                                </button>
                            )}
                        </div>
                    </CardContent>
                </Card>
                </div>

                {/* Calendar Controls */}
                <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2 justify-between">
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" onClick={prev}><ChevronLeft className="size-4" /></Button>
                        <span className="text-sm font-semibold min-w-[200px] text-center">{periodLabel}</span>
                        <Button variant="outline" size="icon" onClick={next}><ChevronRight className="size-4" /></Button>
                        <Button variant="outline" size="sm" onClick={goToday}>Сегодня</Button>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button size="sm" onClick={() => {
                            setCreateDate(null);
                            setCreateOpen(true);
                        }}>
                            <Plus className="size-4 mr-1" />Добавить событие
                        </Button>
                        <div className="flex rounded-lg border overflow-hidden">
                            {VIEWS.map(v => (
                                <button
                                    key={v.key}
                                    onClick={() => setView(v.key)}
                                    className={`px-3 py-1.5 text-xs font-medium border-r last:border-r-0 transition-colors ${view === v.key ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                                >
                                    {v.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Legend */}
                <Card>
                    <CardContent className="py-4 px-4">
                        <p className="text-xs font-semibold text-foreground mb-3">Подсказка по цветам событий</p>
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                            {eventLegend.map(item => (
                                <span key={item.key} className="inline-flex items-center gap-1.5">
                                    <span className={`w-2.5 h-2.5 rounded-full ${item.cls}`} />
                                    {item.label}
                                </span>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Calendar View */}
                <div className="space-y-2">
                    <h2 className="text-lg font-semibold text-foreground">Просмотр</h2>
                {view === 'month' && <MonthView year={year} month={month} events={filteredEvents} holidays={holidays} onDayClick={d => {
                    setDay(d);
                    setView('day');
                }} onDayDoubleClick={openCreateForDay} selectedDay={null} />}
                {view === 'week' && <WeekView year={year} month={month} day={day} events={filteredEvents} onEventClick={setSelectedEvent} />}
                {view === 'day' && <DayView year={year} month={month} day={day} events={filteredEvents} onEventClick={setSelectedEvent} />}
                {view === 'agenda' && <AgendaView events={filteredEvents} onEventClick={setSelectedEvent} />}
                </div>

                {hasMeetingNotifications && (
                    <Card className="border-amber-300/70 bg-amber-50/70">
                        <CardContent className="p-3 space-y-2">
                            <div className="flex items-center gap-2 text-amber-800">
                                <div className="relative">
                                    <Bell className="size-4" />
                                    <span className="absolute -top-1.5 -right-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] leading-none text-white">
                                        {meetingNotifications.length}
                                    </span>
                                </div>
                                <p className="text-sm font-medium">Уведомления о встречах</p>
                            </div>
                            <div className="space-y-1.5">
                                {meetingNotifications.map(meeting => (
                                    <div key={meeting.id} className="rounded-md border border-amber-200 bg-white/70 px-2.5 py-2 text-sm">
                                        <p className="font-medium text-foreground">{meeting.title}</p>
                                        <p className="text-muted-foreground text-xs">{fmtDate(meeting.starts_at)}, {fmtTime(meeting.starts_at)}–{fmtTime(meeting.ends_at)}</p>
                                        <p className="text-muted-foreground text-xs">С кем: {meeting.organizer_name ?? 'Не указан'}</p>
                                        <p className="text-muted-foreground text-xs inline-flex items-center gap-1">
                                            <MapPin className="size-3" />
                                            {meeting.room ? `Где: ${meeting.room}` : (meeting.format === 'online' ? 'Где: Online (Zoom)' : 'Где: не указано')}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                <CreateEventModal open={createOpen} onClose={() => setCreateOpen(false)} defaultDate={createDate} employees={employees} ownerId={activeOwnerId} />
                <EventModal event={selectedEvent} open={!!selectedEvent} onClose={() => setSelectedEvent(null)} />
                </div>
            </div>
            </div>
        </AuthenticatedLayout>
    );
}
