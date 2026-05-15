import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/components/ui/badge';
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
    { value: 'available',  label: 'Доступен для приёма', color: 'bg-green-500' },
    { value: 'busy',       label: 'Занят',                color: 'bg-red-500'   },
    { value: 'soon',       label: 'Скоро освобожусь',     color: 'bg-yellow-500'},
    { value: 'dnd',        label: 'Не беспокоить',        color: 'bg-gray-500'  },
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
    confirmed: 'bg-blue-500/15 border-l-[3px] border-blue-500',
    pending:   'bg-yellow-500/15 border-l-[3px] border-yellow-500',
    conflict:  'bg-red-500/15 border-l-[3px] border-red-500',
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
        <AuthenticatedLayout>
            <Head title="Smart Calendar — Обзор" />

            <div className="p-4 sm:p-6 space-y-5">

                {/* KPI cards */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground">Встреч на неделе</p>
                            <p className="text-2xl font-bold mt-1">{stats.week_count}</p>
                            <CalendarDays className="size-4 text-muted-foreground mt-1" />
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground">Сегодня встреч</p>
                            <p className="text-2xl font-bold mt-1">{stats.today_count}</p>
                            <Clock className="size-4 text-muted-foreground mt-1" />
                        </CardContent>
                    </Card>
                    <Card className="border-yellow-200 bg-yellow-50/40 dark:border-yellow-800 dark:bg-yellow-900/10">
                        <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground">Ожидают ответа</p>
                            <p className="text-2xl font-bold mt-1 text-yellow-600">{stats.pending_count}</p>
                            <MessageSquare className="size-4 text-yellow-500 mt-1" />
                        </CardContent>
                    </Card>
                    <Card className={stats.conflict_count > 0 ? 'border-red-200 bg-red-50/40 dark:border-red-800 dark:bg-red-900/10' : ''}>
                        <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground">Конфликты</p>
                            <p className={`text-2xl font-bold mt-1 ${stats.conflict_count > 0 ? 'text-red-600' : ''}`}>{stats.conflict_count}</p>
                            <AlertTriangle className={`size-4 mt-1 ${stats.conflict_count > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                    {/* Mini-calendar */}
                    <Card className="lg:col-span-2">
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="icon" onClick={prevMonth}><ChevronLeft className="size-4"/></Button>
                                    <span className="text-sm font-semibold w-36 text-center">{MONTH_NAMES[calMonth]} {calYear}</span>
                                    <Button variant="outline" size="icon" onClick={nextMonth}><ChevronRight className="size-4"/></Button>
                                </div>
                                <Button variant="outline" size="sm" onClick={() => { setCalYear(today.getFullYear()); setCalMonth(today.getMonth()); }}>
                                    Сегодня
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="grid grid-cols-7 border-b">
                                {WEEKDAYS.map((wd, i) => (
                                    <div key={wd} className={`py-1.5 text-center text-xs font-medium text-muted-foreground ${i >= 5 ? 'text-destructive/60' : ''}`}>{wd}</div>
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
                                        <div key={idx} className={`min-h-[60px] border-b border-r p-1 last:border-r-0 ${day ? 'cursor-pointer hover:bg-muted/40' : 'bg-muted/10'}`}>
                                            {day && (
                                                <>
                                                    <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-primary text-primary-foreground' : isHoliday || isWeekend ? 'text-destructive/70' : ''}`}>
                                                        {day}
                                                    </span>
                                                    <div className="flex gap-0.5 flex-wrap mt-0.5">
                                                        {dayEvents.slice(0,3).map((s, i) => (
                                                            <span key={i} className={`w-1.5 h-1.5 rounded-full ${s === 'confirmed' ? 'bg-blue-500' : s === 'pending' ? 'bg-yellow-500' : s === 'conflict' ? 'bg-red-500' : 'bg-green-500'}`}/>
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            {/* Legend */}
                            <div className="flex flex-wrap gap-3 p-3 border-t text-xs text-muted-foreground">
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"/>Доступен</span>
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"/>Встреча</span>
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500"/>Ожидает</span>
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"/>Конфликт</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Right column */}
                    <div className="space-y-4">
                        {/* Status switcher */}
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm">Мой статус</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-1.5">
                                {STATUS_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => changeStatus(opt.value)}
                                        className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${status === opt.value ? 'bg-muted font-medium' : 'hover:bg-muted/50'}`}
                                    >
                                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${opt.color}`}/>
                                        {opt.label}
                                        {status === opt.value && <CheckCircle2 className="size-3.5 ml-auto text-muted-foreground"/>}
                                    </button>
                                ))}
                            </CardContent>
                        </Card>

                        {/* Upcoming meetings */}
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm">Ближайшие встречи</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {upcomingEvents.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">Нет предстоящих встреч</p>
                                ) : (
                                    upcomingEvents.map(e => (
                                        <div key={e.id} className={`rounded-lg p-2.5 text-xs ${STATUS_COLORS[e.status] ?? 'bg-muted/40 border-l-[3px] border-muted'}`}>
                                            <p className="font-medium truncate">{e.title}</p>
                                            <p className="text-muted-foreground mt-0.5">{e.with}</p>
                                            <div className="flex items-center justify-between mt-1">
                                                <span className="text-muted-foreground">{formatDate(e.starts_at)} {formatTime(e.starts_at)}</span>
                                                {e.format === 'online' && e.zoom_join_url && (
                                                    <a href={e.zoom_join_url} target="_blank" rel="noopener noreferrer">
                                                        <Video className="size-3.5 text-blue-500"/>
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
