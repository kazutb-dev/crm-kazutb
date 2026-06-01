import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { CalendarClock, Plus, ShieldCheck, Trash2, UserCheck, UserX } from 'lucide-react';
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

    const summaryItems = [
        { label: 'Активные интервалы', value: slots.length, icon: CalendarClock },
        { label: 'Секретари', value: secretaryAccesses.length, icon: ShieldCheck },
        ...(isAdmin ? [{ label: 'Доступ выдан', value: grantedUsers.length, icon: UserCheck }] : []),
        ...(isAdmin ? [{ label: 'Исключены', value: excludedUsers.length, icon: UserX }] : []),
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
        <AuthenticatedLayout>
            <Head title="Smart Calendar — Настройки" />
            <div className="admin-page-wrap">

                {!!flash?.error && <div className="rounded-md border border-red-300 bg-red-50 text-red-800 px-3 py-2 text-sm">{flash.error}</div>}
                {!!flash?.warning && <div className="rounded-md border border-amber-300 bg-amber-50 text-amber-800 px-3 py-2 text-sm">{flash.warning}</div>}
                {!!flash?.success && <div className="rounded-md border border-emerald-300 bg-emerald-50 text-emerald-800 px-3 py-2 text-sm">{flash.success}</div>}

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(24rem,34rem)] xl:items-stretch">
                    <div className="rounded-lg border border-border/70 bg-background p-4 sm:p-5">
                        <p className="text-sm font-semibold">Настройки Smart Calendar</p>
                        <p className="mt-1 max-w-3xl text-xs text-muted-foreground">Управляйте занятостью, совместным доступом и административными ограничениями календаря в одной рабочей зоне.</p>
                        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                            {summaryItems.map(item => (
                                <div key={item.label} className="rounded-md border border-border/70 bg-muted/20 px-3 py-2.5">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-[11px] text-muted-foreground">{item.label}</span>
                                        <item.icon className="size-3.5 text-muted-foreground" />
                                    </div>
                                    <p className="mt-1 text-xl font-semibold leading-none">{item.value}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="rounded-lg border border-border/70 bg-muted/20 p-4 sm:p-5">
                        <p className="text-sm font-semibold">Текущий режим</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <Badge variant="outline">Рабочее время: 08:30–17:30</Badge>
                            <Badge variant="outline">Часовой пояс: Asia/Almaty</Badge>
                            {isAdmin && <Badge variant="outline">Администрирование каталога</Badge>}
                        </div>
                        <p className="mt-3 text-xs text-muted-foreground">Изменения в слотах сразу участвуют в проверке конфликтов и отображаются в календарях сотрудников.</p>
                    </div>
                </div>

                <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.35fr)_minmax(28rem,0.75fr)]">
                    <Card className="border-border/70">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Постоянная занятость</CardTitle>
                            <p className="text-xs text-muted-foreground">Регулярные интервалы занятости, которые отображаются в календаре и влияют на доступность.</p>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={submitSlot} className="space-y-4">
                                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                    <div className="space-y-1">
                                        <Label>Начало</Label>
                                        <Input
                                            type="time"
                                            value={slotForm.data.starts_at}
                                            onChange={e => slotForm.setData('starts_at', e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Конец</Label>
                                        <Input
                                            type="time"
                                            value={slotForm.data.ends_at}
                                            onChange={e => slotForm.setData('ends_at', e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1">
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
                                    <div className="space-y-1">
                                        <Label>Название</Label>
                                        <Input
                                            value={slotForm.data.note}
                                            onChange={e => slotForm.setData('note', e.target.value)}
                                            placeholder="Обед"
                                        />
                                    </div>
                                </div>

                                {slotForm.data.recurrence_type === 'once' && (
                                    <div className="space-y-1 max-w-xs">
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
                                    <div className="space-y-1">
                                        <Label>Дни недели</Label>
                                        <div className="flex flex-wrap gap-2">
                                            {WEEKDAY_OPTIONS.map(day => {
                                                const active = (slotForm.data.recurrence_days ?? []).includes(day.value);
                                                return (
                                                    <button
                                                        key={day.value}
                                                        type="button"
                                                        onClick={() => toggleWeekday(day.value)}
                                                        className={`rounded-md border px-3 py-1 text-xs ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background'}`}
                                                    >
                                                        {day.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                    <div className="space-y-1">
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
                                    <div className="space-y-1">
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
                                    <div className="space-y-1">
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
                                        <div className="space-y-1">
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
                                </div>

                                <div className="flex justify-end border-t border-border/60 pt-3">
                                    <Button type="submit" disabled={slotForm.processing}>Добавить занятость</Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    <Card className="border-border/70">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Мои постоянные занятые интервалы</CardTitle>
                            <p className="text-xs text-muted-foreground">Активные интервалы, которые уже учитываются в календарной доступности.</p>
                        </CardHeader>
                        <CardContent className="p-0">
                            {slots.length === 0 ? (
                                <p className="text-sm text-muted-foreground px-4 py-4">Постоянная занятость не настроена</p>
                            ) : (
                                <div className="divide-y">
                                    {slots.map(slot => (
                                        <div key={slot.id} className="flex items-center gap-3 px-4 py-2.5">
                                            <div className="flex-1">
                                                <p className="text-sm font-medium">{slot.note || 'Занято'}: {slot.starts_at} - {slot.ends_at}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {recurrenceLabel[slot.recurrence_type] ?? slot.recurrence_type}
                                                    {slot.recurrence_type === 'once' && slot.date ? ` (${slot.date})` : ''}
                                                    {` • длительность ${slot.slot_duration_minutes ?? 30} мин • буфер ${slot.buffer_minutes ?? 0} мин`}
                                                    {slot.access_type && slot.access_type !== 'open' ? ` • ${slot.access_type === 'rank' ? `ранг ${slot.min_rank_level ?? 1}+` : 'по приглашению'}` : ''}
                                                </p>
                                            </div>
                                            <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" onClick={() => removeSlot(slot.id)}>
                                                <Trash2 className="size-3.5" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                    <Card className="border-border/70">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Совместное управление календарем</CardTitle>
                            <p className="text-xs text-muted-foreground">Назначьте сотрудника, который сможет управлять вашим календарём и слотами доступности.</p>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={submitSecretary} className="grid gap-3 sm:grid-cols-[1fr_auto]">
                                <div className="space-y-1">
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

                    <Card className="border-border/70">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Текущие секретари</CardTitle>
                            <p className="text-xs text-muted-foreground">Список сотрудников с активным доступом к вашему календарю.</p>
                        </CardHeader>
                        <CardContent className="p-0">
                            {secretaryAccesses.length === 0 ? (
                                <p className="text-sm text-muted-foreground px-4 py-4">Секретари пока не назначены</p>
                            ) : (
                                <div className="divide-y">
                                    {secretaryAccesses.map(access => (
                                        <div key={access.id} className="flex items-center gap-3 px-4 py-2.5">
                                            <div className="flex-1">
                                                <p className="text-sm font-medium">{access.secretary_name}</p>
                                                <p className="text-xs text-muted-foreground">{contactLine(access) || 'Без должности'}</p>
                                            </div>
                                            <Badge className="text-[10px]" variant="outline">Активен</Badge>
                                            <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" onClick={() => revokeSecretary(access.id)}>
                                                <Trash2 className="size-3.5" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Admin: manage who appears in employee catalog */}
                {isAdmin && (
                    <div className="grid gap-4 xl:grid-cols-2">
                        {/* Grant access to any user */}
                        <Card className="border-border/70">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <UserCheck className="size-4 text-muted-foreground" />
                                    Дать доступ к каталогу
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-xs text-muted-foreground mb-3">
                                    Выберите любого сотрудника, чтобы он появился в «Сотрудниках» и аналитике, даже если его должность не подходит.
                                </p>
                                <form onSubmit={submitGrant} className="flex gap-2 flex-wrap">
                                    <div className="flex-1 min-w-48">
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
                                    <Button type="submit" disabled={!grantUserId} size="sm">
                                        <UserCheck className="size-3.5 mr-1" />Дать доступ
                                    </Button>
                                </form>

                                {grantedUsers.length > 0 && (
                                    <div className="mt-4 divide-y border rounded-md">
                                        {grantedUsers.map(emp => (
                                            <div key={emp.id} className="flex items-center gap-3 px-3 py-2">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate">{emp.name}</p>
                                                    <p className="text-xs text-muted-foreground truncate">{contactLine(emp) || 'Без контактов'}</p>
                                                </div>
                                                <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-400 shrink-0">Доступ выдан</Badge>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-destructive hover:text-destructive text-xs h-7 px-2 shrink-0"
                                                    onClick={() => revokeGrant(emp.grantId)}
                                                >
                                                    <UserX className="size-3.5 mr-1" />Отозвать
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="border-border/70">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <UserX className="size-4 text-muted-foreground" />
                                    Исключить из каталога
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-xs text-muted-foreground mb-3">
                                    Сотрудники ниже отображаются в каталоге по должности. Вы можете исключить любого.
                                </p>
                                {calendarEmployees.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">Нет сотрудников для отображения</p>
                                ) : (
                                    <div className="divide-y border rounded-md">
                                        {calendarEmployees.map(emp => (
                                            <div key={emp.id} className="flex items-center gap-3 px-3 py-2">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate">{emp.name}</p>
                                                    <p className="text-xs text-muted-foreground truncate">{contactLine(emp) || 'Без контактов'}</p>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-destructive hover:text-destructive text-xs h-7 px-2 shrink-0"
                                                    onClick={() => router.post(route('calendar.employee-exclusions.store'), { user_id: emp.id }, { preserveScroll: true })}
                                                >
                                                    <UserX className="size-3.5 mr-1" />Исключить
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {excludedUsers.length > 0 && (
                            <Card className="border-border/70 xl:col-span-2">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">Исключённые сотрудники</CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="divide-y">
                                        {excludedUsers.map(emp => (
                                            <div key={emp.id} className="flex items-center gap-3 px-4 py-2.5">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate">{emp.name}</p>
                                                    <p className="text-xs text-muted-foreground truncate">{contactLine(emp) || 'Без контактов'}</p>
                                                </div>
                                                <Badge variant="outline" className="text-[10px] text-destructive border-destructive shrink-0">Исключён</Badge>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-xs h-7 px-2 shrink-0"
                                                    onClick={() => router.delete(route('calendar.employee-exclusions.destroy', emp.exclusionId ?? emp.id), { preserveScroll: true })}
                                                >
                                                    <Plus className="size-3.5 mr-1" />Вернуть
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
