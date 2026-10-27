import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Notice, PageHeader, StatusBadge } from '@/components/platform';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Head, router } from '@inertiajs/react';
import { ArrowLeft, Inbox, Plus, Search, Trash2, Users } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

// Empty state for use inside a card (the platform EmptyState is itself a card).
function InlineEmpty({ title, description = null, action = null }) {
    return (
        <div className="flex flex-col items-center justify-center gap-2 px-5 py-8 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 text-teal-700">
                <Inbox className="h-4 w-4" />
            </div>
            <div className="max-w-md space-y-1">
                <p className="text-sm font-semibold text-[#102945]">{title}</p>
                {description ? <p className="text-sm leading-relaxed text-slate-600">{description}</p> : null}
            </div>
            {action}
        </div>
    );
}

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
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="KPI · Подразделения"
                    title={division.name}
                    description="Управление сотрудниками, которые могут работать с этим подразделением"
                    meta={<StatusBadge tone="info">Сотрудников: {employees.length}</StatusBadge>}
                    actions={(
                        <Button variant="outline" onClick={() => router.get('/kpi/divisions')}>
                            <ArrowLeft className="h-4 w-4" />
                            Вернуться к подразделениям
                        </Button>
                    )}
                />
            )}
        >
            <Head title={`Сотрудники: ${division.name}`} />

            <div className="admin-page-wrap">
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[400px_minmax(0,1fr)] xl:items-start">
                <Card>
                    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                        <CardTitle className="flex items-center gap-2">
                            <Plus className="h-4 w-4" />
                            Добавить сотрудника
                        </CardTitle>
                        <Badge variant="outline" className="tabular-nums" title="Доступно для добавления">{allUsers.length - employees.length}</Badge>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            <div className="relative space-y-2" ref={searchRef}>
                                <span className="qd-field-label block">Поиск сотрудника</span>
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <Input
                                        type="text"
                                        placeholder="Поиск сотрудника по имени, email или отделу..."
                                        value={search}
                                        className="pl-9"
                                        onChange={(e) => {
                                            setSearch(e.target.value);
                                            setShowResults(e.target.value.length > 0);
                                        }}
                                        onFocus={() => search && setShowResults(true)}
                                    />
                                </div>

                                {showResults && search.length > 0 && (
                                    <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded-[12px] border border-slate-200 bg-white shadow-[0_8px_24px_-12px_rgba(16,41,69,0.18)]">
                                        {filteredUsers.length === 0 ? (
                                            <div className="px-4 py-3 text-sm text-slate-500">
                                                Сотрудники не найдены или уже добавлены
                                            </div>
                                        ) : (
                                            filteredUsers.map(user => (
                                                <div
                                                    key={user.id}
                                                    className="flex cursor-pointer items-center justify-between border-b border-slate-200 px-4 py-2.5 last:border-0 hover:bg-teal-50"
                                                    onClick={() => setSelectedUser(user)}
                                                >
                                                    <div className="min-w-0 flex-1">
                                                        <div className="truncate text-sm font-medium text-slate-900">{user.name}</div>
                                                        <div className="truncate text-xs text-slate-500">
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

                            {selectedUser && (
                                <Notice
                                    tone="brand"
                                    title={selectedUser.name}
                                    action={(
                                        <div className="flex shrink-0 flex-wrap gap-2">
                                            <Button size="sm" onClick={() => handleAdd(selectedUser)}>
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
                                    )}
                                >
                                    {selectedUser.email}
                                    {selectedUser.ad_department && ` · ${selectedUser.ad_department}`}
                                    {selectedUser.ad_title && ` · ${selectedUser.ad_title}`}
                                </Notice>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                        <CardTitle className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Сотрудники подразделения
                        </CardTitle>
                        <Badge variant="secondary" className="tabular-nums">{employees.length}</Badge>
                    </CardHeader>
                    <CardContent className="p-0">
                        {employees.length === 0 ? (
                            <InlineEmpty
                                title="Нет назначенных сотрудников"
                                description="Найдите сотрудника в блоке «Добавить сотрудника» и добавьте его в подразделение."
                            />
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[640px] text-sm">
                                    <thead className="border-b border-slate-200">
                                        <tr>
                                            <th className="text-left">#</th>
                                            <th className="text-left">Сотрудник</th>
                                            <th className="text-left">Email</th>
                                            <th className="text-left">Отдел</th>
                                            <th className="text-left">Должность</th>
                                            <th className="text-right">Действия</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {employees.map((employee, index) => (
                                            <tr key={employee.id} className="border-b border-slate-200 last:border-0 hover:bg-slate-50">
                                                <td className="tabular-nums text-slate-500">{index + 1}</td>
                                                <td className="font-medium text-slate-900">{employee.name}</td>
                                                <td className="break-all text-slate-600">{employee.email}</td>
                                                <td className="text-slate-600">{employee.ad_department || '—'}</td>
                                                <td className="text-slate-600">{employee.ad_title || '—'}</td>
                                                <td className="text-right">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => handleRemove(employee.id)}
                                                        title="Удалить из подразделения"
                                                        className="text-red-700 hover:bg-red-50"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
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
