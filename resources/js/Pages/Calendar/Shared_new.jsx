import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Head, router } from '@inertiajs/react';
import { useMemo, useState } from 'react';

export default function CalendarShared({ managedCalendars = [], selectedOwnerId = null }) {
    const options = useMemo(
        () => managedCalendars.map(item => ({
            value: String(item.id),
            label: item.title ? `${item.name} (${item.title})` : item.name,
        })),
        [managedCalendars],
    );

    const fallbackOwner = managedCalendars.length > 0 ? String(managedCalendars[0].id) : '';
    const [ownerId, setOwnerId] = useState(String(selectedOwnerId ?? fallbackOwner));

    const openCalendar = () => {
        if (!ownerId) return;
        router.get(route('calendar.index'), { calendar_owner_id: ownerId });
    };

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-2xl font-semibold leading-tight text-gray-900">
                    Совместный календарь
                </h2>
            }
        >
            <Head title="Smart Calendar — Совместное управление" />
            <div className="py-8">
                <div className="mx-auto sm:px-6 lg:px-8 max-w-2xl">
                    <Card className="border-border/80 shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Выбор владельца календаря</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="space-y-1">
                                <Label>Чей календарь открыть</Label>
                                <NativeSelect
                                    value={ownerId}
                                    onValueChange={setOwnerId}
                                    options={options}
                                />
                            </div>
                            <Button type="button" onClick={openCalendar} disabled={!ownerId}>
                                Открыть календарь
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
