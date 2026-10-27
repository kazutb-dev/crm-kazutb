import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { EmptyState, PageHeader } from '@/components/platform';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Head, Link, router } from '@inertiajs/react';
import { CalendarDays, Users } from 'lucide-react';
import { useState } from 'react';

export default function SharedCalendar({ managedCalendars = [], selectedOwnerId = null }) {
    const [selectedId, setSelectedId] = useState(selectedOwnerId?.toString() || '');

    const openCalendar = () => {
        if (!selectedId) return;
        router.get(route('calendar.index'), { calendar_owner_id: selectedId });
    };

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="Smart Calendar"
                    title="Совместное управление"
                    description="Ведение календарей руководителей, для которых вы назначены секретарём."
                    actions={(
                        <Button variant="outline" asChild>
                            <Link href={route('calendar.index')}>
                                <CalendarDays className="h-4 w-4" />
                                Мой календарь
                            </Link>
                        </Button>
                    )}
                />
            )}
        >
            <Head title="Smart Calendar — Совместное управление" />
            <div className="admin-page-wrap space-y-6">

                {managedCalendars.length === 0 ? (
                    <EmptyState
                        title="У вас нет прав на управление чужими календарями"
                        description="Попросите администратора назначить вас секретарём"
                    />
                ) : (
                    <Card>
                        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                            <CardTitle className="flex items-center gap-2">
                                <Users className="shrink-0" />
                                Выбор календаря для управления
                            </CardTitle>
                            <span className="text-xs font-semibold tabular-nums text-slate-500">Доступно календарей: {managedCalendars.length}</span>
                        </CardHeader>
                        <CardContent className="space-y-0 p-0 sm:p-0">
                            <div className="grid gap-3 border-b border-slate-200 px-5 py-4 sm:grid-cols-[minmax(0,32rem)_auto] sm:items-end sm:px-6">
                                <div className="space-y-2">
                                    <Label>Календарь владельца</Label>
                                    <NativeSelect
                                        value={selectedId}
                                        onValueChange={setSelectedId}
                                        options={[
                                            { value: '', label: 'Выберите календарь...' },
                                            ...managedCalendars.map(emp => ({
                                                value: emp.id.toString(),
                                                label: emp.title ? `${emp.name} (${emp.title})` : emp.name,
                                            })),
                                        ]}
                                    />
                                </div>
                                <Button
                                    onClick={openCalendar}
                                    disabled={!selectedId}
                                >
                                    Открыть
                                </Button>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-200">
                                            <th>Владелец</th>
                                            <th>Должность</th>
                                            <th className="text-right"><span className="sr-only">Действия</span></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {managedCalendars.map(emp => (
                                            <tr key={emp.id} className={`border-b border-slate-200 last:border-b-0 ${String(emp.id) === selectedId ? 'bg-teal-50/60' : 'hover:bg-slate-50'}`}>
                                                <td className="font-medium text-slate-900">{emp.name}</td>
                                                <td className="text-slate-600">{emp.title || '—'}</td>
                                                <td className="text-right">
                                                    <Button size="sm" variant="outline" onClick={() => router.get(route('calendar.index'), { calendar_owner_id: emp.id })}>
                                                        Открыть календарь
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                )}

            </div>
        </AuthenticatedLayout>
    );
}
