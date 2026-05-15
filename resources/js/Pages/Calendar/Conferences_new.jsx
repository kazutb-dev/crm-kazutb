import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Head } from '@inertiajs/react';
import { ExternalLink, Video } from 'lucide-react';

function fmt(dt, opts) {
    if (!dt) return '—';
    return new Date(dt).toLocaleString('ru-RU', opts);
}

const STATUS_META = {
    confirmed: { label: 'Скоро',         cls: 'bg-yellow-500/15 text-yellow-700 border-yellow-400' },
    pending:   { label: 'Ожидает',        cls: 'bg-gray-100 text-muted-foreground border-gray-300' },
    completed: { label: 'Завершена',      cls: 'bg-gray-100 text-muted-foreground border-gray-300' },
};

export default function CalendarConferences({ conferences = [] }) {
    const now = new Date();

    const tagged = conferences.map(c => {
        const start = new Date(c.starts_at);
        const end   = new Date(c.ends_at);
        let tag = 'confirmed';
        if (end < now) tag = 'completed';
        else if (start <= now && end >= now) tag = 'live';
        return { ...c, tag };
    });

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-2xl font-semibold leading-tight text-gray-900">
                    Конференции
                </h2>
            }
        >
            <Head title="Smart Calendar — Конференции" />
            <div className="py-8">
                <div className="mx-auto sm:px-6 lg:px-8">
                    {tagged.length === 0 && (
                        <Card className="border-border/80 shadow-sm"><CardContent className="py-10 text-center text-sm text-muted-foreground">Нет запланированных конференций</CardContent></Card>
                    )}

                    <div className="space-y-3">
                        {tagged.map(c => (
                            <Card key={c.id} className={`border-border/80 shadow-sm ${c.tag === 'live' ? 'border-red-300 bg-red-50/40' : ''}`}>
                                <CardContent className="p-4 flex gap-3 items-start">
                                    <div className="shrink-0 mt-0.5">
                                        <Video className={`size-5 ${c.tag === 'live' ? 'text-red-500' : 'text-blue-500'}`}/>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2 mb-1">
                                            {c.tag === 'live' && (
                                                <Badge className="bg-red-500 text-white text-[10px] py-0 animate-pulse">● ИДЁТ СЕЙЧАС</Badge>
                                            )}
                                            {c.tag !== 'live' && (
                                                <Badge variant="outline" className={`text-[10px] py-0 ${STATUS_META[c.tag]?.cls ?? ''}`}>
                                                    {STATUS_META[c.tag]?.label ?? 'Запланирована'}
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="font-medium text-sm">{c.title}</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">{c.organizer} · {c.organizer_title}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {fmt(c.starts_at, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} —{' '}
                                            {fmt(c.ends_at,   { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                    {c.zoom_join_url && (
                                        <Button asChild size="sm" className={c.tag === 'live' ? '' : ''}>
                                            <a href={c.zoom_join_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                                                <ExternalLink className="size-3.5"/>
                                                Zoom
                                            </a>
                                        </Button>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
