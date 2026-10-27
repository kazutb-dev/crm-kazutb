import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FormField, InfoField, LoadingState, Notice, PageHeader, StatGrid, StatTile, StatusBadge, qdFieldClass } from '@/components/platform';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Head, Link } from '@inertiajs/react';
import axios from 'axios';
import { ArrowLeft, BookOpenText, Building2, Check, GraduationCap, Plus, Search, Users, UserPlus } from 'lucide-react';
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
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="Анкетирование · Группа"
                    title={group ? `Группа ${group.name}` : `Группа #${groupId}`}
                    description={[
                        getGroupSpecialityRef(group)?.name || group?.speciality,
                        getGroupDepartment(group)?.name,
                    ].filter(Boolean).join(' · ') || null}
                    meta={group?.status ? (
                        <StatusBadge tone={group.status === 'active' ? 'success' : 'default'}>{group.status}</StatusBadge>
                    ) : null}
                    actions={(
                        <Button asChild variant="outline">
                            <Link href={route('questionnaire.admin.groups')}>
                                <ArrowLeft className="h-4 w-4" />
                                К списку групп
                            </Link>
                        </Button>
                    )}
                />
            )}
        >
            <Head title="Анкетирование - Детали группы" />

            <div className="admin-page-wrap space-y-6">
                {error && <Notice tone="danger" title="Ошибка">{error}</Notice>}
                {success && <Notice tone="success">{success}</Notice>}

                <StatGrid>
                    <StatTile label="Студентов" value={studentsOfGroup.length} tone="teal" icon={Users} />
                    <StatTile label="Дисциплин" value={disciplines.length} tone="navy" icon={BookOpenText} />
                    <StatTile label="Курс" value={getGroupCourseRef(group)?.name || group?.course || '—'} tone="gold" icon={GraduationCap} />
                    <StatTile label="Статус" value={group?.status || '—'} tone={group?.status === 'active' ? 'success' : 'neutral'} icon={Building2} />
                </StatGrid>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Building2 />
                            Академическая привязка
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
                            <InfoField label="Специальность">{getGroupSpecialityRef(group)?.name || group?.speciality || '—'}</InfoField>
                            <InfoField label="Образовательная программа">{getGroupProgramRef(group)?.name || group?.educational_program || '—'}</InfoField>
                            <InfoField label="Кафедра">{getGroupDepartment(group)?.name || '—'}</InfoField>
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

                        <form className="space-y-4" onSubmit={submitAssignment}>
                            <FormField label="Дисциплина">
                                <select
                                    className={qdFieldClass}
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
                            </FormField>

                            <FormField label="Преподаватель">
                                <select
                                    className={qdFieldClass}
                                    value={assignmentForm.teacher_discipline_id}
                                    onChange={(e) => setAssignmentForm((prev) => ({ ...prev, teacher_discipline_id: e.target.value }))}
                                    disabled={!selectedDisciplineId}
                                >
                                    <option value="">{selectedDisciplineId ? 'Выберите преподавателя' : 'Сначала выберите дисциплину'}</option>
                                    {filteredTeacherDisciplines.map((item) => (
                                        <option key={item.id} value={item.id}>{item.teacher?.display_name || item.teacher?.name || `ID ${item.teacher_id}`}</option>
                                    ))}
                                </select>
                            </FormField>

                            <div className="grid grid-cols-2 gap-4">
                                <FormField label="Учебный год">
                                    <select
                                        className={qdFieldClass}
                                        value={assignmentForm.academic_year}
                                        onChange={(e) => setAssignmentForm((prev) => ({ ...prev, academic_year: e.target.value }))}
                                    >
                                        {academicYearOptions.map((year) => (
                                            <option key={year} value={year}>{year}</option>
                                        ))}
                                    </select>
                                </FormField>

                                <FormField label="Семестр">
                                    <select
                                        className={qdFieldClass}
                                        value={assignmentForm.semester}
                                        onChange={(e) => setAssignmentForm((prev) => ({ ...prev, semester: e.target.value }))}
                                    >
                                        <option value="1">1</option>
                                        <option value="2">2</option>
                                    </select>
                                </FormField>
                            </div>

                            <div className="mt-2 flex justify-end gap-2 border-t border-slate-200 pt-4">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setAssignmentDialogOpen(false)}
                                >
                                    Отмена
                                </Button>
                                <Button type="submit">{editingAssignmentId ? 'Сохранить' : 'Назначить'}</Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>

                <div className="grid grid-cols-1 items-start gap-6 2xl:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <BookOpenText />
                                Дисциплины группы
                            </CardTitle>
                        </CardHeader>
                        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:px-6 sm:items-center sm:justify-between">
                            <div className="relative w-full sm:max-w-xs">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <Input
                                    className="pl-9"
                                    placeholder="Поиск назначения"
                                    value={assignmentSearch}
                                    onChange={(e) => setAssignmentSearch(e.target.value)}
                                    aria-label="Поиск назначения"
                                />
                            </div>
                            <Button type="button" size="sm" onClick={openCreateAssignmentDialog}>
                                <Plus className="h-4 w-4" />
                                Назначить дисциплину
                            </Button>
                        </div>
                        <CardContent className="p-0">
                            {loading ? (
                                <div className="p-5 sm:p-6"><LoadingState /></div>
                            ) : filteredAssignmentsOfGroup.length === 0 ? (
                                <div className="px-5 py-12 text-center sm:px-6">
                                    <p className="font-display text-base font-bold text-[#102945]">Нет назначенных дисциплин</p>
                                    <p className="mt-1 text-sm text-slate-600">У группы пока нет назначенных дисциплин. Нажмите «Назначить дисциплину».</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-slate-200">
                                                <th className="whitespace-nowrap text-left">Преподаватель</th>
                                                <th className="whitespace-nowrap text-left">Дисциплина</th>
                                                <th className="whitespace-nowrap text-left">Период</th>
                                                <th className="whitespace-nowrap text-left">Статус</th>
                                                <th className="whitespace-nowrap text-right">Действия</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredAssignmentsOfGroup.map((item) => (
                                                <tr key={item.id} className="border-b border-slate-200 last:border-b-0 hover:bg-slate-50">
                                                    <td className="font-medium text-slate-900">{item.teacher_discipline?.teacher?.display_name || item.teacher_discipline?.teacher?.name || item.teacher_discipline?.teacher_id}</td>
                                                    <td className="text-slate-700">{item.teacher_discipline?.discipline?.name || item.teacher_discipline?.discipline_id}</td>
                                                    <td className="whitespace-nowrap tabular-nums text-slate-700">{item.academic_year} · {item.semester}</td>
                                                    <td>
                                                        <StatusBadge tone={item.status === 'active' ? 'success' : 'default'}>
                                                            {item.status}
                                                        </StatusBadge>
                                                    </td>
                                                    <td className="text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <Button type="button" variant="outline" size="sm" onClick={() => openEditAssignmentDialog(item)}>
                                                                Ред.
                                                            </Button>
                                                            <Button type="button" variant="ghost" size="sm" className="text-red-700 hover:bg-red-50 hover:text-red-800" onClick={() => removeAssignment(item.id)}>
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

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Users />
                                Студенты группы
                            </CardTitle>
                        </CardHeader>
                        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:px-6 sm:items-center sm:justify-between">
                            <div className="relative w-full sm:max-w-xs">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <Input
                                    className="pl-9"
                                    placeholder="Поиск студента"
                                    value={studentSearch}
                                    onChange={(e) => setStudentSearch(e.target.value)}
                                    aria-label="Поиск студента"
                                />
                            </div>
                            <Button type="button" size="sm" onClick={() => setStudentDialogOpen(true)}>
                                <UserPlus className="h-4 w-4" />
                                Привязать студента
                            </Button>
                        </div>
                        <CardContent className="p-0">
                            {loading ? (
                                <div className="p-5 sm:p-6"><LoadingState /></div>
                            ) : studentsOfGroup.length === 0 ? (
                                <div className="px-5 py-12 text-center sm:px-6">
                                    <p className="font-display text-base font-bold text-[#102945]">Нет студентов</p>
                                    <p className="mt-1 text-sm text-slate-600">В этой группе нет студентов. Нажмите «Привязать студента».</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-slate-200">
                                                <th className="whitespace-nowrap text-left">Студент</th>
                                                <th className="whitespace-nowrap text-left">Логин</th>
                                                <th className="whitespace-nowrap text-right">Действия</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {studentsOfGroup.map((student) => (
                                                <tr key={student.id} className="border-b border-slate-200 last:border-b-0 hover:bg-slate-50">
                                                    <td className="font-medium text-slate-900">{student.full_name}</td>
                                                    <td className="whitespace-nowrap font-mono text-xs text-slate-600">{student.login || student.user?.ad_login || '—'}</td>
                                                    <td className="text-right">
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-red-700 hover:bg-red-50 hover:text-red-800"
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

                        <form className="space-y-4" onSubmit={submitStudentBinding}>
                            <FormField label="Поиск студента">
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <Input
                                        className="pl-9"
                                        placeholder="Поиск по ФИО, login, email (для AD от 2 символов)"
                                        value={studentLookupQuery}
                                        onChange={(e) => setStudentLookupQuery(e.target.value)}
                                    />
                                </div>
                            </FormField>

                            <div className="max-h-64 overflow-y-auto rounded-[12px] border border-slate-200 bg-white">
                                {studentLookupLoading && <div className="px-3 py-2.5"><LoadingState label="Поиск в AD..." /></div>}

                                {!studentLookupLoading && availableStudentChoices.length === 0 && (
                                    <p className="px-3 py-2.5 text-sm text-slate-500">Совпадений не найдено.</p>
                                )}

                                {!studentLookupLoading && availableStudentChoices.map((choice) => {
                                    const isSelected = studentForm.student_key === choice.key;

                                    return (
                                        <button
                                            key={choice.key}
                                            type="button"
                                            className={`flex w-full items-start justify-between gap-3 border-b border-l-2 border-b-slate-200 px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-slate-50 ${isSelected ? 'border-l-teal-600 bg-teal-50' : 'border-l-transparent'}`}
                                            onClick={() => setStudentForm((prev) => ({ ...prev, student_key: choice.key }))}
                                        >
                                            <span className="flex min-w-0 items-start gap-2">
                                                {isSelected && <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />}
                                                <span className="min-w-0">
                                                    <span className="block text-sm font-medium text-[#102945]">{choice.title}</span>
                                                    <span className="block text-xs text-slate-500">{choice.subtitle}</span>
                                                </span>
                                            </span>
                                            <Badge variant={choice.source === 'ad' ? 'info' : 'outline'}>{choice.source.toUpperCase()}</Badge>
                                        </button>
                                    );
                                })}
                            </div>

                            <FormField label="Статус">
                                <select
                                    className={qdFieldClass}
                                    value={studentForm.status}
                                    onChange={(e) => setStudentForm((prev) => ({ ...prev, status: e.target.value }))}
                                >
                                    <option value="active">active</option>
                                    <option value="inactive">inactive</option>
                                </select>
                            </FormField>

                            <div className="mt-2 flex justify-end gap-2 border-t border-slate-200 pt-4">
                                <Button type="button" variant="outline" onClick={() => setStudentDialogOpen(false)}>
                                    Отмена
                                </Button>
                                <Button type="submit">Привязать</Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
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
