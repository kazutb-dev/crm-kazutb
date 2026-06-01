import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';

export default function SharedCalendar({ managedCalendars = [], selectedOwnerId = null }) {
    const [selectedId, setSelectedId] = useState(selectedOwnerId?.toString() || '');

    const openCalendar = () => {
        if (!selectedId) return;
        router.get(route('calendar.index'), { calendar_owner_id: selectedId });
    };

    return (
        <AuthenticatedLayout>
            <Head title="Smart Calendar — Совместное управление" />
            <div className="admin-page-wrap">

                {managedCalendars.length === 0 ? (
                    <Card>
                        <CardContent className="p-8 text-center">
                            <p className="text-sm text-muted-foreground mb-2">
                                У вас нет прав на управление чужими календарями
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Попросите администратора назначить вас секретарём
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Выбор календаря для управления</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-1">
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

                            <div className="flex gap-2">
                                <Button
                                    onClick={openCalendar}
                                    disabled={!selectedId}
                                >
                                    Открыть
                                </Button>
                                <Button variant="outline" asChild>
                                    <Link href={route('calendar.index')}>Мой календарь</Link>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

            </div>
        </AuthenticatedLayout>
    );
}
