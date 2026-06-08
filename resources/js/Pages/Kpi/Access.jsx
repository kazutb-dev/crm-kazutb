import { ConfirmDialog } from '@/components/ConfirmDialog';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { DataTable, FilterBar, PageHeader, StatusBadge } from '@/components/platform';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Head, router } from '@inertiajs/react';
import { Search, ShieldCheck, ShieldOff, ShieldPlus, Trash2, UserPlus, X } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
function formatDate(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
}

/** Строка в выпадающем списке сотрудника при поиске */
function UserSearchRow({ user, permissions_list, permission_labels, grantedPerms, grantedDivisions, structuralDivisions, onGrant, onGrantAll }) {
    const [confirmState, setConfirmState] = useState({ open: false, description: '', onConfirm: null });
    const [selectedPerm, setSelectedPerm] = useState(permissions_list[0] ?? '');
    const [selectedDivision, setSelectedDivision] = useState('');
    const isStructural = selectedPerm === 'structural_queue';
    // For structural_queue, check if this specific division is already granted
    const alreadyHas = isStructural
        ? selectedDivision !== '' && (grantedDivisions.get(selectedPerm) ?? new Set()).has(Number(selectedDivision))
        : grantedPerms.has(selectedPerm);
    const hasAll = permissions_list.every((p) => grantedPerms.has(p));

    return (
        <div className="space-y-1 rounded-md border px-3 py-2">
            <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-sm">{user.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                        {user.email}
                        {user.ad_department ? ` · ${user.ad_department}` : ''}
                        {user.ad_title ? ` · ${user.ad_title}` : ''}
                    </div>
                </div>
                <select
                    className="h-8 rounded-md border border-input bg-background/70 px-2 text-xs shadow-sm"
                    value={selectedPerm}
                    onChange={(e) => { setSelectedPerm(e.target.value); setSelectedDivision(''); }}
                >
                    {permissions_list.map((p) => (
                        <option key={p} value={p}>{permission_labels[p] ?? p}</option>
                    ))}
                </select>
                {isStructural && (
                    <select
                        className="h-8 rounded-md border border-input bg-background/70 px-2 text-xs shadow-sm max-w-[200px]"
                        value={selectedDivision}
                        onChange={(e) => setSelectedDivision(e.target.value)}
                    >
                        <option value="">— выберите подразделение —</option>
                        {structuralDivisions.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                    </select>
                )}
                <Button
                    size="sm"
                    variant={alreadyHas ? 'outline' : 'default'}
                    disabled={alreadyHas || (isStructural && selectedDivision === '')}
                    onClick={() => onGrant(user.id, selectedPerm, isStructural ? Number(selectedDivision) : null)}
                >
                    <UserPlus className="h-3 w-3" />
                    {alreadyHas ? 'Выдан' : 'Выдать'}
                </Button>
                <Button
                    size="sm"
                    variant={hasAll ? 'outline' : 'secondary'}
                    disabled={hasAll}
                    onClick={() => onGrantAll(user.id)}
                    title="Выдать доступ ко всем модулям (кроме структурных)"
                >
                    <ShieldPlus className="h-3 w-3" />
                    Все
                </Button>
            </div>
            {/* Показываем уже выданные гранты */}
            {grantedPerms.size > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                    {permissions_list.filter((p) => grantedPerms.has(p)).map((p) => (
                        <span key={p} className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                            {permission_labels[p] ?? p}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function Access({ grants = [], users = [], search = '', permissions_list = [], permission_labels = {}, structural_divisions = [] }) {
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

    return (
        <AuthenticatedLayout>
            <Head title="Доступ к KPI-модулям" />

            <div className="admin-page-wrap space-y-4">
                <PageHeader
                    eyebrow="KPI"
                    title="Доступ к KPI-модулям"
                    description="Выдача модульного доступа сотрудникам и контроль по структурным подразделениям."
                    meta={<StatusBadge tone="info">Module access</StatusBadge>}
                />

                <FilterBar>
                    <div className="mb-3 flex items-center justify-between gap-2">
                        <div className="text-base font-semibold text-foreground">Выдать доступ</div>
                        <StatusBadge tone="default">{permissions_list.length} модулей</StatusBadge>
                    </div>

                    <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                            Найдите сотрудника по имени, email или подразделению и выдайте доступ к нужному модулю KPI.
                        </p>

                        <div className="space-y-2 rounded-md border p-3">
                            <div className="text-xs font-medium text-muted-foreground">
                                Подразделения из индикаторов KPI (для структурной проверки)
                            </div>
                            {structural_divisions.length === 0 ? (
                                <p className="text-xs text-muted-foreground">В индикаторах пока не настроены подразделения проверки.</p>
                            ) : (
                                <div className="flex flex-wrap gap-1.5">
                                    {structural_divisions.map((division) => (
                                        <Badge key={division.id} variant="outline">{division.name}</Badge>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="relative max-w-md">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>

                        {/* Список результатов */}
                        {searchInput.trim() !== '' && (
                            <div className="space-y-2 max-h-80 overflow-y-auto rounded-md border p-2">
                                {filteredUsers.length === 0 ? (
                                    <p className="py-4 text-center text-sm text-muted-foreground">Сотрудники не найдены</p>
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
                    </div>
                </FilterBar>

                <DataTable>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 px-4 py-3">
                        <div className="text-base font-semibold text-foreground">Выданные доступы ({grants.length})</div>
                        <StatusBadge tone="default">Access grants</StatusBadge>
                    </div>

                    <div className="p-4">
                        {grouped.length === 0 ? (
                            <div className="admin-empty-state">Нет выданных доступов.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-[700px]">
                                    <thead>
                                        <tr>
                                            <th>Сотрудник</th>
                                            <th>Должность / Подразделение</th>
                                            <th>Модуль / Подразделение</th>
                                            <th>Статус</th>
                                            <th>Выдан</th>
                                            <th>Кем выдан</th>
                                            <th className="text-right">Действия</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {grouped.flatMap(({ user, grants: userGrants }) =>
                                            userGrants.map((grant, idx) => (
                                                <tr key={grant.id} className="border-b align-top last:border-0">
                                                    {idx === 0 && (
                                                        <td className="py-3 pe-3 font-medium" rowSpan={userGrants.length}>
                                                            <div>{user?.name ?? '—'}</div>
                                                            <div className="text-xs text-muted-foreground">{user?.email ?? ''}</div>
                                                        </td>
                                                    )}
                                                    {idx === 0 && (
                                                        <td className="py-3 pe-3 text-muted-foreground" rowSpan={userGrants.length}>
                                                            <div>{user?.ad_title ?? '—'}</div>
                                                            <div className="text-xs">{user?.ad_department ?? ''}</div>
                                                        </td>
                                                    )}
                                                    <td className="py-3 pe-3">
                                                        <Badge variant="secondary">
                                                            {permission_labels[grant.permission] ?? grant.permission}
                                                        </Badge>
                                                        {grant.division && (
                                                            <div className="mt-1 text-xs text-muted-foreground">{grant.division.name}</div>
                                                        )}
                                                    </td>
                                                    <td className="py-3 pe-3">
                                                        {grant.is_active ? (
                                                            <Badge>Активен</Badge>
                                                        ) : (
                                                            <Badge variant="outline">Деактивирован</Badge>
                                                        )}
                                                    </td>
                                                    <td className="py-3 pe-3 text-muted-foreground">
                                                        {formatDate(grant.granted_at)}
                                                    </td>
                                                    <td className="py-3 pe-3 text-muted-foreground">
                                                        {grant.grantedBy?.name ?? '—'}
                                                    </td>
                                                    <td className="py-3 text-right">
                                                        <div className="admin-row-actions">
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
                    </div>
                </DataTable>
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
