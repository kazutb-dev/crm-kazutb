import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { FilterBar, Notice, PageHeader, StatTile, StatusBadge } from '@/components/platform';
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

            <div className="admin-page-wrap space-y-6">
                <FilterBar>
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

                <div className="grid gap-4 sm:grid-cols-3">
                    <StatTile label="Администраторы" value={adminUsers.length} tone="teal" icon={ShieldCheck} hint={hasSearch ? 'По текущему поиску' : 'Все с ролью admin / superadmin'} />
                    <StatTile label="Найдено сотрудников" value={hasSearch ? staffUsers.length : '—'} tone="navy" icon={Users} hint={hasSearch ? `Запрос: «${search}»` : 'Введите запрос, чтобы найти сотрудника'} />
                    <StatTile label="Можно выдать admin" value={hasSearch ? staffUsers.filter((user) => user.can_grant_admin).length : '—'} tone="gold" icon={ShieldPlus} />
                </div>

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
                                <table className="w-full min-w-[760px] text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-200 text-left">
                                            <th className="px-5 py-3">Сотрудник</th>
                                            <th className="px-3 py-3">Email</th>
                                            <th className="px-3 py-3">Отдел</th>
                                            <th className="px-3 py-3">Роль</th>
                                            <th className="px-5 py-3 text-right">Действие</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {adminUsers.map((user) => (
                                            <tr key={user.id} className="align-top hover:bg-slate-50">
                                                <td className="px-5 py-3 font-medium text-slate-900">{user.name ?? '-'}</td>
                                                <td className="px-3 py-3 text-slate-700">{user.email ?? '-'}</td>
                                                <td className="px-3 py-3 text-slate-700">{user.department ?? '-'}</td>
                                                <td className="px-3 py-3">
                                                    <Badge variant={user.role === 'superadmin' ? 'gold' : 'default'}>
                                                        {roleLabels[user.role] ?? user.role ?? '-'}
                                                    </Badge>
                                                </td>
                                                <td className="px-5 py-3 text-right">
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
                                        <tr className="border-b border-slate-200 text-left">
                                            <th className="px-5 py-3">Сотрудник</th>
                                            <th className="px-3 py-3">Email</th>
                                            <th className="px-3 py-3">Логин</th>
                                            <th className="px-3 py-3">Отдел</th>
                                            <th className="px-3 py-3">Должность</th>
                                            <th className="px-3 py-3">Текущая роль</th>
                                            <th className="px-5 py-3 text-right">Действие</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {staffUsers.map((user) => (
                                            <tr key={user.id} className="align-top hover:bg-slate-50">
                                                <td className="px-5 py-3 font-medium text-slate-900">{user.name ?? '-'}</td>
                                                <td className="px-3 py-3 text-slate-700">{user.email ?? '-'}</td>
                                                <td className="px-3 py-3 font-mono text-xs text-slate-700">{user.login ?? '-'}</td>
                                                <td className="px-3 py-3 text-slate-700">{user.department ?? '-'}</td>
                                                <td className="px-3 py-3 text-slate-700">{user.title ?? '-'}</td>
                                                <td className="px-3 py-3">
                                                    <Badge variant={user.role === 'admin' || user.role === 'superadmin' ? 'default' : 'secondary'}>
                                                        {roleLabels[user.role] ?? user.role ?? '-'}
                                                    </Badge>
                                                </td>
                                                <td className="px-5 py-3 text-right">
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
        </AuthenticatedLayout>
    );
}

/** Empty state inside a card (the platform EmptyState is a card of its own). */
function EmptyStateInline({ icon: Icon, title, description }) {
    return (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-100 text-teal-700"><Icon className="h-6 w-6" /></span>
            <p className="font-display text-lg font-bold text-[#102945]">{title}</p>
            <p className="max-w-md text-sm text-slate-600">{description}</p>
        </div>
    );
}
