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
                    <Card className="max-w-2xl">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Users className="shrink-0" />
                                Выбор календаря для управления
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-5">
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
                                <p className="text-xs text-slate-500">Доступно календарей: {managedCalendars.length}</p>
                            </div>

                            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
                                <Button
                                    onClick={openCalendar}
                                    disabled={!selectedId}
                                >
                                    Открыть
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

            </div>
        </AuthenticatedLayout>
    );
}
