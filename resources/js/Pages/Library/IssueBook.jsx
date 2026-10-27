import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { InfoField, LoadingState, Notice, PageHeader } from '@/components/platform';
import { BookOpen, CalendarDays, History, Search, UserRound } from 'lucide-react';
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

    const dropdownClassName = 'absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-[12px] border border-slate-200 bg-white py-1 shadow-[0_12px_32px_-12px_rgba(16,41,69,0.25)]';

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="Библиотека"
                    title="Выдать книгу"
                    description="Найдите книгу в каталоге, выберите пользователя и оформите выдачу."
                />
            )}
        >
            <Head title="Выдать книгу" />

            <div className="admin-page-wrap space-y-6">
                {flash.success && (
                    <Notice tone="success">{flash.success}</Notice>
                )}

                <form className="grid grid-cols-1 gap-6 lg:grid-cols-2" onSubmit={submit}>
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <BookOpen className="h-4 w-4" />
                                Книга и получатель
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            <div className="relative space-y-2">
                                <label className="qd-field-label block">Книга</label>
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <Input
                                        placeholder="Введите название, автора или ISBN"
                                        value={bookQuery}
                                        className="pl-9"
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
                                </div>
                                {bookSearching && <LoadingState label="Поиск книг..." />}
                                {bookDropdownOpen && bookResults.length > 0 && (
                                    <ul className={dropdownClassName}>
                                        {bookResults.map((book) => (
                                            <li
                                                key={book.id}
                                                className={`px-3 py-2 text-sm ${
                                                    (book.copies?.available ?? 0) < 1
                                                        ? 'cursor-not-allowed bg-slate-50 text-slate-400'
                                                        : 'cursor-pointer hover:bg-teal-50'
                                                }`}
                                                onMouseDown={() => selectBook(book)}
                                            >
                                                <div className="font-medium text-slate-900">{book.title?.display ?? 'Без названия'}</div>
                                                <div className="text-xs text-slate-500">
                                                    {book.primaryAuthor ?? 'Автор не указан'}
                                                    {book.isbn?.raw ? ` • ISBN ${book.isbn.raw}` : ''}
                                                    {book.copies?.available !== undefined ? ` • Доступно: ${book.copies.available}` : ''}
                                                    {book.copies?.loaned ? ` • Выдано: ${book.copies.loaned}` : ''}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                {form.errors.book_id && <div className="text-xs text-red-700">{form.errors.book_id}</div>}
                            </div>

                            <SelectionBox icon={BookOpen} title="Выбранная книга" empty="Книга еще не выбрана." filled={Boolean(selectedBook)}>
                                {selectedBook && (
                                    <>
                                        <div className="font-medium text-slate-900">{selectedBook.title?.display}</div>
                                        <div>{selectedBook.primaryAuthor ?? 'Автор не указан'}</div>
                                        <div className="tabular-nums">
                                            ISBN: {selectedBook.isbn?.raw ?? '-'} • Доступно: {selectedBook.copies?.available ?? 0}
                                            {selectedBook.copies?.loaned ? ` • Выдано: ${selectedBook.copies.loaned}` : ''}
                                        </div>
                                    </>
                                )}
                            </SelectionBox>

                            <div className="relative space-y-2 border-t border-slate-200 pt-5">
                                <label className="qd-field-label block">Пользователь</label>
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <Input
                                        placeholder="Введите имя, логин или email"
                                        value={userQuery}
                                        className="pl-9"
                                        onChange={(event) => {
                                            setUserQuery(event.target.value);
                                            setSelectedUser(null);
                                            form.setData('user_id', '');
                                            searchUsers(event.target.value);
                                        }}
                                        onBlur={() => setTimeout(() => setUserDropdownOpen(false), 200)}
                                        autoComplete="off"
                                    />
                                </div>
                                {userSearching && <LoadingState label="Поиск пользователей..." />}
                                {userDropdownOpen && userResults.length > 0 && (
                                    <ul className={dropdownClassName}>
                                        {userResults.map((user) => (
                                            <li
                                                key={user.id}
                                                className="cursor-pointer px-3 py-2 text-sm hover:bg-teal-50"
                                                onMouseDown={() => selectUser(user)}
                                            >
                                                <div className="font-medium text-slate-900">{user.name}</div>
                                                <div className="text-xs text-slate-500">
                                                    {user.ad_login ?? 'без логина'}
                                                    {user.department ? ` • ${user.department}` : ''}
                                                    {user.email ? ` • ${user.email}` : ''}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                {form.errors.user_id && <div className="text-xs text-red-700">{form.errors.user_id}</div>}
                            </div>

                            <SelectionBox icon={UserRound} title="Получатель книги" empty="Пользователь еще не выбран." filled={Boolean(selectedUser)}>
                                {selectedUser && (
                                    <>
                                        <div className="font-medium text-slate-900">{selectedUser.name}</div>
                                        <div>{selectedUser.department ?? 'Подразделение не указано'}</div>
                                        <div>{selectedUser.email ?? 'Email не указан'}</div>
                                    </>
                                )}
                            </SelectionBox>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <CalendarDays className="h-4 w-4" />
                                Сроки и итог
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <label className="qd-field-label block">Дата выдачи</label>
                                    <Input
                                        type="date"
                                        value={form.data.issued_at}
                                        onChange={(event) => form.setData('issued_at', event.target.value)}
                                    />
                                    {form.errors.issued_at && <div className="text-xs text-red-700">{form.errors.issued_at}</div>}
                                </div>

                                <div className="space-y-2">
                                    <label className="qd-field-label block">Вернуть до</label>
                                    <Input
                                        type="date"
                                        value={form.data.due_at}
                                        onChange={(event) => form.setData('due_at', event.target.value)}
                                    />
                                    {form.errors.due_at && <div className="text-xs text-red-700">{form.errors.due_at}</div>}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="qd-field-label block">Примечание</label>
                                <Textarea
                                    className="min-h-32"
                                    value={form.data.notes}
                                    onChange={(event) => form.setData('notes', event.target.value)}
                                    placeholder="Например: выдача для работы в читальном зале"
                                />
                                {form.errors.notes && <div className="text-xs text-red-700">{form.errors.notes}</div>}
                            </div>

                            <div className="space-y-3 border-t border-slate-200 pt-5">
                                <p className="qd-field-label text-[#102945]">Итог выдачи</p>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <InfoField label="Книга">{form.data.book_title || 'не выбрана'}</InfoField>
                                    <InfoField label="Получатель">{selectedUser?.name || 'не выбран'}</InfoField>
                                    <InfoField label="Дата выдачи"><span className="tabular-nums">{form.data.issued_at || '-'}</span></InfoField>
                                    <InfoField label="Вернуть до"><span className="tabular-nums">{form.data.due_at || '-'}</span></InfoField>
                                </div>
                            </div>

                            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-5">
                                <Button type="button" variant="outline" disabled={form.processing} onClick={resetForm}>
                                    Очистить
                                </Button>
                                <Button type="submit" disabled={form.processing || !selectedBook || !selectedUser}>
                                    {form.processing ? 'Сохраняем...' : 'Оформить выдачу'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </form>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <History className="h-4 w-4" />
                            Последние выдачи
                        </CardTitle>
                        <CardDescription>
                            Недавно оформленные выдачи книг из локальной базы приложения.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[760px] text-sm">
                                <thead>
                                    <tr>
                                        <th className="text-left">Книга</th>
                                        <th className="text-left">Пользователь</th>
                                        <th className="text-left">Дата выдачи</th>
                                        <th className="text-left">Вернуть до</th>
                                        <th className="text-left">Оформил</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentLoans.map((loan) => (
                                        <tr key={loan.id} className="hover:bg-slate-50">
                                            <td className="align-top">
                                                <div className="font-medium text-slate-900">{loan.book_title}</div>
                                                <div className="text-xs text-slate-500">{loan.book_author ?? 'Автор не указан'}</div>
                                            </td>
                                            <td className="align-top">
                                                <div className="text-slate-900">{loan.user?.name ?? '-'}</div>
                                                <div className="text-xs text-slate-500">{loan.user?.department ?? loan.user?.email ?? '-'}</div>
                                            </td>
                                            <td className="align-top tabular-nums text-slate-700">{loan.issued_at ?? '-'}</td>
                                            <td className="align-top tabular-nums text-slate-700">{loan.due_at ?? '-'}</td>
                                            <td className="align-top text-slate-700">{loan.issuer ?? '-'}</td>
                                        </tr>
                                    ))}

                                    {recentLoans.length === 0 && (
                                        <tr>
                                            <td className="py-12 text-center text-slate-500" colSpan={5}>
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

function SelectionBox({ icon: Icon, title, empty, filled, children }) {
    return (
        <div className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${filled ? 'border-teal-200 bg-teal-50' : 'border-dashed border-slate-300 bg-white'}`}>
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${filled ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-500'}`}>
                <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
                <div className="qd-field-label text-slate-500">{title}</div>
                {filled ? (
                    <div className="mt-1.5 space-y-0.5 text-slate-600">{children}</div>
                ) : (
                    <div className="mt-1.5 text-slate-500">{empty}</div>
                )}
            </div>
        </div>
    );
}
