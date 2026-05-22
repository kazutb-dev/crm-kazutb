import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Head, Link } from '@inertiajs/react';
import axios from 'axios';
import { ArrowLeft, BookOpenText, Search, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const getAcademicYearOptions = () => {
    const currentYear = new Date().getFullYear();

    return Array.from({ length: 6 }, (_, index) => {
        const start = currentYear - 2 + index;
        return `${start}/${start + 1}`;
    });
};

export default function GroupDetails({ groupId }) {
    const academicYearOptions = getAcademicYearOptions();

    const [groups, setGroups] = useState([]);
    const [students, setStudents] = useState([]);
    const [studentUsers, setStudentUsers] = useState([]);
    const [adStudents, setAdStudents] = useState([]);
    const [groupDisciplines, setGroupDisciplines] = useState([]);
    const [teacherDisciplines, setTeacherDisciplines] = useState([]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [studentSearch, setStudentSearch] = useState('');
    const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
    const [editingAssignmentId, setEditingAssignmentId] = useState(null);
    const [selectedDisciplineId, setSelectedDisciplineId] = useState('');
    const [studentDialogOpen, setStudentDialogOpen] = useState(false);
    const [studentForm, setStudentForm] = useState({
        student_key: '',
        status: 'active',
    });

    const [assignmentForm, setAssignmentForm] = useState({
        teacher_discipline_id: '',
        academic_year: academicYearOptions[2] || '',
        semester: '1',
        status: 'active',
    });

    const load = async () => {
        setLoading(true);
        setError('');

        try {
            const [groupsResponse, studentsResponse, groupDisciplinesResponse] = await Promise.all([
                axios.get('/api/questionnaire/admin/groups'),
                axios.get('/api/questionnaire/admin/students'),
                axios.get('/api/questionnaire/admin/group-disciplines'),
            ]);

            setGroups(groupsResponse.data?.data ?? []);
            setStudents(studentsResponse.data?.data ?? []);
            setStudentUsers(studentsResponse.data?.meta?.student_users ?? []);
            setGroupDisciplines(groupDisciplinesResponse.data?.data ?? []);
            setTeacherDisciplines(groupDisciplinesResponse.data?.meta?.teacher_disciplines ?? []);

            try {
                const adResponse = await axios.get('/api/questionnaire/admin/students/ad-search', {
                    params: { q: '' },
                });
                setAdStudents(adResponse.data?.data ?? []);
            } catch {
                setAdStudents([]);
            }
        } catch (e) {
            setError(e?.response?.data?.message || 'Не удалось загрузить данные группы.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const group = useMemo(() => {
        return groups.find((item) => Number(item.id) === Number(groupId)) || null;
    }, [groups, groupId]);

    const studentsOfGroup = useMemo(() => {
        const base = students.filter((item) => Number(item.group_id) === Number(groupId));
        const term = studentSearch.trim().toLowerCase();

        if (!term) {
            return base;
        }

        return base.filter((student) => {
            return [student.full_name, student.login, student.user?.ad_login]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .includes(term);
        });
    }, [students, groupId, studentSearch]);

    const disciplines = useMemo(() => {
        const names = new Set(
            groupDisciplines
                .filter((item) => Number(item.group_id) === Number(groupId))
                .map((item) => item.teacher_discipline?.discipline?.name)
                .filter(Boolean),
        );

        return Array.from(names).sort((a, b) => a.localeCompare(b, 'ru'));
    }, [groupDisciplines, groupId]);

    const studentsOfGroupUserIds = useMemo(() => {
        return new Set(
            students
                .filter((item) => Number(item.group_id) === Number(groupId))
                .map((item) => Number(item.user_id))
                .filter((id) => Number.isFinite(id) && id > 0),
        );
    }, [students, groupId]);

    const studentsOfGroupLogins = useMemo(() => {
        return new Set(
            students
                .filter((item) => Number(item.group_id) === Number(groupId))
                .map((item) => String(item.login || item.user?.ad_login || '').trim().toLowerCase())
                .filter((value) => value !== ''),
        );
    }, [students, groupId]);

    const availableStudentUsers = useMemo(() => {
        return studentUsers.filter((user) => !studentsOfGroupUserIds.has(Number(user.id)));
    }, [studentUsers, studentsOfGroupUserIds]);

    const availableAdStudents = useMemo(() => {
        return adStudents.filter((user) => {
            const login = String(user.ad_login || '').trim().toLowerCase();
            return login !== '' && !studentsOfGroupLogins.has(login);
        });
    }, [adStudents, studentsOfGroupLogins]);

    const availableStudentChoices = useMemo(() => {
        const localChoices = availableStudentUsers.map((user) => ({
            key: `local:${user.id}`,
            label: `${user.display_name || user.name} (${user.ad_login || user.email || `id:${user.id}`})`,
        }));

        const adChoices = availableAdStudents
            .filter((user) => {
                const adLogin = String(user.ad_login || '').trim().toLowerCase();
                return !availableStudentUsers.some((localUser) => String(localUser.ad_login || '').trim().toLowerCase() === adLogin);
            })
            .map((user) => ({
                key: `ad:${user.ad_login}`,
                label: `${user.display_name || user.ad_login} (${user.ad_login}) [AD]`,
            }));

        return [...localChoices, ...adChoices];
    }, [availableStudentUsers, availableAdStudents]);

    const assignmentsOfGroup = useMemo(() => {
        return groupDisciplines.filter((item) => Number(item.group_id) === Number(groupId));
    }, [groupDisciplines, groupId]);

    const disciplineOptions = useMemo(() => {
        const map = new Map();

        for (const item of teacherDisciplines) {
            const discipline = item.discipline;
            if (discipline?.id && !map.has(discipline.id)) {
                map.set(discipline.id, discipline);
            }
        }

        return Array.from(map.values()).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ru'));
    }, [teacherDisciplines]);

    const filteredTeacherDisciplines = useMemo(() => {
        if (!selectedDisciplineId) {
            return [];
        }

        return teacherDisciplines.filter((item) => String(item.discipline_id) === String(selectedDisciplineId));
    }, [teacherDisciplines, selectedDisciplineId]);

    const renderTeacherDisciplineLabel = (item) => {
        const teacherName = item?.teacher?.display_name || item?.teacher?.name || `ID ${item?.teacher_id}`;
        const disciplineName = item?.discipline?.name || `ID ${item?.discipline_id}`;

        return `${teacherName} • ${disciplineName}`;
    };

    const submitAssignment = async (event) => {
        event.preventDefault();
        setError('');
        setSuccess('');

        if (!selectedDisciplineId) {
            setError('Выберите дисциплину.');
            return;
        }

        if (!assignmentForm.teacher_discipline_id) {
            setError('Выберите преподавателя для этой дисциплины.');
            return;
        }

        try {
            const payload = {
                group_id: Number(groupId),
                teacher_discipline_id: Number(assignmentForm.teacher_discipline_id),
                academic_year: assignmentForm.academic_year,
                semester: assignmentForm.semester,
                status: assignmentForm.status,
            };

            if (editingAssignmentId) {
                await axios.patch(`/api/questionnaire/admin/group-disciplines/${editingAssignmentId}`, payload);
            } else {
                await axios.post('/api/questionnaire/admin/group-disciplines', payload);
            }

            setSuccess(editingAssignmentId ? 'Назначение для группы обновлено.' : 'Назначение для группы сохранено.');
            setAssignmentDialogOpen(false);
            setEditingAssignmentId(null);
            await load();
        } catch (e) {
            setError(e?.response?.data?.message || 'Не удалось сохранить назначение группы.');
        }
    };

    const openCreateAssignmentDialog = () => {
        setEditingAssignmentId(null);
        setSelectedDisciplineId('');
        setAssignmentForm({
            teacher_discipline_id: '',
            academic_year: academicYearOptions[2] || '',
            semester: '1',
            status: 'active',
        });
        setAssignmentDialogOpen(true);
    };

    const openEditAssignmentDialog = (item) => {
        setEditingAssignmentId(item.id);
        setSelectedDisciplineId(item.teacher_discipline?.discipline_id ? String(item.teacher_discipline.discipline_id) : '');
        setAssignmentForm({
            teacher_discipline_id: item.teacher_discipline_id ? String(item.teacher_discipline_id) : '',
            academic_year: item.academic_year || academicYearOptions[2] || '',
            semester: item.semester || '1',
            status: item.status || 'active',
        });
        setAssignmentDialogOpen(true);
    };

    const removeAssignment = async (id) => {
        if (!window.confirm('Удалить назначение дисциплины для этой группы?')) {
            return;
        }

        setError('');
        setSuccess('');

        try {
            await axios.delete(`/api/questionnaire/admin/group-disciplines/${id}`);
            setSuccess('Назначение удалено.');
            await load();
        } catch (e) {
            setError(e?.response?.data?.message || 'Не удалось удалить назначение.');
        }
    };

    const removeStudentBinding = async (studentId) => {
        if (!window.confirm('Отвязать студента от этой группы?')) {
            return;
        }

        setError('');
        setSuccess('');

        try {
            await axios.delete(`/api/questionnaire/admin/students/${studentId}`);
            setSuccess('Студент отвязан от группы.');
            await load();
        } catch (e) {
            setError(e?.response?.data?.message || 'Не удалось отвязать студента от группы.');
        }
    };

    const submitStudentBinding = async (event) => {
        event.preventDefault();
        setError('');
        setSuccess('');

        if (!studentForm.student_key) {
            setError('Выберите студента для привязки.');
            return;
        }

        try {
            const payload = {
                group_id: Number(groupId),
                status: studentForm.status,
            };

            if (studentForm.student_key.startsWith('local:')) {
                const userId = Number(studentForm.student_key.replace('local:', ''));
                if (studentsOfGroupUserIds.has(userId)) {
                    setError('Этот студент уже привязан к выбранной группе.');
                    return;
                }

                payload.user_id = userId;
            } else if (studentForm.student_key.startsWith('ad:')) {
                const adLogin = studentForm.student_key.replace('ad:', '').trim();
                if (studentsOfGroupLogins.has(adLogin.toLowerCase())) {
                    setError('Этот студент уже привязан к выбранной группе.');
                    return;
                }

                const adUser = adStudents.find((item) => String(item.ad_login || '').trim() === adLogin);
                payload.ad_login = adLogin;
                payload.full_name = adUser?.display_name || adLogin;
            } else {
                setError('Некорректный источник студента.');
                return;
            }

            await axios.post('/api/questionnaire/admin/students', payload);

            setSuccess('Студент привязан к группе.');
            setStudentDialogOpen(false);
            setStudentForm({ student_key: '', status: 'active' });
            await load();
        } catch (e) {
            setError(e?.response?.data?.message || 'Не удалось привязать студента к группе.');
        }
    };

    return (
        <AuthenticatedLayout>
            <Head title="Анкетирование - Детали группы" />

            <div className="space-y-6 p-4 sm:p-6 lg:p-8">
                <Card className="border-border/80 bg-white/90 shadow-sm">
                    <CardContent className="flex flex-col gap-4 pt-6 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Анкетирование / Группы</p>
                            <h1 className="text-2xl font-semibold tracking-tight text-[#132844]">
                                {group ? `Группа ${group.name}` : `Группа #${groupId}`}
                            </h1>
                            <p className="mt-1 text-sm text-muted-foreground">Отдельная страница группы: студенты и дисциплины.</p>
                        </div>
                        <Link href={route('questionnaire.admin.groups')} className="inline-flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm hover:bg-muted/40">
                            <ArrowLeft className="h-4 w-4" />
                            К списку групп
                        </Link>
                    </CardContent>
                </Card>

                {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
                {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <MetricCard title="Студентов" value={studentsOfGroup.length} icon={<Users className="h-5 w-5 text-[#139AA4]" />} />
                    <MetricCard title="Дисциплин" value={disciplines.length} icon={<BookOpenText className="h-5 w-5 text-[#139AA4]" />} />
                    <MetricCard title="Курс" value={group?.courseRef?.name || group?.course || '—'} />
                    <MetricCard title="Статус" value={group?.status || '—'} />
                </div>

                <Card className="border-border/80 bg-white/90 shadow-sm">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between gap-3">
                            <CardTitle className="text-base text-[#132844]">Назначения группы</CardTitle>
                            <Button type="button" onClick={openCreateAssignmentDialog}>
                                Назначить дисциплину
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">Добавляйте назначение через модальное окно. Текущие назначения отображаются в таблице ниже.</p>
                    </CardContent>
                </Card>

                <Dialog
                    open={assignmentDialogOpen}
                    onOpenChange={(open) => {
                        setAssignmentDialogOpen(open);
                        if (!open) {
                            setEditingAssignmentId(null);
                            setSelectedDisciplineId('');
                            setAssignmentForm({
                                teacher_discipline_id: '',
                                academic_year: academicYearOptions[2] || '',
                                semester: '1',
                                status: 'active',
                            });
                        }
                    }}
                >
                    <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                            <DialogTitle>{editingAssignmentId ? 'Редактировать назначение' : 'Назначить дисциплину группе'}</DialogTitle>
                            <DialogDescription>
                                Сначала выберите дисциплину, затем преподавателя из привязанных к ней.
                            </DialogDescription>
                        </DialogHeader>

                        <form className="space-y-3" onSubmit={submitAssignment}>
                            <select
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={selectedDisciplineId}
                                onChange={(e) => {
                                    const nextDisciplineId = e.target.value;
                                    setSelectedDisciplineId(nextDisciplineId);
                                    setAssignmentForm((prev) => ({ ...prev, teacher_discipline_id: '' }));
                                }}
                            >
                                <option value="">Выберите дисциплину</option>
                                {disciplineOptions.map((discipline) => (
                                    <option key={discipline.id} value={discipline.id}>{discipline.name}</option>
                                ))}
                            </select>

                            <select
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={assignmentForm.teacher_discipline_id}
                                onChange={(e) => setAssignmentForm((prev) => ({ ...prev, teacher_discipline_id: e.target.value }))}
                                disabled={!selectedDisciplineId}
                            >
                                <option value="">{selectedDisciplineId ? 'Выберите преподавателя' : 'Сначала выберите дисциплину'}</option>
                                {filteredTeacherDisciplines.map((item) => (
                                    <option key={item.id} value={item.id}>{item.teacher?.display_name || item.teacher?.name || `ID ${item.teacher_id}`}</option>
                                ))}
                            </select>

                            <select
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={assignmentForm.academic_year}
                                onChange={(e) => setAssignmentForm((prev) => ({ ...prev, academic_year: e.target.value }))}
                            >
                                {academicYearOptions.map((year) => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>

                            <select
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={assignmentForm.semester}
                                onChange={(e) => setAssignmentForm((prev) => ({ ...prev, semester: e.target.value }))}
                            >
                                <option value="1">1</option>
                                <option value="2">2</option>
                            </select>

                            <div className="flex gap-2 pt-1">
                                <Button type="submit">{editingAssignmentId ? 'Сохранить' : 'Назначить'}</Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setAssignmentDialogOpen(false)}
                                >
                                    Отмена
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>

                <Card className="border-border/80 bg-white/90 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base text-[#132844]">Дисциплины группы</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <p className="text-sm text-muted-foreground">Загрузка...</p>
                        ) : assignmentsOfGroup.length === 0 ? (
                            <p className="text-sm text-muted-foreground">У группы пока нет назначенных дисциплин.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead>
                                        <tr className="border-b text-muted-foreground">
                                            <th className="px-3 py-2 text-left font-medium">Преподаватель</th>
                                            <th className="px-3 py-2 text-left font-medium">Дисциплина</th>
                                            <th className="px-3 py-2 text-left font-medium">Период</th>
                                            <th className="px-3 py-2 text-left font-medium">Статус</th>
                                            <th className="px-3 py-2 text-right font-medium">Действия</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {assignmentsOfGroup.map((item) => (
                                            <tr key={item.id} className="border-b last:border-b-0">
                                                <td className="px-3 py-2">{item.teacher_discipline?.teacher?.display_name || item.teacher_discipline?.teacher?.name || item.teacher_discipline?.teacher_id}</td>
                                                <td className="px-3 py-2">{item.teacher_discipline?.discipline?.name || item.teacher_discipline?.discipline_id}</td>
                                                <td className="px-3 py-2">{item.academic_year} · {item.semester}</td>
                                                <td className="px-3 py-2">
                                                    <Badge variant={item.status === 'active' ? 'default' : 'secondary'} className={item.status === 'active' ? 'bg-emerald-600 text-white' : ''}>
                                                        {item.status}
                                                    </Badge>
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                    <div className="inline-flex gap-2">
                                                        <Button type="button" variant="outline" size="sm" onClick={() => openEditAssignmentDialog(item)}>
                                                            Ред.
                                                        </Button>
                                                        <Button type="button" variant="outline" size="sm" className="text-red-700" onClick={() => removeAssignment(item.id)}>
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

                <Card className="border-border/80 bg-white/90 shadow-sm">
                    <CardHeader className="pb-2">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <CardTitle className="text-base text-[#132844]">Студенты группы</CardTitle>
                            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                                <Button type="button" onClick={() => setStudentDialogOpen(true)}>
                                    Привязать студента
                                </Button>
                                <div className="relative w-full sm:w-80">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        className="pl-9"
                                        placeholder="Поиск студента"
                                        value={studentSearch}
                                        onChange={(e) => setStudentSearch(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <p className="text-sm text-muted-foreground">Загрузка...</p>
                        ) : studentsOfGroup.length === 0 ? (
                            <p className="text-sm text-muted-foreground">В этой группе нет студентов.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead>
                                        <tr className="border-b text-muted-foreground">
                                            <th className="px-3 py-2 text-left font-medium">Студент</th>
                                            <th className="px-3 py-2 text-left font-medium">Логин</th>
                                            <th className="px-3 py-2 text-right font-medium">Действия</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {studentsOfGroup.map((student) => (
                                            <tr key={student.id} className="border-b last:border-b-0">
                                                <td className="px-3 py-2 font-medium text-[#132844]">{student.full_name}</td>
                                                <td className="px-3 py-2">{student.login || student.user?.ad_login || '—'}</td>
                                                <td className="px-3 py-2 text-right">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        className="text-red-700"
                                                        onClick={() => removeStudentBinding(student.id)}
                                                    >
                                                        Отвязать
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

                <Dialog
                    open={studentDialogOpen}
                    onOpenChange={(open) => {
                        setStudentDialogOpen(open);
                        if (!open) {
                            setStudentForm({ student_key: '', status: 'active' });
                        }
                    }}
                >
                    <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                            <DialogTitle>Привязать студента к группе</DialogTitle>
                            <DialogDescription>
                                Выберите студента. Один и тот же студент может быть привязан к этой группе только один раз.
                            </DialogDescription>
                        </DialogHeader>

                        <form className="space-y-3" onSubmit={submitStudentBinding}>
                            <select
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={studentForm.student_key}
                                onChange={(e) => setStudentForm((prev) => ({ ...prev, student_key: e.target.value }))}
                            >
                                <option value="">Выберите студента (система/AD)</option>
                                {availableStudentChoices.map((choice) => (
                                    <option key={choice.key} value={choice.key}>
                                        {choice.label}
                                    </option>
                                ))}
                            </select>

                            <select
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={studentForm.status}
                                onChange={(e) => setStudentForm((prev) => ({ ...prev, status: e.target.value }))}
                            >
                                <option value="active">active</option>
                                <option value="inactive">inactive</option>
                            </select>

                            <div className="flex gap-2 pt-1">
                                <Button type="submit">Привязать</Button>
                                <Button type="button" variant="outline" onClick={() => setStudentDialogOpen(false)}>
                                    Отмена
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>
        </AuthenticatedLayout>
    );
}

function MetricCard({ title, value, icon = null }) {
    return (
        <Card className="border-border/80 bg-white/90 shadow-sm">
            <CardContent className="flex items-center justify-between pt-6">
                <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
                    <p className="text-2xl font-semibold text-[#132844]">{value}</p>
                </div>
                {icon}
            </CardContent>
        </Card>
    );
}
