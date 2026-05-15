import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Head, router, useForm } from '@inertiajs/react';
import { Search, ShieldPlus, Users } from 'lucide-react';
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

export default function AdminAccess({ users = [], search = '' }) {
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
        router.post(
            route('users.admin-access.grant'),
            { user_id: userId },
            {
                preserveScroll: true,
            },
        );
    };

    const revokeAdmin = (userId) => {
        router.post(
            route('users.admin-access.revoke'),
            { user_id: userId },
            {
                preserveScroll: true,
            },
        );
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
            headerRight={(
                <form className="admin-header-actions" onSubmit={submitSearch}>
                    <Input
                        value={form.data.search}
                        onChange={(e) => form.setData('search', e.target.value)}
                        placeholder="Поиск по ФИО, email, логину, отделу"
                        className="h-8 w-72"
                    />
                    <Button size="sm" type="submit">
                        <Search className="h-4 w-4" />
                        Найти
                    </Button>
                </form>
            )}
        >
            <Head title="Права администратора" />

            <div className="admin-page-wrap">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            Список администраторов ({adminUsers.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {adminUsers.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Администраторы не найдены по текущему поиску.</p>
                        ) : (
                            <div className="admin-table-wrap">
                                <table className="admin-data-table min-w-[760px]">
                                    <thead>
                                        <tr className="border-b text-left text-muted-foreground">
                                            <th className="py-3 pe-3 font-medium">Сотрудник</th>
                                            <th className="py-3 pe-3 font-medium">Email</th>
                                            <th className="py-3 pe-3 font-medium">Отдел</th>
                                            <th className="py-3 pe-3 font-medium">Роль</th>
                                            <th className="py-3 pe-3 font-medium">Действие</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {adminUsers.map((user) => (
                                            <tr key={user.id} className="border-b align-top">
                                                <td className="py-3 pe-3 font-medium">{user.name ?? '-'}</td>
                                                <td className="py-3 pe-3">{user.email ?? '-'}</td>
                                                <td className="py-3 pe-3">{user.department ?? '-'}</td>
                                                <td className="py-3 pe-3">
                                                    <Badge>
                                                        {roleLabels[user.role] ?? user.role ?? '-'}
                                                    </Badge>
                                                </td>
                                                <td className="py-3 pe-3">
                                                    <Button
                                                        size="sm"
                                                        type="button"
                                                        variant="destructive"
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
                            <Users className="h-5 w-5" />
                            Выдача прав администратора сотрудникам
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {!hasSearch ? (
                            <p className="text-sm text-muted-foreground">
                                Введите запрос в поиск, чтобы найти сотрудника и выдать права admin.
                            </p>
                        ) : staffUsers.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Сотрудники не найдены.</p>
                        ) : (
                            <div className="admin-table-wrap">
                                <table className="admin-data-table min-w-[980px]">
                                    <thead>
                                        <tr className="border-b text-left text-muted-foreground">
                                            <th className="py-3 pe-3 font-medium">Сотрудник</th>
                                            <th className="py-3 pe-3 font-medium">Email</th>
                                            <th className="py-3 pe-3 font-medium">Логин</th>
                                            <th className="py-3 pe-3 font-medium">Отдел</th>
                                            <th className="py-3 pe-3 font-medium">Должность</th>
                                            <th className="py-3 pe-3 font-medium">Текущая роль</th>
                                            <th className="py-3 pe-3 font-medium">Действие</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {staffUsers.map((user) => (
                                            <tr key={user.id} className="border-b align-top">
                                                <td className="py-3 pe-3 font-medium">{user.name ?? '-'}</td>
                                                <td className="py-3 pe-3">{user.email ?? '-'}</td>
                                                <td className="py-3 pe-3">{user.login ?? '-'}</td>
                                                <td className="py-3 pe-3">{user.department ?? '-'}</td>
                                                <td className="py-3 pe-3">{user.title ?? '-'}</td>
                                                <td className="py-3 pe-3">
                                                    <Badge variant={user.role === 'admin' || user.role === 'superadmin' ? 'default' : 'secondary'}>
                                                        {roleLabels[user.role] ?? user.role ?? '-'}
                                                    </Badge>
                                                </td>
                                                <td className="py-3 pe-3">
                                                    <Button
                                                        size="sm"
                                                        type="button"
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
