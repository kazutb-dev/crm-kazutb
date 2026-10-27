import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageHeader, StatGrid, StatTile, StatusBadge } from '@/components/platform';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Head, router } from '@inertiajs/react';
import {
    AlertTriangle,
    CalendarDays,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Clock,
    MessageSquare,
    Video,
} from 'lucide-react';
import { useMemo, useState } from 'react';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTH_NAMES = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

const STATUS_OPTIONS = [
    { value: 'available',  label: 'Доступен для приёма', color: 'bg-emerald-600', tone: 'success' },
    { value: 'busy',       label: 'Занят',                color: 'bg-red-600',     tone: 'danger'  },
    { value: 'soon',       label: 'Скоро освобожусь',     color: 'bg-amber-500',   tone: 'warning' },
    { value: 'dnd',        label: 'Не беспокоить',        color: 'bg-slate-500',   tone: 'default' },
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

function formatTime(dt) {
    if (!dt) return '—';
    return new Date(dt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dt) {
    if (!dt) return '—';
    return new Date(dt).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
}

const STATUS_COLORS = {
    confirmed: 'bg-blue-600',
    pending:   'bg-amber-500',
    conflict:  'bg-red-600',
};

export default function CalendarOverview({ stats, upcomingEvents = [], holidays = {}, userStatus = 'available' }) {
    const today = new Date();
    const [calYear, setCalYear]   = useState(today.getFullYear());
    const [calMonth, setCalMonth] = useState(today.getMonth());
    const [status, setStatus]     = useState(userStatus);

    const cells = useMemo(() => getMonthCells(calYear, calMonth), [calYear, calMonth]);

    const holidayDates = useMemo(() => {
        const s = new Set();
        Object.keys(holidays).forEach(d => s.add(d.slice(0, 10)));
        return s;
    }, [holidays]);

    // build event date set from upcoming
    const eventDates = useMemo(() => {
        const m = {};
        upcomingEvents.forEach(e => {
            const d = new Date(e.starts_at);
            if (d.getFullYear() === calYear && d.getMonth() === calMonth) {
                const day = d.getDate();
                if (!m[day]) m[day] = [];
                m[day].push(e.status);
            }
        });
        return m;
    }, [upcomingEvents, calYear, calMonth]);

    function prevMonth() {
        if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
        else setCalMonth(m => m - 1);
    }
    function nextMonth() {
        if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
        else setCalMonth(m => m + 1);
    }

    const currentStatus = STATUS_OPTIONS.find(s => s.value === status) ?? STATUS_OPTIONS[0];

    function changeStatus(val) {
        setStatus(val);
        router.patch(route('calendar.status.update'), { status: val }, { preserveState: true, preserveScroll: true });
    }

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="Smart Calendar"
                    title="Обзор"
                    description="Встречи на неделе, ожидающие ответа приглашения, конфликты и ваш статус приёма."
                    meta={(
                        <StatusBadge tone={currentStatus.tone}>
                            <span className={`mr-1.5 h-2 w-2 rounded-full ${currentStatus.color}`} />
                            {currentStatus.label}
                        </StatusBadge>
                    )}
                />
            )}
        >
            <Head title="Smart Calendar — Обзор" />

            <div className="admin-page-wrap space-y-6">

                {/* KPI tiles */}
                <StatGrid>
                    <StatTile label="Встреч на неделе" value={stats.week_count} tone="teal" icon={CalendarDays} />
                    <StatTile label="Сегодня встреч" value={stats.today_count} tone="info" icon={Clock} />
                    <StatTile label="Ожидают ответа" value={stats.pending_count} tone="warning" icon={MessageSquare} />
                    <StatTile
                        label="Конфликты"
                        value={stats.conflict_count}
                        tone={stats.conflict_count > 0 ? 'danger' : 'neutral'}
                        icon={AlertTriangle}
                        hint={stats.conflict_count > 0 ? 'Есть пересечения встреч — проверьте календарь' : null}
                    />
                </StatGrid>

                <div className="grid gap-6 lg:grid-cols-3">
                    {/* Mini-calendar */}
                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <CardTitle className="flex items-center gap-2">
                                    <CalendarDays className="shrink-0" />
                                    {MONTH_NAMES[calMonth]} {calYear}
                                </CardTitle>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="icon" onClick={prevMonth} aria-label="Предыдущий месяц"><ChevronLeft className="size-4"/></Button>
                                    <Button variant="outline" size="sm" onClick={() => { setCalYear(today.getFullYear()); setCalMonth(today.getMonth()); }}>
                                        Сегодня
                                    </Button>
                                    <Button variant="outline" size="icon" onClick={nextMonth} aria-label="Следующий месяц"><ChevronRight className="size-4"/></Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0 sm:p-0">
                            <div className="grid grid-cols-7 border-b border-slate-200">
                                {WEEKDAYS.map((wd, i) => (
                                    <div key={wd} className={`py-2 text-center text-[0.6875rem] font-bold uppercase tracking-[0.1em] ${i >= 5 ? 'text-red-600/70' : 'text-slate-500'}`}>{wd}</div>
                                ))}
                            </div>
                            <div className="grid grid-cols-7">
                                {cells.map((day, idx) => {
                                    const isWeekend = idx % 7 >= 5;
                                    const isToday = day && today.getFullYear() === calYear && today.getMonth() === calMonth && today.getDate() === day;
                                    const dateStr = day ? `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}` : '';
                                    const isHoliday = holidayDates.has(dateStr);
                                    const dayEvents = day ? (eventDates[day] ?? []) : [];

                                    return (
                                        <div key={idx} className={`min-h-[64px] border-b border-r border-slate-200 p-1.5 last:border-r-0 [&:nth-child(7n)]:border-r-0 ${day ? 'cursor-pointer hover:bg-teal-50/60' : 'bg-slate-50'}`}>
                                            {day && (
                                                <>
                                                    <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold tabular-nums ${isToday ? 'bg-teal-700 text-white' : isHoliday || isWeekend ? 'text-red-600/80' : 'text-slate-800'}`}>
                                                        {day}
                                                    </span>
                                                    <div className="mt-1 flex flex-wrap gap-0.5 px-1">
                                                        {dayEvents.slice(0,3).map((s, i) => (
                                                            <span key={i} className={`h-1.5 w-1.5 rounded-full ${s === 'confirmed' ? 'bg-blue-600' : s === 'pending' ? 'bg-amber-500' : s === 'conflict' ? 'bg-red-600' : 'bg-emerald-600'}`}/>
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            {/* Legend */}
                            <div className="flex flex-wrap gap-4 px-5 py-3 text-xs text-slate-600">
                                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-600"/>Доступен</span>
                                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-600"/>Встреча</span>
                                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500"/>Ожидает</span>
                                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-600"/>Конфликт</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Right column */}
                    <div className="space-y-6">
                        {/* Status switcher */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <CheckCircle2 className="shrink-0" />
                                    Мой статус
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-1.5">
                                {STATUS_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => changeStatus(opt.value)}
                                        className={`flex w-full items-center gap-2.5 rounded-[10px] border px-3 py-2.5 text-sm transition-colors ${status === opt.value ? 'border-teal-300 bg-teal-50 font-semibold text-[#102945]' : 'border-transparent text-slate-700 hover:bg-slate-50'}`}
                                    >
                                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${opt.color}`}/>
                                        {opt.label}
                                        {status === opt.value && <CheckCircle2 className="ml-auto size-4 text-teal-700"/>}
                                    </button>
                                ))}
                            </CardContent>
                        </Card>

                        {/* Upcoming meetings */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Clock className="shrink-0" />
                                    Ближайшие встречи
                                </CardTitle>
                            </CardHeader>
                            <CardContent className={upcomingEvents.length === 0 ? '' : 'py-2 sm:py-2'}>
                                {upcomingEvents.length === 0 ? (
                                    <p className="py-4 text-center text-sm text-slate-500">Нет предстоящих встреч</p>
                                ) : (
                                    <div className="divide-y divide-slate-200">
                                        {upcomingEvents.map(e => (
                                            <div key={e.id} className="flex gap-3 py-3">
                                                <span className={`mt-1 w-1 shrink-0 self-stretch rounded-full ${STATUS_COLORS[e.status] ?? 'bg-slate-300'}`} />
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-sm font-semibold text-slate-900">{e.title}</p>
                                                    {e.with && <p className="mt-0.5 truncate text-xs text-slate-600">{e.with}</p>}
                                                    <div className="mt-1 flex items-center justify-between gap-2">
                                                        <span className="text-xs tabular-nums text-slate-500">{formatDate(e.starts_at)} {formatTime(e.starts_at)}</span>
                                                        {e.format === 'online' && e.zoom_join_url && (
                                                            <a href={e.zoom_join_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-[#102945]">
                                                                <Video className="size-3.5"/>
                                                                Zoom
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
