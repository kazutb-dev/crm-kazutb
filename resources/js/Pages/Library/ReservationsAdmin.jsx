import { toast } from 'sonner';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LoadingState, Notice, PageHeader, StatusBadge, UnderlineTabs } from '@/components/platform';
import { Search } from 'lucide-react';
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

const STATUS_TONES = {
    pending: 'warning',
    approved: 'success',
    rejected: 'danger',
};

const STATUS_TABS = [
    { key: 'pending', label: 'На рассмотрении' },
    { key: 'approved', label: 'Подтверждённые' },
    { key: 'rejected', label: 'Отклонённые' },
    { key: '', label: 'Все' },
];

export default function ReservationsAdmin() {
    const [items, setItems] = useState([]);
    const [links, setLinks] = useState([]);
    const [total, setTotal] = useState(0);
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
            setTotal(Number(payload?.total ?? (payload?.data ?? []).length));
        } catch (fetchError) {
            setItems([]);
            setLinks([]);
            setTotal(0);
            setError(fetchError.message || 'Не удалось загрузить брони.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadReservations();
    }, [queryString]);

    const pageCounts = items.reduce((acc, item) => {
        acc[item.status] = (acc[item.status] ?? 0) + 1;
        return acc;
    }, {});

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
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="Библиотека"
                    title="Управление бронями книг"
                    description="Подтверждайте или отклоняйте брони, отправленные с терминала библиотеки."
                />
            )}
        >
            <Head title="Брони книг" />

            <div className="admin-page-wrap space-y-6">
                <UnderlineTabs
                    items={STATUS_TABS}
                    value={status}
                    onChange={(nextStatus) => {
                        setStatus(nextStatus);
                        setPage(1);
                    }}
                />

                {error && <Notice tone="danger" title="Ошибка загрузки">{error}</Notice>}

                {isLoading && <LoadingState label="Загрузка броней..." />}

                <Card className="overflow-hidden">
                    <form
                        className="grid items-end gap-3 border-b border-slate-200 px-5 py-4 sm:px-6 md:grid-cols-[minmax(0,1fr)_auto_auto]"
                        onSubmit={(event) => {
                            event.preventDefault();
                            setPage(1);
                            setQuery(queryDraft);
                        }}
                    >
                        <label className="block space-y-2">
                            <span className="qd-field-label block">Поиск</span>
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <Input
                                    value={queryDraft}
                                    onChange={(event) => setQueryDraft(event.target.value)}
                                    placeholder="Книга, автор, ISBN, email, табельный номер"
                                    className="pl-9"
                                />
                            </div>
                        </label>
                        <div className="flex items-center gap-2">
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
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 md:h-10 md:justify-end">
                            <span className="font-medium tabular-nums text-slate-700">Найдено: {total}</span>
                            {Object.entries(pageCounts).map(([key, count]) => (
                                <StatusBadge key={key} tone={STATUS_TONES[key] ?? 'default'}>
                                    {statusLabels[key] ?? key}: {count}
                                </StatusBadge>
                            ))}
                        </div>
                    </form>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[1080px] text-sm">
                                <thead>
                                    <tr>
                                        <th className="text-left">ID</th>
                                        <th className="text-left">Книга</th>
                                        <th className="text-left">Студент</th>
                                        <th className="text-left">Статус</th>
                                        <th className="text-left">IP</th>
                                        <th className="text-left">Дата</th>
                                        <th className="text-left">Решение</th>
                                        <th className="text-right">Действия</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {!isLoading && items.length === 0 && (
                                        <tr>
                                            <td className="py-8 text-center text-slate-500" colSpan={8}>
                                                Брони не найдены.
                                            </td>
                                        </tr>
                                    )}

                                    {items.map((item) => {
                                        const locked = isSubmittingId === item.id;
                                        const isPending = item.status === 'pending';

                                        return (
                                            <tr key={item.id} className="align-top hover:bg-slate-50">
                                                <td className="font-medium tabular-nums text-slate-900">#{item.id}</td>
                                                <td>
                                                    <div className="font-medium text-slate-900">{item.book_title}</div>
                                                    <div className="text-xs text-slate-500">
                                                        {item.book_author || 'Автор не указан'}
                                                        {item.book_isbn ? ` • ISBN ${item.book_isbn}` : ''}
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="text-slate-900">{item.student_name || 'Без имени'}</div>
                                                    <div className="text-xs text-slate-500">{item.student_identifier || '-'}</div>
                                                    <div className="text-xs text-slate-500">{item.student_email || '-'}</div>
                                                </td>
                                                <td>
                                                    <StatusBadge tone={STATUS_TONES[item.status] ?? 'default'}>
                                                        {statusLabels[item.status] || item.status}
                                                    </StatusBadge>
                                                </td>
                                                <td className="font-mono text-xs text-slate-600">{item.source_ip}</td>
                                                <td className="tabular-nums text-slate-600">
                                                    {item.requested_at ? new Date(item.requested_at).toLocaleString('ru-RU') : '-'}
                                                </td>
                                                <td className="max-w-xs text-slate-600">
                                                    {item.reviewed_at ? (
                                                        <>
                                                            <div className="text-xs tabular-nums text-slate-500">
                                                                {new Date(item.reviewed_at).toLocaleString('ru-RU')}
                                                                {item.reviewer?.name ? ` · ${item.reviewer.name}` : ''}
                                                            </div>
                                                            {item.review_note ? <div className="line-clamp-2 text-xs">{item.review_note}</div> : null}
                                                        </>
                                                    ) : (
                                                        <span className="text-slate-400">—</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <div className="flex justify-end gap-2">
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
                            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-5 py-3 sm:px-6">
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
