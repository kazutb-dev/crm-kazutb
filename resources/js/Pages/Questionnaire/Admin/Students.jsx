import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { Plus, Save, Search, Trash2, UserSearch, Users } from 'lucide-react';

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

    return (
        <AuthenticatedLayout>
            <Head title="Анкетирование - Студенты" />

            <div className="space-y-6 p-4 sm:p-6 lg:p-8">
                <Card className="border-border/80 bg-white/90 shadow-sm">
                    <CardContent className="flex flex-col gap-4 pt-6 md:flex-row md:items-center md:justify-between">
                        <div>
                            <h1 className="text-2xl font-semibold tracking-tight text-[#132844]">Анкетирование - Студенты</h1>
                            <p className="mt-1 text-sm text-muted-foreground">Привязка студентов к группам с выбором из локальной базы или AD.</p>
                        </div>
                        <Badge variant="secondary" className="w-fit">{students.length} привязок</Badge>
                    </CardContent>
                </Card>

                {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
                {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[430px_1fr]">
                    <Card className="border-border/80 bg-white/90 shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base text-[#132844]">{editingId ? 'Редактирование привязки' : 'Новая привязка студента'}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form className="space-y-3" onSubmit={submit}>
                                <select
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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

                                {!editingId && (
                                    <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
                                        <p className="text-xs font-medium text-[#132844]">Если студента нет в системе, выполните поиск в AD</p>
                                        <div className="flex gap-2">
                                            <Input
                                                placeholder="Поиск в AD (ФИО, логин, email)"
                                                value={adSearch}
                                                onChange={(e) => setAdSearch(e.target.value)}
                                            />
                                            <Button type="button" variant="outline" className="gap-2" onClick={searchAdStudents}>
                                                <UserSearch className="h-4 w-4" />
                                                {adLoading ? 'Поиск...' : 'Найти'}
                                            </Button>
                                        </div>

                                        <select
                                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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

                                        {!!form.ad_login && (
                                            <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                                                Выбран AD логин: <span className="font-semibold">{form.ad_login}</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <select
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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

                                <select
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={form.status}
                                    onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                                >
                                    <option value="active">active</option>
                                    <option value="inactive">inactive</option>
                                </select>

                                <div className="flex gap-2">
                                    <Button type="submit" className="gap-2">
                                        {editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                        {editingId ? 'Сохранить' : 'Привязать'}
                                    </Button>
                                    {editingId && (
                                        <Button type="button" variant="outline" onClick={resetForm}>Отмена</Button>
                                    )}
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    <Card className="border-border/80 bg-white/90 shadow-sm">
                        <CardHeader className="pb-2">
                            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <CardTitle className="flex items-center gap-2 text-base text-[#132844]"><Users className="h-4 w-4 text-[#139AA4]" />Текущие привязки студентов</CardTitle>
                                <div className="relative w-full sm:w-72">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                    className="pl-9"
                                    placeholder="Поиск"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>

                            {loading ? (
                                <p className="text-sm text-muted-foreground">Загрузка...</p>
                            ) : filteredStudents.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Привязки пока не созданы.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-sm">
                                        <thead>
                                            <tr className="border-b text-muted-foreground">
                                                <th className="px-3 py-2 text-left font-medium">Студент</th>
                                                <th className="px-3 py-2 text-left font-medium">Логин AD</th>
                                                <th className="px-3 py-2 text-left font-medium">Группа</th>
                                                <th className="px-3 py-2 text-left font-medium">Статус</th>
                                                <th className="px-3 py-2 text-right font-medium">Действия</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredStudents.map((student) => (
                                                <tr key={student.id} className="border-b last:border-b-0">
                                                    <td className="px-3 py-2 font-medium text-[#132844]">{student.full_name}</td>
                                                    <td className="px-3 py-2">{student.login || student.user?.ad_login || '—'}</td>
                                                    <td className="px-3 py-2">{student.group?.name || '—'}</td>
                                                    <td className="px-3 py-2">
                                                        <Badge variant={student.status === 'active' ? 'default' : 'secondary'} className={student.status === 'active' ? 'bg-emerald-600 text-white' : ''}>
                                                            {student.status}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-3 py-2 text-right">
                                                        <div className="inline-flex gap-2">
                                                            <Button type="button" variant="outline" size="sm" onClick={() => startEdit(student)}>Ред.</Button>
                                                            <Button type="button" variant="outline" size="sm" className="text-red-700" onClick={() => remove(student.id)}>
                                                                <Trash2 className="mr-1 h-3.5 w-3.5" />
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
        </AuthenticatedLayout>
        <ConfirmDialog
            open={confirmState.open}
            onOpenChange={(open) => !open && setConfirmState({ open: false, description: '', onConfirm: null })}
            description={confirmState.description}
            onConfirm={() => {
                confirmState.onConfirm?.();
                setConfirmState({ open: false, description: '', onConfirm: null });
            }}
        />
    );
}
