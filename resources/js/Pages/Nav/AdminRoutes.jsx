import { ConfirmDialog } from '@/components/ConfirmDialog';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const emptyForm = {
    badge: '',
    title: '',
    meta: '',
    kind: 'cabinet',
    building: '',
    floor: '',
    room: '',
    steps_text: '',
    map_polyline_text: '',
    attached_user_ids: [],
    map_image: null,
    map_image_path: '',
    is_active: true,
    sort_order: 0,
};

const parsePolylineText = (text) => {
    if (!text || typeof text !== 'string') {
        return [];
    }

    return text
        .split(/\r\n|\r|\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => {
            const parts = line.split(',').map((part) => part.trim());
            if (parts.length < 2) {
                return null;
            }

            const x = Number(parts[0]);
            const y = Number(parts[1]);

            if (!Number.isFinite(x) || !Number.isFinite(y)) {
                return null;
            }

            if (x < 0 || x > 100 || y < 0 || y > 100) {
                return null;
            }

            return { x, y };
        })
        .filter((point) => point !== null);
};

const polylinePointsToText = (points) => points
    .map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join('\n');

const buildSmoothPath = (points) => {
    if (!Array.isArray(points) || points.length === 0) {
        return '';
    }

    if (points.length === 1) {
        return `M ${points[0].x} ${points[0].y}`;
    }

    if (points.length === 2) {
        return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
    }

    const pathParts = [`M ${points[0].x} ${points[0].y}`];

    for (let index = 1; index < points.length - 1; index += 1) {
        const current = points[index];
        const next = points[index + 1];
        const midX = (current.x + next.x) / 2;
        const midY = (current.y + next.y) / 2;
        pathParts.push(`Q ${current.x} ${current.y}, ${midX} ${midY}`);
    }

    const lastIndex = points.length - 1;
    pathParts.push(`Q ${points[lastIndex - 1].x} ${points[lastIndex - 1].y}, ${points[lastIndex].x} ${points[lastIndex].y}`);

    return pathParts.join(' ');
};

export default function AdminRoutes({ navigationRoutes }) {
    const items = navigationRoutes?.data ?? [];
    const links = navigationRoutes?.links ?? [];
    const flash = usePage().props.flash ?? {};

    const [confirmState, setConfirmState] = useState({ open: false, description: '', onConfirm: null });
    const [editingId, setEditingId] = useState(null);
    const form = useForm(emptyForm);

    const [userQuery, setUserQuery] = useState('');
    const [userResults, setUserResults] = useState([]);
    const [userSearching, setUserSearching] = useState(false);
    const [userDropdownOpen, setUserDropdownOpen] = useState(false);
    const [attachedUsers, setAttachedUsers] = useState([]);
    const [localMapPreviewUrl, setLocalMapPreviewUrl] = useState(null);
    const userSearchTimer = useRef(null);
    const mapEditorRef = useRef(null);
    const hasErrors = Object.keys(form.errors ?? {}).length > 0;

    const editorPoints = useMemo(
        () => parsePolylineText(form.data.map_polyline_text),
        [form.data.map_polyline_text],
    );

    const editorPathD = useMemo(() => buildSmoothPath(editorPoints), [editorPoints]);
    const editorStartPoint = editorPoints.length > 0 ? editorPoints[0] : null;
    const editorFinishPoint = editorPoints.length > 1 ? editorPoints[editorPoints.length - 1] : null;

    useEffect(() => {
        if (!(form.data.map_image instanceof File)) {
            setLocalMapPreviewUrl(null);
            return;
        }

        const objectUrl = URL.createObjectURL(form.data.map_image);
        setLocalMapPreviewUrl(objectUrl);

        return () => {
            URL.revokeObjectURL(objectUrl);
        };
    }, [form.data.map_image]);

    const mapPreviewUrl = useMemo(() => {
        if (localMapPreviewUrl) {
            return localMapPreviewUrl;
        }

        const value = String(form.data.map_image_path ?? '').trim();
        if (value === '') {
            return null;
        }

        if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/') || value.startsWith('data:')) {
            return value;
        }

        return `/${value}`;
    }, [form.data.map_image_path, localMapPreviewUrl]);

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

    const attachUserToCabinet = (user) => {
        setAttachedUsers((prev) => {
            if (prev.some((item) => item.id === user.id)) {
                return prev;
            }

            const next = [...prev, user];
            form.setData('attached_user_ids', next.map((item) => item.id));
            return next;
        });

        setUserQuery('');
        setUserDropdownOpen(false);
        setUserResults([]);
    };

    const removeAttachedUser = (userId) => {
        setAttachedUsers((prev) => {
            const next = prev.filter((item) => item.id !== userId);
            form.setData('attached_user_ids', next.map((item) => item.id));
            return next;
        });
    };

    const addPointByMapClick = (event) => {
        if (!mapEditorRef.current) {
            return;
        }

        const rect = mapEditorRef.current.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
            return;
        }

        const x = ((event.clientX - rect.left) / rect.width) * 100;
        const y = ((event.clientY - rect.top) / rect.height) * 100;

        const clampedX = Math.max(0, Math.min(100, x));
        const clampedY = Math.max(0, Math.min(100, y));

        const nextPoints = [
            ...editorPoints,
            {
                x: clampedX,
                y: clampedY,
            },
        ];

        form.setData('map_polyline_text', polylinePointsToText(nextPoints));
    };

    const removeLastPoint = () => {
        if (editorPoints.length === 0) {
            return;
        }

        form.setData('map_polyline_text', polylinePointsToText(editorPoints.slice(0, -1)));
    };

    const clearAllPoints = () => {
        form.setData('map_polyline_text', '');
    };

    const editingItem = useMemo(
        () => items.find((item) => item.id === editingId) ?? null,
        [editingId, items],
    );

    const submit = (event) => {
        event.preventDefault();

        if (editingId) {
            form.transform((data) => ({
                ...data,
                _method: 'patch',
            }));

            form.post(route('nav.routes.update', editingId), {
                preserveScroll: true,
                forceFormData: true,
                onSuccess: () => {
                    setEditingId(null);
                    setAttachedUsers([]);
                    setUserQuery('');
                    setUserResults([]);
                    setUserDropdownOpen(false);
                    form.reset();
                },
                onFinish: () => {
                    form.transform((data) => data);
                },
            });

            return;
        }

        form.post(route('nav.routes.store'), {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => {
                setAttachedUsers([]);
                setUserQuery('');
                setUserResults([]);
                setUserDropdownOpen(false);
                form.reset();
            },
        });
    };

    const startEdit = (item) => {
        setEditingId(item.id);
        setUserQuery(item.kind === 'staff' ? (item.title ?? '') : '');
        setUserResults([]);
        setUserDropdownOpen(false);
        setAttachedUsers(item.kind === 'cabinet' ? (item.attached_users ?? []) : []);
        form.setData({
            badge: item.badge ?? '',
            title: item.title ?? '',
            meta: item.meta ?? '',
            kind: item.kind ?? 'cabinet',
            building: item.building ?? '',
            floor: item.floor ?? '',
            room: item.room ?? '',
            steps_text: Array.isArray(item.steps) ? item.steps.join('\n') : '',
            map_polyline_text: Array.isArray(item.map_polyline)
                ? item.map_polyline
                    .map((point) => `${point.x},${point.y}`)
                    .join('\n')
                : '',
            attached_user_ids: Array.isArray(item.attached_users)
                ? item.attached_users.map((user) => user.id)
                : [],
            map_image: null,
            map_image_path: item.map_image_path ?? '',
            is_active: Boolean(item.is_active),
            sort_order: item.sort_order ?? 0,
        });
    };

    const stopEdit = () => {
        setEditingId(null);
        setUserQuery('');
        setUserResults([]);
        setUserDropdownOpen(false);
        setAttachedUsers([]);
        form.reset();
    };

    const removeItem = (id) => {
        setConfirmState({
            open: true,
            description: 'Удалить маршрут?',
            onConfirm: () => router.delete(route('nav.routes.destroy', id), { preserveScroll: true }),
        });
    };

    return (
        <AuthenticatedLayout>
            <Head title="Заполнение маршрутов" />

            <div className="admin-page-wrap">
                <Card className="admin-surface">
                    <CardHeader>
                        <CardTitle>Заполнение маршрутов</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {flash.success && (
                            <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                                {flash.success}
                            </div>
                        )}
                        {hasErrors && (
                            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                                Сохранение не выполнено. Исправьте ошибки в форме и повторите попытку.
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
                                        if (event.target.value !== 'cabinet') {
                                            setAttachedUsers([]);
                                            form.setData('attached_user_ids', []);
                                        }
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

                            {form.data.kind === 'cabinet' && (
                                <div className="md:col-span-2 relative">
                                    <label className="mb-1 block text-sm font-medium">Прикрепленные сотрудники к кабинету</label>
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
                                                    onMouseDown={() => attachUserToCabinet(user)}
                                                >
                                                    <span className="font-medium">{user.name}</span>
                                                    {user.ad_login && (
                                                        <span className="ml-2 text-xs text-muted-foreground">{user.ad_login}</span>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                    {attachedUsers.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {attachedUsers.map((user) => (
                                                <span key={user.id} className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                                                    {user.name}
                                                    <button
                                                        type="button"
                                                        className="text-red-600 hover:text-red-700"
                                                        onClick={() => removeAttachedUser(user.id)}
                                                        aria-label={`Удалить ${user.name}`}
                                                    >
                                                        ×
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    <div className="mt-1 text-xs text-muted-foreground">
                                        Можно прикрепить несколько сотрудников к одному кабинету.
                                    </div>
                                    {form.errors.attached_user_ids && <div className="mt-1 text-xs text-red-600">{form.errors.attached_user_ids}</div>}
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

                            <div className="md:col-span-2">
                                <label className="mb-1 block text-sm font-medium">Загрузка картинки плана этажа</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="w-full rounded-md border px-3 py-2"
                                    onChange={(event) => {
                                        const file = event.target.files?.[0] ?? null;
                                        form.setData('map_image', file);
                                    }}
                                />
                                <div className="mt-1 text-xs text-muted-foreground">
                                    После сохранения файл будет загружен и использован для маршрута.
                                </div>
                                {form.errors.map_image && <div className="mt-1 text-xs text-red-600">{form.errors.map_image}</div>}
                            </div>

                            <div className="md:col-span-2">
                                <label className="mb-1 block text-sm font-medium">Линия маршрута (координаты X,Y в %, каждая точка с новой строки)</label>
                                <textarea
                                    className="w-full rounded-md border px-3 py-2 min-h-[120px] font-mono text-xs"
                                    placeholder={"10,15\n22,18\n35,30\n61,54"}
                                    value={form.data.map_polyline_text}
                                    onChange={(event) => form.setData('map_polyline_text', event.target.value)}
                                />
                                <div className="mt-1 text-xs text-muted-foreground">
                                    Координаты в процентах от размера картинки: X=0..100, Y=0..100.
                                </div>
                                {form.errors.map_polyline_text && <div className="mt-1 text-xs text-red-600">{form.errors.map_polyline_text}</div>}

                                <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                        <p className="text-xs text-slate-600">
                                            Визуальный редактор: кликните по картинке, чтобы добавить точку маршрута.
                                        </p>
                                        <div className="flex gap-2">
                                            <Button type="button" size="sm" variant="outline" onClick={removeLastPoint}>
                                                Отменить точку
                                            </Button>
                                            <Button type="button" size="sm" variant="outline" onClick={clearAllPoints}>
                                                Очистить
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="relative overflow-hidden rounded-md border border-slate-300 bg-white">
                                        {mapPreviewUrl ? (
                                            <div
                                                ref={mapEditorRef}
                                                className="relative mx-auto w-fit max-w-full cursor-crosshair"
                                                onClick={addPointByMapClick}
                                                role="button"
                                                tabIndex={0}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Enter' || event.key === ' ') {
                                                        event.preventDefault();
                                                    }
                                                }}
                                            >
                                                <img
                                                    src={mapPreviewUrl}
                                                    alt="План этажа для редактора маршрута"
                                                    className="block max-h-[70vh] w-auto max-w-full bg-slate-100"
                                                />

                                                {editorPoints.length > 0 && (
                                                    <svg
                                                        viewBox="0 0 100 100"
                                                        preserveAspectRatio="none"
                                                        className="pointer-events-none absolute inset-0 h-full w-full"
                                                        aria-hidden="true"
                                                    >
                                                        <defs>
                                                            <filter id="routeShadowEditor" x="-40%" y="-40%" width="200%" height="200%">
                                                                <feDropShadow dx="0" dy="0.2" stdDeviation="0.4" floodColor="#111111" floodOpacity="0.32" />
                                                            </filter>
                                                            <linearGradient id="flagPoleEditor" x1="0" y1="-3.6" x2="0.6" y2="1.4" gradientUnits="userSpaceOnUse">
                                                                <stop offset="0%" stopColor="#9ea7b1" />
                                                                <stop offset="55%" stopColor="#6f7781" />
                                                                <stop offset="100%" stopColor="#4e555f" />
                                                            </linearGradient>
                                                            <linearGradient id="flagMainEditor" x1="0" y1="-3.1" x2="2.7" y2="-1.8" gradientUnits="userSpaceOnUse">
                                                                <stop offset="0%" stopColor="#7fa06f" />
                                                                <stop offset="65%" stopColor="#5f7c55" />
                                                                <stop offset="100%" stopColor="#485e43" />
                                                            </linearGradient>
                                                            <linearGradient id="flagSideEditor" x1="0" y1="-3.1" x2="0.65" y2="-1.45" gradientUnits="userSpaceOnUse">
                                                                <stop offset="0%" stopColor="#6d8a60" />
                                                                <stop offset="100%" stopColor="#3f5239" />
                                                            </linearGradient>
                                                            <linearGradient id="flagBaseEditor" x1="-1.8" y1="0.65" x2="1.8" y2="1.9" gradientUnits="userSpaceOnUse">
                                                                <stop offset="0%" stopColor="#6f8f61" />
                                                                <stop offset="100%" stopColor="#486244" />
                                                            </linearGradient>
                                                        </defs>
                                                        {editorPoints.length > 1 && (
                                                            <>
                                                                <path
                                                                    d={editorPathD}
                                                                    fill="none"
                                                                    stroke="#000000"
                                                                    strokeWidth="1.16"
                                                                    strokeLinecap="round"
                                                                    strokeLinejoin="round"
                                                                    opacity="0.16"
                                                                    filter="url(#routeShadowEditor)"
                                                                />
                                                                <path
                                                                    d={editorPathD}
                                                                    fill="none"
                                                                    stroke="#111111"
                                                                    strokeWidth="0.6"
                                                                    strokeLinecap="round"
                                                                    strokeLinejoin="round"
                                                                    strokeDasharray="1.55 2.35"
                                                                    strokeDashoffset="0"
                                                                    opacity="0.92"
                                                                >
                                                                    <animate
                                                                        attributeName="stroke-dashoffset"
                                                                        from="0"
                                                                        to="-7.8"
                                                                        dur="1.25s"
                                                                        repeatCount="indefinite"
                                                                    />
                                                                </path>
                                                            </>
                                                        )}
                                                        {editorPoints.slice(1, -1).map((point, index) => (
                                                            <g key={`${point.x}-${point.y}-${index}`}>
                                                                <circle
                                                                    cx={point.x}
                                                                    cy={point.y}
                                                                    r="1.18"
                                                                    fill="#ffffff"
                                                                    opacity="0.9"
                                                                />
                                                                <circle
                                                                    cx={point.x}
                                                                    cy={point.y}
                                                                    r="0.56"
                                                                    fill="#64748b"
                                                                />
                                                            </g>
                                                        ))}
                                                        {editorStartPoint && (
                                                            <g>
                                                                <circle
                                                                    cx={editorStartPoint.x}
                                                                    cy={editorStartPoint.y}
                                                                    r="0.7"
                                                                    fill="none"
                                                                    stroke="#e5242a"
                                                                    strokeWidth="0.36"
                                                                    opacity="0.66"
                                                                >
                                                                    <animate attributeName="r" values="0.7;1.45;0.7" dur="1.6s" repeatCount="indefinite" />
                                                                    <animate attributeName="opacity" values="0.66;0.18;0.66" dur="1.6s" repeatCount="indefinite" />
                                                                </circle>
                                                                <g transform={`translate(${editorStartPoint.x} ${editorStartPoint.y}) scale(0.28)`}>
                                                                    <path
                                                                        d="M 0 0 C 0 0 -2.35 -2.55 -2.35 -4.5 C -2.35 -6.35 -1.3 -7.55 0 -7.55 C 1.3 -7.55 2.35 -6.35 2.35 -4.5 C 2.35 -2.55 0 0 0 0 Z"
                                                                        fill="#e5242a"
                                                                        stroke="#ffffff"
                                                                        strokeWidth="0.44"
                                                                    />
                                                                    <circle cx="0" cy="-4.55" r="1.02" fill="#ffffff" />
                                                                </g>
                                                            </g>
                                                        )}
                                                        {editorFinishPoint && (
                                                            <g>
                                                                <circle
                                                                    cx={editorFinishPoint.x}
                                                                    cy={editorFinishPoint.y}
                                                                    r="0.8"
                                                                    fill="none"
                                                                    stroke="#16a34a"
                                                                    strokeWidth="0.34"
                                                                    opacity="0.7"
                                                                >
                                                                    <animate attributeName="r" values="0.8;1.5;0.8" dur="1.5s" repeatCount="indefinite" />
                                                                    <animate attributeName="opacity" values="0.7;0.2;0.7" dur="1.5s" repeatCount="indefinite" />
                                                                </circle>
                                                                <g transform={`translate(${editorFinishPoint.x} ${editorFinishPoint.y}) scale(0.34)`}>
                                                                    <path
                                                                        d="M 0 0 C 0 0 -2.35 -2.55 -2.35 -4.5 C -2.35 -6.35 -1.3 -7.55 0 -7.55 C 1.3 -7.55 2.35 -6.35 2.35 -4.5 C 2.35 -2.55 0 0 0 0 Z"
                                                                        fill="#16a34a"
                                                                        stroke="#ffffff"
                                                                        strokeWidth="0.44"
                                                                    />
                                                                    <path
                                                                        d="M -0.95 -4.6 L -0.2 -3.88 L 1.15 -5.22"
                                                                        fill="none"
                                                                        stroke="#ffffff"
                                                                        strokeWidth="0.46"
                                                                        strokeLinecap="round"
                                                                        strokeLinejoin="round"
                                                                    />
                                                                </g>
                                                            </g>
                                                        )}
                                                    </svg>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex h-64 w-full items-center justify-center text-sm text-slate-500">
                                                Сначала укажите путь к картинке плана этажа.
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-2 text-xs text-slate-600">
                                        Точек: {editorPoints.length}. Красный pin — старт, зеленый флажок — финиш.
                                    </div>
                                </div>
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

                <Card className="admin-surface">
                    <CardHeader>
                        <CardTitle>Список маршрутов</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {items.length === 0 ? (
                            <div className="admin-empty-state">Маршрутов пока нет.</div>
                        ) : (
                            <div className="admin-table-wrap">
                                <table className="admin-data-table min-w-[980px]">
                                    <thead>
                                        <tr>
                                            <th>ID</th>
                                            <th>Badge</th>
                                            <th>Название</th>
                                            <th>Тип</th>
                                            <th>Meta</th>
                                            <th>Сотрудники</th>
                                            <th>Шаги</th>
                                            <th>Статус</th>
                                            <th className="text-right">Действия</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((item) => (
                                            <tr key={item.id} className="align-top">
                                                <td className="py-3 pe-3">#{item.id}</td>
                                                <td className="py-3 pe-3">{item.badge}</td>
                                                <td className="py-3 pe-3 font-medium">{item.title}</td>
                                                <td className="py-3 pe-3">{item.kind}</td>
                                                <td className="py-3 pe-3 text-muted-foreground">{item.meta}</td>
                                                <td className="py-3 pe-3 text-muted-foreground">
                                                    {Array.isArray(item.attached_users) && item.attached_users.length > 0
                                                        ? item.attached_users.slice(0, 2).map((user) => user.name).join(', ')
                                                        : '—'}
                                                </td>
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
                                                <td className="py-3 pe-3 text-right">
                                                    <div className="admin-row-actions">
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
        <ConfirmDialog
            open={confirmState.open}
            onOpenChange={(open) => !open && setConfirmState({ open: false, description: '', onConfirm: null })}
            description={confirmState.description}
            onConfirm={() => {
                confirmState.onConfirm?.();
                setConfirmState({ open: false, description: '', onConfirm: null });
            }}
        />
    );
}
