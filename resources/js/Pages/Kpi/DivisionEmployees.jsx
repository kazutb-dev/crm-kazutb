import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Head, router } from '@inertiajs/react';
import { ArrowLeft, Plus, Search, Trash2 } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

export default function DivisionEmployees({ division, employees, allUsers }) {
    const [search, setSearch] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const [showResults, setShowResults] = useState(false);
    const searchRef = useRef(null);

    const filteredUsers = allUsers.filter(u =>
        (u.name.toLowerCase().includes(search.toLowerCase()) ||
            u.email.toLowerCase().includes(search.toLowerCase()) ||
            (u.ad_department && u.ad_department.toLowerCase().includes(search.toLowerCase()))) &&
        !employees.some(e => e.id === u.id)
    );

    const handleAdd = (user) => {
        router.post(`/kpi/divisions/${division.id}/employees`, { user_id: user.id }, {
            onSuccess: () => {
                setSearch('');
                setSelectedUser(null);
                setShowResults(false);
            }
        });
    };

    const handleRemove = (userId) => {
        if (!confirm('Удалить сотрудника из подразделения?')) return;
        router.delete(`/kpi/divisions/${division.id}/employees/${userId}`);
    };

    return (
        <AuthenticatedLayout>
            <Head title={`Сотрудники: ${division.name}`} />

            <div className="admin-page-wrap">
                {/* Навигация */}
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.get('/kpi/divisions')}
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Вернуться к подразделениям
                    </Button>
                </div>

                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">{division.name}</h1>
                        <p className="text-sm text-muted-foreground">
                            Управление сотрудниками, которые могут работать с этим подразделением
                        </p>
                    </div>
                </div>

                {/* Форма добавления сотрудника */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Plus className="h-5 w-5" />
                            Добавить сотрудника
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="relative" ref={searchRef}>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <Input
                                            type="text"
                                            placeholder="Поиск сотрудника по имени, email или отделу..."
                                            value={search}
                                            onChange={(e) => {
                                                setSearch(e.target.value);
                                                setShowResults(e.target.value.length > 0);
                                            }}
                                            onFocus={() => search && setShowResults(true)}
                                        />
                                        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    </div>
                                </div>

                                {/* Результаты поиска */}
                                {showResults && search.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 z-10 mt-1 max-h-64 overflow-y-auto rounded-md border bg-background shadow-md">
                                        {filteredUsers.length === 0 ? (
                                            <div className="px-3 py-2 text-sm text-muted-foreground">
                                                Сотрудники не найдены или уже добавлены
                                            </div>
                                        ) : (
                                            filteredUsers.map(user => (
                                                <div
                                                    key={user.id}
                                                    className="flex cursor-pointer items-center justify-between border-b px-3 py-2 hover:bg-muted"
                                                    onClick={() => setSelectedUser(user)}
                                                >
                                                    <div className="min-w-0 flex-1">
                                                        <div className="truncate text-sm font-medium">{user.name}</div>
                                                        <div className="truncate text-xs text-muted-foreground">
                                                            {user.email}
                                                            {user.ad_department ? ` · ${user.ad_department}` : ''}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Выбранный сотрудник */}
                            {selectedUser && (
                                <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
                                    <div className="mb-2 font-medium text-sm">{selectedUser.name}</div>
                                    <div className="mb-3 text-xs text-muted-foreground">
                                        {selectedUser.email}
                                        {selectedUser.ad_department && ` · ${selectedUser.ad_department}`}
                                        {selectedUser.ad_title && ` · ${selectedUser.ad_title}`}
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            onClick={() => handleAdd(selectedUser)}
                                        >
                                            Добавить в подразделение
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                                setSelectedUser(null);
                                                setSearch('');
                                                setShowResults(false);
                                            }}
                                        >
                                            Отмена
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Список сотрудников */}
                <Card>
                    <CardHeader>
                        <CardTitle>
                            Сотрудники подразделения ({employees.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {employees.length === 0 ? (
                            <div className="text-center text-muted-foreground py-6">
                                Нет назначенных сотрудников
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {employees.map(employee => (
                                    <div
                                        key={employee.id}
                                        className="flex items-center justify-between rounded-md border p-3 hover:bg-muted/50"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate font-medium text-sm">{employee.name}</div>
                                            <div className="truncate text-xs text-muted-foreground">
                                                {employee.email}
                                                {employee.ad_department && ` · ${employee.ad_department}`}
                                                {employee.ad_title && ` · ${employee.ad_title}`}
                                            </div>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleRemove(employee.id)}
                                            title="Удалить из подразделения"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}
