import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { Clock, Share2, Trash2, Users } from 'lucide-react';

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
        <AuthenticatedLayout>
            <Head title="Smart Calendar — Настройки" />
            <div className="min-h-screen bg-gradient-to-br from-blue-50/50 via-white to-blue-50/30 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900">
            <div className="p-6 sm:p-8 max-w-4xl mx-auto space-y-6">

                {/* Header */}
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-2.5">
                            <Clock className="size-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-foreground">Настройки календаря</h1>
                            <p className="text-sm text-muted-foreground">Управление занятостью и делегированием доступа</p>
                        </div>
                    </div>
                </div>

                {/* Alerts */}
                {!!flash?.error && <div className="rounded-lg border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm font-medium">{flash.error}</div>}
                {!!flash?.warning && <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-800 px-4 py-3 text-sm font-medium">{flash.warning}</div>}
                {!!flash?.success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 px-4 py-3 text-sm font-medium">{flash.success}</div>}

                {/* Permanent Availability Section */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <Clock className="size-5 text-blue-500" />
                        <h2 className="text-lg font-semibold text-foreground">Постоянная занятость</h2>
                    </div>
                    <Card className="hover:shadow-md transition-all duration-200">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Добавить время занятости</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={submitSlot} className="space-y-4">
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium">Начало</Label>
                                        <Input
                                            type="time"
                                            value={slotForm.data.starts_at}
                                            onChange={e => slotForm.setData('starts_at', e.target.value)}
                                            required
                                            className="h-9"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium">Конец</Label>
                                        <Input
                                            type="time"
                                            value={slotForm.data.ends_at}
                                            onChange={e => slotForm.setData('ends_at', e.target.value)}
                                            required
                                            className="h-9"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium">Повторение</Label>
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
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium">Название</Label>
                                        <Input
                                            value={slotForm.data.note}
                                            onChange={e => slotForm.setData('note', e.target.value)}
                                            placeholder="Обед"
                                            className="h-9"
                                        />
                                    </div>
                                </div>

                                {slotForm.data.recurrence_type === 'once' && (
                                    <div className="space-y-1.5 max-w-xs">
                                        <Label className="text-xs font-medium">Дата</Label>
                                        <Input
                                            type="date"
                                            value={slotForm.data.date}
                                            onChange={e => slotForm.setData('date', e.target.value)}
                                            required
                                            className="h-9"
                                        />
                                    </div>
                                )}

                                {slotForm.data.recurrence_type === 'weekly' && (
                                    <div className="space-y-2">
                                        <Label className="text-xs font-medium">Дни недели</Label>
                                        <div className="flex flex-wrap gap-2">
                                            {WEEKDAY_OPTIONS.map(day => {
                                                const active = (slotForm.data.recurrence_days ?? []).includes(day.value);
                                                return (
                                                    <button
                                                        key={day.value}
                                                        type="button"
                                                        onClick={() => toggleWeekday(day.value)}
                                                        className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-all ${active ? 'bg-blue-500 text-white border-blue-500 shadow-sm' : 'bg-background hover:bg-muted'}`}
                                                    >
                                                        {day.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                <Button type="submit" disabled={slotForm.processing} className="w-full sm:w-auto">
                                    Добавить занятость
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    {/* Slots List */}
                    <Card className="hover:shadow-md transition-all duration-200">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm">Текущие интервалы</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {slots.length === 0 ? (
                                <p className="text-sm text-muted-foreground px-4 py-6 text-center">Постоянная занятость не настроена</p>
                            ) : (
                                <div className="divide-y">
                                    {slots.map(slot => (
                                        <div key={slot.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">{slot.note || 'Занято'}: {slot.starts_at} – {slot.ends_at}</p>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {recurrenceLabel[slot.recurrence_type] ?? slot.recurrence_type}
                                                    {slot.recurrence_type === 'once' && slot.date ? ` (${slot.date})` : ''}
                                                </p>
                                            </div>
                                            <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0" onClick={() => removeSlot(slot.id)}>
                                                <Trash2 className="size-4"/>
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Secretary Access Section */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <Share2 className="size-5 text-green-500" />
                        <h2 className="text-lg font-semibold text-foreground">Совместное управление</h2>
                    </div>

                    <Card className="hover:shadow-md transition-all duration-200">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Назначить секретаря</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={submitSecretary} className="grid gap-3 sm:grid-cols-[1fr_auto]">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium">Выберите сотрудника</Label>
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
                                    <Button type="submit" disabled={secretaryForm.processing || !secretaryForm.data.secretary_id} className="h-9">
                                        Назначить
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    {/* Secretary List */}
                    <Card className="hover:shadow-md transition-all duration-200">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm">Активные секретари</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {secretaryAccesses.length === 0 ? (
                                <p className="text-sm text-muted-foreground px-4 py-6 text-center">Секретари пока не назначены</p>
                            ) : (
                                <div className="divide-y">
                                    {secretaryAccesses.map(access => (
                                        <div key={access.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">{access.secretary_name}</p>
                                                <p className="text-xs text-muted-foreground mt-0.5">{access.secretary_title || access.secretary_email || 'Без должности'}</p>
                                            </div>
                                            <Badge className="text-[10px] shrink-0" variant="outline">Активен</Badge>
                                            <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0" onClick={() => revokeSecretary(access.id)}>
                                                <Trash2 className="size-4"/>
                                            </Button>
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
