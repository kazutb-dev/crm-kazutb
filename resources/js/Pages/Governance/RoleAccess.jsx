import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { DataTable, FilterBar, PageHeader, StatusBadge } from '@/components/platform';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Head, router } from '@inertiajs/react';
import {
    AlertTriangle,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Filter,
    Search,
    ShieldAlert,
    ShieldCheck,
    Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';

const ROLE_BADGES = {
    superadmin: 'border-red-200 bg-red-50 text-red-800',
    admin: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800',
    hod: 'border-amber-200 bg-amber-50 text-amber-900',
    dean: 'border-violet-200 bg-violet-50 text-violet-900',
    structural: 'border-cyan-200 bg-cyan-50 text-cyan-900',
    teacher: 'border-blue-200 bg-blue-50 text-blue-900',
    student: 'border-indigo-200 bg-indigo-50 text-indigo-900',
    department: 'border-slate-200 bg-slate-100 text-slate-700',
    default: 'border-slate-200 bg-slate-100 text-slate-700',
};

const RISK_BADGES = {
    critical: 'border-red-200 bg-red-50 text-red-800',
    high: 'border-amber-200 bg-amber-50 text-amber-900',
    medium: 'border-yellow-200 bg-yellow-50 text-yellow-900',
    low: 'border-slate-200 bg-slate-100 text-slate-700',
};

const ROLE_STATUS_BADGES = {
    aligned: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    mismatch: 'border-red-200 bg-red-50 text-red-700',
    derived: 'border-amber-200 bg-amber-50 text-amber-700',
    missing: 'border-red-200 bg-red-50 text-red-700',
};

const RESOLVER_STATUS_BADGES = {
    exact: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    partial: 'border-amber-200 bg-amber-50 text-amber-700',
    missing: 'border-red-200 bg-red-50 text-red-700',
};

function SummaryCard({ title, value, subtitle, tone = 'slate', icon: Icon }) {
    const tones = {
        slate: 'border-slate-200 bg-white',
        blue: 'border-blue-200 bg-blue-50/35',
        green: 'border-emerald-200 bg-emerald-50/35',
        amber: 'border-amber-200 bg-amber-50/35',
        red: 'border-red-200 bg-red-50/35',
        violet: 'border-violet-200 bg-violet-50/35',
    };

    return (
        <Card className={`border shadow-sm ${tones[tone] ?? tones.slate}`}>
            <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{title}</p>
                        <p className="mt-1 text-3xl font-semibold text-slate-900">{(value ?? 0).toLocaleString('ru-RU')}</p>
                        {subtitle ? <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p> : null}
                    </div>
                    {Icon ? (
                        <div className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600">
                            <Icon className="h-4 w-4" />
                        </div>
                    ) : null}
                </div>
            </CardContent>
        </Card>
    );
}

function roleBadge(role) {
    return ROLE_BADGES[role] ?? ROLE_BADGES.default;
}

function severityBadge(severity) {
    return RISK_BADGES[severity] ?? RISK_BADGES.medium;
}

function roleStatusLabel(status) {
    switch (status) {
        case 'aligned':
            return 'Источник роли: OK';
        case 'mismatch':
            return 'Источник роли: конфликт';
        case 'derived':
            return 'Источник роли: вычислено';
        case 'missing':
            return 'Источник роли: отсутствует';
        default:
            return 'Источник роли: неизвестно';
    }
}

function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';

    return new Intl.DateTimeFormat('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}

function resolverStatusLabel(scope) {
    if (!scope) return 'Область не определена';
    if (scope.status_label) return scope.status_label;

    switch (scope.status) {
        case 'exact':
            return 'Область определена точно';
        case 'partial':
            return 'Область определена частично';
        case 'missing':
            return 'Область не определена';
        default:
            return 'Область неизвестна';
    }
}

export default function RoleAccess({ summary = {}, users = [], filters = {}, pagination = {}, options = {}, permissions = {} }) {
    const [selectedUser, setSelectedUser] = useState(null);
    const canManageFoundation = Boolean(permissions.canManageFoundation);

    const roleOptions = options.roles ?? [];
    const facultyOptions = options.faculties ?? [];
    const departmentOptions = options.departments ?? [];
    const structuralUnitOptions = options.structural_units ?? [];
    const grantOptions = options.grant_types ?? [];

    const form = {
        q: filters.q ?? '',
        role: filters.role ?? '',
        faculty_id: filters.faculty_id ?? '',
        department_id: filters.department_id ?? '',
        structural_unit_id: filters.structural_unit_id ?? '',
        grant: filters.grant ?? '',
        elevated: filters.elevated ?? '',
        missing_binding: filters.missing_binding ?? '',
        suspicious: filters.suspicious ?? '',
        per_page: Number(filters.per_page ?? pagination.per_page ?? 25),
    };

    const activeFilterCount = useMemo(() => {
        return [
            form.q,
            form.role,
            form.faculty_id,
            form.department_id,
            form.structural_unit_id,
            form.grant,
            form.elevated,
            form.missing_binding,
            form.suspicious,
        ].filter((v) => String(v ?? '').trim() !== '').length;
    }, [form.department_id, form.elevated, form.faculty_id, form.grant, form.missing_binding, form.q, form.role, form.structural_unit_id, form.suspicious]);

    const updateFilters = (patch, resetPage = true) => {
        const payload = {
            ...filters,
            ...patch,
        };

        if (resetPage) {
            payload.page = 1;
        }

        router.get(route('governance.role-access'), payload, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const clearFilters = () => {
        router.get(route('governance.role-access'), {
            per_page: form.per_page,
            page: 1,
        }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const goToPage = (page) => {
        if (!page || page < 1 || page > (pagination.last_page ?? 1)) {
            return;
        }

        updateFilters({ page }, false);
    };

    return (
        <AuthenticatedLayout>
            <Head title="Ролевой доступ" />

            <div className="admin-page-wrap space-y-5">
                <PageHeader
                    eyebrow="Управление доступом"
                    title="Ролевой доступ"
                    description="Обзор ролей, прав, орг. области, активного доступа и рисков."
                    actions={(
                        <Button variant="outline" size="sm" onClick={() => router.visit(route('governance.org-structure'))}>
                            Оргструктура
                        </Button>
                    )}
                    meta={<StatusBadge tone="info">Режим запрет-по-умолчанию</StatusBadge>}
                />

                {canManageFoundation ? (
                    <Card className="border-red-200 bg-red-50/40 shadow-sm">
                        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-4">
                            <div>
                                <p className="text-sm font-semibold text-red-900">Суперадмин-управление</p>
                                <p className="text-xs text-red-800">Редактирование, создание, удаление и принудительное переопределение выполняются через проверяемые процессы с обязательной причиной.</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button size="sm" variant="outline" onClick={() => router.visit(route('users.index'))}>Сотрудники</Button>
                                <Button size="sm" variant="outline" onClick={() => router.visit(route('users.students'))}>Студенты</Button>
                                <Button size="sm" variant="outline" onClick={() => router.visit(route('governance.access-requests'))}>Запросы согласования</Button>
                                <Button size="sm" variant="outline" onClick={() => router.visit(route('governance.authority-ledger'))}>Журнал полномочий</Button>
                            </div>
                        </CardContent>
                    </Card>
                ) : null}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <SummaryCard title="Всего пользователей" value={summary.total_users} tone="slate" icon={Users} />
                    <SummaryCard title="Суперадмины" value={summary.superadmins} tone="red" icon={ShieldAlert} />
                    <SummaryCard title="Администраторы" value={summary.admins} tone="violet" icon={ShieldCheck} />
                    <SummaryCard title="Повышенный доступ" value={summary.elevated} tone="amber" icon={AlertTriangle} />
                    <SummaryCard title="Бизнес-суперадмин" value={summary.business_super_admin} tone="blue" />
                    <SummaryCard title="Технический суперадмин" value={summary.technical_super_admin} tone="red" />
                    <SummaryCard title="Оператор платформы" value={summary.platform_operator} tone="violet" />
                    <SummaryCard title="Преподаватели" value={summary.teachers} tone="blue" />
                    <SummaryCard title="Студенты" value={summary.students} tone="blue" />
                    <SummaryCard title="Профили сотрудников" value={summary.employee_profiles} tone="slate" />
                    <SummaryCard title="Профили студентов" value={summary.student_profiles} tone="blue" />
                    <SummaryCard title="Двойной контекст" value={summary.dual_context} tone="violet" />
                    <SummaryCard title="Готовность академического контура" value={summary.academic_ready} tone="green" />
                    <SummaryCard title="Кураторский контур" value={summary.curator_scope} tone="violet" />
                    <SummaryCard title="Регистраторский контур" value={summary.registrar_scope} tone="blue" />
                    <SummaryCard title="Без орг. привязки" value={summary.without_org_binding} tone="amber" />
                    <SummaryCard title="Риски" value={summary.suspicious} tone="red" />
                    <SummaryCard title="KPI расхождения" value={summary.kpi_mismatch} tone="amber" />
                </div>

                <FilterBar>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-base font-semibold text-foreground">
                            <Filter className="h-4 w-4" />
                            Фильтры и обзор
                        </div>
                        <StatusBadge tone="default">Активно фильтров: {activeFilterCount}</StatusBadge>
                    </div>

                    <div className="space-y-3">
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-5">
                            <div className="relative xl:col-span-2">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    value={form.q}
                                    onChange={(e) => updateFilters({ q: e.target.value })}
                                    className="pl-9"
                                    placeholder="Поиск: ФИО, login, email"
                                />
                            </div>

                            <select
                                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                value={form.role}
                                onChange={(e) => updateFilters({ role: e.target.value })}
                            >
                                <option value="">Все роли</option>
                                {roleOptions.map((role) => (
                                    <option key={role.value} value={role.value}>{role.label}</option>
                                ))}
                            </select>

                            <select
                                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                value={form.grant}
                                onChange={(e) => updateFilters({ grant: e.target.value })}
                            >
                                <option value="">Все права</option>
                                {grantOptions.map((grant) => (
                                    <option key={grant.value} value={grant.value}>{grant.label}</option>
                                ))}
                            </select>

                            <select
                                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                value={form.elevated}
                                onChange={(e) => updateFilters({ elevated: e.target.value })}
                            >
                                <option value="">Повышенный доступ: все</option>
                                <option value="1">Только с повышенным доступом</option>
                                <option value="0">Без повышенного доступа</option>
                            </select>
                        </div>

                        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-5">
                            <select
                                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                value={form.faculty_id}
                                onChange={(e) => updateFilters({ faculty_id: e.target.value })}
                            >
                                <option value="">Все факультеты</option>
                                {facultyOptions.map((faculty) => (
                                    <option key={faculty.id} value={faculty.id}>{faculty.name}</option>
                                ))}
                            </select>

                            <select
                                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                value={form.department_id}
                                onChange={(e) => updateFilters({ department_id: e.target.value })}
                            >
                                <option value="">Все кафедры</option>
                                {departmentOptions.map((department) => (
                                    <option key={department.id} value={department.id}>{department.name}</option>
                                ))}
                            </select>

                            <select
                                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                value={form.structural_unit_id}
                                onChange={(e) => updateFilters({ structural_unit_id: e.target.value })}
                            >
                                <option value="">Все структурные единицы</option>
                                {structuralUnitOptions.map((unit) => (
                                    <option key={unit.id} value={unit.id}>{unit.name}</option>
                                ))}
                            </select>

                            <select
                                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                value={form.missing_binding}
                                onChange={(e) => updateFilters({ missing_binding: e.target.value })}
                            >
                                <option value="">Привязка: все</option>
                                <option value="1">Без привязки</option>
                            </select>

                            <div className="flex gap-2">
                                <select
                                    className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                                    value={form.suspicious}
                                    onChange={(e) => updateFilters({ suspicious: e.target.value })}
                                >
                                    <option value="">Риск: все</option>
                                    <option value="1">Только подозрительные</option>
                                </select>
                                <Button variant="outline" onClick={clearFilters}>Сброс</Button>
                            </div>
                        </div>
                    </div>
                </FilterBar>

                <DataTable>
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 px-4 py-3">
                            <div className="text-base font-semibold text-foreground">
                                Текущие роли и доступы
                                <span className="ml-2 text-sm font-normal text-muted-foreground">
                                    ({pagination.total ?? users.length} записей)
                                </span>
                            </div>
                        <StatusBadge tone="default">Табличный вид</StatusBadge>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-[1300px]">
                                <thead>
                                    <tr>
                                        <th>Пользователь</th>
                                        <th>Роль</th>
                                        <th>Привязка к орг.</th>
                                        <th>Структурные</th>
                                        <th>Должность / титул</th>
                                        <th>Права</th>
                                        <th>Активный / повышенный</th>
                                        <th>Маркеры риска</th>
                                        <th className="text-right">Действия</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                                                Нет данных по заданным фильтрам.
                                            </td>
                                        </tr>
                                    ) : users.map((user) => (
                                        <tr key={user.id} className="align-top">
                                            <td>
                                                <div className="font-medium text-slate-900">{user.full_name}</div>
                                                <div className="mt-0.5 text-xs text-muted-foreground">{user.email || '—'}</div>
                                                <div className="mt-0.5 text-xs text-muted-foreground">Логин: {user.ad_login || '—'}</div>
                                                <div className="mt-1 text-[11px] text-slate-500">Последний вход: {formatDate(user.last_login_at)}</div>
                                            </td>
                                            <td>
                                                <div className="flex flex-wrap gap-1.5">
                                                    <Badge variant="outline" className={roleBadge(user.resolved_role)}>
                                                        {user.resolved_role_label}
                                                    </Badge>
                                                    <Badge variant="outline" className={ROLE_STATUS_BADGES[user.role_status] ?? ROLE_STATUS_BADGES.aligned}>
                                                        {roleStatusLabel(user.role_status)}
                                                    </Badge>
                                                </div>
                                                <div className="mt-1 text-xs text-muted-foreground">
                                                    Исходная роль: {user.raw_role || '—'} · ID роли: {user.role_id ?? '—'}
                                                </div>
                                            </td>
                                            <td>
                                                <div className="text-sm">Факультет: {user.faculty?.name || '—'}</div>
                                                <div className="text-sm">Кафедра: {user.department?.name || '—'}</div>
                                                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                                    <Badge
                                                        variant="outline"
                                                        className={RESOLVER_STATUS_BADGES[user.resolved_org_scope?.status] ?? RESOLVER_STATUS_BADGES.missing}
                                                    >
                                                        {resolverStatusLabel(user.resolved_org_scope)}
                                                    </Badge>
                                                        {user.resolved_org_scope?.primary_scope?.org_unit?.name ? (
                                                            <span className="text-xs text-slate-600">
                                                                {user.resolved_org_scope.primary_scope.org_unit.name}
                                                            </span>
                                                        ) : null}
                                                </div>
                                                {user.missing_binding ? (
                                                    <Badge variant="outline" className="mt-1 border-amber-200 bg-amber-50 text-amber-800">Привязка отсутствует</Badge>
                                                ) : null}
                                            </td>
                                            <td>
                                                {user.structural_units?.length ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {user.structural_units.slice(0, 2).map((unit) => (
                                                            <Badge key={unit.id} variant="outline" className="border-cyan-200 bg-cyan-50 text-cyan-800">
                                                                {unit.name}
                                                            </Badge>
                                                        ))}
                                                        {user.structural_units.length > 2 ? (
                                                            <Badge variant="outline">+{user.structural_units.length - 2}</Badge>
                                                        ) : null}
                                                    </div>
                                                ) : (
                                                    <span className="text-sm text-muted-foreground">—</span>
                                                )}
                                            </td>
                                            <td>
                                                <div className="text-sm text-slate-900">{user.position || '—'}</div>
                                                <div className="text-xs text-muted-foreground">AD-титул: {user.ad_title || '—'}</div>
                                            </td>
                                            <td>
                                                {user.grants?.length ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {user.grants.slice(0, 3).map((grant) => (
                                                            <Badge key={grant.id} variant="outline" className="border-blue-200 bg-blue-50 text-blue-800">
                                                                {grant.label}
                                                            </Badge>
                                                        ))}
                                                        {user.grants.length > 3 ? (
                                                            <Badge variant="outline">+{user.grants.length - 3}</Badge>
                                                        ) : null}
                                                    </div>
                                                ) : (
                                                    <span className="text-sm text-muted-foreground">—</span>
                                                )}
                                            </td>
                                            <td>
                                                <div className="space-y-1">
                                                    <StatusBadge tone={user.is_elevated ? 'danger' : 'success'}>
                                                        {user.is_elevated ? 'Повышенный доступ' : 'Стандартный доступ'}
                                                    </StatusBadge>
                                                    <div className="flex flex-wrap gap-1">
                                                        {user.elevated_authority?.has_business ? (
                                                            <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-800">Бизнес</Badge>
                                                        ) : null}
                                                        {user.elevated_authority?.has_technical ? (
                                                            <Badge variant="outline" className="border-red-200 bg-red-50 text-red-800">Технический</Badge>
                                                        ) : null}
                                                        {user.elevated_authority?.has_operator ? (
                                                            <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-800">Оператор</Badge>
                                                        ) : null}
                                                        {user.academic_scope?.student_profile?.exists ? (
                                                            <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-800">Профиль студента</Badge>
                                                        ) : null}
                                                        {user.academic_scope?.employee_profile?.exists ? (
                                                            <Badge variant="outline" className="border-slate-200 bg-slate-100 text-slate-700">Профиль сотрудника</Badge>
                                                        ) : null}
                                                        {user.academic_scope?.dual_context ? (
                                                            <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-800">Двойной контекст</Badge>
                                                        ) : null}
                                                    </div>
                                                    {user.kpi_authority?.mismatch_count > 0 ? (
                                                        <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                                                            Расхождение KPI: {user.kpi_authority.mismatch_count}
                                                        </Badge>
                                                    ) : null}
                                                    <div className="text-xs text-muted-foreground">
                                                        {user.effective_access?.length ? user.effective_access[0] : 'Нет явных расширений'}
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                {user.risk_flags?.length ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {user.risk_flags.slice(0, 2).map((risk) => (
                                                            <Badge key={risk.code} variant="outline" className={severityBadge(risk.severity)}>
                                                                {risk.label}
                                                            </Badge>
                                                        ))}
                                                        {user.risk_flags.length > 2 ? (
                                                            <Badge variant="outline">+{user.risk_flags.length - 2}</Badge>
                                                        ) : null}
                                                    </div>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-xs text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />Нет явных рисков</span>
                                                )}
                                            </td>
                                            <td className="text-right">
                                                <Button size="sm" variant="outline" onClick={() => setSelectedUser(user)}>
                                                    Детали
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                            <div className="text-sm text-muted-foreground">
                                Показано {pagination.from ?? 0}-{pagination.to ?? 0} из {pagination.total ?? 0}
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={(pagination.current_page ?? 1) <= 1}
                                    onClick={() => goToPage((pagination.current_page ?? 1) - 1)}
                                >
                                    <ChevronLeft className="mr-1 h-4 w-4" /> Назад
                                </Button>
                                <span className="text-sm text-muted-foreground">
                                    Стр. {pagination.current_page ?? 1} / {pagination.last_page ?? 1}
                                </span>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={(pagination.current_page ?? 1) >= (pagination.last_page ?? 1)}
                                    onClick={() => goToPage((pagination.current_page ?? 1) + 1)}
                                >
                                    Вперёд <ChevronRight className="ml-1 h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                </DataTable>
            </div>

            <Dialog open={Boolean(selectedUser)} onOpenChange={(open) => !open && setSelectedUser(null)}>
                <DialogContent className="max-w-4xl">
                    {selectedUser ? (
                        <>
                            <DialogHeader>
                                <DialogTitle>Снимок effective access: {selectedUser.full_name}</DialogTitle>
                                <DialogDescription>
                                    Текущая интерпретация доступа для управления и аудита.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm">Идентичность</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-1 text-sm">
                                        <div><span className="text-muted-foreground">Эл. почта:</span> {selectedUser.email || '—'}</div>
                                        <div><span className="text-muted-foreground">Логин:</span> {selectedUser.ad_login || '—'}</div>
                                        <div><span className="text-muted-foreground">Синхронизация:</span> {selectedUser.sync_state === 'ad' ? 'AD связан' : 'Локально'}</div>
                                        <div><span className="text-muted-foreground">Последний вход:</span> {formatDate(selectedUser.last_login_at)}</div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm">Модель роли</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-1 text-sm">
                                        <div><span className="text-muted-foreground">Вычисленная роль:</span> {selectedUser.resolved_role_label}</div>
                                        <div><span className="text-muted-foreground">Исходная роль:</span> {selectedUser.raw_role || '—'}</div>
                                        <div><span className="text-muted-foreground">ID роли:</span> {selectedUser.role_id ?? '—'}</div>
                                        <div><span className="text-muted-foreground">Ссылка на роль:</span> {selectedUser.role_ref_slug || '—'}</div>
                                        <Badge variant="outline" className={ROLE_STATUS_BADGES[selectedUser.role_status] ?? ROLE_STATUS_BADGES.aligned}>
                                            {roleStatusLabel(selectedUser.role_status)}
                                        </Badge>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm">Орг. область</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-1 text-sm">
                                        <div><span className="text-muted-foreground">Факультет:</span> {selectedUser.faculty?.name || '—'}</div>
                                        <div><span className="text-muted-foreground">Кафедра:</span> {selectedUser.department?.name || '—'}</div>
                                        <div><span className="text-muted-foreground">Структурные подразделения:</span></div>
                                        {selectedUser.structural_units?.length ? (
                                            <div className="flex flex-wrap gap-1">
                                                {selectedUser.structural_units.map((unit) => (
                                                    <Badge key={unit.id} variant="outline" className="border-cyan-200 bg-cyan-50 text-cyan-800">
                                                        {unit.name}
                                                    </Badge>
                                                ))}
                                            </div>
                                        ) : <div className="text-muted-foreground">—</div>}
                                        {selectedUser.missing_binding ? (
                                            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">Привязка отсутствует</Badge>
                                        ) : null}
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm">Сопоставление: устаревший → орг. единица</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2 text-sm">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Badge
                                                variant="outline"
                                                className={RESOLVER_STATUS_BADGES[selectedUser.resolved_org_scope?.status] ?? RESOLVER_STATUS_BADGES.missing}
                                            >
                                                {resolverStatusLabel(selectedUser.resolved_org_scope)}
                                            </Badge>
                                            <span className="text-xs text-muted-foreground">
                                                сопоставлено {selectedUser.resolved_org_scope?.resolved_total ?? 0} / {selectedUser.resolved_org_scope?.sources_total ?? 0}
                                            </span>
                                        </div>

                                        <div>
                                            <span className="text-muted-foreground">Основной:</span>{' '}
                                            {selectedUser.resolved_org_scope?.primary_scope?.org_unit?.name
                                                ? `${selectedUser.resolved_org_scope.primary_scope.org_unit.name} (${selectedUser.resolved_org_scope.primary_scope?.mapping_kind ?? 'сопоставлен'})`
                                                : '—'}
                                        </div>

                                        <div>
                                            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">Сопоставленные юниты</p>
                                            {selectedUser.resolved_org_scope?.resolved_units?.length ? (
                                                <ul className="space-y-1 text-xs text-slate-700">
                                                    {selectedUser.resolved_org_scope.resolved_units.slice(0, 6).map((entry, idx) => (
                                                        <li key={`${entry?.org_unit?.id ?? 'na'}-${idx}`}>
                                                            {entry?.source_type || 'источник'}: {entry?.org_unit?.name || '—'} ({entry?.mapping_type || 'сопоставлен'})
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <p className="text-xs text-muted-foreground">Нет сопоставленных юнитов</p>
                                            )}
                                        </div>

                                        <div>
                                            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">Несопоставленные источники</p>
                                            {selectedUser.resolved_org_scope?.missing_mappings?.length ? (
                                                <ul className="space-y-1 text-xs text-red-700">
                                                    {selectedUser.resolved_org_scope.missing_mappings.slice(0, 6).map((entry, idx) => (
                                                        <li key={`${entry?.source_type || 'src'}-${entry?.source_id || idx}-${idx}`}>
                                                            {entry?.source_type || 'источник'} #{entry?.source_id ?? '—'}
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <p className="text-xs text-emerald-700">Несопоставленных источников нет</p>
                                            )}
                                        </div>

                                        <div>
                                            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">Конфликты области</p>
                                            {selectedUser.resolved_org_scope?.inconsistencies?.length ? (
                                                <ul className="space-y-1 text-xs text-amber-700">
                                                    {selectedUser.resolved_org_scope.inconsistencies.slice(0, 4).map((item, idx) => (
                                                        <li key={`${item}-${idx}`}>{item}</li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <p className="text-xs text-emerald-700">Конфликты не обнаружены</p>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm">Права и активный доступ</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2 text-sm">
                                        <div className="flex flex-wrap gap-1">
                                            {selectedUser.grants?.length ? selectedUser.grants.map((grant) => (
                                                <Badge key={grant.id} variant="outline" className="border-blue-200 bg-blue-50 text-blue-800">
                                                    {grant.label}
                                                </Badge>
                                            )) : <span className="text-muted-foreground">Активных прав нет</span>}
                                        </div>
                                        <div>
                                            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">Почему доступ вычислен</p>
                                            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                                                {selectedUser.effective_access?.length ? selectedUser.effective_access.map((reason) => (
                                                    <li key={reason}>{reason}</li>
                                                )) : <li>Нет дополнительных источников доступа</li>}
                                            </ul>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm">Полномочия KPI и управления</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2 text-sm">
                                        <div className="flex flex-wrap gap-2">
                                            <Badge variant="outline" className={selectedUser.kpi_authority?.position_confirmed ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}>
                                                {selectedUser.kpi_authority?.position_confirmed ? 'Позиция подтверждена' : 'Позиция ожидает подтверждения'}
                                            </Badge>
                                            <Badge variant="outline" className={(selectedUser.kpi_authority?.mismatch_count ?? 0) > 0 ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}>
                                                Расхождение устаревшего и управляемого контура: {selectedUser.kpi_authority?.mismatch_count ?? 0}
                                            </Badge>
                                        </div>

                                        <div>
                                            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">Источники полномочий</p>
                                            <div className="flex flex-wrap gap-1">
                                                {selectedUser.kpi_authority?.sources?.length ? selectedUser.kpi_authority.sources.map((source) => (
                                                    <Badge key={source} variant="outline" className="border-blue-200 bg-blue-50 text-blue-800">
                                                        {source}
                                                    </Badge>
                                                )) : <span className="text-muted-foreground">Источник KPI не найден</span>}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                                            <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                                                <div className="text-xs text-muted-foreground">Устаревший доступ</div>
                                                <div className="text-base font-semibold text-slate-900">{selectedUser.kpi_authority?.legacy_allow_count ?? 0}</div>
                                            </div>
                                            <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                                                <div className="text-xs text-muted-foreground">Управляемый доступ</div>
                                                <div className="text-base font-semibold text-slate-900">{selectedUser.kpi_authority?.governance_allow_count ?? 0}</div>
                                            </div>
                                            <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                                                <div className="text-xs text-muted-foreground">Проверки очередей</div>
                                                <div className="text-base font-semibold text-slate-900">{Object.keys(selectedUser.kpi_authority?.queue ?? {}).length}</div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm">Категории повышенных полномочий</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2 text-sm">
                                        <div className="flex flex-wrap gap-2">
                                            {selectedUser.elevated_authority?.has_business ? (
                                                <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-800">Бизнес-суперадмин</Badge>
                                            ) : null}
                                            {selectedUser.elevated_authority?.has_technical ? (
                                                <Badge variant="outline" className="border-red-200 bg-red-50 text-red-800">Технический суперадмин</Badge>
                                            ) : null}
                                            {selectedUser.elevated_authority?.has_operator ? (
                                                <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-800">Оператор платформы</Badge>
                                            ) : null}
                                            {!selectedUser.elevated_authority?.has_business && !selectedUser.elevated_authority?.has_technical && !selectedUser.elevated_authority?.has_operator ? (
                                                <span className="text-muted-foreground">Повышенная категория не найдена</span>
                                            ) : null}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            Источник: {selectedUser.elevated_authority?.source || 'нет'}
                                        </div>
                                        {selectedUser.elevated_authority?.mixed_elevated ? (
                                            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">Смешанные повышенные полномочия</Badge>
                                        ) : null}
                                        {selectedUser.elevated_authority?.legacy_broad ? (
                                            <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">Активен широкий устаревший резервный режим</Badge>
                                        ) : null}
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm">Готовность академического контура</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2 text-sm">
                                        <div className="flex flex-wrap gap-2">
                                            <Badge variant="outline" className={selectedUser.academic_scope?.status === 'ready' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : selectedUser.academic_scope?.status === 'partial' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-red-200 bg-red-50 text-red-700'}>
                                                {selectedUser.academic_scope?.status_label || 'Академический контур отсутствует'}
                                            </Badge>
                                            {selectedUser.academic_scope?.employee_profile?.exists ? (
                                                <Badge variant="outline" className="border-slate-200 bg-slate-100 text-slate-700">Профиль сотрудника связан</Badge>
                                            ) : null}
                                            {selectedUser.academic_scope?.student_profile?.exists ? (
                                                <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-800">Профиль студента связан</Badge>
                                            ) : null}
                                            {selectedUser.academic_scope?.dual_context ? (
                                                <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-800">Двойной контекст</Badge>
                                            ) : null}
                                        </div>

                                        <div className="flex flex-wrap gap-1">
                                            {selectedUser.academic_scope?.curator_scope_exists ? (
                                                <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-800">Кураторский контур есть</Badge>
                                            ) : null}
                                            {selectedUser.academic_scope?.registrar_scope_exists ? (
                                                <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-800">Контур регистратора есть</Badge>
                                            ) : null}
                                            {selectedUser.academic_scope?.academic_admin_scope_exists ? (
                                                <Badge variant="outline" className="border-cyan-200 bg-cyan-50 text-cyan-800">Контур академического администрирования есть</Badge>
                                            ) : null}
                                        </div>

                                        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                                            <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                                                <div className="text-xs text-muted-foreground">Ожидающие академические запросы</div>
                                                <div className="text-base font-semibold text-slate-900">{selectedUser.academic_scope?.pending_academic_requests ?? 0}</div>
                                            </div>
                                            <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                                                <div className="text-xs text-muted-foreground">Активные назначения</div>
                                                <div className="text-base font-semibold text-slate-900">{selectedUser.academic_scope?.active_scope_assignments?.length ?? 0}</div>
                                            </div>
                                            <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                                                <div className="text-xs text-muted-foreground">Внешний ID Platonus</div>
                                                <div className="text-base font-semibold text-slate-900">{selectedUser.academic_scope?.platonus_readiness?.has_upstream_external_id ? 'да' : 'нет'}</div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">Риски и несоответствия</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {selectedUser.risk_flags?.length ? (
                                        <div className="flex flex-wrap gap-2">
                                            {selectedUser.risk_flags.map((risk) => (
                                                <Badge key={risk.code} variant="outline" className={severityBadge(risk.severity)}>
                                                    {risk.label}
                                                </Badge>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-emerald-700">Явных маркеров риска не обнаружено.</p>
                                    )}
                                    <div className="mt-3 text-xs text-muted-foreground">
                                        Ожидающие position requests: {selectedUser.pending_position_requests ?? 0}
                                    </div>
                                </CardContent>
                            </Card>
                        </>
                    ) : null}
                </DialogContent>
            </Dialog>
        </AuthenticatedLayout>
    );
}
