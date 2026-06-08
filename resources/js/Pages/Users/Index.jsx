import { ConfirmDialog } from '@/components/ConfirmDialog';
import { toast } from 'sonner';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { DataTable, FilterBar, PageHeader, StatusBadge } from '@/components/platform';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Head, router, useForm } from '@inertiajs/react';
import axios from 'axios';
import {
    AlertTriangle,
    Clock3,
    Mail,
    Pencil,
    RefreshCw,
    Search,
    ShieldPlus,
    Users,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

const ROLE_OPTIONS = [
    { value: 'teacher', label: 'Преподаватель' },
    { value: 'hod', label: 'Заведующий кафедрой' },
    { value: 'dean', label: 'Декан' },
    { value: 'structural', label: 'Структурное подразделение' },
    { value: 'kpi_admin', label: 'KPI администратор' },
    { value: 'admin', label: 'Администратор' },
];

const STAFF_TAB_OPTIONS = [
    { key: 'teacher', label: 'ППС' },
    { key: 'hod', label: 'Завед. кафедрой' },
    { key: 'dean', label: 'Деканы' },
    { key: 'structural', label: 'Структурные' },
    { key: 'test_users', label: 'Тестовые пользователи' },
    { key: 'all', label: 'Все' },
];

const STUDENT_TAB_OPTIONS = [
    { key: 'bachelor', label: 'Бакалавриат' },
    { key: 'master', label: 'Магистратура' },
    { key: 'all', label: 'Все' },
];

const ROLE_BADGE_STYLES = {
    teacher: 'border-sky-200 bg-sky-50 text-sky-800',
    hod: 'border-amber-200 bg-amber-50 text-amber-900',
    dean: 'border-violet-200 bg-violet-50 text-violet-900',
    structural: 'border-teal-200 bg-teal-50 text-teal-900',
    kpi_admin: 'border-cyan-200 bg-cyan-50 text-cyan-900',
    student: 'border-indigo-200 bg-indigo-50 text-indigo-900',
    admin: 'border-slate-200 bg-slate-100 text-slate-800',
    superadmin: 'border-slate-200 bg-slate-100 text-slate-800',
    default: 'border-slate-200 bg-slate-100 text-slate-700',
};

const SYNC_BADGE_STYLES = {
    yes: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    no: 'border-slate-200 bg-slate-100 text-slate-700',
};

const BINDING_BADGE_STYLES = {
    ok: 'border-slate-200 bg-slate-100 text-slate-700',
    missing: 'border-amber-300 bg-amber-50 text-amber-800',
};

const LAST_LOGIN_TONES = {
    recent: 'text-emerald-700',
    neutral: 'text-slate-600',
    stale: 'text-amber-700',
    never: 'text-slate-400',
};

const FACULTY_STRUCTURE = [
    {
        faculty: 'Технологический факультет',
        departments: ['Технология и стандартизация', 'Технология легкой промышленности и дизайна', 'Социально-гуманитарные дисциплины'],
    },
    {
        faculty: 'Факультет экономики и бизнеса',
        departments: ['Туризм и сервис', 'Экономика и управление', 'Финансы и учёт', 'Государственный и иностранные языки'],
    },
    {
        faculty: 'Факультет инжиниринга и информационных технологий',
        departments: ['Информационные технологии', 'Компьютерная инженерия и автоматизация', 'Химия, химическая технология и экология'],
    },
];

const DEPARTMENT_TO_FACULTY = FACULTY_STRUCTURE.reduce((map, item) => {
    item.departments.forEach((department) => map.set(normalizeKey(department), item.faculty));
    return map;
}, new Map());

function normalizeKey(value) {
    return String(value ?? '').toLowerCase().replace(/[«»"'`;.,]/g, ' ').replace(/\s+/g, ' ').trim();
}

function resolveRoleSlug(user) {
    if (Boolean(user?.is_kpi_admin)) return 'kpi_admin';
    const slug = String(user?.role_slug ?? '').toLowerCase();
    if (slug === 'department_head') return 'hod';
    if (slug === 'department') return 'teacher';
    return slug;
}

function resolveRoleLabel(user) {
    const slug = resolveRoleSlug(user);
    switch (slug) {
        case 'teacher':
            return 'Преподаватель';
        case 'hod':
            return 'Завед. кафедрой';
        case 'dean':
            return 'Декан';
        case 'structural':
            return 'Структурное подразделение';
        case 'kpi_admin':
            return 'KPI администратор';
        case 'admin':
        case 'superadmin':
            return 'Администратор';
        case 'student':
            return 'Студент';
        default:
            return 'Без роли';
    }
}

function resolvePositionDisplay(user) {
    return user.position_name || user.title || '—';
}

function resolveUnitDisplay(user) {
    if (user.faculty_name) return { text: user.faculty_name, fromAd: false };
    if (user.department_name) return { text: user.department_name, fromAd: false };
    if (user.ad_department) return { text: `${user.ad_department} (из AD)`, fromAd: true };
    return { text: '—', fromAd: false };
}

function getRoleBadgeClass(user) {
    const role = resolveRoleSlug(user);
    return ROLE_BADGE_STYLES[role] ?? ROLE_BADGE_STYLES.default;
}

function getSyncBadgeClass(user) {
    return user.is_synced ? SYNC_BADGE_STYLES.yes : SYNC_BADGE_STYLES.no;
}

function getBindingBadgeClass(user) {
    return user.is_binding_missing ? BINDING_BADGE_STYLES.missing : BINDING_BADGE_STYLES.ok;
}

function getLastLoginTone(user) {
    if (!user.last_login_at) {
        return LAST_LOGIN_TONES.never;
    }

    const date = new Date(user.last_login_at);
    if (Number.isNaN(date.getTime())) {
        return LAST_LOGIN_TONES.never;
    }

    const diffHours = (Date.now() - date.getTime()) / 36e5;

    if (diffHours < 24) {
        return LAST_LOGIN_TONES.recent;
    }

    if (diffHours < 24 * 30) {
        return LAST_LOGIN_TONES.neutral;
    }

    return LAST_LOGIN_TONES.stale;
}

function resolveHodFaculty(user) {
    if (user.faculty_name) {
        return user.faculty_name;
    }

    const dep = normalizeKey(user.department_name);
    if (!dep) {
        return '—';
    }

    return DEPARTMENT_TO_FACULTY.get(dep) ?? '—';
}

function renderHodUnit(user) {
    const deptName = user.department_name || user.ad_department || null;
    const facName = user.faculty_name || null;

    if (deptName) {
        return (
            <div>
                <div className="text-sm font-medium text-gray-900">{deptName}</div>
                {facName && <div className="text-xs text-gray-400">{facName}</div>}
            </div>
        );
    }

    if (facName) {
        return <span className="text-sm text-gray-500">{facName}</span>;
    }

    return (
        <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            ⚠ Не привязан
        </span>
    );
}

function isBindingMissing(user) {
    const role = resolveRoleSlug(user);
    if (role === 'hod') {
        return !user.department_id && !user.department_name;
    }
    if (role === 'dean') {
        return !user.faculty_id && !user.faculty_name;
    }
    return false;
}

function formatExactTimestamp(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    return new Intl.DateTimeFormat('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    }).format(date);
}

function formatLastLogin(value) {
    if (!value) {
        return { label: 'Никогда не заходил', className: 'text-muted-foreground', tooltip: 'Пользователь еще не входил в CRM' };
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return { label: 'Никогда не заходил', className: 'text-muted-foreground', tooltip: '' };
    }

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const dayMs = 24 * 60 * 60 * 1000;
    const diffDays = Math.floor(diffMs / dayMs);

    if (diffMs < dayMs) {
        const hhmm = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(date);
        return { label: `Сегодня в ${hhmm}`, className: 'text-emerald-700', tooltip: formatExactTimestamp(value) };
    }

    if (diffDays < 7) {
        return { label: `${diffDays} дн. назад`, className: 'text-foreground', tooltip: formatExactTimestamp(value) };
    }

    if (diffDays < 30) {
        const shortDate = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short' }).format(date);
        return { label: shortDate, className: 'text-foreground', tooltip: formatExactTimestamp(value) };
    }

    const longDate = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
    return { label: longDate, className: 'text-muted-foreground', tooltip: formatExactTimestamp(value) };
}

export default function Index({
    users = [],
    positions = [],
    departments = [],
    faculties = [],
    filters = {},
    counts = {},
    pagination = {},
    pageTitle,
    searchRouteName,
    directoryType = 'staff',
    structuralDivisionOptions = [],
    permissions = {},
}) {
    const routeName = searchRouteName ?? 'users.index';
    const tabOptions = directoryType === 'students' ? STUDENT_TAB_OPTIONS : STAFF_TAB_OPTIONS;
    const requiresDangerousActionReason = Boolean(permissions.requiresDangerousActionReason);

    const filterForm = useForm({
        q: filters.q ?? '',
        tab: filters.tab ?? (directoryType === 'students' ? 'all' : 'teacher'),
        sort_by: filters.sort_by ?? '',
        sort_dir: filters.sort_dir ?? 'asc',
        faculty_id: filters.faculty_id ?? '',
        department_id: filters.department_id ?? '',
        synced: filters.synced ?? 'all',
        last_login_range: filters.last_login_range ?? 'all',
        per_page: Number(filters.per_page ?? pagination.per_page ?? 50),
        page: Number(filters.page ?? pagination.current_page ?? 1),
    });

    const positionForm = useForm({
        position_id: '',
        department_id: '',
        faculty_id: '',
        division_ids: [],
        reason: '',
    });

    const roleForm = useForm({
        role: 'teacher',
        structural_access: false,
        structural_division_id: '',
        reason: '',
    });

    const [confirmState, setConfirmState] = useState({ open: false, description: '', onConfirm: null });
    const [editingUser, setEditingUser] = useState(null);
    const [positionDialogOpen, setPositionDialogOpen] = useState(false);
    const [roleDialogUser, setRoleDialogUser] = useState(null);
    const [roleDialogOpen, setRoleDialogOpen] = useState(false);
    const [roleConfirmOpen, setRoleConfirmOpen] = useState(false);
    const [onlyUnbound, setOnlyUnbound] = useState(false);
    const skipNextAutoSearchRef = useRef(false);

    const defaultTab = directoryType === 'students' ? 'all' : 'teacher';
    const tab = filters.tab ?? filterForm.data.tab ?? defaultTab;
    const activeTab = tab;

    const totalCount = pagination.total ?? users.length ?? 0;

    const tabClass = (key) => (
        activeTab === key
            ? 'inline-flex h-8 items-center gap-1.5 rounded-full border border-[#10263f] bg-[#17314f] px-3 py-1 text-xs font-semibold text-white shadow-sm shadow-slate-300/60 transition-all'
            : 'inline-flex h-8 items-center gap-1.5 rounded-full border border-slate-300/90 bg-slate-50/75 px-3 py-1 text-xs font-medium text-slate-600 transition-all hover:border-slate-400 hover:bg-slate-100 hover:text-slate-900'
    );

    const badgeClass = (key) => (
        activeTab === key
            ? 'ml-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-white/95 px-1.5 text-[10px] font-bold text-[#17314f]'
            : 'ml-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-slate-200/70 px-1.5 text-[10px] font-semibold text-slate-700'
    );

    const displayedUsers = useMemo(() => {
        if (!onlyUnbound) return users;
        return users.filter((user) => isBindingMissing(user));
    }, [users, onlyUnbound]);

    const visibleCount = displayedUsers.length;
    const summaryLine = directoryType === 'students'
        ? `Бакалавриат: ${counts.bachelor ?? 0} · Магистратура: ${counts.master ?? 0} · Всего: ${counts.all ?? 0}`
        : `ППС: ${counts.teacher ?? 0} · Завкаф: ${counts.hod ?? 0} · Деканы: ${counts.dean ?? 0} · Структурные: ${counts.structural ?? 0} · Тестовые: ${counts.test_users ?? 0}`;

    const unboundHodCount = useMemo(
        () => users.filter((user) => resolveRoleSlug(user) === 'hod' && isBindingMissing(user)).length,
        [users],
    );

    const unboundDeanCount = useMemo(
        () => users.filter((user) => resolveRoleSlug(user) === 'dean' && isBindingMissing(user)).length,
        [users],
    );

    const submitFilters = (next = {}, resetPage = true, options = {}) => {
        const payload = {
            ...filterForm.data,
            ...next,
        };

        if (options.suppressNextSearch) {
            skipNextAutoSearchRef.current = true;
        }

        if (resetPage && next.page === undefined) {
            payload.page = 1;
            filterForm.setData('page', 1);
        }

        router.get(route(routeName), payload, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    useEffect(() => {
        const currentQuery = String(filterForm.data.q ?? '');
        const serverQuery = String(filters.q ?? '');

        if (skipNextAutoSearchRef.current) {
            skipNextAutoSearchRef.current = false;
            return undefined;
        }

        if (currentQuery === serverQuery) {
            return undefined;
        }

        const timeoutId = window.setTimeout(() => {
            router.get(route(routeName), {
                ...filterForm.data,
                q: currentQuery,
                page: 1,
            }, {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            });
        }, 320);

        return () => window.clearTimeout(timeoutId);
    }, [filterForm.data, filterForm.data.q, filters.q, routeName]);

    const openPositionDialog = (user) => {
        setEditingUser(user);

        const selectedDivisionIds = Array.isArray(user?.divisions)
            ? user.divisions
                .map((division) => Number(division?.id))
                .filter((id) => Number.isInteger(id) && id > 0)
            : [];

        positionForm.setData({
            position_id: user.position_id ? String(user.position_id) : '',
            department_id: user.department_id ? String(user.department_id) : '',
            faculty_id: user.faculty_id ? String(user.faculty_id) : '',
            division_ids: selectedDivisionIds,
            reason: '',
        });
        positionForm.clearErrors();
        setPositionDialogOpen(true);
    };

    const submitPosition = (e) => {
        e.preventDefault();

        if (!editingUser) return;

        const routeTarget = route('users.position.update', editingUser.local_user_id);

        router.patch(
            routeTarget,
            {
                position_id: positionForm.data.position_id || null,
                department_id: positionForm.data.department_id || null,
                faculty_id: positionForm.data.faculty_id || null,
                division_ids: positionForm.data.division_ids,
                reason: positionForm.data.reason,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setPositionDialogOpen(false);
                    setEditingUser(null);
                },
            },
        );
    };

    const openRoleDialog = (user) => {
        setRoleDialogUser(user);
        // Use kpi_structural_unit IDs from `divisions` array (populated from kpi_structural_unit_user pivot)
        const structuralUnitIds = Array.isArray(user?.divisions)
            ? user.divisions.map((d) => d.id).filter((id) => Number.isInteger(Number(id)) && Number(id) > 0)
            : [];

        roleForm.setData({
            role: resolveRoleSlug(user) || 'teacher',
            structural_access: structuralUnitIds.length > 0,
            structural_division_id: structuralUnitIds[0] ? String(structuralUnitIds[0]) : '',
            reason: '',
        });
        roleForm.clearErrors();
        setRoleDialogOpen(true);
        setRoleConfirmOpen(false);
    };

    const doCreateLocalUserFromAd = async (row, onSuccess) => {
        let reason = '';

        if (requiresDangerousActionReason) {
            reason = window.prompt('Укажите причину создания локальной записи') ?? '';

            if (reason.trim().length < 8) {
                toast.error('Причина должна быть минимум 8 символов.');
                return;
            }
        }

        try {
            const response = await axios.post('/users/create-from-ad', {
                ad_login: row.login,
                ad_guid: row.guid,
                email: row.email,
                name: row.display_name || row.name,
                reason: reason.trim(),
            }, {
                headers: { Accept: 'application/json' },
            });

            const userId = response?.data?.user_id;
            if (!userId) {
                toast.error('Сервер не вернул ID нового пользователя.');
                return;
            }

            onSuccess({ ...row, local_user_id: userId, can_edit: true });
        } catch {
            toast.error('Не удалось создать локальную запись пользователя.');
        }
    };

    const createLocalUserFromAd = (row, onSuccess) => {
        setConfirmState({
            open: true,
            description: 'Создать локальную запись для этого пользователя?',
            onConfirm: () => doCreateLocalUserFromAd(row, onSuccess),
        });
    };

    const handleEditClick = (user) => {
        if (user.local_user_id) {
            openPositionDialog(user);
            return;
        }

        createLocalUserFromAd(user, openPositionDialog);
    };

    const handleRoleClick = (user) => {
        if (user.local_user_id) {
            openRoleDialog(user);
            return;
        }

        createLocalUserFromAd(user, openRoleDialog);
    };

    const submitRoleChange = () => {
        if (!roleDialogUser) return;

        roleForm.patch(
            route('users.role.update', roleDialogUser.local_user_id),
            {
                preserveScroll: true,
                onSuccess: () => {
                    setRoleDialogOpen(false);
                    setRoleDialogUser(null);
                    setRoleConfirmOpen(false);
                },
            },
        );
    };

    const renderSyncBadge = (user) => {
        return (
            <StatusBadge tone={user.is_synced ? 'success' : 'default'} className="inline-flex h-6 items-center gap-1 px-2 py-0 text-[10px] font-semibold">
                <span className={`h-1.5 w-1.5 rounded-full ${user.is_synced ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                {user.is_synced ? 'Да' : 'Нет'}
            </StatusBadge>
        );
    };

    const renderEditButton = (user) => {
        const missing = isBindingMissing(user);

        return (
            <Button
                type="button"
                variant="outline"
                size="sm"
                className={`h-7 rounded-md border px-2.5 text-[11px] font-medium shadow-sm ${missing ? 'border-amber-300 text-amber-700 hover:bg-amber-50' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
                onClick={() => handleEditClick(user)}
            >
                <Pencil className="h-3.5 w-3.5" />
                Редактировать
            </Button>
        );
    };

    const renderRoleButton = (user) => {
        const missing = isBindingMissing(user);

        return (
            <Button
                type="button"
                size="sm"
                variant={missing ? 'outline' : 'default'}
                className={`h-7 rounded-md px-2.5 text-[11px] font-semibold shadow-sm ${missing ? 'border-amber-300 text-amber-800 hover:bg-amber-50' : 'bg-[#17314f] text-white hover:bg-[#10263f]'}`}
                onClick={() => handleRoleClick(user)}
            >
                <ShieldPlus className="h-3.5 w-3.5" />
                Сменить роль
            </Button>
        );
    };

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="Platform"
                    title="Пользователи"
                    description="Управление сотрудниками, студентами и структурой доступа"
                    meta={(
                        <div className="flex flex-wrap gap-2">
                            <StatusBadge tone="default">Всего: {totalCount}</StatusBadge>
                            <StatusBadge tone="info">Видимых: {visibleCount}</StatusBadge>
                            <StatusBadge tone="warning">Без привязки: {users.filter((user) => user.is_binding_missing).length}</StatusBadge>
                        </div>
                    )}
                />
            )}
        >
            <Head title={pageTitle ?? 'Пользователи'} />

            <Dialog
                open={positionDialogOpen}
                onOpenChange={(open) => {
                    setPositionDialogOpen(open);
                    if (!open) {
                        setEditingUser(null);
                    }
                }}
            >
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Редактировать сотрудника</DialogTitle>
                        <DialogDescription>
                            {editingUser?.display_name ?? '—'}
                        </DialogDescription>
                    </DialogHeader>

                    <form className="space-y-4" onSubmit={submitPosition}>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Должность</label>
                            <select
                                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                                value={positionForm.data.position_id}
                                onChange={(e) => positionForm.setData('position_id', e.target.value)}
                            >
                                <option value="">— Не выбрано —</option>
                                {positions.map((position) => (
                                    <option key={position.id} value={position.id}>{position.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Кафедра</label>
                            <select
                                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                                value={positionForm.data.department_id}
                                onChange={(e) => positionForm.setData('department_id', e.target.value)}
                            >
                                <option value="">— Не выбрано —</option>
                                {departments.map((department) => (
                                    <option key={department.id} value={department.id}>{department.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Факультет</label>
                            <select
                                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                                value={positionForm.data.faculty_id}
                                onChange={(e) => positionForm.setData('faculty_id', e.target.value)}
                            >
                                <option value="">— Не выбрано —</option>
                                {faculties.map((faculty) => (
                                    <option key={faculty.id} value={faculty.id}>{faculty.name}</option>
                                ))}
                            </select>
                        </div>

                        {structuralDivisionOptions.length > 0 && (
                            <div className="space-y-2 rounded-lg border border-border p-3">
                                <p className="text-sm font-medium">Подразделения</p>
                                <div className="grid max-h-44 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
                                    {structuralDivisionOptions.map((division) => {
                                        const id = Number(division.id);
                                        const checked = positionForm.data.division_ids.includes(id);

                                        return (
                                            <label key={division.id} className="flex items-start gap-2 rounded px-2 py-1 hover:bg-muted/40">
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={(e) => {
                                                        positionForm.setData(
                                                            'division_ids',
                                                            e.target.checked
                                                                ? [...positionForm.data.division_ids, id]
                                                                : positionForm.data.division_ids.filter((value) => value !== id),
                                                        );
                                                    }}
                                                />
                                                <span className="text-xs">{division.name}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {requiresDangerousActionReason && (
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Причина</label>
                                <Input
                                    value={positionForm.data.reason}
                                    onChange={(e) => positionForm.setData('reason', e.target.value)}
                                    placeholder="Минимум 8 символов для опасного действия"
                                />
                                {positionForm.errors.reason && <p className="text-xs text-destructive">{positionForm.errors.reason}</p>}
                            </div>
                        )}

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setPositionDialogOpen(false)}>
                                Отмена
                            </Button>
                            <Button type="submit" disabled={positionForm.processing || (requiresDangerousActionReason && positionForm.data.reason.trim().length < 8)}>Сохранить</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog
                open={roleDialogOpen}
                onOpenChange={(open) => {
                    setRoleDialogOpen(open);
                    if (!open) {
                        setRoleDialogUser(null);
                        setRoleConfirmOpen(false);
                    }
                }}
            >
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Сменить роль</DialogTitle>
                        <DialogDescription>
                            {roleDialogUser?.display_name ?? '—'}
                        </DialogDescription>
                    </DialogHeader>

                    {!roleConfirmOpen ? (
                        <div className="space-y-3">
                            <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-sm">
                                Текущая роль: <span className="font-medium">{roleDialogUser ? resolveRoleLabel(roleDialogUser) : '—'}</span>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Новая роль</label>
                                <select
                                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                                    value={roleForm.data.role}
                                    onChange={(e) => roleForm.setData('role', e.target.value)}
                                >
                                    {ROLE_OPTIONS.map((role) => (
                                        <option key={role.value} value={role.value}>{role.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2 rounded-md border border-border bg-background px-3 py-2">
                                <label className="flex items-center gap-2 text-sm font-medium">
                                    <input
                                        type="checkbox"
                                        checked={!!roleForm.data.structural_access}
                                        onChange={(e) => {
                                            roleForm.setData('structural_access', e.target.checked);
                                            if (!e.target.checked) {
                                                roleForm.setData('structural_division_id', '');
                                            }
                                        }}
                                    />
                                    Также выдать доступ к структурному подразделению
                                </label>

                                {roleForm.data.structural_access && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Структурное подразделение</label>
                                        <select
                                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                                            value={roleForm.data.structural_division_id}
                                            onChange={(e) => roleForm.setData('structural_division_id', e.target.value)}
                                        >
                                            <option value="">— Выберите подразделение —</option>
                                            {structuralDivisionOptions.map((division) => (
                                                <option key={division.id} value={division.id}>{division.name}</option>
                                            ))}
                                        </select>
                                        {Array.isArray(roleDialogUser?.structural_access_division_ids) && roleDialogUser.structural_access_division_ids.length > 0 && (
                                            <p className="text-xs text-muted-foreground">
                                                Текущий доступ: {roleDialogUser.structural_access_division_ids.length} подраздел.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>

                            {requiresDangerousActionReason && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Причина</label>
                                    <Input
                                        value={roleForm.data.reason}
                                        onChange={(e) => roleForm.setData('reason', e.target.value)}
                                        placeholder="Минимум 8 символов для опасного действия"
                                    />
                                    {roleForm.errors.reason && <p className="text-xs text-destructive">{roleForm.errors.reason}</p>}
                                </div>
                            )}

                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setRoleDialogOpen(false)}>Отмена</Button>
                                <Button type="button" onClick={() => setRoleConfirmOpen(true)} disabled={requiresDangerousActionReason && roleForm.data.reason.trim().length < 8}>Далее</Button>
                            </DialogFooter>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                                Подтвердите смену роли на{' '}
                                <span className="font-semibold">{ROLE_OPTIONS.find((r) => r.value === roleForm.data.role)?.label ?? roleForm.data.role}</span>
                                {roleForm.data.structural_access && roleForm.data.structural_division_id ? (
                                    <>
                                        {' '}и выдать доступ к структурному подразделению
                                        <span className="font-semibold">{' '}
                                            {structuralDivisionOptions.find((division) => String(division.id) === String(roleForm.data.structural_division_id))?.name ?? '—'}
                                        </span>.
                                    </>
                                ) : '.'}
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setRoleConfirmOpen(false)}>Назад</Button>
                                <Button type="button" onClick={submitRoleChange} disabled={roleForm.processing || (requiresDangerousActionReason && roleForm.data.reason.trim().length < 8)}>Подтвердить</Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <div className="admin-page-wrap overflow-x-hidden px-4 lg:px-6">
                <div className="m-0 mx-auto w-full max-w-[1540px] min-w-0 overflow-hidden">
                    <FilterBar className="min-w-0 overflow-hidden rounded-2xl border-slate-300/80 bg-gradient-to-b from-white via-white to-slate-50/50 shadow-[0_14px_34px_-22px_rgba(15,23,42,0.45)]">
                        <div className="mb-3 flex min-w-0 flex-col gap-2 xl:flex-row xl:items-end xl:justify-between">
                            <div className="flex items-center gap-2 text-base font-semibold text-foreground">
                                <Users className="h-5 w-5 text-slate-700" />
                                {pageTitle ?? 'Пользователи'}
                            </div>
                            <div className="text-[11px] font-medium text-slate-600">
                                {summaryLine}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200/80 bg-slate-50/70 p-2">
                                {tabOptions.map((tabOption) => (
                                    <button
                                        key={tabOption.key}
                                        type="button"
                                        onClick={() => submitFilters({ tab: tabOption.key, page: 1 }, false, { suppressNextSearch: true })}
                                        className={tabClass(tabOption.key)}
                                    >
                                        {tabOption.label}
                                        <span className={badgeClass(tabOption.key)}>
                                            {counts[tabOption.key] ?? 0}
                                        </span>
                                    </button>
                                ))}
                            </div>

                            <div className="sticky top-[76px] z-20 rounded-xl border border-slate-200 bg-slate-100/85 p-2.5 shadow-[0_10px_20px_-18px_rgba(15,23,42,0.7)] backdrop-blur">
                                <div className="grid min-w-0 gap-2 md:grid-cols-2 xl:grid-cols-12">
                                    <div className="relative md:col-span-2 xl:col-span-5">
                                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                        <Input
                                            value={filterForm.data.q}
                                            onChange={(e) => filterForm.setData('q', e.target.value)}
                                            placeholder="Поиск по ФИО, email, логину, должности"
                                            className="h-8.5 rounded-lg border-slate-300 bg-white pl-9 text-sm shadow-sm"
                                        />
                                    </div>

                                    <select
                                        className="h-8.5 rounded-lg border border-slate-300 bg-white px-2.5 text-[12px] shadow-sm xl:col-span-2"
                                        value={filterForm.data.sort_by}
                                        onChange={(e) => filterForm.setData('sort_by', e.target.value)}
                                    >
                                        <option value="">Сортировка</option>
                                        <option value="name">По ФИО</option>
                                        <option value="last_login">По последнему входу</option>
                                        <option value="created_at">По дате добавления</option>
                                        <option value="login_count">По кол-ву входов</option>
                                        <option value="synced">По синхронизации</option>
                                        <option value="role">По статусу</option>
                                    </select>

                                    <select
                                        className="h-8.5 rounded-lg border border-slate-300 bg-white px-2.5 text-[12px] shadow-sm xl:col-span-2"
                                        value={filterForm.data.sort_dir}
                                        onChange={(e) => filterForm.setData('sort_dir', e.target.value)}
                                    >
                                        <option value="asc">A→Я / Старые→Новые</option>
                                        <option value="desc">Я→A / Новые→Старые</option>
                                    </select>

                                    <select
                                        className="h-8.5 rounded-lg border border-slate-300 bg-white px-2.5 text-[12px] shadow-sm xl:col-span-1"
                                        value={filterForm.data.synced}
                                        onChange={(e) => filterForm.setData('synced', e.target.value)}
                                    >
                                        <option value="all">Синхронизация: все</option>
                                        <option value="ad">Из AD</option>
                                        <option value="local">Локальные</option>
                                    </select>

                                    <select
                                        className="h-8.5 rounded-lg border border-slate-300 bg-white px-2.5 text-[12px] shadow-sm xl:col-span-1"
                                        value={filterForm.data.last_login_range}
                                        onChange={(e) => filterForm.setData('last_login_range', e.target.value)}
                                    >
                                        <option value="all">Вход</option>
                                        <option value="30">30 дн.</option>
                                        <option value="90">90 дн.</option>
                                        <option value="never">Никогда</option>
                                    </select>

                                    <select
                                        className="h-8.5 rounded-lg border border-slate-300 bg-white px-2.5 text-[12px] shadow-sm xl:col-span-1"
                                        value={filterForm.data.faculty_id}
                                        onChange={(e) => filterForm.setData('faculty_id', e.target.value)}
                                    >
                                        <option value="">Факультет</option>
                                        {faculties.map((faculty) => (
                                            <option key={faculty.id} value={faculty.id}>{faculty.name}</option>
                                        ))}
                                    </select>

                                    <select
                                        className="h-8.5 rounded-lg border border-slate-300 bg-white px-2.5 text-[12px] shadow-sm xl:col-span-2"
                                        value={filterForm.data.department_id}
                                        onChange={(e) => filterForm.setData('department_id', e.target.value)}
                                    >
                                        <option value="">Кафедра</option>
                                        {departments.map((department) => (
                                            <option key={department.id} value={department.id}>{department.name}</option>
                                        ))}
                                    </select>

                                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 pt-1 md:col-span-2 xl:col-span-12">
                                        <div className="text-[11px] font-semibold text-slate-600">
                                            Показано {pagination.from ?? 0}–{pagination.to ?? 0} из {pagination.total ?? 0}
                                        </div>
                                        <div className="ml-auto flex items-center gap-1.5">
                                            <Button type="button" className="h-8 rounded-md bg-[#17314f] px-3 text-[11px] font-semibold text-white shadow-sm hover:bg-[#10263f]" onClick={() => submitFilters({}, true, { suppressNextSearch: true })}>
                                                Применить
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="h-8 rounded-md border-slate-300 px-3 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-white"
                                                onClick={() => {
                                                    filterForm.setData({
                                                        q: '',
                                                        tab,
                                                        sort_by: '',
                                                        sort_dir: 'asc',
                                                        faculty_id: '',
                                                        department_id: '',
                                                        synced: 'all',
                                                        last_login_range: 'all',
                                                        per_page: filterForm.data.per_page,
                                                        page: 1,
                                                    });
                                                    submitFilters({
                                                        q: '',
                                                        sort_by: '',
                                                        sort_dir: 'asc',
                                                        faculty_id: '',
                                                        department_id: '',
                                                        synced: 'all',
                                                        last_login_range: 'all',
                                                        per_page: filterForm.data.per_page,
                                                        page: 1,
                                                    }, true, { suppressNextSearch: true });
                                                }}
                                            >
                                                <RefreshCw className="h-4 w-4" />
                                                Сбросить
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {tab === 'hod' && unboundHodCount > 0 && (
                                <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-amber-900">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 text-sm font-semibold">
                                            <AlertTriangle className="h-4 w-4" />
                                            {unboundHodCount} заведующих кафедрой без привязки
                                        </div>
                                        <Button type="button" size="sm" variant="outline" className="border-amber-300 text-amber-800 hover:bg-amber-100" onClick={() => setOnlyUnbound((v) => !v)}>
                                            {onlyUnbound ? 'Показать всех' : 'Показать только без привязки'}
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {tab === 'dean' && unboundDeanCount > 0 && (
                                <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-amber-900">
                                    <div className="flex items-center gap-2 text-sm font-semibold">
                                        <AlertTriangle className="h-4 w-4" />
                                        {unboundDeanCount} деканов без привязки к факультету
                                    </div>
                                </div>
                            )}

                            <DataTable className="rounded-2xl border-slate-300/80 bg-white shadow-[0_12px_24px_-18px_rgba(15,23,42,0.45)]">
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-0 table-fixed text-[13px] leading-[1.25] [&_td]:px-2.5 [&_td]:py-2.5 [&_th]:px-2.5 [&_th]:py-2 [&_th]:text-[11px] [&_th]:uppercase [&_th]:tracking-[0.16em] [&_tr]:border-b [&_tr]:border-slate-200/85 [&_th:nth-child(2)]:border-r-0 [&_td:nth-child(2)]:border-r-0 [&_th:nth-child(3)]:border-l-0 [&_td:nth-child(3)]:border-l-0">
                                        <thead className="bg-slate-100/95 backdrop-blur">
                                            <tr>
                                                <th className="w-[19%] text-slate-700">ФИО</th>
                                                <th className="w-[11%] pr-3 text-slate-700">Логин</th>
                                                <th className="w-[17%] pl-4 text-slate-700">Email</th>
                                                <th className="w-[11%] text-slate-700">Последний вход</th>
                                                <th className="w-[14%] text-slate-700">Должность / роль</th>
                                                <th className="w-[17%] text-slate-700">Факультет / кафедра</th>
                                                <th className="w-[7%] text-center text-slate-700">Входы</th>
                                                <th className="w-[7%] text-slate-700">Статус</th>
                                                <th className="w-[6%] text-slate-700">Синхр.</th>
                                                <th className="w-[11%] text-right text-slate-700">Действия</th>
                                            </tr>
                                        </thead>
                                        <tbody className="[&_tr:hover]:bg-slate-50/70 [&_tr]:transition-colors">
                                            {displayedUsers.length === 0 ? (
                                                <tr>
                                                    <td colSpan={10} className="px-4 py-10 text-center text-sm text-slate-500">
                                                        Пользователи не найдены
                                                    </td>
                                                </tr>
                                            ) : displayedUsers.map((user) => {
                                                const bindingMissing = isBindingMissing(user);
                                                const lastLoginTone = getLastLoginTone(user);

                                                return (
                                                    <tr key={user.id}>
                                                        <td className="align-top">
                                                            <div className="space-y-0.5">
                                                                <div className="line-clamp-2 text-[13px] font-semibold leading-[1.15rem] text-slate-900">
                                                                    {user.display_name || user.name || '—'}
                                                                </div>
                                                                <div className="truncate text-[11px] text-slate-500">
                                                                    {user.login || user.email || '—'}
                                                                </div>
                                                            </div>
                                                        </td>

                                                        <td className="align-middle pe-3">
                                                            <div className="inline-flex max-w-[120px] items-center rounded-md border border-slate-300/95 bg-slate-100 px-1.5 py-0.5">
                                                                <span className="block w-full truncate font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-700" title={user.login || ''}>
                                                                    {user.login || '—'}
                                                                </span>
                                                            </div>
                                                        </td>

                                                        <td className="min-w-0 align-middle pl-4">
                                                            <div className="flex min-w-0 items-center gap-2.5">
                                                                <Mail className="h-3 w-3 shrink-0 text-slate-400" />
                                                                <span className="block min-w-0 max-w-[190px] truncate text-[11px] leading-[1.05rem] text-slate-500" title={user.email || ''}>
                                                                    {user.email || '—'}
                                                                </span>
                                                            </div>
                                                        </td>

                                                        <td className="align-top">
                                                            <div className={`flex items-start gap-1.5 ${lastLoginTone}`} title={user.last_login_exact || ''}>
                                                                <Clock3 className="mt-0.5 h-3 w-3 shrink-0" />
                                                                <div className="min-w-0 space-y-0.5">
                                                                    <div className="truncate text-[12px] font-semibold leading-[1.1rem]">
                                                                        {user.last_login_human || formatLastLogin(user.last_login_at).label}
                                                                    </div>
                                                                    <div className="truncate text-[10px] text-slate-400">
                                                                        {user.last_login_exact ? formatExactTimestamp(user.last_login_at) : 'Пользователь ещё не входил'}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>

                                                        <td className="align-top">
                                                            <div className="space-y-1">
                                                                <Badge className={`inline-flex h-6 max-w-full items-center rounded-full border px-2 py-0 text-[10px] font-semibold ${getRoleBadgeClass(user)}`}>
                                                                    {resolveRoleLabel(user)}
                                                                </Badge>
                                                                {user.has_structural_access && (
                                                                    <Badge variant="outline" className="inline-flex h-6 max-w-full items-center rounded-full border-dashed px-2 py-0 text-[10px] font-semibold text-slate-600">
                                                                        KPI-доступ
                                                                    </Badge>
                                                                )}
                                                                <div className="line-clamp-2 text-[12px] font-medium leading-[1.1rem] text-slate-800" title={resolvePositionDisplay(user)}>
                                                                    {resolvePositionDisplay(user)}
                                                                </div>
                                                            </div>
                                                        </td>

                                                        <td className="align-top">
                                                            <div className="space-y-1 text-[12px]">
                                                                <div className="line-clamp-2 font-medium leading-[1.1rem] text-slate-900" title={user.display_faculty || user.faculty_name || ''}>
                                                                    {user.display_faculty || user.faculty_name || '—'}
                                                                </div>
                                                                <div className="line-clamp-2 text-slate-500" title={user.display_department || user.department_name || user.ad_department || ''}>
                                                                    {user.display_department || user.department_name || user.ad_department || '—'}
                                                                </div>
                                                                {Array.isArray(user.display_divisions) && user.display_divisions.length > 0 && (
                                                                    <div className="flex flex-wrap gap-1 pt-0.5">
                                                                        {user.display_divisions.slice(0, 2).map((division) => (
                                                                            <span key={`${user.id}-${division}`} className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                                                                                {division}
                                                                            </span>
                                                                        ))}
                                                                        {user.display_divisions.length > 2 && (
                                                                            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                                                                                +{user.display_divisions.length - 2}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                                {bindingMissing && (
                                                                    <Badge variant="outline" className={`inline-flex h-6 items-center rounded-full px-2 py-0 text-[10px] font-semibold ${getBindingBadgeClass(user)}`}>
                                                                        ⚠ Не привязан
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        </td>

                                                        <td className="align-top text-center">
                                                            <div className="inline-flex min-w-[52px] flex-col items-center gap-1">
                                                                <div className={`text-lg font-semibold tracking-tight ${user.login_count > 0 ? 'text-slate-900' : 'text-slate-400'}`}>
                                                                    {user.login_count}
                                                                </div>
                                                                <div className="h-1 w-12 overflow-hidden rounded-full bg-slate-100">
                                                                    <div
                                                                        className={`h-full rounded-full ${user.login_count > 0 ? 'bg-[#17314f]' : 'bg-slate-300'}`}
                                                                        style={{ width: `${Math.min(100, Math.max(6, user.login_count * 12))}%` }}
                                                                    />
                                                                </div>
                                                                <div className="text-[10px] text-slate-500">входов</div>
                                                            </div>
                                                        </td>

                                                        <td className="align-top">
                                                            <Badge variant="outline" className={`inline-flex h-6 items-center rounded-full px-2 py-0 text-[10px] font-semibold ${getBindingBadgeClass(user)}`}>
                                                                {user.binding_label || (bindingMissing ? '⚠ Не привязан' : 'Привязан')}
                                                            </Badge>
                                                        </td>

                                                        <td className="align-top">
                                                            {renderSyncBadge(user)}
                                                        </td>

                                                        <td className="align-top text-right">
                                                            <div className="flex min-h-[28px] flex-wrap items-center justify-end gap-1.5">
                                                                {renderEditButton(user)}
                                                                {renderRoleButton(user)}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </DataTable>

                            <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-100/80 px-3 py-2 lg:flex-row lg:items-center lg:justify-between">
                                <div className="text-xs font-medium text-slate-700">
                                    Показано {pagination.from ?? 0}–{pagination.to ?? 0} из {pagination.total ?? 0}
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400">На странице</span>
                                    <select
                                        className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs shadow-sm"
                                        value={filterForm.data.per_page}
                                        onChange={(e) => {
                                            const value = Number(e.target.value);
                                            filterForm.setData('per_page', value);
                                            submitFilters({ per_page: value, page: 1 }, true, { suppressNextSearch: true });
                                        }}
                                    >
                                        <option value={25}>25</option>
                                        <option value={50}>50</option>
                                        <option value={100}>100</option>
                                    </select>
                                </div>

                                <div className="flex flex-wrap items-center gap-1.5">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="h-8 rounded-md border-slate-300 px-2.5 text-xs shadow-sm"
                                        disabled={(pagination.current_page ?? 1) <= 1}
                                        onClick={() => submitFilters({ page: (pagination.current_page ?? 1) - 1 }, false, { suppressNextSearch: true })}
                                    >
                                        Назад
                                    </Button>

                                    {Array.from({ length: Math.max(1, Math.min(5, pagination.last_page ?? 1)) }).map((_, index) => {
                                        const currentPage = Number(pagination.current_page ?? 1);
                                        const lastPage = Number(pagination.last_page ?? 1);
                                        const start = Math.max(1, Math.min(currentPage - 2, lastPage - 4));
                                        const pageNumber = start + index;
                                        if (pageNumber > lastPage) {
                                            return null;
                                        }

                                        return (
                                            <Button
                                                key={pageNumber}
                                                type="button"
                                                size="sm"
                                                variant={pageNumber === currentPage ? 'default' : 'outline'}
                                                className={`h-8 rounded-md px-2.5 text-xs shadow-sm ${pageNumber === currentPage ? 'bg-[#17314f] hover:bg-[#10263f]' : 'border-slate-300 bg-white'}`}
                                                onClick={() => submitFilters({ page: pageNumber }, false, { suppressNextSearch: true })}
                                            >
                                                {pageNumber}
                                            </Button>
                                        );
                                    })}

                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="h-8 rounded-md border-slate-300 px-2.5 text-xs shadow-sm"
                                        disabled={(pagination.current_page ?? 1) >= (pagination.last_page ?? 1)}
                                        onClick={() => submitFilters({ page: (pagination.current_page ?? 1) + 1 }, false, { suppressNextSearch: true })}
                                    >
                                        Далее
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </FilterBar>
                </div>
            </div>
            <ConfirmDialog
                open={confirmState.open}
                onOpenChange={(open) => !open && setConfirmState({ open: false, description: '', onConfirm: null })}
                description={confirmState.description}
                onConfirm={() => {
                    confirmState.onConfirm?.();
                    setConfirmState({ open: false, description: '', onConfirm: null });
                }}
                confirmLabel="Создать"
                destructive={false}
            />
        </AuthenticatedLayout>
    );
}
