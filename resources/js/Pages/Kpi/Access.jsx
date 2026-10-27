import { ConfirmDialog } from '@/components/ConfirmDialog';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Notice, PageHeader, StatGrid, StatTile, StatusBadge, qdFieldClass } from '@/components/platform';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Head, router } from '@inertiajs/react';
import { Building2, Inbox, Search, ShieldCheck, ShieldOff, ShieldPlus, Trash2, UserPlus, Users, X } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
function formatDate(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
}

/** Строка в выпадающем списке сотрудника при поиске */
function UserSearchRow({ user, permissions_list, permission_labels, grantedPerms, grantedDivisions, structuralDivisions, onGrant, onGrantAll }) {
    const [selectedPerm, setSelectedPerm] = useState(permissions_list[0] ?? '');
    const [selectedDivision, setSelectedDivision] = useState('');
    const isStructural = selectedPerm === 'structural_queue';
    // For structural_queue, check if this specific division is already granted
    const alreadyHas = isStructural
        ? selectedDivision !== '' && (grantedDivisions.get(selectedPerm) ?? new Set()).has(Number(selectedDivision))
        : grantedPerms.has(selectedPerm);
    const hasAll = permissions_list.every((p) => grantedPerms.has(p));

    return (
        <div className="space-y-2 border-b border-slate-200 px-4 py-3 last:border-0">
            <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-[200px] flex-1">
                    <div className="truncate text-sm font-medium text-slate-900">{user.name}</div>
                    <div className="truncate text-xs text-slate-500">
                        {user.email}
                        {user.ad_department ? ` · ${user.ad_department}` : ''}
                        {user.ad_title ? ` · ${user.ad_title}` : ''}
                    </div>
                </div>
                <select
                    className={`${qdFieldClass} h-9 w-auto max-w-[240px]`}
                    aria-label="Модуль"
                    value={selectedPerm}
                    onChange={(e) => { setSelectedPerm(e.target.value); setSelectedDivision(''); }}
                >
                    {permissions_list.map((p) => (
                        <option key={p} value={p}>{permission_labels[p] ?? p}</option>
                    ))}
                </select>
                {isStructural && (
                    <select
                        className={`${qdFieldClass} h-9 w-auto max-w-[220px]`}
                        aria-label="Подразделение"
                        value={selectedDivision}
                        onChange={(e) => setSelectedDivision(e.target.value)}
                    >
                        <option value="">— выберите подразделение —</option>
                        {structuralDivisions.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                    </select>
                )}
                <div className="flex gap-2">
                    <Button
                        size="sm"
                        variant={alreadyHas ? 'outline' : 'default'}
                        disabled={alreadyHas || (isStructural && selectedDivision === '')}
                        onClick={() => onGrant(user.id, selectedPerm, isStructural ? Number(selectedDivision) : null)}
                    >
                        <UserPlus className="h-3.5 w-3.5" />
                        {alreadyHas ? 'Выдан' : 'Выдать'}
                    </Button>
                    <Button
                        size="sm"
                        variant={hasAll ? 'outline' : 'secondary'}
                        disabled={hasAll}
                        onClick={() => onGrantAll(user.id)}
                        title="Выдать доступ ко всем модулям (кроме структурных)"
                    >
                        <ShieldPlus className="h-3.5 w-3.5" />
                        Все
                    </Button>
                </div>
            </div>
            {grantedPerms.size > 0 && (
                <div className="flex flex-wrap gap-1">
                    {permissions_list.filter((p) => grantedPerms.has(p)).map((p) => (
                        <Badge key={p} variant="secondary" className="text-[11px]">
                            {permission_labels[p] ?? p}
                        </Badge>
                    ))}
                </div>
            )}
        </div>
    );
}

// Empty state for use inside a card (the platform EmptyState is itself a card).
function InlineEmpty({ title, description = null, action = null }) {
    return (
        <div className="flex flex-col items-center justify-center gap-3 px-5 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-100 text-teal-700">
                <Inbox className="h-6 w-6" />
            </div>
            <div className="max-w-md space-y-1">
                <p className="font-display text-base font-bold text-[#102945]">{title}</p>
                {description ? <p className="text-sm leading-relaxed text-slate-600">{description}</p> : null}
            </div>
            {action}
        </div>
    );
}

export default function Access({ grants = [], users = [], search = '', permissions_list = [], permission_labels = {}, structural_divisions = [] }) {
    const [confirmState, setConfirmState] = useState({ open: false, description: '', onConfirm: null });
    const [searchInput, setSearchInput] = useState(search);
    const [localQuery, setLocalQuery] = useState('');
    const searchRef = useRef(null);
    const debounceRef = useRef(null);

    // Группируем гранты по пользователю
    const grouped = useMemo(() => {
        const map = new Map();
        for (const grant of grants) {
            const uid = grant.user_id;
            if (!map.has(uid)) map.set(uid, { user: grant.user, grants: [] });
            map.get(uid).grants.push(grant);
        }
        return Array.from(map.values()).sort((a, b) =>
            (a.user?.name ?? '').localeCompare(b.user?.name ?? '', 'ru'),
        );
    }, [grants]);

    // Уже выданные гранты по user_id → Set<permission>
    const grantsByUser = useMemo(() => {
        const map = new Map();
        for (const grant of grants) {
            if (!map.has(grant.user_id)) map.set(grant.user_id, new Set());
            if (grant.is_active) map.get(grant.user_id).add(grant.permission);
        }
        return map;
    }, [grants]);

    // For structural_queue: user_id → Map<permission, Set<division_id>>
    const grantedDivisionsByUser = useMemo(() => {
        const map = new Map();
        for (const grant of grants) {
            if (!grant.is_active || grant.division_id == null) continue;
            if (!map.has(grant.user_id)) map.set(grant.user_id, new Map());
            const permMap = map.get(grant.user_id);
            if (!permMap.has(grant.permission)) permMap.set(grant.permission, new Set());
            permMap.get(grant.permission).add(grant.division_id);
        }
        return map;
    }, [grants]);

    // Клиентская фильтрация списка users (уже пришёл с сервера по search)
    const filteredUsers = useMemo(() => {
        const q = localQuery.trim().toLowerCase();
        if (!q) return users;
        return users.filter(
            (u) =>
                (u.name ?? '').toLowerCase().includes(q) ||
                (u.email ?? '').toLowerCase().includes(q) ||
                (u.ad_department ?? '').toLowerCase().includes(q),
        );
    }, [users, localQuery]);

    // Серверный поиск (debounced)
    const handleSearchChange = useCallback((e) => {
        const val = e.target.value;
        setSearchInput(val);
        setLocalQuery(val);
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            router.get(route('kpi.access.index'), { search: val || undefined }, {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            });
        }, 400);
    }, []);

    const clearSearch = () => {
        setSearchInput('');
        setLocalQuery('');
        router.get(route('kpi.access.index'), {}, { preserveState: true, preserveScroll: true, replace: true });
        searchRef.current?.focus();
    };

    const grantAccess = (userId, permission, divisionId = null) => {
        router.post(route('kpi.access.store'), { user_id: userId, permission, division_id: divisionId || undefined }, { preserveScroll: true });
    };

    const grantAll = (userId) => {
        const existing = grantsByUser.get(userId) ?? new Set();
        const missing = permissions_list.filter((p) => !existing.has(p));
        if (missing.length === 0) return;
        // Отправляем по очереди через router.visit, последний — с reload
        missing.forEach((permission, idx) => {
            const isLast = idx === missing.length - 1;
            router.post(route('kpi.access.store'), { user_id: userId, permission }, {
                preserveScroll: true,
                preserveState: !isLast,
            });
        });
    };

    const toggleActive = (grant) => {
        router.patch(route('kpi.access.update', grant.id), { is_active: !grant.is_active }, { preserveScroll: true });
    };

    const deleteGrant = (grant) => {
        setConfirmState({
            open: true,
            description: `Отозвать доступ "${permission_labels[grant.permission] ?? grant.permission}" у ${grant.user?.name ?? '—'}?`,
            onConfirm: () => router.delete(route('kpi.access.destroy', grant.id), { preserveScroll: true }),
        });
    };

    const activeGrantsCount = grants.filter((grant) => grant.is_active).length;

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="KPI · Доступ"
                    title="Доступ к KPI-модулям"
                    description="Выдача модульного доступа сотрудникам и контроль по структурным подразделениям."
                    meta={<StatusBadge tone="info">Module access</StatusBadge>}
                />
            )}
        >
            <Head title="Доступ к KPI-модулям" />

            <div className="admin-page-wrap space-y-6">
                <StatGrid>
                    <StatTile label="Выдано доступов" value={grants.length} tone="teal" icon={ShieldCheck} hint={`Активных: ${activeGrantsCount}`} />
                    <StatTile label="Сотрудников с доступом" value={grouped.length} tone="navy" icon={Users} />
                    <StatTile label="Модулей" value={permissions_list.length} tone="info" icon={ShieldPlus} />
                    <StatTile label="Подразделений проверки" value={structural_divisions.length} tone="gold" icon={Building2} />
                </StatGrid>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                    <Card>
                        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                            <CardTitle className="flex items-center gap-2"><UserPlus className="h-4 w-4" />Выдать доступ</CardTitle>
                            <StatusBadge tone="default">{permissions_list.length} модулей</StatusBadge>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm text-slate-600">
                                Найдите сотрудника по имени, email или подразделению и выдайте доступ к нужному модулю KPI.
                            </p>

                            <label className="block max-w-xl space-y-2">
                                <span className="qd-field-label block">Сотрудник</span>
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <Input
                                        ref={searchRef}
                                        className="pl-9 pr-9"
                                        value={searchInput}
                                        onChange={handleSearchChange}
                                        placeholder="Имя, email или подразделение…"
                                        autoComplete="off"
                                    />
                                    {searchInput && (
                                        <button
                                            type="button"
                                            onClick={clearSearch}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#102945]"
                                            aria-label="Очистить поиск"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                            </label>

                            {searchInput.trim() !== '' && (
                                <div className="max-h-96 overflow-y-auto rounded-xl border border-slate-200 bg-white">
                                    {filteredUsers.length === 0 ? (
                                        <p className="py-6 text-center text-sm text-slate-500">Сотрудники не найдены</p>
                                    ) : (
                                        filteredUsers.map((user) => (
                                            <UserSearchRow
                                                key={user.id}
                                                user={user}
                                                permissions_list={permissions_list}
                                                permission_labels={permission_labels}
                                                grantedPerms={grantsByUser.get(user.id) ?? new Set()}
                                                grantedDivisions={grantedDivisionsByUser.get(user.id) ?? new Map()}
                                                structuralDivisions={structural_divisions}
                                                onGrant={grantAccess}
                                                onGrantAll={grantAll}
                                            />
                                        ))
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Building2 className="h-4 w-4" />
                                Подразделения проверки
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <p className="text-xs text-slate-500">
                                Подразделения из индикаторов KPI (для структурной проверки)
                            </p>
                            {structural_divisions.length === 0 ? (
                                <Notice tone="warning">В индикаторах пока не настроены подразделения проверки.</Notice>
                            ) : (
                                <div className="flex flex-wrap gap-1.5">
                                    {structural_divisions.map((division) => (
                                        <Badge key={division.id} variant="outline">{division.name}</Badge>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                        <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" />Выданные доступы ({grants.length})</CardTitle>
                        <StatusBadge tone="default">Access grants</StatusBadge>
                    </CardHeader>
                    <CardContent className="p-0">
                        {grouped.length === 0 ? (
                            <InlineEmpty
                                title="Нет выданных доступов"
                                description="Найдите сотрудника в блоке «Выдать доступ» и назначьте ему модуль KPI."
                            />
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[900px] text-sm">
                                    <thead className="border-b border-slate-200">
                                        <tr>
                                            <th className="text-left">Сотрудник</th>
                                            <th className="text-left">Должность / Подразделение</th>
                                            <th className="text-left">Модуль / Подразделение</th>
                                            <th className="text-left">Статус</th>
                                            <th className="text-left">Выдан</th>
                                            <th className="text-left">Кем выдан</th>
                                            <th className="text-right">Действия</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {grouped.flatMap(({ user, grants: userGrants }) =>
                                            userGrants.map((grant, idx) => (
                                                <tr key={grant.id} className={`align-top ${idx === userGrants.length - 1 ? 'border-b border-slate-200' : ''} last:border-0`}>
                                                    {idx === 0 && (
                                                        <td rowSpan={userGrants.length}>
                                                            <div className="font-medium text-slate-900">{user?.name ?? '—'}</div>
                                                            <div className="text-xs text-slate-500">{user?.email ?? ''}</div>
                                                        </td>
                                                    )}
                                                    {idx === 0 && (
                                                        <td className="text-slate-600" rowSpan={userGrants.length}>
                                                            <div>{user?.ad_title ?? '—'}</div>
                                                            <div className="text-xs text-slate-500">{user?.ad_department ?? ''}</div>
                                                        </td>
                                                    )}
                                                    <td>
                                                        <Badge variant="secondary">
                                                            {permission_labels[grant.permission] ?? grant.permission}
                                                        </Badge>
                                                        {grant.division && (
                                                            <div className="mt-1 text-xs text-slate-500">{grant.division.name}</div>
                                                        )}
                                                    </td>
                                                    <td>
                                                        {grant.is_active ? (
                                                            <StatusBadge tone="success">Активен</StatusBadge>
                                                        ) : (
                                                            <StatusBadge tone="default">Деактивирован</StatusBadge>
                                                        )}
                                                    </td>
                                                    <td className="tabular-nums text-slate-600">
                                                        {formatDate(grant.granted_at)}
                                                    </td>
                                                    <td className="text-slate-600">
                                                        {grant.grantedBy?.name ?? '—'}
                                                    </td>
                                                    <td className="text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => toggleActive(grant)}
                                                            >
                                                                {grant.is_active ? (
                                                                    <><ShieldOff className="h-4 w-4" /> Деактив.</>
                                                                ) : (
                                                                    <><ShieldCheck className="h-4 w-4" /> Активир.</>
                                                                )}
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="destructive"
                                                                onClick={() => deleteGrant(grant)}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                                Отозвать
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )),
                                        )}
                                    </tbody>
                                </table>
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
