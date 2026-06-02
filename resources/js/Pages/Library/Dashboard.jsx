import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Head } from '@inertiajs/react';
import { useEffect, useState } from 'react';

const DEFAULT_LIMIT = 100;
const PAGE_SIZE_OPTIONS = [20, 50, 100, 200];

export default function Dashboard() {
    const [books, setBooks] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(DEFAULT_LIMIT);
    const [query, setQuery] = useState('');
    const [searchDraft, setSearchDraft] = useState('');
    const [meta, setMeta] = useState({
        page: 1,
        limit: DEFAULT_LIMIT,
        total: 0,
        totalPages: 1,
    });

    useEffect(() => {
        const controller = new AbortController();

        const loadCatalog = async () => {
            setIsLoading(true);
            setError('');

            try {
                const params = new URLSearchParams({
                    page: String(page),
                    limit: String(limit),
                });

                if (query.trim() !== '') {
                    params.set('q', query.trim());
                }

                const response = await fetch(`${route('library.catalog')}?${params.toString()}`, {
                    method: 'GET',
                    headers: {
                        Accept: 'application/json',
                    },
                    signal: controller.signal,
                });

                const payload = await response.json();

                if (!response.ok) {
                    throw new Error(payload?.message || `API вернул статус ${response.status}`);
                }

                const rows = Array.isArray(payload)
                    ? payload
                    : Array.isArray(payload?.data)
                        ? payload.data
                        : Array.isArray(payload?.items)
                            ? payload.items
                            : [];
                const nextMeta = payload?.meta ?? {};

                setBooks(rows);
                setMeta({
                    page: Number(nextMeta.page ?? page),
                    limit: Number(nextMeta.limit ?? limit),
                    total: Number(nextMeta.total ?? rows.length),
                    totalPages: Number(nextMeta.totalPages ?? 1),
                });
            } catch (err) {
                if (err.name === 'AbortError') {
                    return;
                }

                setError(err.message || 'Не удалось загрузить список книг.');
                setBooks([]);
                setMeta((currentMeta) => ({
                    ...currentMeta,
                    total: 0,
                    totalPages: 1,
                }));
            } finally {
                setIsLoading(false);
            }
        };

        loadCatalog();

        return () => controller.abort();
    }, [limit, page, query]);

    const canGoPrev = page > 1 && !isLoading;
    const canGoNext = page < meta.totalPages && !isLoading;
    const pageNumbers = [];
    const startPage = Math.max(1, meta.page - 2);
    const endPage = Math.min(meta.totalPages, meta.page + 2);

    for (let pageNumber = startPage; pageNumber <= endPage; pageNumber += 1) {
        pageNumbers.push(pageNumber);
    }

    const handleSearchSubmit = (event) => {
        event.preventDefault();
        setPage(1);
        setQuery(searchDraft.trim());
    };

    const handleReset = () => {
        setSearchDraft('');
        setQuery('');
        setLimit(DEFAULT_LIMIT);
        setPage(1);
    };

    return (
        <AuthenticatedLayout>
            <Head title="Library Dashboard" />

            <div className="admin-page-wrap">
                <Card>
                    <CardHeader>
                        <CardTitle>Library Dashboard</CardTitle>
                        <CardDescription>
                            Каталог книг из внешнего API с поиском и пагинацией.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end" onSubmit={handleSearchSubmit}>
                            <div className="flex-1 space-y-1">
                                <label className="text-sm font-medium">Поиск</label>
                                <Input
                                    value={searchDraft}
                                    onChange={(event) => setSearchDraft(event.target.value)}
                                    placeholder="Введите название, автора или ISBN"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-sm font-medium">На странице</label>
                                <select
                                    className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={limit}
                                    onChange={(event) => {
                                        setLimit(Number(event.target.value));
                                        setPage(1);
                                    }}
                                >
                                    {PAGE_SIZE_OPTIONS.map((option) => (
                                        <option key={option} value={option}>
                                            {option}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex gap-2">
                                <Button type="submit" disabled={isLoading}>
                                    Найти
                                </Button>
                                <Button type="button" variant="outline" disabled={isLoading} onClick={handleReset}>
                                    Сбросить
                                </Button>
                            </div>
                        </form>

                        {isLoading && (
                            <p className="text-sm text-muted-foreground">
                                Загрузка каталога...
                            </p>
                        )}

                        {!isLoading && error && (
                            <p className="text-sm text-red-600">
                                {error}
                            </p>
                        )}

                        {!isLoading && !error && (
                            <div className="space-y-4">
                                <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                                    <p>
                                        {query ? `Результатов по запросу «${query}»: ${meta.total}.` : `Всего книг: ${meta.total}.`} Показано: {books.length} на странице.
                                    </p>
                                    <p>
                                        Страница {meta.page} из {meta.totalPages}
                                    </p>
                                </div>

                                <div className="overflow-x-auto rounded-md border">
                                    <table className="w-full min-w-[980px] text-sm">
                                        <thead className="bg-muted/50">
                                            <tr>
                                                <th className="px-3 py-2 text-left font-medium">Название</th>
                                                <th className="px-3 py-2 text-left font-medium">Автор</th>
                                                <th className="px-3 py-2 text-left font-medium">Год</th>
                                                <th className="px-3 py-2 text-left font-medium">ISBN</th>
                                                <th className="px-3 py-2 text-left font-medium">Доступно</th>
                                                <th className="px-3 py-2 text-left font-medium">Всего</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {books.map((book, index) => (
                                                <tr key={book.id ?? `${book.title?.display ?? 'book'}-${book.legacyDocId ?? index}`} className="border-t">
                                                    <td className="px-3 py-2 align-top">{book.title?.display ?? 'Без названия'}</td>
                                                    <td className="px-3 py-2 align-top">{book.primaryAuthor ?? '-'}</td>
                                                    <td className="px-3 py-2 align-top">{book.publicationYear ?? '-'}</td>
                                                    <td className="px-3 py-2 align-top">{book.isbn?.raw ?? '-'}</td>
                                                    <td className="px-3 py-2 align-top">{book.copies?.available ?? 0}</td>
                                                    <td className="px-3 py-2 align-top">{book.copies?.total ?? 0}</td>
                                                </tr>
                                            ))}

                                            {books.length === 0 && (
                                                <tr className="border-t">
                                                    <td className="px-3 py-6 text-center text-muted-foreground" colSpan={6}>
                                                        Книги не найдены.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="flex flex-wrap items-center justify-end gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        disabled={!canGoPrev}
                                        onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
                                    >
                                        Назад
                                    </Button>
                                    {startPage > 1 && (
                                        <>
                                            <Button type="button" variant="outline" onClick={() => setPage(1)} disabled={isLoading}>
                                                1
                                            </Button>
                                            {startPage > 2 && <span className="px-1 text-sm text-muted-foreground">...</span>}
                                        </>
                                    )}
                                    {pageNumbers.map((pageNumber) => (
                                        <Button
                                            key={pageNumber}
                                            type="button"
                                            variant={pageNumber === meta.page ? 'default' : 'outline'}
                                            disabled={isLoading}
                                            onClick={() => setPage(pageNumber)}
                                        >
                                            {pageNumber}
                                        </Button>
                                    ))}
                                    {endPage < meta.totalPages && (
                                        <>
                                            {endPage < meta.totalPages - 1 && <span className="px-1 text-sm text-muted-foreground">...</span>}
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => setPage(meta.totalPages)}
                                                disabled={isLoading}
                                            >
                                                {meta.totalPages}
                                            </Button>
                                        </>
                                    )}
                                    <Button
                                        type="button"
                                        variant="outline"
                                        disabled={!canGoNext}
                                        onClick={() => setPage((currentPage) => Math.min(meta.totalPages, currentPage + 1))}
                                    >
                                        Вперед
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}
