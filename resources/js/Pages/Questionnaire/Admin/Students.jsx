import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FormField, LoadingState, Notice, PageHeader, StatGrid, StatTile, StatusBadge, qdFieldClass } from '@/components/platform';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { Loader2, Pencil, Plus, Save, Search, Trash2, UserCheck, UserSearch, Users, UsersRound } from 'lucide-react';

export default function Students() {
    const [confirmState, setConfirmState] = useState({ open: false, description: '', onConfirm: null });
    const [students, setStudents] = useState([]);
    const [groups, setGroups] = useState([]);
    const [studentUsers, setStudentUsers] = useState([]);
    const [adStudents, setAdStudents] = useState([]);
    const [adSearch, setAdSearch] = useState('');
    const [adLoading, setAdLoading] = useState(false);
    const [search, setSearch] = useState('');

    const [form, setForm] = useState({
        user_id: '',
        ad_login: '',
        full_name: '',
        group_id: '',
        status: 'active',
    });

    const [editingId, setEditingId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const load = async () => {
        setLoading(true);
        setError('');

        try {
            const response = await axios.get('/api/questionnaire/admin/students');
            setStudents(response.data?.data ?? []);
            setGroups(response.data?.meta?.groups ?? []);
            const localStudents = response.data?.meta?.student_users ?? [];
            setStudentUsers(localStudents);

            if (localStudents.length === 0) {
                const adResponse = await axios.get('/api/questionnaire/admin/students/ad-search', {
                    params: { q: '' },
                });
                setAdStudents(adResponse.data?.data ?? []);
            }
        } catch (e) {
            setError(e?.response?.data?.message || 'Не удалось загрузить привязки студентов.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const resetForm = () => {
        setForm({
            user_id: '',
            ad_login: '',
            full_name: '',
            group_id: '',
            status: 'active',
        });
        setEditingId(null);
    };

    const searchAdStudents = async () => {
        setAdLoading(true);
        setError('');

        try {
            const response = await axios.get('/api/questionnaire/admin/students/ad-search', {
                params: { q: adSearch },
            });
            setAdStudents(response.data?.data ?? []);
        } catch (e) {
            setError(e?.response?.data?.message || 'Не удалось выполнить поиск по AD.');
        } finally {
            setAdLoading(false);
        }
    };

    const submit = async (event) => {
        event.preventDefault();
        setError('');
        setSuccess('');

        try {
            if (editingId) {
                await axios.patch(`/api/questionnaire/admin/students/${editingId}`, {
                    group_id: Number(form.group_id),
                    status: form.status,
                });
                setSuccess('Привязка студента обновлена.');
            } else {
                const payload = {
                    group_id: Number(form.group_id),
                    status: form.status,
                };

                if (form.user_id) {
                    payload.user_id = Number(form.user_id);
                } else {
                    payload.ad_login = form.ad_login;
                    payload.full_name = form.full_name;
                }

                await axios.post('/api/questionnaire/admin/students', {
                    ...payload,
                });
                setSuccess('Привязка студента создана.');
            }

            resetForm();
            await load();
        } catch (e) {
            setError(e?.response?.data?.message || 'Ошибка сохранения привязки студента.');
        }
    };

    const startEdit = (student) => {
        setEditingId(student.id);
        setForm({
            user_id: student.user_id ? String(student.user_id) : '',
            ad_login: student.login || student.user?.ad_login || '',
            full_name: student.full_name || student.user?.display_name || student.user?.name || '',
            group_id: student.group_id ? String(student.group_id) : '',
            status: student.status || 'active',
        });
    };

    const remove = async (studentId) => {
        setConfirmState({
            open: true,
            description: 'Удалить привязку студента?',
            onConfirm: async () => {
                setError('');
                setSuccess('');
                try {
                    await axios.delete(`/api/questionnaire/admin/students/${studentId}`);
                    if (editingId === studentId) {
                        resetForm();
                    }
                    setSuccess('Привязка студента удалена.');
                    await load();
                } catch (e) {
                    setError(e?.response?.data?.message || 'Ошибка удаления привязки студента.');
                }
            },
        });
    };

    const filteredStudents = students.filter((student) => {
        const term = search.trim().toLowerCase();
        if (term === '') {
            return true;
        }

        return [
            student.full_name,
            student.login,
            student.user?.ad_login,
            student.group?.name,
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(term);
    });

    const activeStudents = students.filter((student) => student.status === 'active').length;

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="Анкетирование"
                    title="Студенты"
                    description="Привязка студентов к группам с выбором из локальной базы или AD."
                    meta={<StatusBadge tone="default">{students.length} привязок</StatusBadge>}
                />
            )}
        >
            <Head title="Анкетирование - Студенты" />

            <div className="admin-page-wrap space-y-6">
                <StatGrid>
                    <StatTile label="Привязок" value={students.length} tone="teal" icon={Users} />
                    <StatTile label="Активные" value={activeStudents} tone="success" icon={UserCheck} />
                    <StatTile label="Групп" value={groups.length} tone="navy" icon={UsersRound} />
                    <StatTile label="Студентов в базе" value={studentUsers.length} tone="gold" icon={UserSearch} hint="Доступны для выбора в форме" />
                </StatGrid>

                {error && <Notice tone="danger" title="Ошибка">{error}</Notice>}
                {success && <Notice tone="success">{success}</Notice>}

                <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[400px_1fr]">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                {editingId ? <Save /> : <Plus />}
                                {editingId ? 'Редактирование привязки' : 'Новая привязка студента'}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form className="space-y-4" onSubmit={submit}>
                                <FormField label="Студент из локальной базы">
                                    <select
                                        className={qdFieldClass}
                                        value={form.user_id}
                                        onChange={(e) => setForm((prev) => ({
                                            ...prev,
                                            user_id: e.target.value,
                                            ad_login: e.target.value ? '' : prev.ad_login,
                                            full_name: e.target.value ? '' : prev.full_name,
                                        }))}
                                        disabled={Boolean(editingId)}
                                    >
                                        <option value="">Выберите студента из локальной базы</option>
                                        {studentUsers.map((user) => (
                                            <option key={user.id} value={user.id}>
                                                {user.display_name || user.name} ({user.ad_login || user.email || `id:${user.id}`})
                                            </option>
                                        ))}
                                    </select>
                                </FormField>

                                {!editingId && (
                                    <div className="space-y-3 rounded-xl border border-dashed border-slate-300 bg-white p-4">
                                        <div className="flex items-start gap-2">
                                            <UserSearch className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
                                            <p className="text-sm font-medium text-[#102945]">Если студента нет в системе, выполните поиск в AD</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <Input
                                                placeholder="Поиск в AD (ФИО, логин, email)"
                                                value={adSearch}
                                                onChange={(e) => setAdSearch(e.target.value)}
                                            />
                                            <Button type="button" variant="outline" onClick={searchAdStudents}>
                                                {adLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                                {adLoading ? 'Поиск...' : 'Найти'}
                                            </Button>
                                        </div>

                                        <FormField label="Студент из AD">
                                            <select
                                                className={qdFieldClass}
                                                value={form.ad_login}
                                                onChange={(e) => {
                                                    const selected = adStudents.find((item) => item.ad_login === e.target.value);

                                                    setForm((prev) => ({
                                                        ...prev,
                                                        user_id: '',
                                                        ad_login: e.target.value,
                                                        full_name: selected?.display_name || '',
                                                    }));
                                                }}
                                            >
                                                <option value="">Выберите студента из AD</option>
                                                {adStudents.map((user) => (
                                                    <option key={user.ad_login} value={user.ad_login}>
                                                        {user.display_name} ({user.ad_login})
                                                    </option>
                                                ))}
                                            </select>
                                        </FormField>

                                        {!!form.ad_login && (
                                            <p className="text-xs text-slate-600">
                                                Выбран AD логин: <Badge variant="secondary" className="ml-1 font-mono">{form.ad_login}</Badge>
                                            </p>
                                        )}
                                    </div>
                                )}

                                <FormField label="Группа">
                                    <select
                                        className={qdFieldClass}
                                        value={form.group_id}
                                        onChange={(e) => setForm((prev) => ({ ...prev, group_id: e.target.value }))}
                                    >
                                        <option value="">Выберите группу</option>
                                        {groups.map((group) => (
                                            <option key={group.id} value={group.id}>
                                                {group.name}
                                            </option>
                                        ))}
                                    </select>
                                </FormField>

                                <FormField label="Статус">
                                    <select
                                        className={qdFieldClass}
                                        value={form.status}
                                        onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                                    >
                                        <option value="active">active</option>
                                        <option value="inactive">inactive</option>
                                    </select>
                                </FormField>

                                <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                                    {editingId && (
                                        <Button type="button" variant="outline" onClick={resetForm}>Отмена</Button>
                                    )}
                                    <Button type="submit">
                                        {editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                        {editingId ? 'Сохранить' : 'Привязать'}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Users />
                                Текущие привязки студентов
                            </CardTitle>
                        </CardHeader>
                        <div className="border-b border-slate-200 px-5 py-4">
                            <FormField label="Поиск">
                                <div className="relative w-full sm:max-w-sm">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <Input
                                        className="pl-9"
                                        placeholder="ФИО, логин или группа"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                    />
                                </div>
                            </FormField>
                        </div>
                        <CardContent className="p-0">
                            {loading ? (
                                <div className="p-5"><LoadingState /></div>
                            ) : filteredStudents.length === 0 ? (
                                <div className="px-5 py-12 text-center">
                                    <p className="font-display text-lg font-bold text-[#102945]">Привязки пока не созданы</p>
                                    <p className="mt-1 text-sm text-slate-600">
                                        {students.length === 0 ? 'Выберите студента и группу в форме слева, чтобы создать первую привязку.' : 'По запросу ничего не найдено — измените поиск.'}
                                    </p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-slate-200">
                                                <th className="px-5 py-3 text-left">Студент</th>
                                                <th className="px-5 py-3 text-left">Логин AD</th>
                                                <th className="px-5 py-3 text-left">Группа</th>
                                                <th className="px-5 py-3 text-left">Статус</th>
                                                <th className="px-5 py-3 text-right">Действия</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredStudents.map((student) => (
                                                <tr key={student.id} className={`border-b border-slate-200 last:border-b-0 hover:bg-slate-50 ${editingId === student.id ? 'bg-teal-50' : ''}`}>
                                                    <td className="px-5 py-3 font-medium text-slate-900">{student.full_name}</td>
                                                    <td className="px-5 py-3 font-mono text-xs text-slate-600">{student.login || student.user?.ad_login || '—'}</td>
                                                    <td className="px-5 py-3 text-slate-700">{student.group?.name || '—'}</td>
                                                    <td className="px-5 py-3">
                                                        <StatusBadge tone={student.status === 'active' ? 'success' : 'default'}>
                                                            {student.status}
                                                        </StatusBadge>
                                                    </td>
                                                    <td className="px-5 py-3 text-right">
                                                        <div className="inline-flex gap-2">
                                                            <Button type="button" variant="outline" size="sm" onClick={() => startEdit(student)}>
                                                                <Pencil className="h-3.5 w-3.5" />
                                                                Ред.
                                                            </Button>
                                                            <Button type="button" variant="ghost" size="sm" className="text-red-700 hover:bg-red-50 hover:text-red-800" onClick={() => remove(student.id)}>
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                                Удалить
                                                            </Button>
                                                        </div>
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
