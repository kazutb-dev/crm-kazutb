import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
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
import { Pencil, Plus, Search, Users } from 'lucide-react';
import { useMemo, useState } from 'react';

export default function Index({ users, positions = [], search, adAvailable, pageTitle, searchRouteName, directoryType }) {
    const form = useForm({
        q: search ?? '',
    });
    const manualForm = useForm({
        name: '',
        email: '',
        login: '',
        position_id: '',
        directory_type: directoryType,
    });
    const positionForm = useForm({
        position_id: '',
    });
    const [manualDialogOpen, setManualDialogOpen] = useState(false);
    const [positionDialogOpen, setPositionDialogOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);

    const title = pageTitle ?? 'Пользователи';
    const routeName = searchRouteName ?? 'users.index';
    const isStudentsPage = directoryType === 'students';
    const isStaffPage = directoryType === 'staff';
    const selectedPosition = useMemo(
        () => positions.find((position) => String(position.id) === String(positionForm.data.position_id)) ?? null,
        [positions, positionForm.data.position_id],
    );
    const selectedManualPosition = useMemo(
        () => positions.find((position) => String(position.id) === String(manualForm.data.position_id)) ?? null,
        [positions, manualForm.data.position_id],
    );

    const submit = (e) => {
        e.preventDefault();

        router.get(
            route(routeName),
            { q: form.data.q },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            },
        );
    };

    const openPositionDialog = (user) => {
        setEditingUser(user);

        const matched = positions.find(
            (position) =>
                (position.name ?? '') === (user.title ?? '')
                && (position.division_name ?? '') === (user.department ?? ''),
        );

        positionForm.setData('position_id', matched ? String(matched.id) : '');
        positionForm.clearErrors();
        setPositionDialogOpen(true);
    };

    const submitPosition = (e) => {
        e.preventDefault();

        if (!editingUser) {
            return;
        }

        const payload = {
            position_id: positionForm.data.position_id,
            login: editingUser.login ?? '',
            email: editingUser.email ?? '',
            display_name: editingUser.display_name ?? '',
            employee_type: editingUser.employee_type ?? '',
        };

        const routeTarget = editingUser.local_user_id
            ? route('users.position.update', editingUser.local_user_id)
            : route('users.position.update-directory');

        router.patch(routeTarget, payload, {
            preserveScroll: true,
            onSuccess: () => {
                setPositionDialogOpen(false);
                setEditingUser(null);
            },
        });
    };

    const submitManual = (e) => {
        e.preventDefault();

        manualForm.post(route('users.manual.store'), {
            preserveScroll: true,
            onSuccess: () => {
                manualForm.reset({
                    name: '',
                    email: '',
                    login: '',
                    position_id: '',
                    directory_type: directoryType,
                });
                setManualDialogOpen(false);
            },
        });
    };

    return (
        <AuthenticatedLayout
            headerRight={
                <div className="flex items-center gap-2">
                    <form className="flex items-center gap-2" onSubmit={submit}>
                        <Input
                            value={form.data.q}
                            onChange={(e) => form.setData('q', e.target.value)}
                            placeholder="Поиск по имени, логину, email"
                            className="h-8 w-64"
                        />
                        <Button size="sm" type="submit">
                            <Search />
                            Найти
                        </Button>
                    </form>
                    <Button size="sm" type="button" onClick={() => setManualDialogOpen(true)}>
                        <Plus className="h-4 w-4" />
                        Добавить пользователя
                    </Button>
                </div>
            }
        >
            <Head title={title} />

            <Dialog
                open={manualDialogOpen}
                onOpenChange={(open) => {
                    setManualDialogOpen(open);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Добавить пользователя вручную</DialogTitle>
                        <DialogDescription>
                            Заполните данные. Пользователь будет создан локально.
                        </DialogDescription>
                    </DialogHeader>

                    <form className="space-y-4" onSubmit={submitManual}>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">ФИО</label>
                            <Input
                                value={manualForm.data.name}
                                onChange={(e) => manualForm.setData('name', e.target.value)}
                                placeholder="Например: Иванов Иван Иванович"
                            />
                            {manualForm.errors.name && (
                                <p className="text-sm text-destructive">{manualForm.errors.name}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Email</label>
                            <Input
                                type="email"
                                value={manualForm.data.email}
                                onChange={(e) => manualForm.setData('email', e.target.value)}
                                placeholder="user@kaztbu.edu.kz"
                            />
                            {manualForm.errors.email && (
                                <p className="text-sm text-destructive">{manualForm.errors.email}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Логин</label>
                            <Input
                                value={manualForm.data.login}
                                onChange={(e) => manualForm.setData('login', e.target.value)}
                                placeholder="Необязательно"
                            />
                            {manualForm.errors.login && (
                                <p className="text-sm text-destructive">{manualForm.errors.login}</p>
                            )}
                        </div>

                        {isStaffPage && (
                            <>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Должность</label>
                                    <select
                                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                        value={manualForm.data.position_id}
                                        onChange={(e) => manualForm.setData('position_id', e.target.value)}
                                    >
                                        <option value="">Выберите должность</option>
                                        {positions.map((position) => (
                                            <option key={position.id} value={position.id}>
                                                {position.name}
                                            </option>
                                        ))}
                                    </select>
                                    {manualForm.errors.position_id && (
                                        <p className="text-sm text-destructive">{manualForm.errors.position_id}</p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Отдел</label>
                                    <Input value={selectedManualPosition?.division_name ?? '-'} readOnly />
                                </div>
                            </>
                        )}

                        <DialogFooter>
                            <Button type="submit" disabled={manualForm.processing}>
                                Сохранить
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog
                open={positionDialogOpen}
                onOpenChange={(open) => {
                    setPositionDialogOpen(open);
                    if (!open) {
                        setEditingUser(null);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Изменить должность</DialogTitle>
                        <DialogDescription>
                            Выберите должность. Отдел заполнится автоматически.
                        </DialogDescription>
                    </DialogHeader>

                    <form className="space-y-4" onSubmit={submitPosition}>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Должность</label>
                            <select
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                value={positionForm.data.position_id}
                                onChange={(e) => positionForm.setData('position_id', e.target.value)}
                            >
                                <option value="">Выберите должность</option>
                                {positions.map((position) => (
                                    <option key={position.id} value={position.id}>
                                        {position.name}
                                    </option>
                                ))}
                            </select>
                            {positionForm.errors.position_id && (
                                <p className="text-sm text-destructive">{positionForm.errors.position_id}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Отдел</label>
                            <Input value={selectedPosition?.division_name ?? '-'} readOnly />
                        </div>

                        <DialogFooter>
                            <Button type="submit" disabled={positionForm.processing}>
                                Сохранить
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <div className="p-4 sm:p-6 lg:p-8">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            {title} из AD
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {!adAvailable && users.length === 0 ? (
                            <p className="text-sm text-destructive">
                                Не удалось получить данные из AD. Проверьте подключение и параметры.
                            </p>
                        ) : users.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                {isStudentsPage ? 'Студенты не найдены.' : 'Сотрудники не найдены.'}
                            </p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[1000px] text-sm">
                                    <thead>
                                        <tr className="border-b text-left text-muted-foreground">
                                            <th className="py-3 pe-3 font-medium">ФИО</th>
                                            <th className="py-3 pe-3 font-medium">Логин</th>
                                            <th className="py-3 pe-3 font-medium">Email</th>
                                            <th className="py-3 pe-3 font-medium">Отдел</th>
                                            <th className="py-3 pe-3 font-medium">Должность</th>
                                            <th className="py-3 pe-3 font-medium">Статус</th>
                                            <th className="py-3 pe-3 font-medium">Синхронизирован</th>
                                            <th className="py-3 pe-3 font-medium">Действия</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.map((user, index) => (
                                            <tr key={`${user.login}-${index}`} className="border-b last:border-0">
                                                <td className="py-3 pe-3 font-medium">
                                                    {user.display_name || '-'}
                                                </td>
                                                <td className="py-3 pe-3">
                                                    <Badge variant="outline">{user.login || '-'}</Badge>
                                                </td>
                                                <td className="py-3 pe-3 text-muted-foreground">
                                                    {user.email || '-'}
                                                </td>
                                                <td className="py-3 pe-3 text-muted-foreground">
                                                    {user.division || '-'}
                                                </td>
                                                <td className="py-3 pe-3 text-muted-foreground">
                                                    {user.title || '-'}
                                                </td>
                                                <td className="py-3 pe-3 text-muted-foreground">
                                                    {user.status || '-'}
                                                </td>
                                                <td className="py-3 pe-3">
                                                    {user.is_synced ? (
                                                        <Badge>Да</Badge>
                                                    ) : (
                                                        <Badge variant="outline">Нет</Badge>
                                                    )}
                                                </td>
                                                <td className="py-3 pe-3">
                                                    {isStaffPage && (user.local_user_id || user.login || user.email) ? (
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => openPositionDialog(user)}
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                            Изменить должность
                                                        </Button>
                                                    ) : (
                                                        <span className="text-muted-foreground">-</span>
                                                    )}
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
