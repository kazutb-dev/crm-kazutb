import { ConfirmDialog } from '@/components/ConfirmDialog';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { DataTable, EmptyState, Notice, PageHeader, qdFieldClass, StatGrid, StatTile } from '@/components/platform';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Building2, DoorOpen, MapPinned, Route, Users } from 'lucide-react';

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
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="Навигация по кампусу"
                    title="Заполнение маршрутов"
                    description="Точки навигации — кабинеты, сотрудники и отделы: шаги маршрута, план этажа и линия пути на нём."
                />
            )}
        >
            <Head title="Заполнение маршрутов" />

            <div className="admin-page-wrap space-y-6">
                <StatGrid>
                    <StatTile label="Всего маршрутов" value={navigationRoutes?.total ?? items.length} tone="navy" icon={Route} />
                    <StatTile label="Активны на странице" value={items.filter((item) => item.is_active).length} tone="success" icon={MapPinned} hint={`из ${items.length} на этой странице`} />
                    <StatTile label="Кабинеты" value={items.filter((item) => item.kind === 'cabinet').length} tone="teal" icon={DoorOpen} hint="на этой странице" />
                    <StatTile label="Сотрудники и отделы" value={items.filter((item) => item.kind === 'staff' || item.kind === 'department').length} tone="gold" icon={Users} hint="на этой странице" />
                </StatGrid>

                {flash.success && <Notice tone="success">{flash.success}</Notice>}
                {hasErrors && (
                    <Notice tone="danger">Сохранение не выполнено. Исправьте ошибки в форме и повторите попытку.</Notice>
                )}

                <Card>
                    <CardHeader>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <CardTitle className="flex items-center gap-2"><MapPinned className="h-4 w-4" />{editingId ? `Редактирование маршрута #${editingId}` : 'Новый маршрут'}</CardTitle>
                            {editingId ? <Badge variant="warning">Режим редактирования</Badge> : null}
                        </div>
                    </CardHeader>
                    <CardContent>

                        <form onSubmit={submit} className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-2">
                            <div>
                                <label className="qd-field-label mb-2 block">Badge</label>
                                <input
                                    className={qdFieldClass}
                                    value={form.data.badge}
                                    onChange={(event) => form.setData('badge', event.target.value)}
                                />
                                {form.errors.badge && <div className="mt-1.5 text-xs text-red-700">{form.errors.badge}</div>}
                            </div>

                            <div>
                                <label className="qd-field-label mb-2 block">Тип точки</label>
                                <select
                                    className={qdFieldClass}
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
                                    <label className="qd-field-label mb-2 block">Поиск сотрудника</label>
                                    <input
                                        className={qdFieldClass}
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
                                        <div className="mt-1.5 text-xs text-slate-500">Поиск...</div>
                                    )}
                                    {userDropdownOpen && userResults.length > 0 && (
                                        <ul className="absolute z-50 mt-1 max-h-52 w-full overflow-auto rounded-[12px] border border-slate-200 bg-white p-1 shadow-[0_12px_32px_0_rgba(25,28,29,0.10)]">
                                            {userResults.map((user) => (
                                                <li
                                                    key={user.id}
                                                    className="cursor-pointer rounded-[10px] px-3 py-2 text-sm hover:bg-teal-50"
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
                                    <div className="mt-1.5 text-xs text-slate-500">
                                        Выберите сотрудника — поля Название и Badge заполнятся автоматически.
                                    </div>
                                </div>
                            )}

                            {form.data.kind === 'cabinet' && (
                                <div className="md:col-span-2 relative">
                                    <label className="qd-field-label mb-2 block">Прикрепленные сотрудники к кабинету</label>
                                    <input
                                        className={qdFieldClass}
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
                                        <div className="mt-1.5 text-xs text-slate-500">Поиск...</div>
                                    )}
                                    {userDropdownOpen && userResults.length > 0 && (
                                        <ul className="absolute z-50 mt-1 max-h-52 w-full overflow-auto rounded-[12px] border border-slate-200 bg-white p-1 shadow-[0_12px_32px_0_rgba(25,28,29,0.10)]">
                                            {userResults.map((user) => (
                                                <li
                                                    key={user.id}
                                                    className="cursor-pointer rounded-[10px] px-3 py-2 text-sm hover:bg-teal-50"
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
                                                <span key={user.id} className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-medium text-teal-800">
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
                                    <div className="mt-1.5 text-xs text-slate-500">
                                        Можно прикрепить несколько сотрудников к одному кабинету.
                                    </div>
                                    {form.errors.attached_user_ids && <div className="mt-1.5 text-xs text-red-700">{form.errors.attached_user_ids}</div>}
                                </div>
                            )}

                            <div className="md:col-span-2">
                                <label className="qd-field-label mb-2 block">Название</label>
                                <input
                                    className={qdFieldClass}
                                    value={form.data.title}
                                    onChange={(event) => form.setData('title', event.target.value)}
                                />
                                {form.errors.title && <div className="mt-1.5 text-xs text-red-700">{form.errors.title}</div>}
                            </div>

                            <div className="md:col-span-2">
                                <label className="qd-field-label mb-2 block">Meta (пример: 2 корпус • 3 этаж)</label>
                                <input
                                    className={qdFieldClass}
                                    value={form.data.meta}
                                    onChange={(event) => form.setData('meta', event.target.value)}
                                />
                                {form.errors.meta && <div className="mt-1.5 text-xs text-red-700">{form.errors.meta}</div>}
                                <div className="mt-1.5 text-xs text-slate-500">
                                    Если оставить пустым, заполнится автоматически из полей Корпус и Этаж.
                                </div>
                            </div>

                            <div>
                                <label className="qd-field-label mb-2 block">Корпус</label>
                                <input
                                    className={qdFieldClass}
                                    value={form.data.building}
                                    onChange={(event) => form.setData('building', event.target.value)}
                                />
                            </div>

                            <div>
                                <label className="qd-field-label mb-2 block">Этаж</label>
                                <input
                                    type="number"
                                    className={qdFieldClass}
                                    value={form.data.floor}
                                    onChange={(event) => form.setData('floor', event.target.value)}
                                />
                            </div>

                            <div>
                                <label className="qd-field-label mb-2 block">Кабинет</label>
                                <input
                                    className={qdFieldClass}
                                    value={form.data.room}
                                    onChange={(event) => form.setData('room', event.target.value)}
                                />
                                {form.errors.room && <div className="mt-1.5 text-xs text-red-700">{form.errors.room}</div>}
                                {(form.data.kind === 'staff' || form.data.kind === 'cabinet') && (
                                    <div className="mt-1.5 text-xs text-slate-500">
                                        Для типа "Сотрудник" и "Кабинет" поле обязательно.
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="qd-field-label mb-2 block">Порядок сортировки</label>
                                <input
                                    type="number"
                                    className={qdFieldClass}
                                    value={form.data.sort_order}
                                    onChange={(event) => form.setData('sort_order', event.target.value)}
                                />
                            </div>

                            <div className="md:col-span-2">
                                <label className="qd-field-label mb-2 block">Шаги маршрута (каждый шаг с новой строки)</label>
                                <textarea
                                    className={`${qdFieldClass} h-auto min-h-[140px] py-2`}
                                    value={form.data.steps_text}
                                    onChange={(event) => form.setData('steps_text', event.target.value)}
                                />
                                {form.errors.steps_text && <div className="mt-1.5 text-xs text-red-700">{form.errors.steps_text}</div>}
                            </div>

                            <div className="md:col-span-2">
                                <label className="qd-field-label mb-2 block">Загрузка картинки плана этажа</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="block w-full rounded-[10px] border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-700 file:mr-3 file:rounded-[8px] file:border-0 file:bg-teal-700 file:px-3 file:py-1.5 file:text-xs file:font-bold file:uppercase file:tracking-[0.08em] file:text-white hover:file:bg-[#102945]"
                                    onChange={(event) => {
                                        const file = event.target.files?.[0] ?? null;
                                        form.setData('map_image', file);
                                    }}
                                />
                                <div className="mt-1.5 text-xs text-slate-500">
                                    После сохранения файл будет загружен и использован для маршрута.
                                </div>
                                {form.errors.map_image && <div className="mt-1.5 text-xs text-red-700">{form.errors.map_image}</div>}
                            </div>

                            <div className="md:col-span-2">
                                <label className="qd-field-label mb-2 block">Линия маршрута (координаты X,Y в %, каждая точка с новой строки)</label>
                                <textarea
                                    className={`${qdFieldClass} h-auto min-h-[120px] py-2 font-mono text-xs`}
                                    placeholder={"10,15\n22,18\n35,30\n61,54"}
                                    value={form.data.map_polyline_text}
                                    onChange={(event) => form.setData('map_polyline_text', event.target.value)}
                                />
                                <div className="mt-1.5 text-xs text-slate-500">
                                    Координаты в процентах от размера картинки: X=0..100, Y=0..100.
                                </div>
                                {form.errors.map_polyline_text && <div className="mt-1.5 text-xs text-red-700">{form.errors.map_polyline_text}</div>}

                                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                        <p className="text-sm text-slate-600">
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

                                    <div className="relative overflow-hidden rounded-[10px] border border-slate-200 bg-slate-50">
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
                                                                    stroke="#c52b28"
                                                                    strokeWidth="0.36"
                                                                    opacity="0.66"
                                                                >
                                                                    <animate attributeName="r" values="0.7;1.45;0.7" dur="1.6s" repeatCount="indefinite" />
                                                                    <animate attributeName="opacity" values="0.66;0.18;0.66" dur="1.6s" repeatCount="indefinite" />
                                                                </circle>
                                                                <g transform={`translate(${editorStartPoint.x} ${editorStartPoint.y}) scale(0.28)`}>
                                                                    <path
                                                                        d="M 0 0 C 0 0 -2.35 -2.55 -2.35 -4.5 C -2.35 -6.35 -1.3 -7.55 0 -7.55 C 1.3 -7.55 2.35 -6.35 2.35 -4.5 C 2.35 -2.55 0 0 0 0 Z"
                                                                        fill="#c52b28"
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
                                                                    stroke="#26975f"
                                                                    strokeWidth="0.34"
                                                                    opacity="0.7"
                                                                >
                                                                    <animate attributeName="r" values="0.8;1.5;0.8" dur="1.5s" repeatCount="indefinite" />
                                                                    <animate attributeName="opacity" values="0.7;0.2;0.7" dur="1.5s" repeatCount="indefinite" />
                                                                </circle>
                                                                <g transform={`translate(${editorFinishPoint.x} ${editorFinishPoint.y}) scale(0.34)`}>
                                                                    <path
                                                                        d="M 0 0 C 0 0 -2.35 -2.55 -2.35 -4.5 C -2.35 -6.35 -1.3 -7.55 0 -7.55 C 1.3 -7.55 2.35 -6.35 2.35 -4.5 C 2.35 -2.55 0 0 0 0 Z"
                                                                        fill="#26975f"
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

                                    <div className="mt-2 text-xs tabular-nums text-slate-600">
                                        Точек: {editorPoints.length}. Красный pin — старт, зеленый флажок — финиш.
                                    </div>
                                </div>
                            </div>

                            <div className="md:col-span-2 flex items-center gap-3">
                                <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-800">
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4 rounded-[4px] border-slate-300 text-teal-700 focus:ring-teal-600/30"
                                        checked={Boolean(form.data.is_active)}
                                        onChange={(event) => form.setData('is_active', event.target.checked)}
                                    />
                                    Активен
                                </label>
                            </div>

                            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4 md:col-span-2">
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
                        <CardTitle className="flex items-center gap-2"><Route className="h-4 w-4" />Список маршрутов</CardTitle>
                    </CardHeader>
                    <CardContent className={items.length === 0 ? '' : 'p-0'}>
                        {items.length === 0 ? (
                            <div className="flex flex-col items-center gap-3 py-10 text-center">
                                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-100 text-teal-700"><Route className="h-6 w-6" /></span>
                                <p className="font-display text-lg font-bold text-[#102945]">Маршрутов пока нет.</p>
                                <p className="max-w-md text-sm text-slate-600">Заполните форму выше, чтобы добавить первую точку навигации.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[980px] text-sm">
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
                                            <tr key={item.id} className={`align-top hover:bg-slate-50 ${editingId === item.id ? 'bg-teal-50/60' : ''}`}>
                                                <td className="tabular-nums text-slate-500">#{item.id}</td>
                                                <td>{item.badge ? <Badge variant="secondary">{item.badge}</Badge> : null}</td>
                                                <td className="font-medium text-slate-900">{item.title}</td>
                                                <td className="text-slate-700">{item.kind}</td>
                                                <td className="text-slate-600">{item.meta}</td>
                                                <td className="text-slate-600">
                                                    {Array.isArray(item.attached_users) && item.attached_users.length > 0
                                                        ? item.attached_users.slice(0, 2).map((user) => user.name).join(', ')
                                                        : '—'}
                                                </td>
                                                <td className="whitespace-pre-line text-slate-600">
                                                    {Array.isArray(item.steps) && item.steps.length > 0
                                                        ? item.steps.slice(0, 2).map((step, idx) => `${idx + 1}. ${step}`).join('\n')
                                                        : 'Нет шагов'}
                                                </td>
                                                <td>
                                                    <Badge variant={item.is_active ? 'success' : 'outline'}>
                                                        {item.is_active ? 'Активен' : 'Скрыт'}
                                                    </Badge>
                                                </td>
                                                <td className="text-right">
                                                    <div className="flex justify-end gap-2">
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
                            <div className="flex flex-wrap items-center justify-end gap-1.5 border-t border-slate-200 px-5 py-3 sm:px-6">
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
            <ConfirmDialog
                open={confirmState.open}
                onOpenChange={(open) => !open && setConfirmState({ open: false, description: '', onConfirm: null })}
                description={confirmState.description}
                onConfirm={() => {
                    confirmState.onConfirm?.();
                    setConfirmState({ open: false, description: '', onConfirm: null });
                }}
            />
        </AuthenticatedLayout>
    );
}
