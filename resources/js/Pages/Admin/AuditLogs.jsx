import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Head, Link, router, useForm } from '@inertiajs/react';

const eventLabels = {
    login: 'Вход в систему',
    created: 'Создание записи',
};

const eventVariants = {
    login: 'secondary',
    created: 'default',
};

export default function AuditLogs({ logs, filters = {}, options = {} }) {
    const items = logs?.data ?? [];
    const links = logs?.links ?? [];

    const filterForm = useForm({
        event_type: filters.event_type ?? '',
        subject_type: filters.subject_type ?? '',
        search: filters.search ?? '',
    });

    const applyFilters = (event) => {
        event.preventDefault();

        router.get(route('admin.audit-logs.index'), {
            event_type: filterForm.data.event_type || undefined,
            subject_type: filterForm.data.subject_type || undefined,
            search: filterForm.data.search || undefined,
        }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const resetFilters = () => {
        filterForm.setData({
            event_type: '',
            subject_type: '',
            search: '',
        });

        router.get(route('admin.audit-logs.index'), {}, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    return (
        <AuthenticatedLayout>
            <Head title="Журнал действий" />

            <div className="admin-page-wrap">
                <Card className="admin-surface">
                    <CardHeader>
                        <CardTitle>Журнал действий</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form className="grid gap-4 md:grid-cols-4" onSubmit={applyFilters}>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Событие</label>
                                <select
                                    className="h-9 w-full rounded-md border border-input bg-background/70 px-3 text-sm shadow-sm"
                                    value={filterForm.data.event_type}
                                    onChange={(event) => filterForm.setData('event_type', event.target.value)}
                                >
                                    <option value="">Все</option>
                                    {(options.eventTypes ?? []).map((eventType) => (
                                        <option key={eventType} value={eventType}>{eventLabels[eventType] ?? eventType}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Сущность</label>
                                <select
                                    className="h-9 w-full rounded-md border border-input bg-background/70 px-3 text-sm shadow-sm"
                                    value={filterForm.data.subject_type}
                                    onChange={(event) => filterForm.setData('subject_type', event.target.value)}
                                >
                                    <option value="">Все</option>
                                    {(options.subjectTypes ?? []).map((subjectType) => (
                                        <option key={subjectType} value={subjectType}>{subjectType}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2 md:col-span-2">
                                <label className="text-sm font-medium">Поиск</label>
                                <Input
                                    value={filterForm.data.search}
                                    onChange={(event) => filterForm.setData('search', event.target.value)}
                                    placeholder="Имя, email, описание, объект"
                                />
                            </div>

                            <div className="md:col-span-4 flex flex-wrap gap-2">
                                <Button type="submit">Применить</Button>
                                <Button type="button" variant="outline" onClick={resetFilters}>Сбросить</Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                <Card className="admin-surface">
                    <CardHeader>
                        <CardTitle>События</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {items.length === 0 ? (
                            <div className="admin-empty-state">Пока нет событий для отображения.</div>
                        ) : (
                            <div className="admin-table-wrap">
                                <table className="admin-data-table min-w-[1200px]">
                                    <thead>
                                        <tr>
                                            <th>Дата</th>
                                            <th>Пользователь</th>
                                            <th>Событие</th>
                                            <th>Сущность</th>
                                            <th>Объект</th>
                                            <th>Описание</th>
                                            <th>IP</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((log) => (
                                            <tr key={log.id} className="align-top">
                                                <td className="py-3 pe-3 text-muted-foreground">
                                                    {new Date(log.created_at).toLocaleString('ru-RU')}
                                                </td>
                                                <td className="py-3 pe-3">
                                                    <div className="font-medium">{log.actor_name || 'Неизвестно'}</div>
                                                    <div className="text-xs text-muted-foreground">{log.actor_email || '—'}</div>
                                                </td>
                                                <td className="py-3 pe-3">
                                                    <Badge variant={eventVariants[log.event_type] ?? 'outline'}>
                                                        {eventLabels[log.event_type] ?? log.event_type}
                                                    </Badge>
                                                </td>
                                                <td className="py-3 pe-3 text-muted-foreground">{log.subject_type || '—'}</td>
                                                <td className="py-3 pe-3">{log.subject_label || '—'}</td>
                                                <td className="py-3 pe-3 max-w-md text-muted-foreground">{log.description}</td>
                                                <td className="py-3 pe-3 text-muted-foreground">{log.ip_address || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {links.length > 3 && (
                            <div className="admin-pagination">
                                {links.map((link, index) => (
                                    <Button
                                        key={`${link.label}-${index}`}
                                        variant={link.active ? 'default' : 'outline'}
                                        size="sm"
                                        disabled={!link.url}
                                        asChild={Boolean(link.url)}
                                    >
                                        {link.url ? (
                                            <Link href={link.url} dangerouslySetInnerHTML={{ __html: link.label }} />
                                        ) : (
                                            <span dangerouslySetInnerHTML={{ __html: link.label }} />
                                        )}
                                    </Button>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}