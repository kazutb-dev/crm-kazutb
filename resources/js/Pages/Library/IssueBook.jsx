import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Head, useForm, usePage } from '@inertiajs/react';
import { useCallback, useRef, useState } from 'react';

function formatDate(date) {
    return date.toISOString().slice(0, 10);
}

function buildDefaultDueDate() {
    const date = new Date();
    date.setDate(date.getDate() + 14);

    return formatDate(date);
}

function getCsrfToken() {
    return decodeURIComponent(document.cookie.match(/XSRF-TOKEN=([^;]+)/)?.[1] ?? '');
}

export default function IssueBook({ recentLoans = [] }) {
    const flash = usePage().props.flash ?? {};
    const form = useForm({
        book_id: '',
        book_legacy_doc_id: '',
        book_title: '',
        book_author: '',
        book_isbn: '',
        user_id: '',
        issued_at: formatDate(new Date()),
        due_at: buildDefaultDueDate(),
        notes: '',
    });

    const [bookQuery, setBookQuery] = useState('');
    const [bookResults, setBookResults] = useState([]);
    const [bookSearching, setBookSearching] = useState(false);
    const [bookDropdownOpen, setBookDropdownOpen] = useState(false);
    const [selectedBook, setSelectedBook] = useState(null);
    const [userQuery, setUserQuery] = useState('');
    const [userResults, setUserResults] = useState([]);
    const [userSearching, setUserSearching] = useState(false);
    const [userDropdownOpen, setUserDropdownOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const bookSearchTimer = useRef(null);
    const userSearchTimer = useRef(null);

    const resetForm = () => {
        form.reset();
        form.setData('issued_at', formatDate(new Date()));
        form.setData('due_at', buildDefaultDueDate());
        setBookQuery('');
        setBookResults([]);
        setBookDropdownOpen(false);
        setSelectedBook(null);
        setUserQuery('');
        setUserResults([]);
        setUserDropdownOpen(false);
        setSelectedUser(null);
    };

    const searchBooks = useCallback((query) => {
        clearTimeout(bookSearchTimer.current);

        if (query.trim().length < 2) {
            setBookResults([]);
            setBookDropdownOpen(false);
            return;
        }

        bookSearchTimer.current = setTimeout(async () => {
            setBookSearching(true);

            try {
                const response = await fetch(
                    `${route('library.catalog')}?q=${encodeURIComponent(query)}&page=1&limit=10`,
                    {
                        headers: {
                            Accept: 'application/json',
                            'X-XSRF-TOKEN': getCsrfToken(),
                        },
                        credentials: 'include',
                    },
                );

                if (!response.ok) {
                    return;
                }

                const payload = await response.json();
                setBookResults(payload.data ?? []);
                setBookDropdownOpen(true);
            } finally {
                setBookSearching(false);
            }
        }, 300);
    }, []);

    const searchUsers = useCallback((query) => {
        clearTimeout(userSearchTimer.current);

        if (query.trim().length < 2) {
            setUserResults([]);
            setUserDropdownOpen(false);
            return;
        }

        userSearchTimer.current = setTimeout(async () => {
            setUserSearching(true);

            try {
                const response = await fetch(
                    `${route('library.users.search')}?q=${encodeURIComponent(query)}&per_page=10`,
                    {
                        headers: {
                            Accept: 'application/json',
                            'X-XSRF-TOKEN': getCsrfToken(),
                        },
                        credentials: 'include',
                    },
                );

                if (!response.ok) {
                    return;
                }

                const payload = await response.json();
                setUserResults(payload.data ?? []);
                setUserDropdownOpen(true);
            } finally {
                setUserSearching(false);
            }
        }, 300);
    }, []);

    const selectBook = (book) => {
        if ((book.copies?.available ?? 0) < 1) {
            return;
        }

        setSelectedBook(book);
        setBookQuery(book.title?.display ?? '');
        setBookResults([]);
        setBookDropdownOpen(false);
        form.setData((currentData) => ({
            ...currentData,
            book_id: book.id ?? '',
            book_legacy_doc_id: book.legacyDocId ?? '',
            book_title: book.title?.display ?? '',
            book_author: book.primaryAuthor ?? '',
            book_isbn: book.isbn?.raw ?? '',
        }));
    };

    const selectUser = (user) => {
        setSelectedUser(user);
        setUserQuery(user.name ?? '');
        setUserResults([]);
        setUserDropdownOpen(false);
        form.setData('user_id', user.id ?? '');
    };

    const submit = (event) => {
        event.preventDefault();

        form.post(route('library.issue-book.store'), {
            preserveScroll: true,
            onSuccess: () => resetForm(),
        });
    };

    return (
        <AuthenticatedLayout>
            <Head title="Выдать книгу" />

            <div className="space-y-6 p-4 sm:p-6 lg:p-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Выдать книгу</CardTitle>
                        <CardDescription>
                            Найдите книгу в каталоге, выберите пользователя и оформите выдачу.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {flash.success && (
                            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                                {flash.success}
                            </div>
                        )}

                        <form className="grid grid-cols-1 gap-6 lg:grid-cols-2" onSubmit={submit}>
                            <div className="space-y-4">
                                <div className="relative">
                                    <label className="mb-1 block text-sm font-medium">Книга</label>
                                    <Input
                                        placeholder="Введите название, автора или ISBN"
                                        value={bookQuery}
                                        onChange={(event) => {
                                            setBookQuery(event.target.value);
                                            setSelectedBook(null);
                                            form.setData((currentData) => ({
                                                ...currentData,
                                                book_id: '',
                                                book_legacy_doc_id: '',
                                                book_title: '',
                                                book_author: '',
                                                book_isbn: '',
                                            }));
                                            searchBooks(event.target.value);
                                        }}
                                        onBlur={() => setTimeout(() => setBookDropdownOpen(false), 200)}
                                        autoComplete="off"
                                    />
                                    {bookSearching && <div className="mt-1 text-xs text-muted-foreground">Поиск книг...</div>}
                                    {bookDropdownOpen && bookResults.length > 0 && (
                                        <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-white shadow-lg">
                                            {bookResults.map((book) => (
                                                <li
                                                    key={book.id}
                                                    className={`px-3 py-2 text-sm ${
                                                        (book.copies?.available ?? 0) < 1
                                                            ? 'cursor-not-allowed bg-slate-50 text-slate-400'
                                                            : 'cursor-pointer hover:bg-slate-100'
                                                    }`}
                                                    onMouseDown={() => selectBook(book)}
                                                >
                                                    <div className="font-medium">{book.title?.display ?? 'Без названия'}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {book.primaryAuthor ?? 'Автор не указан'}
                                                        {book.isbn?.raw ? ` • ISBN ${book.isbn.raw}` : ''}
                                                        {book.copies?.available !== undefined ? ` • Доступно: ${book.copies.available}` : ''}
                                                        {book.copies?.loaned ? ` • Выдано: ${book.copies.loaned}` : ''}
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                    {form.errors.book_id && <div className="mt-1 text-xs text-red-600">{form.errors.book_id}</div>}
                                </div>

                                <div className="rounded-md border bg-slate-50 p-4 text-sm">
                                    <div className="font-medium">Выбранная книга</div>
                                    {selectedBook ? (
                                        <div className="mt-2 space-y-1 text-muted-foreground">
                                            <div>{selectedBook.title?.display}</div>
                                            <div>{selectedBook.primaryAuthor ?? 'Автор не указан'}</div>
                                            <div>
                                                ISBN: {selectedBook.isbn?.raw ?? '-'} • Доступно: {selectedBook.copies?.available ?? 0}
                                                {selectedBook.copies?.loaned ? ` • Выдано: ${selectedBook.copies.loaned}` : ''}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="mt-2 text-muted-foreground">Книга еще не выбрана.</div>
                                    )}
                                </div>

                                <div className="relative">
                                    <label className="mb-1 block text-sm font-medium">Пользователь</label>
                                    <Input
                                        placeholder="Введите имя, логин или email"
                                        value={userQuery}
                                        onChange={(event) => {
                                            setUserQuery(event.target.value);
                                            setSelectedUser(null);
                                            form.setData('user_id', '');
                                            searchUsers(event.target.value);
                                        }}
                                        onBlur={() => setTimeout(() => setUserDropdownOpen(false), 200)}
                                        autoComplete="off"
                                    />
                                    {userSearching && <div className="mt-1 text-xs text-muted-foreground">Поиск пользователей...</div>}
                                    {userDropdownOpen && userResults.length > 0 && (
                                        <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-white shadow-lg">
                                            {userResults.map((user) => (
                                                <li
                                                    key={user.id}
                                                    className="cursor-pointer px-3 py-2 text-sm hover:bg-slate-100"
                                                    onMouseDown={() => selectUser(user)}
                                                >
                                                    <div className="font-medium">{user.name}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {user.ad_login ?? 'без логина'}
                                                        {user.department ? ` • ${user.department}` : ''}
                                                        {user.email ? ` • ${user.email}` : ''}
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                    {form.errors.user_id && <div className="mt-1 text-xs text-red-600">{form.errors.user_id}</div>}
                                </div>

                                <div className="rounded-md border bg-slate-50 p-4 text-sm">
                                    <div className="font-medium">Получатель книги</div>
                                    {selectedUser ? (
                                        <div className="mt-2 space-y-1 text-muted-foreground">
                                            <div>{selectedUser.name}</div>
                                            <div>{selectedUser.department ?? 'Подразделение не указано'}</div>
                                            <div>{selectedUser.email ?? 'Email не указан'}</div>
                                        </div>
                                    ) : (
                                        <div className="mt-2 text-muted-foreground">Пользователь еще не выбран.</div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div>
                                        <label className="mb-1 block text-sm font-medium">Дата выдачи</label>
                                        <Input
                                            type="date"
                                            value={form.data.issued_at}
                                            onChange={(event) => form.setData('issued_at', event.target.value)}
                                        />
                                        {form.errors.issued_at && <div className="mt-1 text-xs text-red-600">{form.errors.issued_at}</div>}
                                    </div>

                                    <div>
                                        <label className="mb-1 block text-sm font-medium">Вернуть до</label>
                                        <Input
                                            type="date"
                                            value={form.data.due_at}
                                            onChange={(event) => form.setData('due_at', event.target.value)}
                                        />
                                        {form.errors.due_at && <div className="mt-1 text-xs text-red-600">{form.errors.due_at}</div>}
                                    </div>
                                </div>

                                <div>
                                    <label className="mb-1 block text-sm font-medium">Примечание</label>
                                    <textarea
                                        className="min-h-32 w-full rounded-md border px-3 py-2 text-sm"
                                        value={form.data.notes}
                                        onChange={(event) => form.setData('notes', event.target.value)}
                                        placeholder="Например: выдача для работы в читальном зале"
                                    />
                                    {form.errors.notes && <div className="mt-1 text-xs text-red-600">{form.errors.notes}</div>}
                                </div>

                                <div className="rounded-md border p-4 text-sm">
                                    <div className="font-medium">Итог выдачи</div>
                                    <div className="mt-2 space-y-1 text-muted-foreground">
                                        <div>Книга: {form.data.book_title || 'не выбрана'}</div>
                                        <div>Получатель: {selectedUser?.name || 'не выбран'}</div>
                                        <div>Дата выдачи: {form.data.issued_at || '-'}</div>
                                        <div>Вернуть до: {form.data.due_at || '-'}</div>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <Button type="submit" disabled={form.processing || !selectedBook || !selectedUser}>
                                        {form.processing ? 'Сохраняем...' : 'Оформить выдачу'}
                                    </Button>
                                    <Button type="button" variant="outline" disabled={form.processing} onClick={resetForm}>
                                        Очистить
                                    </Button>
                                </div>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Последние выдачи</CardTitle>
                        <CardDescription>
                            Недавно оформленные выдачи книг из локальной базы приложения.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto rounded-md border">
                            <table className="w-full min-w-[980px] text-sm">
                                <thead className="bg-muted/50">
                                    <tr>
                                        <th className="px-3 py-2 text-left font-medium">Книга</th>
                                        <th className="px-3 py-2 text-left font-medium">Пользователь</th>
                                        <th className="px-3 py-2 text-left font-medium">Дата выдачи</th>
                                        <th className="px-3 py-2 text-left font-medium">Вернуть до</th>
                                        <th className="px-3 py-2 text-left font-medium">Оформил</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentLoans.map((loan) => (
                                        <tr key={loan.id} className="border-t">
                                            <td className="px-3 py-2 align-top">
                                                <div className="font-medium">{loan.book_title}</div>
                                                <div className="text-xs text-muted-foreground">{loan.book_author ?? 'Автор не указан'}</div>
                                            </td>
                                            <td className="px-3 py-2 align-top">
                                                <div>{loan.user?.name ?? '-'}</div>
                                                <div className="text-xs text-muted-foreground">{loan.user?.department ?? loan.user?.email ?? '-'}</div>
                                            </td>
                                            <td className="px-3 py-2 align-top">{loan.issued_at ?? '-'}</td>
                                            <td className="px-3 py-2 align-top">{loan.due_at ?? '-'}</td>
                                            <td className="px-3 py-2 align-top">{loan.issuer ?? '-'}</td>
                                        </tr>
                                    ))}

                                    {recentLoans.length === 0 && (
                                        <tr className="border-t">
                                            <td className="px-3 py-6 text-center text-muted-foreground" colSpan={5}>
                                                Выдач пока нет.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}
