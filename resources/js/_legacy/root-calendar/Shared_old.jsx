import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Head, router } from '@inertiajs/react';
import { Share2 } from 'lucide-react';
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
        <AuthenticatedLayout>
            <Head title="Smart Calendar — Совместное управление" />
            <div className="min-h-screen bg-gradient-to-br from-blue-50/50 via-white to-blue-50/30 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900">
            <div className="p-6 sm:p-8 max-w-2xl mx-auto space-y-6">

                {/* Header */}
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-2.5">
                            <Share2 className="size-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-foreground">Совместный календарь</h1>
                            <p className="text-sm text-muted-foreground">Выберите календарь для управления</p>
                        </div>
                    </div>
                </div>

                {/* Card */}
                <Card className="hover:shadow-lg transition-all duration-200">
                    <CardHeader className="pb-3">
                        <CardTitle>Выбор владельца календаря</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Чей календарь открыть?</Label>
                            <p className="text-xs text-muted-foreground">Выберите сотрудника, чьим календарём вы можете управлять</p>
                        </div>
                        <NativeSelect
                            value={ownerId}
                            onValueChange={setOwnerId}
                            options={options}
                        />
                        <Button 
                            type="button" 
                            onClick={openCalendar} 
                            disabled={!ownerId}
                            className="w-full sm:w-auto"
                        >
                            <Share2 className="size-4 mr-2" />
                            Открыть календарь
                        </Button>
                    </CardContent>
                </Card>

                {/* Info Card */}
                <Card className="border-blue-200/50 bg-blue-50/30 dark:border-blue-800/30 dark:bg-blue-900/10">
                    <CardContent className="pt-6">
                        <p className="text-sm text-foreground/70">
                            💡 <span className="font-medium">Совет:</span> Вы можете управлять календарем коллеги, если вам предоставлен доступ. Обратитесь к руководителю или коллеге, если вы не видите их календарь в списке.
                        </p>
                    </CardContent>
                </Card>

                </div>
            </div>
        </AuthenticatedLayout>
    );
}
