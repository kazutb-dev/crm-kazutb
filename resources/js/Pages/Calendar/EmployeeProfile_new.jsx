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

const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTH_NAMES = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

const STATUS_LABELS = { available: 'Доступен', busy: 'Занят', soon: 'Скоро', dnd: 'Не беспокоить' };
const STATUS_COLORS = { available: 'bg-green-500', busy: 'bg-red-500', soon: 'bg-yellow-400', dnd: 'bg-gray-400' };

const TYPE_META = {
    meeting:       { label: 'Встреча',          bg: 'bg-blue-500/15 border-blue-500',      text: 'text-blue-700 dark:text-blue-300' },
    vacation:      { label: 'Отпуск',           bg: 'bg-green-500/15 border-green-500',    text: 'text-green-700 dark:text-green-300' },
    business_trip: { label: 'Командировка',     bg: 'bg-violet-500/15 border-violet-500',  text: 'text-violet-700 dark:text-violet-300' },
    sick_leave:    { label: 'Больничный',        bg: 'bg-orange-500/15 border-orange-400',  text: 'text-orange-700 dark:text-orange-300' },
    personal:      { label: 'Личное',           bg: 'bg-pink-500/15 border-pink-400',      text: 'text-pink-700 dark:text-pink-300' },
    remote:        { label: 'Удалённая работа', bg: 'bg-teal-500/15 border-teal-500',      text: 'text-teal-700 dark:text-teal-300' },
    other:         { label: 'Другое',           bg: 'bg-gray-200 border-gray-400',         text: 'text-gray-700 dark:text-gray-300' },
};

const EVENT_STYLE = {
    conflict: { bg: 'bg-red-500/15 border-red-500', text: 'text-red-700 dark:text-red-300', label: 'Конфликт' },
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

function fmtTime(dt) {
    if (!dt) return '';
    return new Date(dt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function EventChip({ event }) {
    const s = event.status === 'conflict' ? EVENT_STYLE.conflict : (TYPE_META[event.type] ?? TYPE_META.other);
    return (
        <div className={`rounded border-l-[3px] px-1.5 py-0.5 text-[10px] leading-tight ${s.bg}`}>
            <p className={`font-medium truncate ${s.text}`}>{event.title}</p>
        </div>
    );
}

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
        <Card className="border-border/80 shadow-sm">
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
                        const isWeekend  = idx % 7 >= 5;
                        const isToday    = day && today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
                        const isPastDay  = day && new Date(year, month, day).setHours(0, 0, 0, 0) < new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
                        const isSelected = day === selectedDay;
                        const dayEvts    = day ? (byDay[day] ?? []) : [];

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
                                        <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full shrink-0 ${isToday ? 'bg-primary text-primary-foreground' : isPastDay ? 'text-muted-foreground' : isWeekend ? 'text-destructive/70' : ''}`}>
                                            {day}
                                        </span>
                                        {dayEvts.slice(0, 2).map((e, i) => <EventChip key={i} event={e} />)}
                                        {dayEvts.length > 2 && <span className="text-[10px] text-muted-foreground">+{dayEvts.length - 2}</span>}
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
    const { data, setData, post, processing, errors, reset } = useForm({
        type:        'meeting',
        title:       '',
        attendee_id: employee?.id ?? '',
        starts_at:   '',
        ends_at:     '',
        description: '',
    });

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
        <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Предложить встречу</DialogTitle>
                </DialogHeader>
                <form onSubmit={submit} className="space-y-3">
                    <div className="space-y-1">
                        <Label>Участник</Label>
                        <div className="flex items-center gap-2 rounded border px-3 py-2 bg-muted/40 text-sm">
                            {employee?.name}
                        </div>
                    </div>

                    <div className="space-y-1">
                        <Label htmlFor="m-title">Тема <span className="text-destructive">*</span></Label>
                        <Input
                            id="m-title"
                            value={data.title}
                            onChange={e => setData('title', e.target.value)}
                            placeholder="Обсуждение..."
                            required
                        />
                        {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                            <Label htmlFor="m-start">Начало <span className="text-destructive">*</span></Label>
                            <Input
                                id="m-start"
                                type="datetime-local"
                                value={data.starts_at}
                                onChange={e => setData('starts_at', e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="m-end">Конец <span className="text-destructive">*</span></Label>
                            <Input
                                id="m-end"
                                type="datetime-local"
                                value={data.ends_at}
                                onChange={e => setData('ends_at', e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    {busyConflict && (
                        <div className="rounded border border-amber-300 bg-amber-50 text-amber-800 px-3 py-2 text-sm">
                            ⚠️ {employee?.name} {BLOCKING_TYPE_LABELS[busyConflict.type] ?? 'занят'} в это время
                        </div>
                    )}

                    <div className="space-y-1">
                        <Label htmlFor="m-desc">Описание</Label>
                        <Textarea
                            id="m-desc"
                            value={data.description}
                            onChange={e => setData('description', e.target.value)}
                            placeholder="Повестка..."
                            rows={2}
                        />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose} disabled={processing}>Отмена</Button>
                        <Button type="submit" disabled={processing || !!busyConflict}>Отправить</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export default function CalendarEmployeeProfile({ employee, events = [], year, month }) {
    const { flash = {} } = usePage().props;
    const monthIdx = (month ?? 1) - 1;
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === monthIdx;

    const [selectedDay, setSelectedDay] = useState(isCurrentMonth ? today.getDate() : 1);
    const [meetingOpen, setMeetingOpen] = useState(false);

    const prev = new Date(year, monthIdx - 1, 1);
    const next = new Date(year, monthIdx + 1, 1);
    const monthLabel = `${MONTH_NAMES[monthIdx]} ${year}`;

    return (
        <AuthenticatedLayout
            header={
                <div>
                    <h2 className="text-2xl font-semibold leading-tight text-gray-900">
                        Календарь — {employee?.name}
                    </h2>
                </div>
            }
        >
            <Head title={`Календарь — ${employee?.name ?? 'Сотрудник'}`} />
            <div className="py-8">
                <div className="mx-auto sm:px-6 lg:px-8">
                    {!!flash?.warning && <div className="rounded border border-amber-300 bg-amber-50 text-amber-800 px-3 py-2 text-sm mb-4">{flash.warning}</div>}
                    {!!flash?.success && <div className="rounded border border-emerald-300 bg-emerald-50 text-emerald-800 px-3 py-2 text-sm mb-4">{flash.success}</div>}

                    <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                        <Button variant="outline" size="sm" asChild>
                            <Link href={route('calendar.employees')}>
                                <ArrowLeft className="size-4 mr-1" />Назад
                            </Link>
                        </Button>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="icon" asChild>
                                <Link href={route('calendar.employees.profile', { employee: employee.id, year: prev.getFullYear(), month: prev.getMonth() + 1 })}>
                                    <ChevronLeft className="size-4" />
                                </Link>
                            </Button>
                            <span className="text-sm font-semibold min-w-[150px] text-center">{monthLabel}</span>
                            <Button variant="outline" size="icon" asChild>
                                <Link href={route('calendar.employees.profile', { employee: employee.id, year: next.getFullYear(), month: next.getMonth() + 1 })}>
                                    <ChevronRight className="size-4" />
                                </Link>
                            </Button>
                        </div>
                        <Button size="sm" onClick={() => setMeetingOpen(true)}>
                            <CalendarPlus className="size-4 mr-1" />Встреча
                        </Button>
                    </div>

                    <MonthCalendar
                        year={year}
                        month={monthIdx}
                        events={events}
                        selectedDay={selectedDay}
                        onDayClick={setSelectedDay}
                    />

                    <MeetingModal
                        open={meetingOpen}
                        onClose={() => setMeetingOpen(false)}
                        employee={employee}
                        defaultDay={null}
                        events={events}
                    />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
