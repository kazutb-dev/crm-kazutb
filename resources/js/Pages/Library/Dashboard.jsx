import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable, ErrorState, FilterBar, LoadingState, PageHeader, StatGrid, StatTile, qdFieldClass } from '@/components/platform';
import { Input } from '@/components/ui/input';
import { Head } from '@inertiajs/react';
import { BookOpen, Layers, Library, Search } from 'lucide-react';
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
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="Библиотека"
                    title="Library Dashboard"
                    description="Каталог книг из внешнего API с поиском и пагинацией."
                />
            )}
        >
            <Head title="Library Dashboard" />

            <div className="admin-page-wrap space-y-6">
                <StatGrid className="xl:grid-cols-3">
                    <StatTile
                        label={query ? 'Найдено книг' : 'Всего книг'}
                        value={isLoading ? '…' : meta.total}
                        tone="teal"
                        icon={Library}
                        hint={query ? `По запросу «${query}»` : 'Во внешнем каталоге'}
                    />
                    <StatTile label="На странице" value={isLoading ? '…' : books.length} tone="navy" icon={BookOpen} />
                    <StatTile label="Страница" value={`${meta.page} / ${meta.totalPages}`} tone="gold" icon={Layers} />
                </StatGrid>

                <FilterBar>
                    <form className="space-y-4" onSubmit={handleSearchSubmit}>
                        <div className="grid gap-x-3 gap-y-4 md:grid-cols-[minmax(0,1fr)_12rem]">
                            <label className="block space-y-2">
                                <span className="qd-field-label block">Поиск</span>
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <Input
                                        value={searchDraft}
                                        onChange={(event) => setSearchDraft(event.target.value)}
                                        placeholder="Введите название, автора или ISBN"
                                        className="pl-9"
                                    />
                                </div>
                            </label>

                            <label className="block space-y-2">
                                <span className="qd-field-label block">На странице</span>
                                <select
                                    className={qdFieldClass}
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
                            </label>
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4">
                            <Button type="submit" disabled={isLoading}>
                                Найти
                            </Button>
                            <Button type="button" variant="outline" disabled={isLoading} onClick={handleReset}>
                                Сбросить
                            </Button>
                        </div>
                    </form>
                </FilterBar>

                {isLoading && (
                    <LoadingState label="Загрузка каталога..." />
                )}

                {!isLoading && error && (
                    <ErrorState title="Не удалось загрузить каталог" description={error} />
                )}

                {!isLoading && !error && (
                    <div className="space-y-4">
                        <div className="flex flex-col gap-2 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
                            <p>
                                {query ? `Результатов по запросу «${query}»: ${meta.total}.` : `Всего книг: ${meta.total}.`} Показано: {books.length} на странице.
                            </p>
                            <p className="tabular-nums">
                                Страница {meta.page} из {meta.totalPages}
                            </p>
                        </div>

                        <DataTable>
                            <table className="w-full min-w-[980px] text-sm">
                                <thead>
                                    <tr>
                                        <th className="px-4 py-3 text-left">Название</th>
                                        <th className="px-4 py-3 text-left">Автор</th>
                                        <th className="px-4 py-3 text-left">Год</th>
                                        <th className="px-4 py-3 text-left">ISBN</th>
                                        <th className="px-4 py-3 text-right">Доступно</th>
                                        <th className="px-4 py-3 text-right">Всего</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {books.map((book, index) => {
                                        const available = book.copies?.available ?? 0;
                                        return (
                                            <tr key={book.id ?? `${book.title?.display ?? 'book'}-${book.legacyDocId ?? index}`} className="border-t border-slate-200 hover:bg-slate-50">
                                                <td className="px-4 py-3 align-top font-medium text-slate-900">{book.title?.display ?? 'Без названия'}</td>
                                                <td className="px-4 py-3 align-top text-slate-700">{book.primaryAuthor ?? '-'}</td>
                                                <td className="px-4 py-3 align-top tabular-nums text-slate-700">{book.publicationYear ?? '-'}</td>
                                                <td className="px-4 py-3 align-top font-mono text-xs text-slate-600">{book.isbn?.raw ?? '-'}</td>
                                                <td className="px-4 py-3 text-right align-top">
                                                    <Badge variant={available > 0 ? 'success' : 'secondary'} className="tabular-nums">{available}</Badge>
                                                </td>
                                                <td className="px-4 py-3 text-right align-top tabular-nums text-slate-700">{book.copies?.total ?? 0}</td>
                                            </tr>
                                        );
                                    })}

                                    {books.length === 0 && (
                                        <tr className="border-t border-slate-200">
                                            <td className="px-4 py-10 text-center text-slate-500" colSpan={6}>
                                                Книги не найдены.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </DataTable>

                        <div className="flex flex-wrap items-center justify-end gap-2">
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={!canGoPrev}
                                onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
                            >
                                Назад
                            </Button>
                            {startPage > 1 && (
                                <>
                                    <Button type="button" size="sm" variant="outline" onClick={() => setPage(1)} disabled={isLoading}>
                                        1
                                    </Button>
                                    {startPage > 2 && <span className="px-1 text-sm text-slate-500">...</span>}
                                </>
                            )}
                            {pageNumbers.map((pageNumber) => (
                                <Button
                                    key={pageNumber}
                                    type="button"
                                    size="sm"
                                    variant={pageNumber === meta.page ? 'default' : 'outline'}
                                    disabled={isLoading}
                                    onClick={() => setPage(pageNumber)}
                                    className="tabular-nums"
                                >
                                    {pageNumber}
                                </Button>
                            ))}
                            {endPage < meta.totalPages && (
                                <>
                                    {endPage < meta.totalPages - 1 && <span className="px-1 text-sm text-slate-500">...</span>}
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setPage(meta.totalPages)}
                                        disabled={isLoading}
                                        className="tabular-nums"
                                    >
                                        {meta.totalPages}
                                    </Button>
                                </>
                            )}
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={!canGoNext}
                                onClick={() => setPage((currentPage) => Math.min(meta.totalPages, currentPage + 1))}
                            >
                                Вперед
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
