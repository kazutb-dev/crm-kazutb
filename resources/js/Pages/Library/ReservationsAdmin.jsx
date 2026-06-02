import { toast } from 'sonner';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Head } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';

function getCsrfToken() {
    return decodeURIComponent(document.cookie.match(/XSRF-TOKEN=([^;]+)/)?.[1] ?? '');
}

const statusLabels = {
    pending: 'На рассмотрении',
    approved: 'Подтверждена',
    rejected: 'Отклонена',
};

export default function ReservationsAdmin() {
    const [items, setItems] = useState([]);
    const [links, setLinks] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmittingId, setIsSubmittingId] = useState(null);
    const [error, setError] = useState('');
    const [queryDraft, setQueryDraft] = useState('');
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState('pending');
    const [page, setPage] = useState(1);

    const queryString = useMemo(() => {
        const params = new URLSearchParams({
            page: String(page),
            per_page: '20',
        });

        if (query.trim() !== '') {
            params.set('q', query.trim());
        }

        if (status !== '') {
            params.set('status', status);
        }

        return params.toString();
    }, [page, query, status]);

    const loadReservations = async () => {
        setIsLoading(true);
        setError('');

        try {
            const response = await fetch(`${route('library.reservations.data')}?${queryString}`, {
                headers: {
                    Accept: 'application/json',
                    'X-XSRF-TOKEN': getCsrfToken(),
                },
                credentials: 'include',
            });

            const payload = await response.json();

            if (!response.ok) {
                throw new Error(payload?.message || 'Не удалось загрузить брони.');
            }

            setItems(payload?.data ?? []);
            setLinks(payload?.links ?? []);
        } catch (fetchError) {
            setItems([]);
            setLinks([]);
            setError(fetchError.message || 'Не удалось загрузить брони.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadReservations();
    }, [queryString]);

    const handleAction = async (reservationId, action) => {
        const note = window.prompt('Комментарий (необязательно):', '');

        if (note === null) {
            return;
        }

        setIsSubmittingId(reservationId);

        try {
            const endpoint = action === 'approve'
                ? route('library.reservations.approve', reservationId)
                : route('library.reservations.reject', reservationId);

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-XSRF-TOKEN': getCsrfToken(),
                },
                credentials: 'include',
                body: JSON.stringify({ review_note: note || null }),
            });

            const payload = await response.json();

            if (!response.ok) {
                throw new Error(payload?.message || 'Не удалось обновить статус брони.');
            }

            await loadReservations();
        } catch (submitError) {
            toast.error(submitError.message || 'Не удалось обновить статус брони.');
        } finally {
            setIsSubmittingId(null);
        }
    };

    return (
        <AuthenticatedLayout>
            <Head title="Брони книг" />

            <div className="admin-page-wrap">
                <Card>
                    <CardHeader>
                        <CardTitle>Управление бронями книг</CardTitle>
                        <CardDescription>
                            Подтверждайте или отклоняйте брони, отправленные с терминала библиотеки.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form
                            className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end"
                            onSubmit={(event) => {
                                event.preventDefault();
                                setPage(1);
                                setQuery(queryDraft);
                            }}
                        >
                            <div className="flex-1 space-y-1">
                                <label className="text-sm font-medium">Поиск</label>
                                <Input
                                    value={queryDraft}
                                    onChange={(event) => setQueryDraft(event.target.value)}
                                    placeholder="Книга, автор, email, табельный номер"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-sm font-medium">Статус</label>
                                <select
                                    className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={status}
                                    onChange={(event) => {
                                        setStatus(event.target.value);
                                        setPage(1);
                                    }}
                                >
                                    <option value="pending">На рассмотрении</option>
                                    <option value="approved">Подтверждена</option>
                                    <option value="rejected">Отклонена</option>
                                    <option value="">Все</option>
                                </select>
                            </div>

                            <div className="flex gap-2">
                                <Button type="submit" disabled={isLoading}>Найти</Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={isLoading}
                                    onClick={() => {
                                        setQueryDraft('');
                                        setQuery('');
                                        setStatus('pending');
                                        setPage(1);
                                    }}
                                >
                                    Сбросить
                                </Button>
                            </div>
                        </form>

                        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

                        <div className="overflow-x-auto rounded-md border">
                            <table className="w-full min-w-[1100px] text-sm">
                                <thead className="bg-muted/50">
                                    <tr>
                                        <th className="px-3 py-2 text-left font-medium">ID</th>
                                        <th className="px-3 py-2 text-left font-medium">Книга</th>
                                        <th className="px-3 py-2 text-left font-medium">Студент</th>
                                        <th className="px-3 py-2 text-left font-medium">Статус</th>
                                        <th className="px-3 py-2 text-left font-medium">IP</th>
                                        <th className="px-3 py-2 text-left font-medium">Дата</th>
                                        <th className="px-3 py-2 text-left font-medium">Действия</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {!isLoading && items.length === 0 && (
                                        <tr className="border-t">
                                            <td className="px-3 py-6 text-center text-muted-foreground" colSpan={7}>
                                                Брони не найдены.
                                            </td>
                                        </tr>
                                    )}

                                    {items.map((item) => {
                                        const locked = isSubmittingId === item.id;
                                        const isPending = item.status === 'pending';

                                        return (
                                            <tr key={item.id} className="border-t align-top">
                                                <td className="px-3 py-3 font-medium">#{item.id}</td>
                                                <td className="px-3 py-3">
                                                    <div className="font-medium">{item.book_title}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {item.book_author || 'Автор не указан'}
                                                        {item.book_isbn ? ` • ISBN ${item.book_isbn}` : ''}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3">
                                                    <div>{item.student_name || 'Без имени'}</div>
                                                    <div className="text-xs text-muted-foreground">{item.student_identifier || '-'}</div>
                                                    <div className="text-xs text-muted-foreground">{item.student_email || '-'}</div>
                                                </td>
                                                <td className="px-3 py-3">{statusLabels[item.status] || item.status}</td>
                                                <td className="px-3 py-3">{item.source_ip}</td>
                                                <td className="px-3 py-3 text-muted-foreground">
                                                    {item.requested_at ? new Date(item.requested_at).toLocaleString('ru-RU') : '-'}
                                                </td>
                                                <td className="px-3 py-3">
                                                    <div className="flex gap-2">
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            disabled={!isPending || locked}
                                                            onClick={() => handleAction(item.id, 'approve')}
                                                        >
                                                            Подтвердить
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="destructive"
                                                            disabled={!isPending || locked}
                                                            onClick={() => handleAction(item.id, 'reject')}
                                                        >
                                                            Отклонить
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {links.length > 3 && (
                            <div className="mt-4 flex flex-wrap gap-2">
                                {links.map((link, index) => (
                                    <Button
                                        key={`${link.label}-${index}`}
                                        type="button"
                                        variant={link.active ? 'default' : 'outline'}
                                        size="sm"
                                        disabled={!link.url || isLoading}
                                        onClick={() => {
                                            if (!link.url) {
                                                return;
                                            }

                                            const parsed = new URL(link.url);
                                            const nextPage = Number(parsed.searchParams.get('page') || '1');
                                            setPage(nextPage);
                                        }}
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                    />
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}
