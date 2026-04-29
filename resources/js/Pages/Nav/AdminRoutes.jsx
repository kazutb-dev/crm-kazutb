import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { useCallback, useMemo, useRef, useState } from 'react';

const emptyForm = {
    badge: '',
    title: '',
    meta: '',
    kind: 'cabinet',
    building: '',
    floor: '',
    room: '',
    steps_text: '',
    map_image_path: '',
    is_active: true,
    sort_order: 0,
};

export default function AdminRoutes({ navigationRoutes }) {
    const items = navigationRoutes?.data ?? [];
    const links = navigationRoutes?.links ?? [];
    const flash = usePage().props.flash ?? {};

    const [editingId, setEditingId] = useState(null);
    const form = useForm(emptyForm);

    const [userQuery, setUserQuery] = useState('');
    const [userResults, setUserResults] = useState([]);
    const [userSearching, setUserSearching] = useState(false);
    const [userDropdownOpen, setUserDropdownOpen] = useState(false);
    const userSearchTimer = useRef(null);

    const getCsrfToken = () =>
        decodeURIComponent(document.cookie.match(/XSRF-TOKEN=([^;]+)/)?.[1] ?? '');

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
                const res = await fetch(
                    `/admin/users/search?q=${encodeURIComponent(query)}&per_page=20`,
                    {
                        headers: {
                            Accept: 'application/json',
                            'X-XSRF-TOKEN': getCsrfToken(),
                        },
                        credentials: 'include',
                    },
                );
                if (res.ok) {
                    const data = await res.json();
                    setUserResults(data.data ?? []);
                    setUserDropdownOpen(true);
                }
            } finally {
                setUserSearching(false);
            }
        }, 300);
    }, []);

    const selectUser = (user) => {
        form.setData({
            ...form.data,
            title: user.name,
            badge: (user.ad_login ?? user.name).slice(0, 6).toUpperCase(),
        });
        setUserQuery(user.name);
        setUserDropdownOpen(false);
        setUserResults([]);
    };

    const editingItem = useMemo(
        () => items.find((item) => item.id === editingId) ?? null,
        [editingId, items],
    );

    const submit = (event) => {
        event.preventDefault();

        if (editingId) {
            form.patch(route('nav.routes.update', editingId), {
                preserveScroll: true,
                onSuccess: () => {
                    setEditingId(null);
                    form.reset();
                },
            });
            return;
        }

        form.post(route('nav.routes.store'), {
            preserveScroll: true,
            onSuccess: () => form.reset(),
        });
    };

    const startEdit = (item) => {
        setEditingId(item.id);
        setUserQuery(item.kind === 'staff' ? (item.title ?? '') : '');
        setUserResults([]);
        form.setData({
            badge: item.badge ?? '',
            title: item.title ?? '',
            meta: item.meta ?? '',
            kind: item.kind ?? 'cabinet',
            building: item.building ?? '',
            floor: item.floor ?? '',
            room: item.room ?? '',
            steps_text: Array.isArray(item.steps) ? item.steps.join('\n') : '',
            map_image_path: item.map_image_path ?? '',
            is_active: Boolean(item.is_active),
            sort_order: item.sort_order ?? 0,
        });
    };

    const stopEdit = () => {
        setEditingId(null);
        setUserQuery('');
        setUserResults([]);
        form.reset();
    };

    const removeItem = (id) => {
        if (!window.confirm('Удалить маршрут?')) {
            return;
        }

        router.delete(route('nav.routes.destroy', id), {
            preserveScroll: true,
        });
    };

    return (
        <AuthenticatedLayout>
            <Head title="Заполнение маршрутов" />

            <div className="p-4 sm:p-6 lg:p-8 space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Заполнение маршрутов</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {flash.success && (
                            <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                                {flash.success}
                            </div>
                        )}

                        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="mb-1 block text-sm font-medium">Badge</label>
                                <input
                                    className="w-full rounded-md border px-3 py-2"
                                    value={form.data.badge}
                                    onChange={(event) => form.setData('badge', event.target.value)}
                                />
                                {form.errors.badge && <div className="mt-1 text-xs text-red-600">{form.errors.badge}</div>}
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium">Тип точки</label>
                                <select
                                    className="w-full rounded-md border px-3 py-2"
                                    value={form.data.kind}
                                    onChange={(event) => {
                                        form.setData('kind', event.target.value);
                                        if (event.target.value !== 'staff') {
                                            setUserQuery('');
                                            setUserResults([]);
                                            setUserDropdownOpen(false);
                                        }
                                    }}
                                >
                                    <option value="cabinet">Кабинет</option>
                                    <option value="staff">Сотрудник</option>
                                    <option value="department">Отдел</option>
                                </select>
                            </div>

                            {form.data.kind === 'staff' && (
                                <div className="md:col-span-2 relative">
                                    <label className="mb-1 block text-sm font-medium">Поиск сотрудника</label>
                                    <input
                                        className="w-full rounded-md border px-3 py-2"
                                        placeholder="Введите имя или логин..."
                                        value={userQuery}
                                        onChange={(event) => {
                                            setUserQuery(event.target.value);
                                            searchUsers(event.target.value);
                                        }}
                                        onBlur={() => setTimeout(() => setUserDropdownOpen(false), 200)}
                                        autoComplete="off"
                                    />
                                    {userSearching && (
                                        <div className="mt-1 text-xs text-muted-foreground">Поиск...</div>
                                    )}
                                    {userDropdownOpen && userResults.length > 0 && (
                                        <ul className="absolute z-50 mt-1 w-full rounded-md border bg-white shadow-lg max-h-52 overflow-auto">
                                            {userResults.map((user) => (
                                                <li
                                                    key={user.id}
                                                    className="cursor-pointer px-3 py-2 text-sm hover:bg-gray-100"
                                                    onMouseDown={() => selectUser(user)}
                                                >
                                                    <span className="font-medium">{user.name}</span>
                                                    {user.ad_login && (
                                                        <span className="ml-2 text-xs text-muted-foreground">{user.ad_login}</span>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                    <div className="mt-1 text-xs text-muted-foreground">
                                        Выберите сотрудника — поля Название и Badge заполнятся автоматически.
                                    </div>
                                </div>
                            )}

                            <div className="md:col-span-2">
                                <label className="mb-1 block text-sm font-medium">Название</label>
                                <input
                                    className="w-full rounded-md border px-3 py-2"
                                    value={form.data.title}
                                    onChange={(event) => form.setData('title', event.target.value)}
                                />
                                {form.errors.title && <div className="mt-1 text-xs text-red-600">{form.errors.title}</div>}
                            </div>

                            <div className="md:col-span-2">
                                <label className="mb-1 block text-sm font-medium">Meta (пример: 2 корпус • 3 этаж)</label>
                                <input
                                    className="w-full rounded-md border px-3 py-2"
                                    value={form.data.meta}
                                    onChange={(event) => form.setData('meta', event.target.value)}
                                />
                                {form.errors.meta && <div className="mt-1 text-xs text-red-600">{form.errors.meta}</div>}
                                <div className="mt-1 text-xs text-muted-foreground">
                                    Если оставить пустым, заполнится автоматически из полей Корпус и Этаж.
                                </div>
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium">Корпус</label>
                                <input
                                    className="w-full rounded-md border px-3 py-2"
                                    value={form.data.building}
                                    onChange={(event) => form.setData('building', event.target.value)}
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium">Этаж</label>
                                <input
                                    type="number"
                                    className="w-full rounded-md border px-3 py-2"
                                    value={form.data.floor}
                                    onChange={(event) => form.setData('floor', event.target.value)}
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium">Кабинет</label>
                                <input
                                    className="w-full rounded-md border px-3 py-2"
                                    value={form.data.room}
                                    onChange={(event) => form.setData('room', event.target.value)}
                                />
                                {form.errors.room && <div className="mt-1 text-xs text-red-600">{form.errors.room}</div>}
                                {(form.data.kind === 'staff' || form.data.kind === 'cabinet') && (
                                    <div className="mt-1 text-xs text-muted-foreground">
                                        Для типа "Сотрудник" и "Кабинет" поле обязательно.
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium">Порядок сортировки</label>
                                <input
                                    type="number"
                                    className="w-full rounded-md border px-3 py-2"
                                    value={form.data.sort_order}
                                    onChange={(event) => form.setData('sort_order', event.target.value)}
                                />
                            </div>

                            <div className="md:col-span-2">
                                <label className="mb-1 block text-sm font-medium">Шаги маршрута (каждый шаг с новой строки)</label>
                                <textarea
                                    className="w-full rounded-md border px-3 py-2 min-h-[140px]"
                                    value={form.data.steps_text}
                                    onChange={(event) => form.setData('steps_text', event.target.value)}
                                />
                                {form.errors.steps_text && <div className="mt-1 text-xs text-red-600">{form.errors.steps_text}</div>}
                            </div>

                            <div className="md:col-span-2 flex items-center gap-3">
                                <label className="inline-flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={Boolean(form.data.is_active)}
                                        onChange={(event) => form.setData('is_active', event.target.checked)}
                                    />
                                    Активен
                                </label>
                            </div>

                            <div className="md:col-span-2 flex gap-2">
                                <Button type="submit" disabled={form.processing}>
                                    {editingId ? 'Сохранить изменения' : 'Добавить маршрут'}
                                </Button>
                                {editingId && (
                                    <Button type="button" variant="outline" onClick={stopEdit}>
                                        Отменить редактирование
                                    </Button>
                                )}
                            </div>
                        </form>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Список маршрутов</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {items.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Маршрутов пока нет.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[980px] text-sm">
                                    <thead>
                                        <tr className="border-b text-left text-muted-foreground">
                                            <th className="py-3 pe-3 font-medium">ID</th>
                                            <th className="py-3 pe-3 font-medium">Badge</th>
                                            <th className="py-3 pe-3 font-medium">Название</th>
                                            <th className="py-3 pe-3 font-medium">Тип</th>
                                            <th className="py-3 pe-3 font-medium">Meta</th>
                                            <th className="py-3 pe-3 font-medium">Шаги</th>
                                            <th className="py-3 pe-3 font-medium">Статус</th>
                                            <th className="py-3 pe-3 font-medium">Действия</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((item) => (
                                            <tr key={item.id} className="border-b align-top">
                                                <td className="py-3 pe-3">#{item.id}</td>
                                                <td className="py-3 pe-3">{item.badge}</td>
                                                <td className="py-3 pe-3 font-medium">{item.title}</td>
                                                <td className="py-3 pe-3">{item.kind}</td>
                                                <td className="py-3 pe-3 text-muted-foreground">{item.meta}</td>
                                                <td className="py-3 pe-3 text-muted-foreground whitespace-pre-line">
                                                    {Array.isArray(item.steps) && item.steps.length > 0
                                                        ? item.steps.slice(0, 2).map((step, idx) => `${idx + 1}. ${step}`).join('\n')
                                                        : 'Нет шагов'}
                                                </td>
                                                <td className="py-3 pe-3">
                                                    <Badge variant={item.is_active ? 'default' : 'outline'}>
                                                        {item.is_active ? 'Активен' : 'Скрыт'}
                                                    </Badge>
                                                </td>
                                                <td className="py-3 pe-3">
                                                    <div className="flex gap-2">
                                                        <Button size="sm" variant="outline" type="button" onClick={() => startEdit(item)}>
                                                            Изменить
                                                        </Button>
                                                        <Button size="sm" variant="destructive" type="button" onClick={() => removeItem(item.id)}>
                                                            Удалить
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {links.length > 3 && (
                            <div className="mt-6 flex flex-wrap gap-2">
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
