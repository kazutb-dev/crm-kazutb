import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { EmptyState, Notice, PageHeader, Segmented, StatusBadge } from '@/components/platform';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Head, useForm, usePage } from '@inertiajs/react';
import { Bell, ChevronLeft, ChevronRight, MapPin, Plus, Video } from 'lucide-react';
import { useMemo, useState } from 'react';

const WEEKDAYS_LONG  = ['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье'];
const WEEKDAYS_SHORT = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
const MONTH_NAMES    = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const HOURS = Array.from({ length: 11 }, (_, i) => i + 8); // 08–18

const EVENT_STYLE = {
    confirmed: { bg: 'bg-blue-50 border-blue-600',   text: 'text-blue-800',  label: 'Подтверждена' },
    pending:   { bg: 'bg-amber-50 border-amber-500', text: 'text-amber-800', label: 'Ожидает' },
    conflict:  { bg: 'bg-red-50 border-red-600',     text: 'text-red-800',   label: 'Конфликт' },
    completed: { bg: 'bg-slate-100 border-slate-300', text: 'text-slate-500', label: 'Завершена' },
};

const TYPE_META = {
    meeting:       { label: 'Встреча',           bg: 'bg-blue-50 border-blue-600',       text: 'text-blue-800',    dot: 'bg-blue-600' },
    vacation:      { label: 'Отпуск',            bg: 'bg-emerald-50 border-emerald-600', text: 'text-emerald-800', dot: 'bg-emerald-600' },
    business_trip: { label: 'Командировка',      bg: 'bg-orange-50 border-orange-600',   text: 'text-orange-800',  dot: 'bg-orange-600' },
    sick_leave:    { label: 'Больничный',         bg: 'bg-amber-50 border-amber-500',     text: 'text-amber-800',   dot: 'bg-amber-500' },
    personal:      { label: 'Личное',            bg: 'bg-slate-100 border-[#102945]',    text: 'text-[#102945]',   dot: 'bg-[#102945]' },
    remote:        { label: 'Удалённая работа',  bg: 'bg-teal-50 border-teal-600',       text: 'text-teal-800',    dot: 'bg-teal-600' },
    other:         { label: 'Другое',            bg: 'bg-slate-100 border-slate-400',    text: 'text-slate-700',   dot: 'bg-slate-400' },
};

function getMonthCells(year, month) {
    const firstDay  = new Date(year, month, 1);
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
    const monday = new Date(d); monday.setDate(d.getDate() - dow);
    return Array.from({ length: 7 }, (_, i) => {
        const dd = new Date(monday); dd.setDate(monday.getDate() + i);
        return dd;
    });
}

function fmt(dt, opts) {
    if (!dt) return '';
    return new Date(dt).toLocaleString('ru-RU', opts);
}
function fmtTime(dt) { return fmt(dt, { hour: '2-digit', minute: '2-digit' }); }
function fmtDate(dt) { return fmt(dt, { day: '2-digit', month: 'long', year: 'numeric' }); }

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

function EventChip({ event, small = false }) {
    const s = event.status === 'conflict'
        ? EVENT_STYLE.conflict
        : (event.type && TYPE_META[event.type]
            ? TYPE_META[event.type]
            : (EVENT_STYLE[event.status] ?? EVENT_STYLE.confirmed));
    return (
        <div className={`rounded-[6px] border-l-[3px] px-1.5 py-0.5 ${s.bg} ${small ? 'text-[10px]' : 'text-xs'}`}>
            <p className={`font-medium truncate ${s.text}`}>{event.title}</p>
            {!small && <p className="text-slate-500 tabular-nums truncate">{fmtTime(event.starts_at)}–{fmtTime(event.ends_at)}</p>}
            {!small && event.with_name && <p className="text-slate-500 truncate">{event.with_name}</p>}
        </div>
    );
}

// ── Month view ──────────────────────────────────────────────────────────────
function MonthView({ year, month, events, holidays, onDayClick, onDayDoubleClick, selectedDay }) {
    const cells = useMemo(() => getMonthCells(year, month), [year, month]);
    const today = new Date();

    const byDay = useMemo(() => {
        const m = {};
        events.forEach(e => {
            const d = new Date(e.starts_at);
            if (d.getFullYear() === year && d.getMonth() === month) {
                const day = d.getDate();
                if (!m[day]) m[day] = [];
                m[day].push(e);
            }
        });
        return m;
    }, [events, year, month]);

    const holidayDates = useMemo(() => {
        const s = new Set();
        (holidays ?? []).forEach(h => s.add(h.date?.slice(0, 10)));
        return s;
    }, [holidays]);

    return (
        <Card>
            <CardContent className="p-0 sm:p-0">
                <div className="grid grid-cols-7 border-b border-slate-200">
                    {WEEKDAYS_SHORT.map((wd, i) => (
                        <div key={wd} className={`py-2 text-center text-[0.6875rem] font-bold uppercase tracking-[0.1em] ${i >= 5 ? 'text-red-600/70' : 'text-slate-500'}`}>{wd}</div>
                    ))}
                </div>
                <div className="grid grid-cols-7">
                    {cells.map((day, idx) => {
                        const isWeekend = idx % 7 >= 5;
                        const isToday   = day && today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
                        const isPastDay = day && new Date(year, month, day).setHours(0, 0, 0, 0) < new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
                        const isSelected = !!day && day === selectedDay;
                        const dateStr   = day ? `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}` : '';
                        const isHoliday = holidayDates.has(dateStr);
                        const dayEvts   = day ? (byDay[day] ?? []) : [];

                        return (
                            <div
                                key={idx}
                                onClick={() => day && onDayClick(day)}
                                onDoubleClick={() => day && onDayDoubleClick && onDayDoubleClick(day)}
                                className={[
                                    'min-h-[88px] border-b border-r border-slate-200 p-1.5 flex flex-col gap-1 last:border-r-0 [&:nth-child(7n)]:border-r-0',
                                    day ? 'cursor-pointer hover:bg-teal-50/60 transition-colors' : 'bg-slate-50',
                                    isPastDay ? 'bg-slate-50 text-slate-400' : '',
                                    isSelected ? 'bg-teal-50 ring-1 ring-inset ring-teal-600/40' : '',
                                ].join(' ')}
                            >
                                {day && (
                                    <>
                                        <span className={`text-xs font-semibold tabular-nums w-7 h-7 flex items-center justify-center rounded-full shrink-0 ${isToday ? 'bg-teal-700 text-white' : isPastDay ? 'text-slate-400' : isHoliday || isWeekend ? 'text-red-600/80' : 'text-slate-800'}`}>
                                            {day}
                                        </span>
                                        {dayEvts.slice(0, 2).map((e, i) => <EventChip key={i} event={e} small/>)}
                                        {dayEvts.length > 2 && (
                                            <span className="text-[10px] font-medium text-slate-500">+{dayEvts.length - 2} ещё</span>
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

// ── Week view ───────────────────────────────────────────────────────────────
function WeekView({ year, month, day, events }) {
    const weekDates = useMemo(() => getWeekDates(year, month, day), [year, month, day]);
    const today = new Date();

    const byDayHour = useMemo(() => {
        const m = {};
        events.forEach(e => {
            const d = new Date(e.starts_at);
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            if (!m[key]) m[key] = [];
            m[key].push(e);
        });
        return m;
    }, [events]);

    return (
        <Card>
            <CardContent className="p-0 sm:p-0 overflow-x-auto">
                <div className="min-w-[640px]">
                    {/* Header */}
                    <div className="grid border-b border-slate-200" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
                        <div className="border-r border-slate-200"/>
                        {weekDates.map((d, i) => {
                            const isToday = today.toDateString() === d.toDateString();
                            return (
                                <div key={i} className={`text-center py-2 border-r border-slate-200 last:border-r-0 ${isToday ? 'bg-teal-50' : ''}`}>
                                    <p className="text-[0.6875rem] font-bold uppercase tracking-[0.1em] text-slate-500">{WEEKDAYS_SHORT[(d.getDay()+6)%7]}</p>
                                    <p className={`font-display text-base font-bold tabular-nums ${isToday ? 'text-teal-700' : 'text-[#102945]'}`}>{d.getDate()}</p>
                                </div>
                            );
                        })}
                    </div>
                    {/* Hour rows */}
                    {HOURS.map(h => (
                        <div key={h} className="grid border-b border-slate-200 last:border-b-0" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
                            <div className="border-r border-slate-200 px-1.5 py-1 text-right text-[10px] tabular-nums text-slate-500">{String(h).padStart(2,'0')}:00</div>
                            {weekDates.map((d, i) => {
                                const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
                                const slotEvts = (byDayHour[key] ?? []).filter(e => {
                                    const hour = new Date(e.starts_at).getHours();
                                    return hour === h;
                                });
                                return (
                                    <div key={i} className="border-r border-slate-200 last:border-r-0 min-h-[48px] p-0.5 space-y-0.5">
                                        {slotEvts.map((e, j) => <EventChip key={j} event={e} small/>)}
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

// ── Day view ────────────────────────────────────────────────────────────────
function DayView({ year, month, day, events }) {
    const date = new Date(year, month, day);
    const dayEvts = useMemo(() => events.filter(e => {
        const d = new Date(e.starts_at);
        return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    }), [events, year, month, day]);

    return (
        <Card>
            <CardContent className="p-0 sm:p-0">
                <div className="border-b border-slate-200 px-5 py-3 font-display text-base font-bold text-[#102945]">{fmtDate(date)}</div>
                <div>
                    {HOURS.map(h => {
                        const slotEvts = dayEvts.filter(e => new Date(e.starts_at).getHours() === h);
                        return (
                            <div key={h} className="flex border-b border-slate-200 last:border-b-0 min-h-[56px]">
                                <div className="w-16 shrink-0 border-r border-slate-200 px-2 py-1.5 text-right text-xs tabular-nums text-slate-500">{String(h).padStart(2,'0')}:00</div>
                                <div className="flex-1 p-1 space-y-1">
                                    {slotEvts.map((e, i) => <EventChip key={i} event={e}/>)}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}

// ── Agenda view ─────────────────────────────────────────────────────────────
function AgendaView({ events }) {
    if (events.length === 0) {
        return <EmptyState title="Нет событий" description="Добавьте событие кнопкой «Добавить событие» или дважды щёлкните по дню в режиме «Месяц»." />;
    }
    return (
        <Card>
            <CardContent className="p-0 sm:p-0 divide-y divide-slate-200">
                {events.map(e => {
                    const s = e.status === 'conflict'
                        ? EVENT_STYLE.conflict
                        : (e.type && TYPE_META[e.type] ? TYPE_META[e.type] : (EVENT_STYLE[e.status] ?? EVENT_STYLE.confirmed));
                    const typeLabel = e.type && TYPE_META[e.type] ? TYPE_META[e.type].label : null;
                    return (
                        <div key={e.id} className="flex gap-4 px-5 py-3.5 hover:bg-slate-50">
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
                                            <Video className="size-3"/>Zoom
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

// ── Main page ────────────────────────────────────────────────────────────────
// ── Create Event Modal ───────────────────────────────────────────────────────
function CreateEventModal({ open, onClose, defaultDate, employees = [] }) {
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
        title:       '',
        type:        'meeting',
        attendee_id: '',
        starts_at:   initialRange.starts_at,
        ends_at:     initialRange.ends_at,
        description: '',
    });

    // Auto-fill title when type changes (only if title not manually edited)
    function handleTypeChange(val) {
        const knownTitles = Object.values(TYPE_META).map(m => m.label);
        const nextTitle = (!data.title || knownTitles.includes(data.title))
            ? (TYPE_META[val]?.label ?? data.title)
            : data.title;
        setData({
            ...data,
            type: val,
            title: nextTitle,
            attendee_id: val === 'meeting' ? data.attendee_id : '',
        });
    }

    function submit(e) {
        e.preventDefault();
        post(route('calendar.events.store'), {
            onSuccess: () => { reset(); onClose(); },
        });
    }

    return (
        <Dialog
            open={open}
            onOpenChange={v => {
                if (!v) {
                    reset();
                    onClose();
                    return;
                }

                const nextRange = getInitialRange();
                setData(prev => ({
                    ...prev,
                    starts_at: nextRange.starts_at,
                    ends_at: nextRange.ends_at,
                }));
            }}
        >
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Добавить событие</DialogTitle>
                </DialogHeader>
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
                                    if (value) {
                                        window.open(route('calendar.employees.profile', { employee: value }), '_blank');
                                    }
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
                            {!!data.attendee_id && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="mt-1"
                                    onClick={() => window.open(route('calendar.employees.profile', { employee: data.attendee_id }), '_blank')}
                                >
                                    Открыть профиль календаря
                                </Button>
                            )}
                        </div>
                    )}
                    <div className="space-y-2">
                        <Label>Название</Label>
                        <Input value={data.title} onChange={e => setData('title', e.target.value)} required/>
                        {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label>Начало</Label>
                            <Input type="datetime-local" min={minDateTime} value={data.starts_at} onChange={e => setData('starts_at', e.target.value)} required/>
                            {errors.starts_at && <p className="text-xs text-destructive">{errors.starts_at}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label>Конец</Label>
                            <Input type="datetime-local" min={data.starts_at || minDateTime} value={data.ends_at} onChange={e => setData('ends_at', e.target.value)} required/>
                            {errors.ends_at && <p className="text-xs text-destructive">{errors.ends_at}</p>}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Комментарий / причина <span className="text-xs font-normal normal-case tracking-normal text-slate-500">(необязательно)</span></Label>
                        <Textarea rows={3} value={data.description} onChange={e => setData('description', e.target.value)} placeholder="Например: ежегодный отпуск, деловая поездка в Алматы…"/>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => { reset(); onClose(); }}>Отмена</Button>
                        <Button type="submit" disabled={processing}>Сохранить</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

const VIEWS = [
    { key: 'month',  label: 'Месяц' },
    { key: 'week',   label: 'Неделя' },
    { key: 'day',    label: 'День' },
    { key: 'agenda', label: 'Повестка' },
];

export default function CalendarMy({ events = [], meetingNotifications = [], slots = [], holidays = [], employees = [], year: initYear, month: initMonth }) {
    const { flash = {} } = usePage().props;
    const today = new Date();
    const [view,  setView]  = useState('month');
    const [year,  setYear]  = useState(initYear  ?? today.getFullYear());
    const [month, setMonth] = useState((initMonth ?? today.getMonth() + 1) - 1); // 0-based
    const [day,   setDay]   = useState(today.getDate());
    const [createOpen, setCreateOpen] = useState(false);
    const [createDate, setCreateDate] = useState(null);

    function prev() {
        if (view === 'month') {
            if (month === 0) { setMonth(11); setYear(y => y - 1); }
            else setMonth(m => m - 1);
        } else if (view === 'week') {
            const d = new Date(year, month, day - 7);
            setYear(d.getFullYear()); setMonth(d.getMonth()); setDay(d.getDate());
        } else {
            const d = new Date(year, month, day - 1);
            setYear(d.getFullYear()); setMonth(d.getMonth()); setDay(d.getDate());
        }
    }
    function next() {
        if (view === 'month') {
            if (month === 11) { setMonth(0); setYear(y => y + 1); }
            else setMonth(m => m + 1);
        } else if (view === 'week') {
            const d = new Date(year, month, day + 7);
            setYear(d.getFullYear()); setMonth(d.getMonth()); setDay(d.getDate());
        } else {
            const d = new Date(year, month, day + 1);
            setYear(d.getFullYear()); setMonth(d.getMonth()); setDay(d.getDate());
        }
    }
    function goToday() {
        setYear(today.getFullYear()); setMonth(today.getMonth()); setDay(today.getDate());
    }

    function openCreateForDay(d) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        setCreateDate(dateStr);
        setCreateOpen(true);
    }
    const periodLabel = useMemo(() => {
        if (view === 'month')  return `${MONTH_NAMES[month]} ${year}`;
        if (view === 'week') {
            const dates = getWeekDates(year, month, day);
            const first = dates[0]; const last = dates[6];
            return `${first.getDate()} – ${last.getDate()} ${MONTH_NAMES[last.getMonth()]} ${last.getFullYear()}`;
        }
        return fmtDate(new Date(year, month, day));
    }, [view, year, month, day]);

    const hasMeetingNotifications = meetingNotifications.length > 0;

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="Smart Calendar"
                    title="Мой календарь"
                    description="Встречи, отпуска, командировки и другие события. Двойной щелчок по дню в режиме «Месяц» — новое событие на этот день."
                    meta={hasMeetingNotifications ? (
                        <StatusBadge tone="warning">
                            <Bell className="mr-1 h-3 w-3" />
                            Уведомлений: {meetingNotifications.length}
                        </StatusBadge>
                    ) : null}
                    actions={(
                        <Button onClick={() => { setCreateDate(null); setCreateOpen(true); }}>
                            <Plus className="size-4"/>Добавить событие
                        </Button>
                    )}
                />
            )}
        >
            <Head title="Smart Calendar — Мой Календарь" />
            <div className="admin-page-wrap space-y-6">
                {!!flash?.warning && (
                    <Notice tone="warning">{flash.warning}</Notice>
                )}
                {!!flash?.success && (
                    <Notice tone="success">{flash.success}</Notice>
                )}

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
                        <CardContent className="py-1 sm:py-1">
                            <div className="divide-y divide-slate-200">
                                {meetingNotifications.map((meeting) => (
                                    <div key={meeting.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                                        <div className="min-w-0">
                                            <p className="font-semibold text-slate-900">{meeting.title}</p>
                                            <p className="text-xs text-slate-600">С кем: {meeting.organizer_name ?? 'Не указан'}</p>
                                        </div>
                                        <div className="shrink-0 space-y-0.5 text-xs text-slate-600 sm:text-right">
                                            <p className="tabular-nums">{fmtDate(meeting.starts_at)}, {fmtTime(meeting.starts_at)}–{fmtTime(meeting.ends_at)}</p>
                                            <p className="inline-flex items-center gap-1">
                                                <MapPin className="size-3 text-teal-700" />
                                                {meeting.room ? `Где: ${meeting.room}` : (meeting.format === 'online' ? 'Где: Online (Zoom)' : 'Где: не указано')}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" onClick={prev} aria-label="Назад"><ChevronLeft className="size-4"/></Button>
                        <Button variant="outline" size="icon" onClick={next} aria-label="Вперёд"><ChevronRight className="size-4"/></Button>
                        <h2 className="mx-2 font-display text-xl font-bold text-[#102945]">{periodLabel}</h2>
                        <Button variant="outline" size="sm" onClick={goToday}>Сегодня</Button>
                    </div>
                    <Segmented items={VIEWS} value={view} onChange={setView} />
                </div>

                {/* View */}
                {view === 'month'  && <MonthView year={year} month={month} events={events} holidays={holidays} onDayClick={d => { setDay(d); setView('day'); }} onDayDoubleClick={openCreateForDay} selectedDay={null}/>}
                {view === 'week'   && <WeekView  year={year} month={month} day={day} events={events}/>}
                {view === 'day'    && <DayView   year={year} month={month} day={day} events={events}/>}
                {view === 'agenda' && <AgendaView events={events}/>}

                {/* Legend */}
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-600">
                    {Object.entries(TYPE_META).map(([key, meta]) => (
                        <span key={key} className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${meta.dot}`} />{meta.label}</span>
                    ))}
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-600" />Конфликт</span>
                </div>

                <CreateEventModal open={createOpen} onClose={() => setCreateOpen(false)} defaultDate={createDate} employees={employees}/>
            </div>
        </AuthenticatedLayout>
    );
}
