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

const VIEWS = [
    { key: 'month', label: 'Месяц' },
    { key: 'week', label: 'Неделя' },
    { key: 'day', label: 'День' },
    { key: 'agenda', label: 'Повестка' },
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
        <Card className="border-border/80 shadow-sm">
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
        <Card className="border-border/80 shadow-sm">
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
        <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm">{fmtDate(date)}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
                {dayEvts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Событий нет</p>
                ) : (
                    dayEvts.map((e, i) => <div key={i} onClick={() => onEventClick?.(e)}><EventChip event={e} onClick={() => onEventClick?.(e)} /></div>)
                )}
            </CardContent>
        </Card>
    );
}

function AgendaView({ events, onEventClick }) {
    const sorted = useMemo(() => [...events].sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)), [events]);
    return (
        <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm">Повестка</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
                {sorted.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Событий нет</p>
                ) : (
                    sorted.map((e, i) => <div key={i} onClick={() => onEventClick?.(e)}><EventChip event={e} onClick={() => onEventClick?.(e)} /></div>)
                )}
            </CardContent>
        </Card>
    );
}

function CreateEventModal({ open, onClose, defaultDate, employees, ownerId }) {
    // Implement modal component (same as before but simplified)
    return null;
}

function EventModal({ event, open, onClose }) {
    // Implement modal component (same as before but simplified)
    return null;
}

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
        <AuthenticatedLayout
            header={
                <h2 className="text-2xl font-semibold leading-tight text-gray-900">
                    Календарь
                </h2>
            }
        >
            <Head title="Smart Calendar — Календарь" />
            <div className="py-8">
                <div className="mx-auto sm:px-6 lg:px-8">
                    {!!flash?.error && <div className="rounded-md border border-red-300 bg-red-50 text-red-800 px-3 py-2 text-sm mb-4">{flash.error}</div>}
                    {!!flash?.warning && <div className="rounded-md border border-amber-300 bg-amber-50 text-amber-800 px-3 py-2 text-sm mb-4">{flash.warning}</div>}
                    {!!flash?.success && <div className="rounded-md border border-emerald-300 bg-emerald-50 text-emerald-800 px-3 py-2 text-sm mb-4">{flash.success}</div>}

                    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6 mb-5">
                        <Card className="border-border/80 shadow-sm">
                            <CardContent className="p-4">
                                <p className="text-xs text-muted-foreground">Встреч на неделе</p>
                                <p className="text-2xl font-bold mt-1">{stats.week_count ?? 0}</p>
                            </CardContent>
                        </Card>
                        <Card className="border-border/80 shadow-sm">
                            <CardContent className="p-4">
                                <p className="text-xs text-muted-foreground">Сегодня встреч</p>
                                <p className="text-2xl font-bold mt-1">{stats.today_count ?? 0}</p>
                            </CardContent>
                        </Card>
                        <Card className="border-border/80 shadow-sm">
                            <CardContent className="p-4">
                                <p className="text-xs text-muted-foreground">Ожидают ответа</p>
                                <p className="text-2xl font-bold mt-1 text-yellow-600">{stats.pending_count ?? 0}</p>
                            </CardContent>
                        </Card>
                        <Card className="border-border/80 shadow-sm">
                            <CardContent className="p-4">
                                <p className="text-xs text-muted-foreground">Конфликты</p>
                                <p className={`text-2xl font-bold mt-1 ${(stats.conflict_count ?? 0) > 0 ? 'text-red-600' : ''}`}>{stats.conflict_count ?? 0}</p>
                            </CardContent>
                        </Card>
                        <Card className="border-border/80 shadow-sm">
                            <CardContent className="p-4">
                                <p className="text-xs text-muted-foreground">Дней отпуска</p>
                                <p className="text-2xl font-bold mt-1">{stats.vacation_days ?? 0}</p>
                            </CardContent>
                        </Card>
                        <Card className="border-border/80 shadow-sm">
                            <CardContent className="p-4">
                                <p className="text-xs text-muted-foreground">Дней командировок</p>
                                <p className="text-2xl font-bold mt-1">{stats.business_trip_days ?? 0}</p>
                            </CardContent>
                        </Card>
                    </section>

                    <Card className="border-border/80 shadow-sm mb-5">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Ближайшие встречи</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {upcomingEvents.length === 0 ? (
                                <p className="text-xs text-muted-foreground">Нет предстоящих встреч</p>
                            ) : (
                                upcomingEvents.map(e => (
                                    <div key={e.id} className="rounded border px-2.5 py-2 text-xs">
                                        <p className="font-medium">{e.title}</p>
                                        <p className="text-muted-foreground mt-0.5">{e.with}</p>
                                        <p className="text-muted-foreground mt-0.5">{fmtDate(e.starts_at)} {fmtTime(e.starts_at)}–{fmtTime(e.ends_at)}</p>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-border/80 shadow-sm mb-5">
                        <CardContent className="py-3 px-4">
                            <div className="flex flex-wrap gap-2 mb-3">
                                <div className="relative flex-1 min-w-[200px]">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                                    <Input
                                        className="pl-8 h-9"
                                        placeholder="Поиск по событиям..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                    />
                                </div>
                                <Button size="sm" onClick={() => setView('month')}>Месяц</Button>
                                <Button size="sm" onClick={() => setView('week')}>Неделя</Button>
                                <Button size="sm" onClick={() => setView('day')}>День</Button>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {Object.entries(TYPE_META).map(([key, meta]) => (
                                    <button
                                        key={key}
                                        onClick={() => toggleType(key)}
                                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border transition-opacity ${activeTypes.has(key) ? 'opacity-100' : 'opacity-40'} ${meta.bg} ${meta.text}`}
                                    >
                                        {meta.label}
                                    </button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex flex-wrap items-center gap-2 justify-between mb-5">
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="icon" onClick={prev}><ChevronLeft className="size-4" /></Button>
                            <span className="text-sm font-semibold min-w-[200px] text-center">{periodLabel}</span>
                            <Button variant="outline" size="icon" onClick={next}><ChevronRight className="size-4" /></Button>
                            <Button variant="outline" size="sm" onClick={goToday}>Сегодня</Button>
                        </div>
                        <Button size="sm" onClick={() => { setCreateDate(null); setCreateOpen(true); }}><Plus className="size-4 mr-1" />Добавить событие</Button>
                    </div>

                    {view === 'month' && <MonthView year={year} month={month} events={filteredEvents} holidays={holidays} onDayClick={d => { setDay(d); setView('day'); }} onDayDoubleClick={openCreateForDay} selectedDay={null} />}
                    {view === 'week' && <WeekView year={year} month={month} day={day} events={filteredEvents} onEventClick={setSelectedEvent} />}
                    {view === 'day' && <DayView year={year} month={month} day={day} events={filteredEvents} onEventClick={setSelectedEvent} />}
                    {view === 'agenda' && <AgendaView events={filteredEvents} onEventClick={setSelectedEvent} />}

                    {hasMeetingNotifications && (
                        <Card className="border-amber-300/70 bg-amber-50/70 mt-5">
                            <CardContent className="p-3 space-y-2">
                                <div className="flex items-center gap-2 text-amber-800">
                                    <Bell className="size-4" />
                                    <p className="text-sm font-medium">Уведомления о встречах ({meetingNotifications.length})</p>
                                </div>
                                <div className="space-y-1.5">
                                    {meetingNotifications.map(meeting => (
                                        <div key={meeting.id} className="rounded border border-amber-200 bg-white/70 px-2.5 py-2 text-sm">
                                            <p className="font-medium">{meeting.title}</p>
                                            <p className="text-xs text-muted-foreground">{fmtDate(meeting.starts_at)}, {fmtTime(meeting.starts_at)}–{fmtTime(meeting.ends_at)}</p>
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
        </AuthenticatedLayout>
    );
}
