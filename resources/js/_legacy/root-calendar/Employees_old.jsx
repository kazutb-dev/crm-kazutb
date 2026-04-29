import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Head, Link } from '@inertiajs/react';
import { Search, Users } from 'lucide-react';
import { useState } from 'react';

const STATUS_COLORS = {
    available: 'bg-green-500',
    busy:      'bg-red-500',
    soon:      'bg-yellow-500',
    dnd:       'bg-gray-400',
};
const STATUS_LABELS = {
    available: 'Доступен',
    busy:      'Занят',
    soon:      'Скоро',
    dnd:       'Не беспокоить',
};

export default function CalendarEmployees({ employees = [] }) {
    const [query, setQuery] = useState('');

    const filtered = employees.filter(e => {
        const q = query.toLowerCase();
        return !q ||
            e.name?.toLowerCase().includes(q) ||
            e.title?.toLowerCase().includes(q) ||
            e.department?.toLowerCase().includes(q) ||
            e.room?.toLowerCase().includes(q) ||
            e.email?.toLowerCase().includes(q);
    });

    return (
        <AuthenticatedLayout>
            <Head title="Smart Calendar — Сотрудники" />
            <div className="min-h-screen bg-gradient-to-br from-blue-50/50 via-white to-blue-50/30 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900">
            <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-2.5">
                            <Users className="size-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-foreground">Каталог сотрудников</h1>
                            <p className="text-sm text-muted-foreground">Просмотр календарей и статуса доступности</p>
                        </div>
                    </div>
                </div>

                {/* Search */}
                <div className="space-y-3">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"/>
                        <Input
                            className="pl-9 h-10"
                            placeholder="Поиск по имени, должности, кабинету..."
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                        />
                    </div>
                    {query && (
                        <p className="text-xs text-muted-foreground">
                            Найдено: <span className="font-semibold text-foreground">{filtered.length}</span> сотрудников
                        </p>
                    )}
                </div>

                {/* Grid */}
                {filtered.length === 0 ? (
                    <Card className="col-span-full">
                        <CardContent className="py-12 text-center">
                            <Users className="size-10 text-muted-foreground/40 mx-auto mb-3" />
                            <p className="text-sm font-medium text-muted-foreground">Сотрудники не найдены</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {filtered.map(emp => (
                            <Card key={emp.id} className="hover:shadow-md transition-all duration-200 overflow-hidden">
                                <CardContent className="p-5 space-y-4">
                                    {/* Avatar + Status */}
                                    <div className="flex items-start gap-4">
                                        <div className="relative shrink-0">
                                            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                                                <span className="text-lg font-semibold text-white">
                                                    {emp.name.charAt(0).toUpperCase()}
                                                </span>
                                            </div>
                                            <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-background ${STATUS_COLORS[emp.calendar_status] ?? STATUS_COLORS.dnd}`}/>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold truncate">{emp.name}</p>
                                            <p className="text-xs text-muted-foreground truncate">{emp.title ?? '—'}</p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${STATUS_COLORS[emp.calendar_status] ?? STATUS_COLORS.dnd}`}/>
                                                {STATUS_LABELS[emp.calendar_status] ?? 'Нет данных'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Details */}
                                    <div className="space-y-1.5">
                                        {emp.department && (
                                            <Badge variant="secondary" className="text-[10px] font-normal">
                                                📍 {emp.department}
                                            </Badge>
                                        )}
                                        {emp.room && (
                                            <Badge variant="secondary" className="text-[10px] font-normal">
                                                🏢 Кабинет {emp.room}
                                            </Badge>
                                        )}
                                    </div>

                                    {/* Action Button */}
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className="w-full h-8 text-xs" 
                                        asChild
                                    >
                                        <Link href={route('calendar.employees.profile', { employee: emp.id })}>
                                            Открыть календарь
                                        </Link>
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                </div>
            </div>
        </AuthenticatedLayout>
    );
}
