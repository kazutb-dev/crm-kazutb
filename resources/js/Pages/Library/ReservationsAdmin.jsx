import { toast } from 'sonner';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Button } from '@/components/ui/button';
import { DataTable, FilterBar, LoadingState, Notice, PageHeader, StatusBadge, UnderlineTabs } from '@/components/platform';
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

                <FilterBar>
                    <form
                        className="space-y-4"
                        onSubmit={(event) => {
                            event.preventDefault();
                            setPage(1);
                            setQuery(queryDraft);
                        }}
                    >
                        <div className="max-w-2xl">
                            <label className="block space-y-2">
                                <span className="qd-field-label block">Поиск</span>
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <Input
                                        value={queryDraft}
                                        onChange={(event) => setQueryDraft(event.target.value)}
                                        placeholder="Книга, автор, email, табельный номер"
                                        className="pl-9"
                                    />
                                </div>
                            </label>

                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4">
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
                </FilterBar>

                {error && <Notice tone="danger" title="Ошибка загрузки">{error}</Notice>}

                {isLoading && <LoadingState label="Загрузка броней..." />}

                <DataTable>
                    <table className="w-full min-w-[1100px] text-sm">
                        <thead>
                            <tr>
                                <th className="px-4 py-3 text-left">ID</th>
                                <th className="px-4 py-3 text-left">Книга</th>
                                <th className="px-4 py-3 text-left">Студент</th>
                                <th className="px-4 py-3 text-left">Статус</th>
                                <th className="px-4 py-3 text-left">IP</th>
                                <th className="px-4 py-3 text-left">Дата</th>
                                <th className="px-4 py-3 text-right">Действия</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!isLoading && items.length === 0 && (
                                <tr className="border-t border-slate-200">
                                    <td className="px-4 py-10 text-center text-slate-500" colSpan={7}>
                                        Брони не найдены.
                                    </td>
                                </tr>
                            )}

                            {items.map((item) => {
                                const locked = isSubmittingId === item.id;
                                const isPending = item.status === 'pending';

                                return (
                                    <tr key={item.id} className="border-t border-slate-200 align-top hover:bg-slate-50">
                                        <td className="px-4 py-3 font-medium tabular-nums text-slate-900">#{item.id}</td>
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-slate-900">{item.book_title}</div>
                                            <div className="text-xs text-slate-500">
                                                {item.book_author || 'Автор не указан'}
                                                {item.book_isbn ? ` • ISBN ${item.book_isbn}` : ''}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="text-slate-900">{item.student_name || 'Без имени'}</div>
                                            <div className="text-xs text-slate-500">{item.student_identifier || '-'}</div>
                                            <div className="text-xs text-slate-500">{item.student_email || '-'}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <StatusBadge tone={STATUS_TONES[item.status] ?? 'default'}>
                                                {statusLabels[item.status] || item.status}
                                            </StatusBadge>
                                        </td>
                                        <td className="px-4 py-3 font-mono text-xs text-slate-600">{item.source_ip}</td>
                                        <td className="px-4 py-3 tabular-nums text-slate-600">
                                            {item.requested_at ? new Date(item.requested_at).toLocaleString('ru-RU') : '-'}
                                        </td>
                                        <td className="px-4 py-3">
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
                </DataTable>

                {links.length > 3 && (
                    <div className="flex flex-wrap justify-end gap-2">
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
            </div>
        </AuthenticatedLayout>
    );
}
