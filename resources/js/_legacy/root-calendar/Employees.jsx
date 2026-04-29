import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Head, Link } from '@inertiajs/react';
import { Search, User } from 'lucide-react';
import { useState } from 'react';

const STATUS_COLORS = {
    available: 'bg-green-500',
    busy: 'bg-red-500',
    soon: 'bg-yellow-500',
    dnd: 'bg-gray-400',
};
const STATUS_LABELS = {
    available: 'Доступен',
    busy: 'Занят',
    soon: 'Скоро',
    dnd: 'Не беспокоить',
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
        <AuthenticatedLayout
            header={
                <h2 className="text-2xl font-semibold leading-tight text-gray-900">
                    Сотрудники
                </h2>
            }
        >
            <Head title="Smart Calendar — Сотрудники" />
            <div className="py-8">
                <div className="mx-auto sm:px-6 lg:px-8">
                    <div className="relative max-w-sm mb-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"/>
                        <Input
                            className="pl-9"
                            placeholder="Поиск по ФИО, должности, кабинету..."
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                        />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {filtered.map(emp => (
                            <Card key={emp.id} className="border-border/80 shadow-sm">
                                <CardContent className="p-4 flex gap-3">
                                    <div className="relative shrink-0">
                                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                                            <User className="size-5 text-muted-foreground"/>
                                        </div>
                                        <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${STATUS_COLORS[emp.calendar_status] ?? STATUS_COLORS.dnd}`}/>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium truncate">{emp.name}</p>
                                        <p className="text-xs text-muted-foreground truncate">{emp.title ?? '—'}</p>
                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                            {emp.department && <Badge variant="outline" className="text-[10px] py-0">{emp.department}</Badge>}
                                            {emp.room && <Badge variant="outline" className="text-[10px] py-0">Каб. {emp.room}</Badge>}
                                        </div>
                                        <div className="flex items-center gap-1 mt-2">
                                            <span className={`w-1.5 h-1.5 rounded-full ${STATUS_COLORS[emp.calendar_status] ?? STATUS_COLORS.dnd}`}/>
                                            <span className="text-[10px] text-muted-foreground">{STATUS_LABELS[emp.calendar_status] ?? 'Нет данных'}</span>
                                            <Button variant="outline" size="sm" className="ml-auto h-6 text-[10px] px-2" asChild>
                                                <Link href={route('calendar.employees.profile', { employee: emp.id })}>Календарь</Link>
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                        {filtered.length === 0 && (
                            <p className="col-span-full text-sm text-muted-foreground text-center py-8">Сотрудники не найдены</p>
                        )}
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
