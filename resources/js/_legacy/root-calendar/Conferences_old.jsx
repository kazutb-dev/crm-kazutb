import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Head } from '@inertiajs/react';
import { ExternalLink, Video, Zap } from 'lucide-react';

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
        <AuthenticatedLayout>
            <Head title="Smart Calendar — Конференции" />
            <div className="min-h-screen bg-gradient-to-br from-blue-50/50 via-white to-blue-50/30 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900">
            <div className="p-6 sm:p-8 max-w-4xl mx-auto space-y-6">

                {/* Header */}
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-2.5">
                            <Video className="size-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-foreground">Онлайн-встречи</h1>
                            <p className="text-sm text-muted-foreground">Конференции и видеозвонки на этой неделе</p>
                        </div>
                    </div>
                </div>

                {/* Conferences List */}
                {tagged.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <Video className="size-10 text-muted-foreground/40 mx-auto mb-3" />
                            <p className="text-sm font-medium text-muted-foreground">Нет запланированных конференций</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-3">
                        {tagged.map(c => (
                            <Card 
                                key={c.id} 
                                className={`hover:shadow-md transition-all duration-200 ${
                                    c.tag === 'live' 
                                        ? 'border-red-300/50 bg-gradient-to-r from-red-50/40 to-red-50/20 dark:border-red-800/30 dark:from-red-900/10 dark:to-red-900/5' 
                                        : ''
                                }`}
                            >
                                <CardContent className="p-5">
                                    <div className="flex gap-4 items-start">
                                        {/* Icon */}
                                        <div className="shrink-0 mt-0.5">
                                            <div className={`p-2.5 rounded-lg ${
                                                c.tag === 'live' 
                                                    ? 'bg-red-500/10' 
                                                    : 'bg-blue-500/10'
                                            }`}>
                                                <Video className={`size-5 ${c.tag === 'live' ? 'text-red-500' : 'text-blue-500'}`}/>
                                            </div>
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                                {c.tag === 'live' && (
                                                    <Badge className="bg-red-500 text-white text-[10px] font-semibold py-0.5 px-2 animate-pulse">
                                                        <Zap className="size-3 mr-1 inline" />
                                                        ИДЁТ СЕЙЧАС
                                                    </Badge>
                                                )}
                                                {c.tag !== 'live' && (
                                                    <Badge variant="outline" className={`text-[10px] py-0.5 ${STATUS_META[c.tag]?.cls ?? ''}`}>
                                                        {STATUS_META[c.tag]?.label ?? 'Запланирована'}
                                                    </Badge>
                                                )}
                                            </div>
                                            <h3 className="font-semibold text-sm text-foreground mb-1">{c.title}</h3>
                                            <p className="text-xs text-muted-foreground space-x-1">
                                                <span className="font-medium">{c.organizer}</span>
                                                <span>·</span>
                                                <span>{c.organizer_title}</span>
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-1.5">
                                                🕐 {fmt(c.starts_at, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} — {fmt(c.ends_at, { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>

                                        {/* Join Button */}
                                        {c.zoom_join_url && (
                                            <Button 
                                                asChild 
                                                size="sm" 
                                                className={`shrink-0 h-9 ${c.tag === 'live' ? '' : ''}`}
                                            >
                                                <a href={c.zoom_join_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5">
                                                    <ExternalLink className="size-3.5"/>
                                                    <span className="hidden sm:inline">Zoom</span>
                                                </a>
                                            </Button>
                                        )}
                                    </div>
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
