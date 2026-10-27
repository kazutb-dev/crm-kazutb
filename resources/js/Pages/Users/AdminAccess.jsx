import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { FilterBar, Notice, PageHeader, StatGrid, StatTile, StatusBadge } from '@/components/platform';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Head, router, useForm } from '@inertiajs/react';
import { Search, ShieldCheck, ShieldPlus, Users } from 'lucide-react';
import { useMemo } from 'react';

const roleLabels = {
    admin: 'Администратор',
    superadmin: 'Суперадминистратор',
    teacher: 'Преподаватель',
    hod: 'Зав. кафедрой',
    department_head: 'Зав. кафедрой',
    dean: 'Декан',
    department: 'Департамент',
    student: 'Студент',
};

export default function AdminAccess({ users = [], search = '', permissions = {} }) {
    const requiresDangerousActionReason = Boolean(permissions.requiresDangerousActionReason);
    const form = useForm({
        search,
    });

    const submitSearch = (e) => {
        e.preventDefault();

        router.get(
            route('users.admin-access'),
            { search: form.data.search },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            },
        );
    };

    const grantAdmin = (userId) => {
        const reason = resolveDangerousActionReason();

        if (reason === null) {
            return;
        }

        router.post(
            route('users.admin-access.grant'),
            { user_id: userId, reason },
            {
                preserveScroll: true,
            },
        );
    };

    const revokeAdmin = (userId) => {
        const reason = resolveDangerousActionReason();

        if (reason === null) {
            return;
        }

        router.post(
            route('users.admin-access.revoke'),
            { user_id: userId, reason },
            {
                preserveScroll: true,
            },
        );
    };

    const resolveDangerousActionReason = () => {
        if (!requiresDangerousActionReason) {
            return '';
        }

        const reason = window.prompt('Укажите причину опасного действия') ?? '';

        if (reason.trim().length < 8) {
            window.alert('Причина должна быть минимум 8 символов.');
            return null;
        }

        return reason.trim();
    };

    const adminUsers = useMemo(
        () => users.filter((user) => user.role === 'admin' || user.role === 'superadmin'),
        [users],
    );

    const staffUsers = useMemo(
        () => users.filter((user) => user.role !== 'admin' && user.role !== 'superadmin'),
        [users],
    );
    const hasSearch = String(search ?? '').trim() !== '';
    const grantTableShown = hasSearch && staffUsers.length > 0;
    const superadminCount = adminUsers.filter((user) => user.role === 'superadmin').length;

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="Управление доступом"
                    title="Права администратора"
                    description="Кто сейчас администрирует платформу и кому выдать права admin. Опасные действия требуют указания причины."
                    meta={requiresDangerousActionReason ? <StatusBadge tone="warning">Нужна причина действия</StatusBadge> : null}
                />
            )}
        >
            <Head title="Права администратора" />

            <div className="admin-page-wrap space-y-4">
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
                <FilterBar className="flex flex-col justify-center">
                    <form className="flex flex-wrap items-end gap-3" onSubmit={submitSearch}>
                        <label className="relative block min-w-[16rem] flex-1 space-y-2">
                            <span className="qd-field-label block">Поиск сотрудника</span>
                            <Search className="pointer-events-none absolute bottom-3 left-3 h-4 w-4 text-slate-400" />
                            <Input
                                value={form.data.search}
                                onChange={(e) => form.setData('search', e.target.value)}
                                placeholder="Поиск по ФИО, email, логину, отделу"
                                className="pl-9"
                            />
                        </label>
                        <Button type="submit">
                            <Search className="h-4 w-4" />
                            Найти
                        </Button>
                    </form>
                </FilterBar>

                <StatGrid>
                    <StatTile label="Администраторы" value={adminUsers.length} tone="teal" icon={ShieldCheck} hint={hasSearch ? 'По текущему поиску' : 'Все с ролью admin / superadmin'} />
                    <StatTile label="Найдено сотрудников" value={hasSearch ? staffUsers.length : '—'} tone="navy" icon={Users} hint={hasSearch ? `Запрос: «${search}»` : 'Введите запрос, чтобы найти сотрудника'} />
                    <StatTile label="Можно выдать admin" value={hasSearch ? staffUsers.filter((user) => user.can_grant_admin).length : '—'} tone="gold" icon={ShieldPlus} hint={superadminCount > 0 ? `Суперадминистраторов: ${superadminCount}` : null} />
                </StatGrid>
                </div>

                <div className={`grid items-start gap-4 [&>*]:min-w-0 ${grantTableShown ? '' : '2xl:grid-cols-2'}`}>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4" />
                            Список администраторов ({adminUsers.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent className={adminUsers.length === 0 ? '' : 'p-0'}>
                        {adminUsers.length === 0 ? (
                            <Notice tone="info">Администраторы не найдены по текущему поиску.</Notice>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[640px] text-sm">
                                    <thead>
                                        <tr>
                                            <th>Сотрудник</th>
                                            <th>Email</th>
                                            <th>Отдел</th>
                                            <th>Роль</th>
                                            <th className="text-right">Действие</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {adminUsers.map((user) => (
                                            <tr key={user.id} className="align-top hover:bg-slate-50">
                                                <td className="font-medium text-slate-900">{user.name ?? '-'}</td>
                                                <td className="text-slate-700">{user.email ?? '-'}</td>
                                                <td className="text-slate-700">{user.department ?? '-'}</td>
                                                <td>
                                                    <Badge variant={user.role === 'superadmin' ? 'gold' : 'default'}>
                                                        {roleLabels[user.role] ?? user.role ?? '-'}
                                                    </Badge>
                                                </td>
                                                <td className="text-right">
                                                    <Button
                                                        size="sm"
                                                        type="button"
                                                        variant={user.can_revoke_admin ? 'destructive' : 'outline'}
                                                        onClick={() => revokeAdmin(user.id)}
                                                        disabled={!user.can_revoke_admin}
                                                    >
                                                        {user.can_revoke_admin ? 'Снять admin' : 'Нельзя снять'}
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ShieldPlus className="h-4 w-4" />
                            Выдача прав администратора сотрудникам
                        </CardTitle>
                    </CardHeader>
                    <CardContent className={hasSearch && staffUsers.length > 0 ? 'p-0' : ''}>
                        {!hasSearch ? (
                            <EmptyStateInline
                                icon={Search}
                                title="Найдите сотрудника"
                                description="Введите запрос в поиск, чтобы найти сотрудника и выдать права admin."
                            />
                        ) : staffUsers.length === 0 ? (
                            <EmptyStateInline icon={Users} title="Сотрудники не найдены" description="Проверьте написание ФИО, email, логина или отдела." />
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[980px] text-sm">
                                    <thead>
                                        <tr>
                                            <th>Сотрудник</th>
                                            <th>Email</th>
                                            <th>Логин</th>
                                            <th>Отдел</th>
                                            <th>Должность</th>
                                            <th>Текущая роль</th>
                                            <th className="text-right">Действие</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {staffUsers.map((user) => (
                                            <tr key={user.id} className="align-top hover:bg-slate-50">
                                                <td className="font-medium text-slate-900">{user.name ?? '-'}</td>
                                                <td className="text-slate-700">{user.email ?? '-'}</td>
                                                <td className="font-mono text-xs text-slate-700">{user.login ?? '-'}</td>
                                                <td className="text-slate-700">{user.department ?? '-'}</td>
                                                <td className="text-slate-700">{user.title ?? '-'}</td>
                                                <td>
                                                    <Badge variant={user.role === 'admin' || user.role === 'superadmin' ? 'default' : 'secondary'}>
                                                        {roleLabels[user.role] ?? user.role ?? '-'}
                                                    </Badge>
                                                </td>
                                                <td className="text-right">
                                                    <Button
                                                        size="sm"
                                                        type="button"
                                                        variant={user.can_grant_admin ? 'default' : 'outline'}
                                                        onClick={() => grantAdmin(user.id)}
                                                        disabled={!user.can_grant_admin}
                                                    >
                                                        <ShieldPlus className="h-4 w-4" />
                                                        {user.can_grant_admin ? 'Выдать admin' : 'Уже admin'}
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

/** Empty state inside a card (the platform EmptyState is a card of its own). */
function EmptyStateInline({ icon: Icon, title, description }) {
    return (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 text-teal-700"><Icon className="h-5 w-5" /></span>
            <p className="text-base font-bold text-[#102945]">{title}</p>
            <p className="max-w-md text-sm text-slate-600">{description}</p>
        </div>
    );
}
