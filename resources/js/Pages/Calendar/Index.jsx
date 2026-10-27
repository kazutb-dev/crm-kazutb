import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { EmptyState, FilterBar, LoadingState, Notice, PageHeader, Segmented, StatGrid, StatTile, StatusBadge } from '@/components/platform';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { AlertTriangle, Bell, CalendarDays, ChevronLeft, ChevronRight, Clock, MapPin, MessageSquare, Pencil, Plus, Search, Trash2, Users, Video, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTH_NAMES = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const HOURS = Array.from({ length: 11 }, (_, i) => i + 8);
const TIME_OPTIONS = Array.from({ length: 96 }, (_, i) => {
    const h = String(Math.floor(i / 4)).padStart(2, '0');
    const m = String((i % 4) * 15).padStart(2, '0');
    return { value: `${h}:${m}`, label: `${h}:${m}` };
});

const EVENT_STYLE = {
    confirmed: { bg: 'bg-blue-50 border-blue-600', text: 'text-blue-800' },
    pending: { bg: 'bg-amber-50 border-amber-500', text: 'text-amber-800' },
    conflict: { bg: 'bg-red-50 border-red-600', text: 'text-red-800' },
    declined: { bg: 'bg-slate-100 border-slate-500', text: 'text-slate-700' },
    completed: { bg: 'bg-slate-100 border-slate-300', text: 'text-slate-500' },
};

const TYPE_META = {
    meeting: { label: 'Встреча', bg: 'bg-blue-50 border-blue-600', text: 'text-blue-800', dot: 'bg-blue-600' },
    vacation: { label: 'Отпуск', bg: 'bg-emerald-50 border-emerald-600', text: 'text-emerald-800', dot: 'bg-emerald-600' },
    business_trip: { label: 'Командировка', bg: 'bg-orange-50 border-orange-600', text: 'text-orange-800', dot: 'bg-orange-600' },
    sick_leave: { label: 'Больничный', bg: 'bg-amber-50 border-amber-500', text: 'text-amber-800', dot: 'bg-amber-500' },
    personal: { label: 'Личное', bg: 'bg-slate-100 border-[#102945]', text: 'text-[#102945]', dot: 'bg-[#102945]' },
    remote: { label: 'Удалённая работа', bg: 'bg-teal-50 border-teal-600', text: 'text-teal-800', dot: 'bg-teal-600' },
    other: { label: 'Другое', bg: 'bg-slate-100 border-slate-400', text: 'text-slate-700', dot: 'bg-slate-400' },
};

const TYPE_COLOR_HEX = {
    meeting: '#5b86b5',
    vacation: '#3fb57a',
    business_trip: '#2c5a86',
    sick_leave: '#d9853f',
    personal: '#a4531f',
    remote: '#0a9d96',
    other: '#6b7280',
};

const PRESET_COLORS = [
    '#5b86b5', '#3fb57a', '#2c5a86', '#d9853f', '#a4531f',
    '#0a9d96', '#6b7280', '#d64540', '#e2b53e', '#09bab2',
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

function roundToQuarterHour(date = new Date()) {
    const d = new Date(date);
    d.setSeconds(0, 0);
    d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15);
    return d;
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

function DateTimePickerField({ label, value, onChange, minValue, required = false, error }) {
    const datePart = value?.slice(0, 10) ?? '';
    const timePart = value?.slice(11, 16) ?? '09:00';
    const minDate = minValue?.slice(0, 10) ?? '';
    const minTime = minValue?.slice(11, 16) ?? '00:00';

    const availableTimes = (datePart && minDate && datePart === minDate)
        ? TIME_OPTIONS.filter(opt => opt.value >= minTime)
        : TIME_OPTIONS;

    const safeTimes = availableTimes.length > 0 ? availableTimes : [{ value: minTime, label: minTime }];
    const safeTime = safeTimes.some(opt => opt.value === timePart) ? timePart : safeTimes[0].value;

    function updateDate(nextDate) {
        if (!nextDate) {
            onChange('');
            return;
        }

        const nextTimes = (minDate && nextDate === minDate)
            ? TIME_OPTIONS.filter(opt => opt.value >= minTime)
            : TIME_OPTIONS;
        const finalTimes = nextTimes.length > 0 ? nextTimes : [{ value: minTime, label: minTime }];
        const nextTime = finalTimes.some(opt => opt.value === safeTime) ? safeTime : finalTimes[0].value;

        onChange(`${nextDate}T${nextTime}`);
    }

    function updateTime(nextTime) {
        const targetDate = datePart || toLocalDateInput(new Date());
        onChange(`${targetDate}T${nextTime}`);
    }

    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_120px]">
                <Input
                    type="date"
                    value={datePart}
                    min={minDate || undefined}
                    onChange={e => updateDate(e.target.value)}
                    required={required}
                />
                <NativeSelect
                    value={safeTime}
                    onValueChange={updateTime}
                    options={safeTimes}
                />
            </div>
            {datePart && <p className="text-[11px] text-slate-500">Выбрано: {fmtDate(`${datePart}T${safeTime}`)} {safeTime}</p>}
            {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
    );
}

const SUMMARY_TONES = { default: 'teal', warning: 'warning', danger: 'danger', success: 'success', info: 'copper', neutral: 'neutral', navy: 'navy' };

function SummaryStatCard({ label, value, hint, icon: Icon, tone = 'default' }) {
    return <StatTile label={label} value={value} hint={hint} icon={Icon} tone={SUMMARY_TONES[tone] ?? 'teal'} />;
}

function EventChip({ event, small = false, onClick }) {
    const s = EVENT_STYLE[event.status]
        ?? (event.type && TYPE_META[event.type] ? TYPE_META[event.type] : EVENT_STYLE.confirmed);

    const customStyle = event.color
        ? { borderColor: event.color, backgroundColor: event.color + '26' }
        : {};

    return (
        <div
            className={`rounded-[6px] border border-slate-200/70 border-l-[3px] px-2 py-1 ${event.color ? '' : s.bg} ${small ? 'text-[10px]' : 'text-xs'} ${onClick ? 'cursor-pointer transition-colors hover:border-slate-300 hover:brightness-[0.98]' : ''}`}
            style={customStyle}
            onClick={onClick}
        >
            <p className={`font-medium truncate leading-tight ${event.color ? '' : s.text}`} style={event.color ? { color: event.color } : {}}>{event.title}</p>
            {!small && (
                <p className="mt-0.5 text-slate-500 tabular-nums truncate">
                    {fmtDate(event.starts_at)} {fmtTime(event.starts_at)} - {fmtDate(event.ends_at)} {fmtTime(event.ends_at)}
                </p>
            )}
            {!small && event.with_name && <p className="mt-0.5 text-slate-500 truncate">{event.with_name}</p>}
        </div>
    );
}

function MonthView({ year, month, events, holidays, onDayClick, onDayDoubleClick, onEventClick, selectedDay }) {
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
        <Card className="overflow-hidden">
            <CardContent className="p-0 sm:p-0">
                <div className="grid grid-cols-7 border-b border-slate-200 bg-white">
                    {WEEKDAYS_SHORT.map((wd, i) => (
                        <div key={wd} className={`py-2.5 text-center text-[0.6875rem] font-bold uppercase tracking-[0.1em] ${i >= 5 ? 'text-red-600/70' : 'text-slate-500'}`}>{wd}</div>
                    ))}
                </div>
                <div className="grid grid-cols-7">
                    {cells.map((day, idx) => {
                        const isWeekend = idx % 7 >= 5;
                        const isToday = day && today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
                        const isPastDay = day && new Date(year, month, day).setHours(0, 0, 0, 0) < new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
                        const isSelected = !!day && day === selectedDay;
                        const dateStr = day ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '';
                        const isHoliday = holidayDates.has(dateStr);
                        const dayEvts = day ? (byDay[day] ?? []) : [];

                        return (
                            <div
                                key={idx}
                                onClick={() => day && onDayClick(day)}
                                onDoubleClick={() => day && onDayDoubleClick && onDayDoubleClick(day)}
                                className={[
                                    'min-h-[104px] border-b border-r border-slate-200 p-2 flex flex-col gap-1.5 last:border-r-0 [&:nth-child(7n)]:border-r-0',
                                    day ? 'cursor-pointer hover:bg-teal-50/60 transition-colors' : 'bg-slate-50',
                                    isPastDay ? 'bg-slate-50 text-slate-400' : '',
                                    dayEvts.length > 0 && !isPastDay ? 'bg-white' : '',
                                    isSelected ? 'bg-teal-50 ring-1 ring-inset ring-teal-600/40' : '',
                                ].join(' ')}
                            >
                                {day && (
                                    <>
                                        <span className={`text-xs font-semibold tabular-nums w-7 h-7 flex items-center justify-center rounded-full shrink-0 ${isToday ? 'bg-teal-700 text-white' : isPastDay ? 'text-slate-400' : isHoliday || isWeekend ? 'text-red-600/80' : 'text-slate-800'}`}>
                                            {day}
                                        </span>
                                        {dayEvts.slice(0, 2).map((e, i) => <EventChip key={i} event={e} small onClick={onEventClick ? ev => { ev.stopPropagation(); onEventClick(e); } : undefined} />)}
                                        {dayEvts.length > 2 && <span className="mt-auto text-[10px] font-medium text-slate-500">+{dayEvts.length - 2} ещё</span>}
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
            <CardContent className="p-0 sm:p-0 overflow-x-auto">
                <div className="min-w-[640px]">
                    <div className="grid border-b border-slate-200" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
                        <div className="border-r border-slate-200" />
                        {weekDates.map((d, i) => {
                            const isToday = today.toDateString() === d.toDateString();
                            return (
                                <div key={i} className={`text-center py-2 border-r border-slate-200 last:border-r-0 ${isToday ? 'bg-teal-50' : ''}`}>
                                    <p className="text-[0.6875rem] font-bold uppercase tracking-[0.1em] text-slate-500">{WEEKDAYS_SHORT[(d.getDay() + 6) % 7]}</p>
                                    <p className={`font-display text-base font-bold tabular-nums ${isToday ? 'text-teal-700' : 'text-[#102945]'}`}>{d.getDate()}</p>
                                </div>
                            );
                        })}
                    </div>
                    {HOURS.map(h => (
                        <div key={h} className="grid border-b border-slate-200 last:border-b-0" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
                            <div className="border-r border-slate-200 px-1.5 py-1 text-right text-[10px] tabular-nums text-slate-500">{String(h).padStart(2, '0')}:00</div>
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
                                    <div key={i} className="border-r border-slate-200 last:border-r-0 min-h-[48px] p-0.5 space-y-0.5">
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
            <CardContent className="p-0 sm:p-0">
                <div className="border-b border-slate-200 px-5 py-3 font-display text-base font-bold text-[#102945]">{fmtDate(date)}</div>
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
                            <div key={h} className="flex border-b border-slate-200 last:border-b-0 min-h-[56px]">
                                <div className="w-16 shrink-0 border-r border-slate-200 px-2 py-1.5 text-right text-xs tabular-nums text-slate-500">{String(h).padStart(2, '0')}:00</div>
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
        return <EmptyState title="Нет событий" description="Измените фильтры или добавьте событие кнопкой «Добавить событие»." />;
    }

    return (
        <Card>
            <CardContent className="p-0 sm:p-0 divide-y divide-slate-200">
                {events.map(e => {
                    const s = EVENT_STYLE[e.status]
                        ?? (e.type && TYPE_META[e.type] ? TYPE_META[e.type] : EVENT_STYLE.confirmed);
                    const typeLabel = e.type && TYPE_META[e.type] ? TYPE_META[e.type].label : null;
                    return (
                        <div key={e.id} className={`flex gap-4 px-5 py-3.5 hover:bg-slate-50 ${onEventClick ? 'cursor-pointer' : ''}`} onClick={() => onEventClick?.(e)}>
                            <div className="w-24 shrink-0 pt-0.5">
                                <p className="text-sm font-semibold text-[#102945]">{fmt(e.starts_at, { day: '2-digit', month: 'short' })}</p>
                                <p className="text-xs tabular-nums text-slate-500">{fmtTime(e.starts_at)}</p>
                            </div>
                            <div className={`flex-1 rounded-[10px] border-l-[3px] px-3 py-2 ${s.bg}`}>
                                <p className={`font-medium text-sm ${s.text}`}>{e.title}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    {typeLabel && <Badge variant="outline" className="bg-white">{typeLabel}</Badge>}
                                    {e.with_name && <span className="text-xs text-slate-600">{e.with_name}</span>}
                                    {e.format === 'online' && e.zoom_join_url && (
                                        <a href={e.zoom_join_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-[#102945]">
                                            <Video className="size-3" />Zoom
                                        </a>
                                    )}
                                </div>
                                {e.room && <p className="text-xs text-slate-600 mt-0.5">Кабинет: {e.room}</p>}
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
        format: 'offline',
        room: '',
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

    const isSelectedDayAbsence = useMemo(
        () => !!selectedCalendarDay && absenceDaysSet.has(selectedCalendarDay),
        [selectedCalendarDay, absenceDaysSet],
    );

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

            return { hour, events: eventsInHour, isPast, isBusy: eventsInHour.length > 0 };
        });
    }, [selectedCalendarDay, selectedDayEvents]);

    const selectedStartHour = useMemo(() => {
        if (!selectedCalendarDay || !data.starts_at) return null;
        if (!data.starts_at.startsWith(selectedCalendarDay)) return null;
        return Number(data.starts_at.slice(11, 13));
    }, [selectedCalendarDay, data.starts_at]);

    function applyQuickRange(mode) {
        let start = roundToQuarterHour(new Date());

        if (mode === 'in_1h') {
            start = new Date(start);
            start.setHours(start.getHours() + 1);
        }
        if (mode === 'tomorrow_9') {
            start = new Date();
            start.setDate(start.getDate() + 1);
            start.setHours(9, 0, 0, 0);
        }

        const end = new Date(start);
        end.setMinutes(end.getMinutes() + 60);

        const next = normalizeRange(
            toLocalDateTimeInput(start),
            toLocalDateTimeInput(end),
            minDateTime,
        );

        setData(prev => ({
            ...prev,
            starts_at: next.starts_at,
            ends_at: next.ends_at,
        }));
    }

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
                        <div className="space-y-2">
                            <Label>Тип события</Label>
                            <NativeSelect
                                value={data.type}
                                onValueChange={handleTypeChange}
                                options={Object.entries(TYPE_META).map(([k, v]) => ({ value: k, label: v.label }))}
                            />
                        </div>
                        {data.type === 'meeting' && (
                            <div className="space-y-2">
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
                                    {suggestMessage && <span className="text-xs text-slate-600">{suggestMessage}</span>}
                                </div>
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label>Название</Label>
                            <Input value={data.title} onChange={e => setData('title', e.target.value)} required />
                            {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
                        </div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <DateTimePickerField
                                label="Начало"
                                value={data.starts_at}
                                minValue={minDateTime}
                                onChange={value => setData('starts_at', value)}
                                required
                                error={errors.starts_at}
                            />
                            <DateTimePickerField
                                label="Конец"
                                value={data.ends_at}
                                minValue={data.starts_at || minDateTime}
                                onChange={value => setData('ends_at', value)}
                                required
                                error={errors.ends_at}
                            />
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                            <p className="qd-field-label mb-2 text-slate-500">Быстрый выбор времени</p>
                            <div className="flex flex-wrap gap-2">
                                <Button type="button" variant="outline" size="sm" onClick={() => applyQuickRange('now')}>Сейчас + 1 час</Button>
                                <Button type="button" variant="outline" size="sm" onClick={() => applyQuickRange('in_1h')}>Через 1 час</Button>
                                <Button type="button" variant="outline" size="sm" onClick={() => applyQuickRange('tomorrow_9')}>Завтра 09:00</Button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Комментарий / причина <span className="text-xs font-normal normal-case tracking-normal text-slate-500">(необязательно)</span></Label>
                            <Textarea rows={3} value={data.description} onChange={e => setData('description', e.target.value)} placeholder="Например: ежегодный отпуск, деловая поездка в Алматы..." />
                        </div>
                        {data.type === 'meeting' && (
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label>Формат</Label>
                                    <NativeSelect
                                        value={data.format}
                                        onValueChange={value => setData('format', value)}
                                        options={[
                                            { value: 'offline', label: 'Офлайн' },
                                            { value: 'online', label: 'Онлайн' },
                                        ]}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Кабинет</Label>
                                    <Input value={data.room} onChange={e => setData('room', e.target.value)} placeholder="Например: 305" />
                                </div>
                            </div>
                        )}
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
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><CalendarDays className="shrink-0" />Календарь сотрудника</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {!data.attendee_id && (
                                    <p className="text-sm text-slate-500">Выберите сотрудника, чтобы посмотреть свободные даты.</p>
                                )}

                                {data.attendee_id && (
                                    <>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-semibold text-slate-900">{selectedEmployee?.name ?? 'Сотрудник'}</p>
                                                <p className="text-xs text-slate-500">{MONTH_NAMES[calendarMonth]} {calendarYear}</p>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Button type="button" variant="outline" size="icon" className="size-8" aria-label="Предыдущий месяц" onClick={() => setCalendarCursor(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}>
                                                    <ChevronLeft className="size-4" />
                                                </Button>
                                                <Button type="button" variant="outline" size="icon" className="size-8" aria-label="Следующий месяц" onClick={() => setCalendarCursor(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}>
                                                    <ChevronRight className="size-4" />
                                                </Button>
                                            </div>
                                        </div>

                                        {availabilityLoading && <LoadingState label="Загрузка календаря..." />}
                                        {availabilityError && <p className="text-xs text-destructive">{availabilityError}</p>}

                                        <div className="grid grid-cols-7 gap-1 text-[11px]">
                                            {WEEKDAYS_SHORT.map(dayName => (
                                                <div key={dayName} className="text-center text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">{dayName}</div>
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
                                                            'h-8 rounded-[8px] border text-xs font-medium tabular-nums transition-colors',
                                                            isSelected ? 'ring-2 ring-teal-600 border-teal-600' : 'border-slate-200',
                                                            isPast
                                                                ? 'bg-slate-100 text-slate-400 border-slate-200'
                                                                : (isAbsence ? 'bg-red-100 text-red-700' : (isBusy ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700')),
                                                        ].join(' ')}
                                                    >
                                                        {d}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-600">
                                            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300" />Прошедшая дата</span>
                                            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-500" />Прошедший час</span>
                                            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-600" />Свободно</span>
                                            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />Есть события</span>
                                            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-600" />Отсутствие</span>
                                        </div>

                                        {selectedCalendarDay && (
                                            <div className="space-y-2 border-t border-slate-200 pt-3">
                                                <p className="qd-field-label text-slate-600">Часы на {fmtDate(selectedCalendarDay)}</p>
                                                {isSelectedDayAbsence && (
                                                    <p className="text-xs text-red-700">На выбранную дату у сотрудника отмечено отсутствие.</p>
                                                )}
                                                {selectedDayEvents.length === 0 && (
                                                    <p className="text-xs text-emerald-700">На выбранную дату сотрудник свободен.</p>
                                                )}

                                                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-3">
                                                    {selectedDayHourSlots.map(slot => {
                                                        const isSelectedStart = selectedStartHour === slot.hour;
                                                        const mode = slot.isPast
                                                            ? 'past'
                                                            : (isSelectedDayAbsence
                                                                ? 'absence'
                                                                : (slot.isBusy ? 'busy' : 'free'));
                                                        const classes = {
                                                            past: 'border-slate-200 bg-slate-100 text-slate-500',
                                                            absence: 'border-orange-300 bg-orange-100 text-orange-800',
                                                            busy: 'border-red-300 bg-red-100 text-red-800',
                                                            free: 'border-emerald-300 bg-emerald-100 text-emerald-800',
                                                        };
                                                        const labels = {
                                                            past: 'Прошло',
                                                            absence: 'Отсутствие',
                                                            busy: 'Занято',
                                                            free: 'Свободно',
                                                        };

                                                        return (
                                                            <button
                                                                key={`compact-${slot.hour}`}
                                                                type="button"
                                                                onClick={() => {
                                                                    if (slot.isPast || isSelectedDayAbsence) return;
                                                                    const start = `${selectedCalendarDay}T${String(slot.hour).padStart(2, '0')}:00`;
                                                                    const end = `${selectedCalendarDay}T${String(slot.hour + 1).padStart(2, '0')}:00`;
                                                                    const next = normalizeRange(start, end, minDateTime);
                                                                    setData(prev => ({ ...prev, starts_at: next.starts_at, ends_at: next.ends_at }));
                                                                }}
                                                                className={[
                                                                    'rounded-[8px] border px-2 py-1.5 text-left text-[11px] transition-colors',
                                                                    classes[mode],
                                                                    (slot.isPast || isSelectedDayAbsence) ? 'cursor-not-allowed opacity-85' : 'hover:brightness-95',
                                                                    isSelectedStart ? 'ring-2 ring-teal-600 ring-offset-1' : '',
                                                                ].join(' ')}
                                                            >
                                                                <p className="font-semibold leading-tight">{String(slot.hour).padStart(2, '0')}:00</p>
                                                                <p className="mt-0.5 leading-tight">{labels[mode]}</p>
                                                            </button>
                                                        );
                                                    })}
                                                </div>

                                                {selectedDayEvents.length > 0 && (
                                                    <div className="rounded-[10px] border border-red-200 bg-red-50 p-2.5">
                                                        <p className="text-[11px] font-semibold text-red-800">Запланированные интервалы</p>
                                                        <div className="mt-1 space-y-1">
                                                            {selectedDayEvents.map(event => (
                                                                <div key={`planned-${event.id}`} className="rounded-[8px] border border-red-200 bg-white px-2 py-1 text-[11px]">
                                                                    <p className="font-medium text-red-900">{event.title}</p>
                                                                    <p className="text-red-700">{fmtTime(event.starts_at)} - {fmtTime(event.ends_at)}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="space-y-1.5 max-h-64 overflow-auto pr-1">
                                                    {selectedDayHourSlots.map(slot => (
                                                        <div
                                                            key={slot.hour}
                                                            className={[
                                                                'grid grid-cols-[52px_1fr] gap-2 items-start rounded-[8px] border p-1.5',
                                                                slot.isPast
                                                                    ? 'bg-slate-100 border-slate-200 text-slate-500'
                                                                    : (isSelectedDayAbsence
                                                                        ? 'bg-orange-50 border-orange-200'
                                                                        : (slot.isBusy ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200')),
                                                            ].join(' ')}
                                                        >
                                                            <div className="text-[11px] tabular-nums text-slate-500 pt-0.5">{String(slot.hour).padStart(2, '0')}:00</div>
                                                            <div className="space-y-2">
                                                                {slot.isPast ? (
                                                                    <p className="text-[11px] text-slate-500">Прошло</p>
                                                                ) : isSelectedDayAbsence ? (
                                                                    <p className="text-[11px] text-orange-800">Недоступно: отсутствие</p>
                                                                ) : slot.events.length === 0 ? (
                                                                    <p className="text-[11px] text-emerald-700">Свободно</p>
                                                                ) : (
                                                                    slot.events.map(event => (
                                                                        <div key={`${slot.hour}-${event.id}`} className="rounded-[8px] border border-slate-200 bg-white p-1.5 text-[11px]">
                                                                            <p className="font-medium leading-tight">{event.title}</p>
                                                                            <p className="text-slate-500 tabular-nums leading-tight mt-0.5">
                                                                                {fmtTime(event.starts_at)} - {fmtTime(event.ends_at)}
                                                                            </p>
                                                                            <div className="mt-1 flex items-center gap-1">
                                                                                <Badge variant="outline">{TYPE_META[event.type]?.label ?? event.type}</Badge>
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
        ? (EVENT_STYLE[event.status] ?? TYPE_META[event.type] ?? EVENT_STYLE.confirmed)
        : EVENT_STYLE.confirmed;

    const { data, setData, patch, processing, errors, reset } = useForm(
        event ? {
            title: event.title ?? '',
            type: event.type ?? 'other',
            starts_at: event.starts_at ? event.starts_at.slice(0, 16) : '',
            ends_at: event.ends_at ? event.ends_at.slice(0, 16) : '',
            description: event.description ?? '',
            format: event.format ?? 'offline',
            room: event.room ?? '',
            color: event.color ?? '',
        } : { title: '', type: 'other', starts_at: '', ends_at: '', description: '', format: 'offline', room: '', color: '' }
    );

    const [isEditing, setIsEditing] = useState(false);

    function handleConfirm() {
        router.patch(route('calendar.events.confirm', event.id), {}, {
            onSuccess: onClose,
        });
    }

    function handleDecline() {
        const reason = prompt('Причина отклонения (необязательно)') ?? '';
        router.patch(route('calendar.events.decline', event.id), { reason }, { onSuccess: onClose });
    }

    function handleCancel() {
        const reason = prompt('Укажите причину отмены');
        if (!reason) return;
        router.patch(route('calendar.events.cancel', event.id), { reason }, { onSuccess: onClose });
    }

    function handleReschedule() {
        const reason = prompt('Причина переноса (необязательно)') ?? '';
        router.patch(route('calendar.events.reschedule', event.id), {
            starts_at: data.starts_at,
            ends_at: data.ends_at,
            reason,
        }, { onSuccess: () => { setIsEditing(false); onClose(); } });
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
                            <Badge variant="outline">{TYPE_META[event.type].label}</Badge>
                        )}
                    </DialogTitle>
                </DialogHeader>

                {!isEditing ? (
                    <div className="space-y-3 py-1">
                        <div className={`rounded-[10px] border-l-4 px-4 py-3.5 space-y-2.5 ${event.color ? '' : s.bg}`}
                            style={event.color ? { borderColor: event.color, backgroundColor: event.color + '26' } : {}}>

                            {/* Время */}
                            <div className="flex items-start gap-2 text-sm">
                                <Clock className="size-4 mt-0.5 shrink-0 text-slate-500" />
                                <span className="tabular-nums">{fmtDate(event.starts_at)} {fmtTime(event.starts_at)} — {fmtDate(event.ends_at)} {fmtTime(event.ends_at)}</span>
                            </div>

                            {/* Собеседник */}
                            {event.with_name && (
                                <div className="flex items-center gap-2 text-sm">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="size-4 shrink-0 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg>
                                    <span>{event.with_name}</span>
                                </div>
                            )}

                            {/* Формат */}
                            {event.format && (
                                <div className="flex items-center gap-2 text-sm">
                                    {event.format === 'online'
                                        ? <Video className="size-4 shrink-0 text-slate-500" />
                                        : <MapPin className="size-4 shrink-0 text-slate-500" />}
                                    <span className="capitalize">{event.format === 'online' ? 'Онлайн' : 'Офлайн'}</span>
                                </div>
                            )}

                            {/* Zoom ссылка */}
                            {event.zoom_join_url && (
                                <div className="flex items-center gap-2 text-sm">
                                    <Video className="size-4 shrink-0 text-teal-700" />
                                    <a
                                        href={event.zoom_join_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-semibold text-teal-700 underline underline-offset-2 hover:text-[#102945] break-all"
                                    >
                                        Подключиться к Zoom
                                    </a>
                                </div>
                            )}

                            {/* Кабинет */}
                            {event.room && (
                                <div className="flex items-center gap-2 text-sm">
                                    <MapPin className="size-4 shrink-0 text-slate-500" />
                                    <span>Кабинет: {event.room}</span>
                                </div>
                            )}

                            {/* Статус */}
                            {event.status && event.status !== 'confirmed' && (
                                <div className="flex items-center gap-2 text-sm">
                                    <AlertTriangle className="size-4 shrink-0 text-slate-500" />
                                    <Badge variant={event.status === 'pending' ? 'warning' : event.status === 'conflict' || event.status === 'cancelled' ? 'destructive' : 'secondary'}>
                                        {event.status === 'pending' ? 'Ожидает подтверждения'
                                            : event.status === 'conflict' ? 'Конфликт'
                                                : event.status === 'declined' ? 'Отклонено'
                                                    : event.status === 'cancelled' ? 'Отменено'
                                                        : event.status}
                                    </Badge>
                                </div>
                            )}

                            {/* Описание */}
                            {event.description && (
                                <div className="border-t border-slate-200/80 pt-2.5 mt-2">
                                    <p className="qd-field-label text-slate-500 mb-1">Описание</p>
                                    <p className="text-sm whitespace-pre-wrap">{event.description}</p>
                                </div>
                            )}
                        </div>

                        {(event.can_confirm || event.can_decline || event.can_cancel || event.can_reschedule || event.is_own) && (
                            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
                                {event.can_confirm && (
                                    <Button size="sm" onClick={handleConfirm}>Подтвердить</Button>
                                )}
                                {event.can_decline && (
                                    <Button size="sm" variant="outline" onClick={handleDecline}>Отклонить</Button>
                                )}
                                <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
                                    <Pencil className="size-3.5" />{event.is_own ? 'Редактировать' : 'Перенести'}
                                </Button>
                                {event.can_cancel && (
                                    <Button size="sm" variant="destructive" onClick={handleCancel}>
                                        <Trash2 className="size-3.5" />Отменить
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <form onSubmit={handleSave} className="space-y-4 pt-1">
                        <div className="space-y-2">
                            <Label>Тип события</Label>
                            <NativeSelect value={data.type} onValueChange={v => setData('type', v)}
                                options={Object.entries(TYPE_META).map(([k, v]) => ({ value: k, label: v.label }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Название</Label>
                            <Input value={data.title} onChange={e => setData('title', e.target.value)} required />
                            {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
                        </div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <DateTimePickerField
                                label="Начало"
                                value={data.starts_at}
                                onChange={value => setData('starts_at', value)}
                                required
                                error={errors.starts_at}
                            />
                            <DateTimePickerField
                                label="Конец"
                                value={data.ends_at}
                                minValue={data.starts_at || undefined}
                                onChange={value => setData('ends_at', value)}
                                required
                                error={errors.ends_at}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Описание</Label>
                            <Textarea rows={2} value={data.description} onChange={e => setData('description', e.target.value)} />
                        </div>
                        {data.type === 'meeting' && (
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label>Формат</Label>
                                    <NativeSelect value={data.format} onValueChange={v => setData('format', v)}
                                        options={[
                                            { value: 'offline', label: 'Офлайн' },
                                            { value: 'online', label: 'Онлайн' },
                                        ]} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Кабинет</Label>
                                    <Input value={data.room} onChange={e => setData('room', e.target.value)} />
                                </div>
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label>Цвет метки</Label>
                            <div className="flex flex-wrap gap-1.5 items-center">
                                <button type="button" onClick={() => setData('color', '')}
                                    aria-label="Без цвета"
                                    className={`w-7 h-7 rounded-full border-2 bg-slate-100 ${!data.color ? 'border-teal-700 ring-2 ring-teal-600/30' : 'border-slate-300'}`} />
                                {PRESET_COLORS.map(c => (
                                    <button key={c} type="button" onClick={() => setData('color', data.color === c ? '' : c)}
                                        aria-label={c}
                                        className={`w-7 h-7 rounded-full border-2 transition-shadow ${data.color === c ? 'border-[#102945] ring-2 ring-[#102945]/25' : 'border-white ring-1 ring-slate-200 hover:ring-slate-400'}`}
                                        style={{ backgroundColor: c }} />
                                ))}
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsEditing(false)} disabled={processing}>Отмена</Button>
                            {event.can_cancel && (
                                <Button type="button" variant="destructive" size="sm" onClick={handleCancel} disabled={processing}>
                                    <Trash2 className="size-3.5" />Отменить
                                </Button>
                            )}
                            {event.can_reschedule && (
                                <Button type="button" variant="secondary" onClick={handleReschedule} disabled={processing}>Перенести</Button>
                            )}
                            {event.is_own && <Button type="submit" disabled={processing}>Сохранить</Button>}
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
        { key: 'meeting', label: 'Встреча', cls: 'bg-blue-600' },
        { key: 'vacation', label: 'Отпуск', cls: 'bg-emerald-600' },
        { key: 'business_trip', label: 'Командировка', cls: 'bg-orange-600' },
        { key: 'sick_leave', label: 'Больничный', cls: 'bg-amber-500' },
        { key: 'personal', label: 'Личное', cls: 'bg-[#102945]' },
        { key: 'remote', label: 'Удаленная работа', cls: 'bg-teal-600' },
        { key: 'other', label: 'Другое', cls: 'bg-slate-400' },
        { key: 'pending', label: 'Ожидает', cls: 'bg-amber-400' },
        { key: 'conflict', label: 'Конфликт', cls: 'bg-red-600' },
        { key: 'declined', label: 'Отклонено', cls: 'bg-slate-500' },
    ];

    const isManagingOther = calendarOwner && String(calendarOwner.id) !== String(selfUser?.id);

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="Smart Calendar"
                    title={isManagingOther ? `Календарь: ${calendarOwner?.name ?? '—'}` : 'Календарь'}
                    description="Встречи, отпуска, командировки и другие события. Двойной щелчок по дню в режиме «Месяц» — новое событие на этот день."
                    meta={hasMeetingNotifications ? (
                        <StatusBadge tone="warning">
                            <Bell className="mr-1 h-3 w-3" />
                            Уведомлений: {meetingNotifications.length}
                        </StatusBadge>
                    ) : null}
                    actions={(
                        <Button onClick={() => {
                            setCreateDate(null);
                            setCreateOpen(true);
                        }}>
                            <Plus className="size-4" />Добавить событие
                        </Button>
                    )}
                />
            )}
        >
            <Head title="Smart Calendar — Календарь" />
            <div className="admin-page-wrap space-y-6">
                {!!flash?.error && <Notice tone="danger"><span className="whitespace-pre-line">{flash.error}</span></Notice>}
                {!!flash?.warning && <Notice tone="warning"><span className="whitespace-pre-line">{flash.warning}</span></Notice>}
                {!!flash?.success && <Notice tone="success">{flash.success}</Notice>}

                {/* Calendar owner switcher — shown when secretary access is available */}
                {(managedCalendars.length > 0 || isManagingOther) && (
                    <Notice
                        tone={isManagingOther ? 'warning' : 'brand'}
                        title={isManagingOther
                            ? `Управление: ${calendarOwner?.name ?? '—'}`
                            : 'Совместное управление'}
                        action={(
                            <div className="w-full sm:w-auto">
                                <NativeSelect
                                    value={activeOwnerId}
                                    onValueChange={(val) => router.get(route('calendar.index'), { calendar_owner_id: val })}
                                    options={[
                                        {
                                            value: String(selfOwnerOption.id),
                                            label: `Мой календарь (${selfOwnerOption.name})`,
                                        },
                                        ...managedCalendars.map((c) => ({
                                            value: String(c.id),
                                            label: c.title ? `${c.name} — ${c.title}` : c.name,
                                        })),
                                    ]}
                                    className="min-w-[240px] bg-white"
                                />
                            </div>
                        )}
                    >
                        Выберите, чей календарь открыть.
                    </Notice>
                )}

                <StatGrid className="sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
                    <SummaryStatCard label="Встреч на неделе" value={stats.week_count ?? 0} hint="подтверждённые встречи" icon={CalendarDays} />
                    <SummaryStatCard label="Сегодня встреч" value={stats.today_count ?? 0} hint="по текущему дню" icon={Clock} tone="navy" />
                    <SummaryStatCard label="Ожидают ответа" value={stats.pending_count ?? 0} hint="входящие запросы" icon={MessageSquare} tone="warning" />
                    <SummaryStatCard label="Конфликты" value={stats.conflict_count ?? 0} hint="требуют внимания" icon={AlertTriangle} tone={(stats.conflict_count ?? 0) > 0 ? 'danger' : 'neutral'} />
                    <SummaryStatCard label="Дней отпуска" value={stats.vacation_days ?? 0} hint="в этом месяце" icon={CalendarDays} tone="success" />
                    <SummaryStatCard label="Командировки" value={stats.business_trip_days ?? 0} hint="в этом месяце" icon={CalendarDays} tone="info" />
                </StatGrid>

                {hasMeetingNotifications && (
                    <Card className="border-amber-200">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Bell className="shrink-0" />
                                Уведомления о встречах
                                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold leading-none tabular-nums text-white">
                                    {meetingNotifications.length}
                                </span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-3 lg:grid-cols-2">
                                {meetingNotifications.map(meeting => (
                                    <div key={meeting.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                                        <div className="flex items-start justify-between gap-2">
                                            <p className="font-semibold text-slate-900">{meeting.title}</p>
                                            <Badge variant="info">Встреча</Badge>
                                        </div>
                                        <p className="mt-1 text-xs tabular-nums text-slate-600">{fmtDate(meeting.starts_at)}, {fmtTime(meeting.starts_at)}–{fmtTime(meeting.ends_at)}</p>
                                        <p className="mt-0.5 text-xs text-slate-600">С кем: {meeting.organizer_name ?? 'Не указан'}</p>
                                        <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-slate-600">
                                            <MapPin className="size-3 text-teal-700" />
                                            {meeting.room ? `Где: ${meeting.room}` : (meeting.format === 'online' ? 'Где: Online (Zoom)' : 'Где: не указано')}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
                    <div className="space-y-6">
                        <FilterBar>
                            <div className="space-y-4">
                                <label className="relative block space-y-2">
                                    <span className="qd-field-label block">Поиск по событиям</span>
                                    <Search className="pointer-events-none absolute bottom-3 left-3 size-4 text-slate-400" />
                                    <Input
                                        className="pl-9 pr-9"
                                        placeholder="Название события..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                    />
                                    {searchQuery && (
                                        <button type="button" aria-label="Очистить поиск" className="absolute bottom-3 right-3" onClick={(ev) => { ev.preventDefault(); setSearchQuery(''); }}>
                                            <X className="size-4 text-slate-400 hover:text-[#102945]" />
                                        </button>
                                    )}
                                </label>
                                <div className="space-y-2">
                                    <span className="qd-field-label block">Типы событий</span>
                                    <div className="flex flex-wrap gap-1.5">
                                        {Object.entries(TYPE_META).map(([key, meta]) => {
                                            const on = activeTypes.has(key);
                                            return (
                                                <button
                                                    key={key}
                                                    type="button"
                                                    onClick={() => toggleType(key)}
                                                    aria-pressed={on}
                                                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${on ? 'border-slate-300 bg-white text-slate-800 hover:border-slate-400' : 'border-dashed border-slate-300 bg-slate-50 text-slate-400'}`}
                                                >
                                                    <span className={`h-2 w-2 rounded-full ${on ? meta.dot : 'bg-slate-300'}`} />
                                                    {meta.label}
                                                    {!on && <X className="size-3" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4">
                                    <span className="text-xs font-medium text-slate-500">Найдено: <span className="tabular-nums">{filteredEvents.length}</span></span>
                                    {activeTypes.size < Object.keys(TYPE_META).length && (
                                        <Button type="button" variant="outline" size="sm" onClick={() => setActiveTypes(new Set(Object.keys(TYPE_META)))}>
                                            Сбросить
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </FilterBar>

                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <Button variant="outline" size="icon" aria-label="Предыдущий период" onClick={prev}><ChevronLeft className="size-4" /></Button>
                                <Button variant="outline" size="icon" aria-label="Следующий период" onClick={next}><ChevronRight className="size-4" /></Button>
                                <h2 className="mx-2 font-display text-xl font-bold text-[#102945]">{periodLabel}</h2>
                                <Button variant="outline" size="sm" onClick={goToday}>Сегодня</Button>
                            </div>
                            <Segmented items={VIEWS} value={view} onChange={setView} />
                        </div>

                        {view === 'month' && <MonthView year={year} month={month} events={filteredEvents} holidays={holidays} onDayClick={d => {
                            setDay(d);
                            setView('day');
                        }} onDayDoubleClick={openCreateForDay} onEventClick={setSelectedEvent} selectedDay={null} />}
                        {view === 'week' && <WeekView year={year} month={month} day={day} events={filteredEvents} onEventClick={setSelectedEvent} />}
                        {view === 'day' && <DayView year={year} month={month} day={day} events={filteredEvents} onEventClick={setSelectedEvent} />}
                        {view === 'agenda' && <AgendaView events={filteredEvents} onEventClick={setSelectedEvent} />}

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600">
                            <span className="qd-field-label text-slate-500">Цвета событий</span>
                            {eventLegend.map(item => (
                                <span key={item.key} className="inline-flex items-center gap-1.5">
                                    <span className={`h-2.5 w-2.5 rounded-full ${item.cls}`} />
                                    {item.label}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-6 xl:sticky xl:top-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Clock className="shrink-0" />
                                    Ближайшие встречи
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="max-h-[calc(100vh-10rem)] overflow-y-auto py-1 sm:py-1">
                                {upcomingEvents.length === 0 ? (
                                    <p className="py-6 text-center text-sm text-slate-500">Нет предстоящих встреч</p>
                                ) : (
                                    <div className="divide-y divide-slate-200">
                                        {upcomingEvents.map(e => (
                                            <div key={e.id} className="py-3">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-semibold text-slate-900">{e.title}</p>
                                                        <p className="mt-0.5 text-xs text-slate-600">{e.with}</p>
                                                    </div>
                                                    {e.format === 'online' && e.zoom_join_url && <Badge variant="info">Zoom</Badge>}
                                                </div>
                                                <p className="mt-1.5 text-xs tabular-nums text-slate-500">{fmtDate(e.starts_at)} {fmtTime(e.starts_at)}–{fmtTime(e.ends_at)}</p>
                                                <p className="mt-0.5 text-xs text-slate-500">{e.room ? `Где: ${e.room}` : (e.format === 'online' ? 'Где: Online (Zoom)' : 'Где: не указано')}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <CreateEventModal open={createOpen} onClose={() => setCreateOpen(false)} defaultDate={createDate} employees={employees} ownerId={activeOwnerId} />
                <EventModal event={selectedEvent} open={!!selectedEvent} onClose={() => setSelectedEvent(null)} />
            </div>
        </AuthenticatedLayout>
    );
}
