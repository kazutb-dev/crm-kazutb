import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { Trash2 } from 'lucide-react';

const WEEKDAY_OPTIONS = [
    { value: 1, label: 'Пн' },
    { value: 2, label: 'Вт' },
    { value: 3, label: 'Ср' },
    { value: 4, label: 'Чт' },
    { value: 5, label: 'Пт' },
    { value: 6, label: 'Сб' },
    { value: 7, label: 'Вс' },
];

export default function CalendarSettings({ employees = [], secretaryAccesses = [], slots = [] }) {
    const { flash = {} } = usePage().props;

    const slotForm = useForm({
        starts_at: '13:00',
        ends_at: '14:00',
        recurrence_type: 'daily',
        date: '',
        recurrence_days: [1, 2, 3, 4, 5],
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

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-2xl font-semibold leading-tight text-gray-900">
                    Настройки календаря
                </h2>
            }
        >
            <Head title="Smart Calendar — Настройки" />
            <div className="py-8">
                <div className="mx-auto sm:px-6 lg:px-8">
                    {!!flash?.error && <div className="rounded-md border border-red-300 bg-red-50 text-red-800 px-3 py-2 text-sm mb-4">{flash.error}</div>}
                    {!!flash?.warning && <div className="rounded-md border border-amber-300 bg-amber-50 text-amber-800 px-3 py-2 text-sm mb-4">{flash.warning}</div>}
                    {!!flash?.success && <div className="rounded-md border border-emerald-300 bg-emerald-50 text-emerald-800 px-3 py-2 text-sm mb-4">{flash.success}</div>}

                    <Card className="border-border/80 shadow-sm mb-5">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Добавить постоянную занятость</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={submitSlot} className="space-y-3">
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

                                <Button type="submit" disabled={slotForm.processing}>Добавить занятость</Button>
                            </form>
                        </CardContent>
                    </Card>

                    <Card className="border-border/80 shadow-sm mb-5">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Текущие интервалы занятости</CardTitle>
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
                                                </p>
                                            </div>
                                            <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" onClick={() => removeSlot(slot.id)}>
                                                <Trash2 className="size-3.5"/>
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-border/80 shadow-sm mb-5">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Назначить секретаря</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={submitSecretary} className="grid gap-3 sm:grid-cols-[1fr_auto]">
                                <div className="space-y-1">
                                    <Label>Сотрудник</Label>
                                    <NativeSelect
                                        value={String(secretaryForm.data.secretary_id ?? '')}
                                        onValueChange={value => secretaryForm.setData('secretary_id', value)}
                                        options={[
                                            { value: '', label: 'Выберите сотрудника' },
                                            ...employees.map(emp => ({
                                                value: String(emp.id),
                                                label: emp.title ? `${emp.name} (${emp.title})` : emp.name,
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

                    <Card className="border-border/80 shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Текущие секретари</CardTitle>
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
                                                <p className="text-xs text-muted-foreground">{access.secretary_title || access.secretary_email || 'Без должности'}</p>
                                            </div>
                                            <Badge className="text-[10px]" variant="outline">Активен</Badge>
                                            <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" onClick={() => revokeSecretary(access.id)}>
                                                <Trash2 className="size-3.5"/>
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
