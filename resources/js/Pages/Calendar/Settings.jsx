import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Notice, PageHeader, StatGrid, StatTile, StatusBadge } from '@/components/platform';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { CalendarClock, Plus, ShieldCheck, Trash2, UserCheck, UserX, Users } from 'lucide-react';
import React from 'react';

const WEEKDAY_OPTIONS = [
    { value: 1, label: 'Пн' },
    { value: 2, label: 'Вт' },
    { value: 3, label: 'Ср' },
    { value: 4, label: 'Чт' },
    { value: 5, label: 'Пт' },
    { value: 6, label: 'Сб' },
    { value: 7, label: 'Вс' },
];

export default function CalendarSettings({
    employees = [],
    secretaryAccesses = [],
    slots = [],
    isAdmin = false,
    calendarEmployees = [],
    grantedUsers = [],
    excludedUsers = [],
    availableForGrant = [],
}) {
    const { flash = {} } = usePage().props;

    const contactLine = (person) => {
        const parts = [];

        if (person?.title) {
            parts.push(person.title);
        }

        if (person?.phone) {
            parts.push(`WhatsApp: ${person.phone}`);
        } else if (person?.secretary_phone) {
            parts.push(`WhatsApp: ${person.secretary_phone}`);
        }

        if (person?.email) {
            parts.push(person.email);
        } else if (person?.secretary_email) {
            parts.push(person.secretary_email);
        }

        return parts.join(' • ');
    };

    const slotForm = useForm({
        starts_at: '13:00',
        ends_at: '14:00',
        recurrence_type: 'daily',
        date: '',
        recurrence_days: [1, 2, 3, 4, 5],
        slot_duration_minutes: 30,
        buffer_minutes: 0,
        access_type: 'open',
        min_rank_level: '',
        note: 'Обед',
    });

    const secretaryForm = useForm({
        secretary_id: '',
    });

    function submitSlot(e) {
        e.preventDefault();
        slotForm.post(route('calendar.slots.store'), {
            preserveScroll: true,
            onSuccess: () => {
                slotForm.setData('date', '');
            },
        });
    }

    function removeSlot(id) {
        router.delete(route('calendar.slots.destroy', id), { preserveScroll: true });
    }

    function submitSecretary(e) {
        e.preventDefault();
        secretaryForm.post(route('calendar.secretary-access.store'), {
            preserveScroll: true,
            onSuccess: () => secretaryForm.reset(),
        });
    }

    function revokeSecretary(id) {
        router.delete(route('calendar.secretary-access.destroy', id), { preserveScroll: true });
    }

    function toggleWeekday(dayValue) {
        const day = Number(dayValue);
        const current = new Set(slotForm.data.recurrence_days ?? []);
        if (current.has(day)) {
            current.delete(day);
        } else {
            current.add(day);
        }
        slotForm.setData('recurrence_days', Array.from(current).sort((a, b) => a - b));
    }

    const recurrenceLabel = {
        daily: 'Ежедневно',
        weekly: 'Еженедельно',
        once: 'Один раз',
    };

    const [grantUserId, setGrantUserId] = React.useState('');

    const slotCountBy = (type) => slots.filter(slot => slot.recurrence_type === type).length;
    const summaryItems = [
        { label: 'Активные интервалы', value: slots.length, icon: CalendarClock, tone: 'teal', hint: `ежедн. ${slotCountBy('daily')} · еженед. ${slotCountBy('weekly')} · разово ${slotCountBy('once')}` },
        { label: 'Секретари', value: secretaryAccesses.length, icon: ShieldCheck, tone: 'navy', hint: 'с доступом к календарю' },
        { label: 'Сотрудники', value: employees.length, icon: Users, tone: 'info', hint: 'можно назначить секретарём' },
        ...(isAdmin ? [{ label: 'В каталоге', value: calendarEmployees.length, icon: Users, tone: 'teal', hint: 'по должности' }] : []),
        ...(isAdmin ? [{ label: 'Доступ выдан', value: grantedUsers.length, icon: UserCheck, tone: 'success', hint: 'вручную' }] : []),
        ...(isAdmin ? [{ label: 'Исключены', value: excludedUsers.length, icon: UserX, tone: 'danger', hint: 'скрыты из каталога' }] : []),
    ];

    function submitGrant(e) {
        e.preventDefault();
        if (!grantUserId) return;
        router.post(route('calendar.employee-grants.store'), { user_id: Number(grantUserId) }, {
            preserveScroll: true,
            onSuccess: () => setGrantUserId(''),
        });
    }

    function revokeGrant(grantId) {
        router.delete(route('calendar.employee-grants.destroy', grantId), { preserveScroll: true });
    }

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="Smart Calendar"
                    title="Настройки календаря"
                    description="Управляйте занятостью, совместным доступом и административными ограничениями календаря в одной рабочей зоне."
                    meta={(
                        <>
                            <StatusBadge tone="default">Рабочее время: 08:30–17:30</StatusBadge>
                            <StatusBadge tone="default">Часовой пояс: Asia/Almaty</StatusBadge>
                            {isAdmin && <StatusBadge tone="info">Администрирование каталога</StatusBadge>}
                        </>
                    )}
                />
            )}
        >
            <Head title="Smart Calendar — Настройки" />
            <div className="admin-page-wrap space-y-6">

                {!!flash?.error && <Notice tone="danger">{flash.error}</Notice>}
                {!!flash?.warning && <Notice tone="warning">{flash.warning}</Notice>}
                {!!flash?.success && <Notice tone="success">{flash.success}</Notice>}

                <StatGrid>
                    {summaryItems.map(item => (
                        <StatTile key={item.label} label={item.label} value={item.value} hint={item.hint} icon={item.icon} tone={item.tone} />
                    ))}
                </StatGrid>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,30rem)] xl:items-start">
                    <div className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><CalendarClock className="shrink-0" />Постоянная занятость</CardTitle>
                            <CardDescription>Регулярные интервалы занятости: видны в календаре, сразу участвуют в проверке конфликтов и влияют на доступность.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={submitSlot} className="space-y-4">
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                    <div className="space-y-2">
                                        <Label>Начало</Label>
                                        <Input
                                            type="time"
                                            value={slotForm.data.starts_at}
                                            onChange={e => slotForm.setData('starts_at', e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Конец</Label>
                                        <Input
                                            type="time"
                                            value={slotForm.data.ends_at}
                                            onChange={e => slotForm.setData('ends_at', e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Повторение</Label>
                                        <NativeSelect
                                            value={slotForm.data.recurrence_type}
                                            onValueChange={value => slotForm.setData('recurrence_type', value)}
                                            options={[
                                                { value: 'daily', label: 'Ежедневно' },
                                                { value: 'weekly', label: 'Еженедельно' },
                                                { value: 'once', label: 'Один раз' },
                                            ]}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Название</Label>
                                        <Input
                                            value={slotForm.data.note}
                                            onChange={e => slotForm.setData('note', e.target.value)}
                                            placeholder="Обед"
                                        />
                                    </div>
                                </div>

                                {slotForm.data.recurrence_type === 'once' && (
                                    <div className="space-y-2 max-w-xs">
                                        <Label>Дата</Label>
                                        <Input
                                            type="date"
                                            value={slotForm.data.date}
                                            onChange={e => slotForm.setData('date', e.target.value)}
                                            required
                                        />
                                    </div>
                                )}

                                {slotForm.data.recurrence_type === 'weekly' && (
                                    <div className="space-y-2">
                                        <Label>Дни недели</Label>
                                        <div className="flex flex-wrap gap-2">
                                            {WEEKDAY_OPTIONS.map(day => {
                                                const active = (slotForm.data.recurrence_days ?? []).includes(day.value);
                                                return (
                                                    <button
                                                        key={day.value}
                                                        type="button"
                                                        onClick={() => toggleWeekday(day.value)}
                                                        className={`h-9 min-w-11 rounded-[10px] border px-3 text-sm font-semibold transition-colors ${active ? 'border-teal-700 bg-teal-700 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-teal-400'}`}
                                                    >
                                                        {day.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                    <div className="space-y-2">
                                        <Label>Длительность слота</Label>
                                        <Input
                                            type="number"
                                            min="15"
                                            max="240"
                                            step="15"
                                            value={slotForm.data.slot_duration_minutes}
                                            onChange={e => slotForm.setData('slot_duration_minutes', Number(e.target.value))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Буфер, минут</Label>
                                        <Input
                                            type="number"
                                            min="0"
                                            max="120"
                                            step="5"
                                            value={slotForm.data.buffer_minutes}
                                            onChange={e => slotForm.setData('buffer_minutes', Number(e.target.value))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Доступ</Label>
                                        <NativeSelect
                                            value={slotForm.data.access_type}
                                            onValueChange={value => slotForm.setData('access_type', value)}
                                            options={[
                                                { value: 'open', label: 'Открытый' },
                                                { value: 'invitation', label: 'По приглашению' },
                                                { value: 'rank', label: 'По рангу' },
                                            ]}
                                        />
                                    </div>
                                    {slotForm.data.access_type === 'rank' && (
                                        <div className="space-y-2">
                                            <Label>Мин. ранг</Label>
                                            <Input
                                                type="number"
                                                min="1"
                                                max="10"
                                                value={slotForm.data.min_rank_level}
                                                onChange={e => slotForm.setData('min_rank_level', e.target.value)}
                                            />
                                        </div>
                                    )}
                                    <div className="flex items-end lg:col-start-4">
                                        <Button type="submit" className="w-full" disabled={slotForm.processing}>Добавить занятость</Button>
                                    </div>
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><ShieldCheck className="shrink-0" />Совместное управление календарем</CardTitle>
                            <CardDescription>Назначьте сотрудника, который сможет управлять вашим календарём и слотами доступности.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={submitSecretary} className="grid gap-3 sm:grid-cols-[1fr_auto]">
                                <div className="space-y-2">
                                    <Label>Назначить секретаря</Label>
                                    <NativeSelect
                                        value={String(secretaryForm.data.secretary_id ?? '')}
                                        onValueChange={value => secretaryForm.setData('secretary_id', value)}
                                        options={[
                                            { value: '', label: 'Выберите сотрудника' },
                                            ...employees.map(emp => ({
                                                value: String(emp.id),
                                                label: contactLine(emp) ? `${emp.name} (${contactLine(emp)})` : emp.name,
                                            })),
                                        ]}
                                    />
                                </div>
                                <div className="flex items-end">
                                    <Button type="submit" disabled={secretaryForm.processing || !secretaryForm.data.secretary_id}>Назначить</Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                    </div>

                    <div className="space-y-4">
                    <Card>
                        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                            <CardTitle>Мои постоянные занятые интервалы</CardTitle>
                            <span className="text-xs font-semibold tabular-nums text-slate-500">{slots.length}</span>
                        </CardHeader>
                        <CardContent className="p-0 sm:p-0">
                            {slots.length === 0 ? (
                                <p className="px-6 py-6 text-center text-sm text-slate-500">Постоянная занятость не настроена</p>
                            ) : (
                                <div className="divide-y divide-slate-200">
                                    {slots.map(slot => (
                                        <div key={slot.id} className="flex items-center gap-3 px-5 py-3 sm:px-6">
                                            <div className="flex-1">
                                                <p className="text-sm font-medium text-slate-900">{slot.note || 'Занято'}: <span className="tabular-nums">{slot.starts_at} - {slot.ends_at}</span></p>
                                                <p className="text-xs text-slate-500">
                                                    {recurrenceLabel[slot.recurrence_type] ?? slot.recurrence_type}
                                                    {slot.recurrence_type === 'once' && slot.date ? ` (${slot.date})` : ''}
                                                    {` • длительность ${slot.slot_duration_minutes ?? 30} мин • буфер ${slot.buffer_minutes ?? 0} мин`}
                                                    {slot.access_type && slot.access_type !== 'open' ? ` • ${slot.access_type === 'rank' ? `ранг ${slot.min_rank_level ?? 1}+` : 'по приглашению'}` : ''}
                                                </p>
                                            </div>
                                            <Button variant="ghost" size="icon" className="text-red-600 hover:text-red-700" onClick={() => removeSlot(slot.id)} aria-label="Удалить интервал">
                                                <Trash2 className="size-3.5" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                            <CardTitle>Текущие секретари</CardTitle>
                            <span className="text-xs font-semibold tabular-nums text-slate-500">{secretaryAccesses.length}</span>
                        </CardHeader>
                        <CardContent className="p-0 sm:p-0">
                            {secretaryAccesses.length === 0 ? (
                                <p className="px-6 py-6 text-center text-sm text-slate-500">Секретари пока не назначены</p>
                            ) : (
                                <div className="divide-y divide-slate-200">
                                    {secretaryAccesses.map(access => (
                                        <div key={access.id} className="flex items-center gap-3 px-5 py-3 sm:px-6">
                                            <div className="flex-1">
                                                <p className="text-sm font-medium text-slate-900">{access.secretary_name}</p>
                                                <p className="text-xs text-slate-500">{contactLine(access) || 'Без должности'}</p>
                                            </div>
                                            <Badge variant="success">Активен</Badge>
                                            <Button variant="ghost" size="icon" className="text-red-600 hover:text-red-700" onClick={() => revokeSecretary(access.id)} aria-label="Отозвать доступ">
                                                <Trash2 className="size-3.5" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                    </div>
                </div>

                {/* Admin: manage who appears in employee catalog */}
                {isAdmin && (
                    <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
                        {/* Grant access to any user */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <UserCheck className="shrink-0" />
                                    Дать доступ к каталогу
                                </CardTitle>
                                <CardDescription>
                                    Выберите любого сотрудника, чтобы он появился в «Сотрудниках» и аналитике, даже если его должность не подходит.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={submitGrant} className="flex flex-wrap items-end gap-2">
                                    <div className="min-w-48 flex-1 space-y-2">
                                        <Label>Сотрудник</Label>
                                        <NativeSelect
                                            value={grantUserId}
                                            onValueChange={setGrantUserId}
                                            options={[
                                                { value: '', label: 'Выберите сотрудника' },
                                                ...availableForGrant.map(u => ({
                                                    value: String(u.id),
                                                    label: contactLine(u) ? `${u.name} (${contactLine(u)})` : u.name,
                                                })),
                                            ]}
                                        />
                                    </div>
                                    <Button type="submit" disabled={!grantUserId}>
                                        <UserCheck className="size-4" />Дать доступ
                                    </Button>
                                </form>

                                {grantedUsers.length > 0 && (
                                    <div className="mt-5 divide-y divide-slate-200 border-t border-slate-200">
                                        {grantedUsers.map(emp => (
                                            <div key={emp.id} className="flex items-center gap-3 py-2.5">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-slate-900 truncate">{emp.name}</p>
                                                    <p className="text-xs text-slate-500 truncate">{contactLine(emp) || 'Без контактов'}</p>
                                                </div>
                                                <Badge variant="success" className="shrink-0">Доступ выдан</Badge>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="shrink-0 text-red-600 hover:text-red-700"
                                                    onClick={() => revokeGrant(emp.grantId)}
                                                >
                                                    <UserX className="size-3.5" />Отозвать
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <UserX className="shrink-0" />
                                    Исключить из каталога
                                </CardTitle>
                                <CardDescription>
                                    Сотрудники ниже отображаются в каталоге по должности. Вы можете исключить любого.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="py-2 sm:py-2">
                                {calendarEmployees.length === 0 ? (
                                    <p className="py-6 text-center text-sm text-slate-500">Нет сотрудников для отображения</p>
                                ) : (
                                    <div className="divide-y divide-slate-200 border-t border-slate-200">
                                        {calendarEmployees.map(emp => (
                                            <div key={emp.id} className="flex items-center gap-3 py-2.5">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-slate-900 truncate">{emp.name}</p>
                                                    <p className="text-xs text-slate-500 truncate">{contactLine(emp) || 'Без контактов'}</p>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="shrink-0 text-red-600 hover:text-red-700"
                                                    onClick={() => router.post(route('calendar.employee-exclusions.store'), { user_id: emp.id }, { preserveScroll: true })}
                                                >
                                                    <UserX className="size-3.5" />Исключить
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {excludedUsers.length > 0 && (
                            <Card className="xl:col-span-2">
                                <CardHeader>
                                    <CardTitle>Исключённые сотрудники</CardTitle>
                                </CardHeader>
                                <CardContent className="p-0 sm:p-0">
                                    <div className="divide-y divide-slate-200">
                                        {excludedUsers.map(emp => (
                                            <div key={emp.id} className="flex items-center gap-3 px-5 py-3 sm:px-6">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-slate-900 truncate">{emp.name}</p>
                                                    <p className="text-xs text-slate-500 truncate">{contactLine(emp) || 'Без контактов'}</p>
                                                </div>
                                                <Badge variant="destructive" className="shrink-0">Исключён</Badge>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="shrink-0"
                                                    onClick={() => router.delete(route('calendar.employee-exclusions.destroy', emp.exclusionId ?? emp.id), { preserveScroll: true })}
                                                >
                                                    <Plus className="size-3.5" />Вернуть
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                )}

            </div>
        </AuthenticatedLayout>
    );
}
