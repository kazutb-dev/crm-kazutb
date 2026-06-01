import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Head, Link } from '@inertiajs/react';
import axios from 'axios';
import { ArrowLeft, BookOpenText, Building2, GraduationCap, Search, Users, UserPlus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const getAcademicYearOptions = () => {
    const currentYear = new Date().getFullYear();

    return Array.from({ length: 6 }, (_, index) => {
        const start = currentYear - 2 + index;
        return `${start}/${start + 1}`;
    });
};

const getGroupCourseRef = (group) => group?.courseRef ?? group?.course_ref ?? null;

const getGroupSpecialityRef = (group) => group?.specialityRef ?? group?.speciality_ref ?? null;

const getGroupProgramRef = (group) => group?.educationalProgramRef ?? group?.educational_program_ref ?? null;

const getGroupDepartment = (group) => {
    const specialityRef = getGroupSpecialityRef(group);
    return specialityRef?.department ?? specialityRef?.department_ref ?? null;
};

export default function GroupDetails({ groupId }) {
    const academicYearOptions = getAcademicYearOptions();

    const [confirmState, setConfirmState] = useState({ open: false, description: '', onConfirm: null });
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
    const [studentLookupQuery, setStudentLookupQuery] = useState('');
    const [studentLookupLoading, setStudentLookupLoading] = useState(false);
    const [assignmentSearch, setAssignmentSearch] = useState('');
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
        } catch (e) {
            setError(e?.response?.data?.message || 'Не удалось загрузить данные группы.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    useEffect(() => {
        if (!studentDialogOpen) {
            return;
        }

        const term = studentLookupQuery.trim();
        if (term.length < 2) {
            setAdStudents([]);
            setStudentLookupLoading(false);
            return;
        }

        let cancelled = false;
        const timeoutId = setTimeout(async () => {
            setStudentLookupLoading(true);

            try {
                const adResponse = await axios.get('/api/questionnaire/admin/students/ad-search', {
                    params: { q: term },
                });

                if (!cancelled) {
                    setAdStudents(adResponse.data?.data ?? []);
                }
            } catch {
                if (!cancelled) {
                    setAdStudents([]);
                }
            } finally {
                if (!cancelled) {
                    setStudentLookupLoading(false);
                }
            }
        }, 300);

        return () => {
            cancelled = true;
            clearTimeout(timeoutId);
        };
    }, [studentDialogOpen, studentLookupQuery]);

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
        const term = studentLookupQuery.trim().toLowerCase();

        return studentUsers.filter((user) => {
            if (studentsOfGroupUserIds.has(Number(user.id))) {
                return false;
            }

            if (!term) {
                return true;
            }

            return [user.display_name, user.name, user.ad_login, user.email]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .includes(term);
        });
    }, [studentUsers, studentsOfGroupUserIds, studentLookupQuery]);

    const availableAdStudents = useMemo(() => {
        return adStudents.filter((user) => {
            const login = String(user.ad_login || '').trim().toLowerCase();
            return login !== '' && !studentsOfGroupLogins.has(login);
        });
    }, [adStudents, studentsOfGroupLogins]);

    const availableStudentChoices = useMemo(() => {
        const localChoices = availableStudentUsers.map((user) => ({
            key: `local:${user.id}`,
            title: user.display_name || user.name || `id:${user.id}`,
            subtitle: user.ad_login || user.email || `id:${user.id}`,
            source: 'local',
        }));

        const adChoices = availableAdStudents
            .filter((user) => {
                const adLogin = String(user.ad_login || '').trim().toLowerCase();
                return !availableStudentUsers.some((localUser) => String(localUser.ad_login || '').trim().toLowerCase() === adLogin);
            })
            .map((user) => ({
                key: `ad:${user.ad_login}`,
                title: user.display_name || user.ad_login,
                subtitle: `${user.ad_login}${user.department ? ` • ${user.department}` : ''}`,
                source: 'ad',
            }));

        return [...localChoices, ...adChoices];
    }, [availableStudentUsers, availableAdStudents]);

    const assignmentsOfGroup = useMemo(() => {
        return groupDisciplines.filter((item) => Number(item.group_id) === Number(groupId));
    }, [groupDisciplines, groupId]);

    const filteredAssignmentsOfGroup = useMemo(() => {
        const term = assignmentSearch.trim().toLowerCase();
        if (!term) {
            return assignmentsOfGroup;
        }

        return assignmentsOfGroup.filter((item) => {
            return [
                item.teacher_discipline?.teacher?.display_name,
                item.teacher_discipline?.teacher?.name,
                item.teacher_discipline?.discipline?.name,
                item.academic_year,
                item.semester,
                item.status,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .includes(term);
        });
    }, [assignmentsOfGroup, assignmentSearch]);

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
        setConfirmState({
            open: true,
            description: 'Удалить назначение дисциплины для этой группы?',
            onConfirm: async () => {
                setError('');
                setSuccess('');
                try {
                    await axios.delete(`/api/questionnaire/admin/group-disciplines/${id}`);
                    setSuccess('Назначение удалено.');
                    await load();
                } catch (e) {
                    setError(e?.response?.data?.message || 'Не удалось удалить назначение.');
                }
            },
        });
    };

    const removeStudentBinding = async (studentId) => {
        setConfirmState({
            open: true,
            description: 'Отвязать студента от этой группы?',
            onConfirm: async () => {
                setError('');
                setSuccess('');
                try {
                    await axios.delete(`/api/questionnaire/admin/students/${studentId}`);
                    setSuccess('Студент отвязан от группы.');
                    await load();
                } catch (e) {
                    setError(e?.response?.data?.message || 'Не удалось отвязать студента от группы.');
                }
            },
        });
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
                <Card className="relative overflow-hidden border-0 bg-gradient-to-r from-[#132844] via-[#1b3a60] to-[#245279] text-white shadow-lg">
                    <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-cyan-300/20 blur-3xl" />
                    <div className="pointer-events-none absolute -bottom-24 left-20 h-64 w-64 rounded-full bg-blue-200/20 blur-3xl" />
                    <CardContent className="relative flex flex-col gap-4 pt-6 md:flex-row md:items-center md:justify-between">
                        <div>
                            <h1 className="text-3xl font-semibold tracking-tight">
                                {group ? `Группа ${group.name}` : `Группа #${groupId}`}
                            </h1>
                        </div>
                        <Link href={route('questionnaire.admin.groups')} className="inline-flex items-center gap-2 rounded-md border border-white/30 bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/20">
                            <ArrowLeft className="h-4 w-4" />
                            К списку групп
                        </Link>
                    </CardContent>
                </Card>

                {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
                {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}

                <Card className="border-border/80 bg-white shadow-sm">
                    <CardContent className="space-y-4 pt-6">
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <MetricCard title="Студентов" value={studentsOfGroup.length} icon={<Users className="h-5 w-5 text-cyan-600" />} accent="cyan" />
                            <MetricCard title="Дисциплин" value={disciplines.length} icon={<BookOpenText className="h-5 w-5 text-indigo-600" />} accent="indigo" />
                            <MetricCard title="Курс" value={getGroupCourseRef(group)?.name || group?.course || '—'} icon={<GraduationCap className="h-5 w-5 text-emerald-600" />} accent="emerald" />
                            <MetricCard title="Статус" value={group?.status || '—'} icon={<Building2 className="h-5 w-5 text-amber-600" />} accent="amber" />
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3">
                            <div className="rounded-xl border border-cyan-200/70 bg-cyan-50/60 px-3 py-2 text-sm">
                                <span className="text-muted-foreground">Специальность: </span>
                                <span className="font-medium text-[#132844]">{getGroupSpecialityRef(group)?.name || group?.speciality || '—'}</span>
                            </div>
                            <div className="rounded-xl border border-indigo-200/70 bg-indigo-50/60 px-3 py-2 text-sm">
                                <span className="text-muted-foreground">ОП: </span>
                                <span className="font-medium text-[#132844]">{getGroupProgramRef(group)?.name || group?.educational_program || '—'}</span>
                            </div>
                            <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/60 px-3 py-2 text-sm">
                                <span className="text-muted-foreground">Кафедра: </span>
                                <span className="font-medium text-[#132844]">{getGroupDepartment(group)?.name || '—'}</span>
                            </div>
                        </div>
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

                <div className="grid gap-6 xl:grid-cols-2 items-start">
                <Card className="border-border/80 bg-white shadow-sm">
                    <CardHeader className="pb-2">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <CardTitle className="flex items-center gap-2 text-base text-[#132844]">
                                <BookOpenText className="h-4 w-4 text-indigo-600" />
                                Дисциплины группы
                            </CardTitle>
                            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                                <Button type="button" className="gap-2" onClick={openCreateAssignmentDialog}>
                                    Назначить дисциплину
                                </Button>
                                <div className="relative w-full sm:w-80">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        className="pl-9"
                                        placeholder="Поиск назначения"
                                        value={assignmentSearch}
                                        onChange={(e) => setAssignmentSearch(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <p className="text-sm text-muted-foreground">Загрузка...</p>
                        ) : filteredAssignmentsOfGroup.length === 0 ? (
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
                                        {filteredAssignmentsOfGroup.map((item) => (
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

                <Card className="border-border/80 bg-white shadow-sm">
                    <CardHeader className="pb-2">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <CardTitle className="flex items-center gap-2 text-base text-[#132844]">
                                <Users className="h-4 w-4 text-cyan-600" />
                                Студенты группы
                            </CardTitle>
                            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                                <Button type="button" className="gap-2" onClick={() => setStudentDialogOpen(true)}>
                                    <UserPlus className="h-4 w-4" />
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
                </div>

                <Dialog
                    open={studentDialogOpen}
                    onOpenChange={(open) => {
                        setStudentDialogOpen(open);
                        if (!open) {
                            setStudentLookupQuery('');
                            setAdStudents([]);
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
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    className="pl-9"
                                    placeholder="Поиск по ФИО, login, email (для AD от 2 символов)"
                                    value={studentLookupQuery}
                                    onChange={(e) => setStudentLookupQuery(e.target.value)}
                                />
                            </div>

                            <div className="max-h-64 overflow-y-auto rounded-md border border-input bg-white">
                                {studentLookupLoading && <p className="px-3 py-2 text-sm text-muted-foreground">Поиск в AD...</p>}

                                {!studentLookupLoading && availableStudentChoices.length === 0 && (
                                    <p className="px-3 py-2 text-sm text-muted-foreground">Совпадений не найдено.</p>
                                )}

                                {!studentLookupLoading && availableStudentChoices.map((choice) => {
                                    const isSelected = studentForm.student_key === choice.key;

                                    return (
                                        <button
                                            key={choice.key}
                                            type="button"
                                            className={`flex w-full items-start justify-between gap-3 border-b border-border/60 px-3 py-2 text-left last:border-b-0 hover:bg-muted/40 ${isSelected ? 'bg-muted/50' : ''}`}
                                            onClick={() => setStudentForm((prev) => ({ ...prev, student_key: choice.key }))}
                                        >
                                            <span>
                                                <span className="block text-sm font-medium text-[#132844]">{choice.title}</span>
                                                <span className="block text-xs text-muted-foreground">{choice.subtitle}</span>
                                            </span>
                                            <Badge variant={choice.source === 'ad' ? 'secondary' : 'outline'}>{choice.source.toUpperCase()}</Badge>
                                        </button>
                                    );
                                })}
                            </div>

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

function MetricCard({ title, value, icon = null, accent = 'cyan' }) {
    const accentStyles = {
        cyan: 'from-cyan-500/20 to-cyan-100 border-cyan-200/80',
        indigo: 'from-indigo-500/20 to-indigo-100 border-indigo-200/80',
        emerald: 'from-emerald-500/20 to-emerald-100 border-emerald-200/80',
        amber: 'from-amber-500/20 to-amber-100 border-amber-200/80',
    };

    const cardTone = accentStyles[accent] || accentStyles.cyan;

    return (
        <Card className={`overflow-hidden border bg-gradient-to-br ${cardTone} shadow-sm`}>
            <CardContent className="flex items-center justify-between pt-6">
                <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
                    <p className="text-2xl font-semibold text-[#132844]">{value}</p>
                </div>
                {icon}
            </CardContent>
        </Card>
    );
}
