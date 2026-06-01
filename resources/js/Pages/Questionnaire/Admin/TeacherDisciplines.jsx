import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import {
    AlertTriangle,
    Download,
    Filter,
    GraduationCap,
    Pin,
    Search,
    Star,
    Users,
    UserX,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { usePersistedState } from '../shared/usePersistedState';

const getAcademicYearOptions = () => {
    const currentYear = new Date().getFullYear();

    return Array.from({ length: 6 }, (_, index) => {
        const start = currentYear - 2 + index;
        return `${start}/${start + 1}`;
    });
};

const PAGE_TABS = {
    overview: 'Обзор',
    disciplines: 'Дисциплины',
};

function exportCsv(rows) {
    if (!rows.length) {
        return;
    }

    const header = ['teacher', 'department', 'disciplines', 'groups', 'students', 'surveys', 'rating', 'status'];
    const lines = rows.map((row) => [
        row.teacherName,
        row.department,
        row.disciplinesCount,
        row.groupsCount,
        row.studentsCount,
        row.surveysCount,
        row.rating,
        row.status,
    ].join(','));

    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'questionnaire-teachers.csv';
    link.click();
    URL.revokeObjectURL(url);
}

export default function TeacherDisciplines() {
    const academicYearOptions = getAcademicYearOptions();

    const [confirmState, setConfirmState] = useState({ open: false, description: '', onConfirm: null });
    const [items, setItems] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [disciplines, setDisciplines] = useState([]);
    const [ratingMeta, setRatingMeta] = useState({
        teacher_overall: [],
        teacher_discipline: [],
    });

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [editingId, setEditingId] = useState(null);
    const [drawerTeacher, setDrawerTeacher] = useState(null);
    const [drawerTab, setDrawerTab] = useState('overview');
    const [selectedDrawerDisciplineId, setSelectedDrawerDisciplineId] = useState(null);
    const [selectedDrawerGroupId, setSelectedDrawerGroupId] = useState(null);
    const [disciplineRatingsCache, setDisciplineRatingsCache] = useState({});

    const getDisciplineCacheKey = (teacherId, disciplineId) => `${teacherId}:${disciplineId}`;

    const [search, setSearch] = usePersistedState('questionnaire.teacher.search', '');
    const [filters, setFilters] = usePersistedState('questionnaire.teacher.filters', {
        academic_year: '',
        semester: 'all',
        status: 'all',
        min_rating: 'all',
        only_problematic: false,
        only_without_assignments: false,
    });

    const [favorites, setFavorites] = usePersistedState('questionnaire.teacher.favorites', []);
    const [pinned, setPinned] = usePersistedState('questionnaire.teacher.pinned', []);
    const [selectedIds, setSelectedIds] = useState([]);

    const [form, setForm] = useState({
        teacher_id: '',
        discipline_id: '',
        status: 'active',
    });

    const load = async () => {
        setLoading(true);
        setError('');

        try {
            const [itemsResponse, teachersResponse, disciplinesResponse] = await Promise.all([
                axios.get('/api/questionnaire/admin/teacher-disciplines'),
                axios.get('/api/questionnaire/admin/teachers'),
                axios.get('/api/questionnaire/admin/disciplines'),
            ]);

            setItems(itemsResponse.data?.data ?? []);
            setRatingMeta(itemsResponse.data?.meta?.ratings ?? {
                teacher_overall: [],
                teacher_discipline: [],
            });
            setTeachers(teachersResponse.data?.data ?? []);
            setDisciplines(disciplinesResponse.data?.data ?? []);
        } catch (e) {
            setError(e?.response?.data?.message || 'Не удалось загрузить реестр преподавателей.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    useEffect(() => {
        const onKeyDown = (event) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                const input = document.getElementById('questionnaire-teacher-search');
                input?.focus();
            }

            if (event.key === 'Escape') {
                setDrawerTeacher(null);
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    const teacherRows = useMemo(() => {
        const overallRatingByTeacher = new Map(
            (ratingMeta.teacher_overall || []).map((item) => [
                String(item.teacher_id),
                {
                    average_score: item.average_score !== null ? Number(item.average_score) : null,
                    answers_count: Number(item.answers_count || 0),
                    responses_count: Number(item.responses_count || 0),
                },
            ]),
        );

        const grouped = new Map();

        for (const item of items) {
            const teacherId = item.teacher_id;
            const teacher = item.teacher || {};
            const key = String(teacherId);

            if (!grouped.has(key)) {
                grouped.set(key, {
                    teacherId,
                    teacherName: teacher.display_name || teacher.name || `ID ${teacherId}`,
                    avatar: null,
                    department: teacher.ad_department || teacher.department || 'Не указано',
                    position: teacher.ad_title || teacher.title || 'Не указано',
                    status: 'active',
                    disciplines: new Set(),
                    groups: new Set(),
                    assignments: 0,
                    surveysCount: 0,
                    studentsCount: 0,
                    periods: new Set(),
                });
            }

            const row = grouped.get(key);
            row.assignments += 1;
            row.disciplines.add(item.discipline?.name || `ID ${item.discipline_id}`);

            if (item.status !== 'active') {
                row.status = 'inactive';
            }

            const groupLinks = item.group_disciplines || [];
            for (const groupLink of groupLinks) {
                row.groups.add(groupLink.group?.name || `ID ${groupLink.group_id}`);
                row.studentsCount += Number(groupLink.group?.students_count || 0);
                if (groupLink.academic_year || groupLink.semester) {
                    row.periods.add(`${groupLink.academic_year || '—'}-${groupLink.semester || '—'}`);
                }
            }
        }

        return Array.from(grouped.values()).map((row) => {
            const ratingInfo = overallRatingByTeacher.get(String(row.teacherId));
            const rating = ratingInfo?.average_score ?? null;

            return {
                ...row,
                disciplinesCount: row.disciplines.size,
                groupsCount: row.groups.size,
                surveysCount: row.assignments * 2,
                rating,
                ratingResponsesCount: ratingInfo?.responses_count ?? 0,
                ratingAnswersCount: ratingInfo?.answers_count ?? 0,
                problematic: (rating !== null && rating < 4.4) || row.status !== 'active',
                withoutAssignments: row.assignments === 0,
            };
        });
    }, [items, ratingMeta]);

    const filteredRows = useMemo(() => {
        return teacherRows.filter((row) => {
            const term = search.trim().toLowerCase();
            if (term) {
                const haystack = [row.teacherName, row.department, row.position, ...Array.from(row.disciplines), ...Array.from(row.groups)]
                    .join(' ')
                    .toLowerCase();
                if (!haystack.includes(term)) {
                    return false;
                }
            }

            if (filters.status !== 'all' && row.status !== filters.status) {
                return false;
            }

            if (filters.min_rating !== 'all' && (row.rating === null || row.rating < Number(filters.min_rating))) {
                return false;
            }

            if (filters.only_problematic && !row.problematic) {
                return false;
            }

            if (filters.only_without_assignments && !row.withoutAssignments) {
                return false;
            }

            if (filters.academic_year) {
                const hasYear = Array.from(row.periods).some((period) => period.startsWith(filters.academic_year));
                if (!hasYear) {
                    return false;
                }
            }

            if (filters.semester !== 'all') {
                const hasSemester = Array.from(row.periods).some((period) => period.endsWith(`-${filters.semester}`));
                if (!hasSemester) {
                    return false;
                }
            }

            return true;
        }).sort((a, b) => {
            const aPinned = pinned.includes(a.teacherId);
            const bPinned = pinned.includes(b.teacherId);
            if (aPinned !== bPinned) {
                return aPinned ? -1 : 1;
            }

            if (a.rating === null && b.rating === null) {
                return 0;
            }

            if (a.rating === null) {
                return 1;
            }

            if (b.rating === null) {
                return -1;
            }

            return b.rating - a.rating;
        });
    }, [teacherRows, search, filters, pinned]);

    const summary = useMemo(() => {
        const totalTeachers = teacherRows.length;
        const activeTeachers = teacherRows.filter((row) => row.status === 'active').length;
        const totalAssignments = teacherRows.reduce((acc, row) => acc + row.assignments, 0);
        const totalDisciplines = teacherRows.reduce((acc, row) => acc + row.disciplinesCount, 0);
        const avgRating = totalTeachers
            ? (() => {
                const rated = teacherRows.filter((row) => row.rating !== null);
                if (!rated.length) {
                    return null;
                }

                return Number((rated.reduce((acc, row) => acc + row.rating, 0) / rated.length).toFixed(2));
            })()
            : null;

        return {
            totalTeachers,
            activeTeachers,
            totalAssignments,
            totalDisciplines,
            avgRating,
            problematic: teacherRows.filter((row) => row.problematic).length,
            withoutAssignments: teacherRows.filter((row) => row.withoutAssignments).length,
            topTeacher: teacherRows[0]?.teacherName || '—',
        };
    }, [teacherRows]);

    const drawerSurveyRatings = useMemo(() => {
        if (!drawerTeacher) {
            return [];
        }

        return (ratingMeta.teacher_discipline || [])
            .filter((item) => Number(item.teacher_id) === Number(drawerTeacher.teacherId))
            .map((item) => ({
                discipline: item.discipline_name || item.discipline_id,
                rating: item.average_score !== null ? Number(item.average_score) : null,
                responses: Number(item.responses_count || 0),
                answers: Number(item.answers_count || 0),
            }))
            .sort((a, b) => {
                if (a.rating === null && b.rating === null) {
                    return 0;
                }

                if (a.rating === null) {
                    return 1;
                }

                if (b.rating === null) {
                    return -1;
                }

                return b.rating - a.rating;
            });
    }, [drawerTeacher, ratingMeta]);

    const resetForm = () => {
        setForm({
            teacher_id: '',
            discipline_id: '',
            status: 'active',
        });
        setEditingId(null);
    };

    const submit = async (event) => {
        event.preventDefault();
        setError('');
        setSuccess('');

        try {
            if (editingId) {
                await axios.patch(`/api/questionnaire/admin/teacher-disciplines/${editingId}`, {
                    status: form.status,
                });
                setSuccess('Привязка преподавателя обновлена.');
            } else {
                await axios.post('/api/questionnaire/admin/teacher-disciplines', {
                    teacher_id: Number(form.teacher_id),
                    discipline_id: Number(form.discipline_id),
                    status: form.status,
                });
                setSuccess('Привязка преподавателя создана.');
            }

            resetForm();
            await load();
        } catch (e) {
            setError(e?.response?.data?.message || 'Ошибка сохранения привязки преподавателя.');
        }
    };

    const startEdit = (item) => {
        setEditingId(item.id);
        setForm({
            teacher_id: item.teacher_id ? String(item.teacher_id) : '',
            discipline_id: item.discipline_id ? String(item.discipline_id) : '',
            status: item.status || 'active',
        });
    };

    const remove = async (id) => {
        setConfirmState({
            open: true,
            description: 'Удалить привязку преподавателя?',
            onConfirm: async () => {
                setError('');
                setSuccess('');
                try {
                    await axios.delete(`/api/questionnaire/admin/teacher-disciplines/${id}`);
                    if (editingId === id) {
                        resetForm();
                    }
                    setSuccess('Привязка преподавателя удалена.');
                    await load();
                } catch (e) {
                    setError(e?.response?.data?.message || 'Ошибка удаления привязки преподавателя.');
                }
            },
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredRows.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredRows.map((row) => row.teacherId));
        }
    };

    const toggleFavorite = (teacherId) => {
        setFavorites((prev) => prev.includes(teacherId)
            ? prev.filter((id) => id !== teacherId)
            : [...prev, teacherId]);
    };

    const togglePinned = (teacherId) => {
        setPinned((prev) => prev.includes(teacherId)
            ? prev.filter((id) => id !== teacherId)
            : [...prev, teacherId]);
    };

    const bulkArchiveSelected = async () => {
        if (!selectedIds.length) {
            return;
        }

        const toArchive = items.filter((item) => selectedIds.includes(item.teacher_id));

        for (const item of toArchive) {
            // eslint-disable-next-line no-await-in-loop
            await axios.patch(`/api/questionnaire/admin/teacher-disciplines/${item.id}`, {
                status: 'inactive',
            });
        }

        setSuccess('Массовый архив выполнен.');
        setSelectedIds([]);
        await load();
    };

    const openTeacherDrawer = (row) => {
        setDrawerTeacher(row);
        setDrawerTab('overview');
        setSelectedDrawerDisciplineId(null);
        setSelectedDrawerGroupId(null);
    };

    const drawerTeacherItems = useMemo(() => {
        if (!drawerTeacher) {
            return [];
        }

        return items.filter((item) => item.teacher_id === drawerTeacher.teacherId);
    }, [drawerTeacher, items]);

    const drawerOverview = useMemo(() => {
        if (!drawerTeacher) {
            return null;
        }

        return {
            disciplines: Array.from(drawerTeacher.disciplines),
            groups: Array.from(drawerTeacher.groups),
            periods: Array.from(drawerTeacher.periods),
        };
    }, [drawerTeacher]);

    const drawerDisciplineRows = useMemo(() => {
        if (!drawerTeacher) {
            return [];
        }

        const grouped = new Map();

        for (const item of drawerTeacherItems) {
            const disciplineId = item.discipline?.id ?? item.discipline_id;
            const disciplineName = item.discipline?.name || item.discipline_id;
            const key = String(disciplineId);

            if (!grouped.has(key)) {
                grouped.set(key, {
                    disciplineId,
                    disciplineName,
                    statuses: new Set(),
                    groups: new Map(),
                });
            }

            const row = grouped.get(key);
            row.statuses.add(item.status || 'active');

            for (const gd of item.group_disciplines || []) {
                const groupId = gd.group?.id ?? gd.group_id;
                const groupName = gd.group?.name || `ID ${gd.group_id}`;
                row.groups.set(String(groupId), {
                    groupId,
                    groupName,
                });
            }
        }

        return Array.from(grouped.values())
            .map((row) => ({
                ...row,
                status: row.statuses.has('active') ? 'active' : 'inactive',
                groups: Array.from(row.groups.values()).sort((a, b) => a.groupName.localeCompare(b.groupName, 'ru')),
            }))
            .sort((a, b) => a.disciplineName.localeCompare(b.disciplineName, 'ru'));
    }, [drawerTeacher, drawerTeacherItems]);

    const selectedDrawerDiscipline = useMemo(() => {
        if (!selectedDrawerDisciplineId) {
            return null;
        }

        return drawerDisciplineRows.find((row) => Number(row.disciplineId) === Number(selectedDrawerDisciplineId)) || null;
    }, [drawerDisciplineRows, selectedDrawerDisciplineId]);

    const selectedDisciplineRatingsState = (drawerTeacher && selectedDrawerDisciplineId)
        ? (disciplineRatingsCache[getDisciplineCacheKey(drawerTeacher.teacherId, selectedDrawerDisciplineId)] || { loading: false, error: '', responses: [] })
        : { loading: false, error: '', responses: [] };

    const disciplineAllScores = useMemo(() => {
        return (selectedDisciplineRatingsState.responses || [])
            .flatMap((response) => (response.answers || []).map((answer) => {
                if (answer.option?.score !== null && answer.option?.score !== undefined) {
                    return Number(answer.option.score);
                }

                if (answer.numeric_answer !== null && answer.numeric_answer !== undefined && answer.numeric_answer !== '') {
                    return Number(answer.numeric_answer);
                }

                return null;
            }))
            .filter((score) => score !== null && Number.isFinite(score));
    }, [selectedDisciplineRatingsState.responses]);

    const disciplineAverageScore = disciplineAllScores.length
        ? Number((disciplineAllScores.reduce((acc, score) => acc + score, 0) / disciplineAllScores.length).toFixed(2))
        : null;

    const groupRatingRows = useMemo(() => {
        if (!selectedDrawerDiscipline) {
            return [];
        }

        return selectedDrawerDiscipline.groups.map((group) => {
            const groupResponses = (selectedDisciplineRatingsState.responses || []).filter((response) => Number(response.group_id) === Number(group.groupId));
            const groupScores = groupResponses
                .flatMap((response) => (response.answers || []).map((answer) => {
                    if (answer.option?.score !== null && answer.option?.score !== undefined) {
                        return Number(answer.option.score);
                    }

                    if (answer.numeric_answer !== null && answer.numeric_answer !== undefined && answer.numeric_answer !== '') {
                        return Number(answer.numeric_answer);
                    }

                    return null;
                }))
                .filter((score) => score !== null && Number.isFinite(score));

            const average = groupScores.length
                ? Number((groupScores.reduce((acc, score) => acc + score, 0) / groupScores.length).toFixed(2))
                : null;

            return {
                groupId: group.groupId,
                groupName: group.groupName,
                responsesCount: groupResponses.length,
                answersCount: groupScores.length,
                average,
            };
        });
    }, [selectedDrawerDiscipline, selectedDisciplineRatingsState.responses]);

    const selectedGroupRating = useMemo(() => {
        if (!selectedDrawerGroupId) {
            return null;
        }

        return groupRatingRows.find((row) => Number(row.groupId) === Number(selectedDrawerGroupId)) || null;
    }, [groupRatingRows, selectedDrawerGroupId]);

    const studentRatingsInGroup = useMemo(() => {
        if (!selectedDrawerGroupId) {
            return [];
        }

        const responses = (selectedDisciplineRatingsState.responses || []).filter((response) => Number(response.group_id) === Number(selectedDrawerGroupId));
        const grouped = new Map();

        for (const response of responses) {
            const key = String(response.student_id);
            if (!grouped.has(key)) {
                grouped.set(key, {
                    studentName: response.student?.full_name || `ID ${response.student_id}`,
                    scores: [],
                    responsesCount: 0,
                });
            }

            const row = grouped.get(key);
            row.responsesCount += 1;

            for (const answer of response.answers || []) {
                if (answer.option?.score !== null && answer.option?.score !== undefined) {
                    row.scores.push(Number(answer.option.score));
                } else if (answer.numeric_answer !== null && answer.numeric_answer !== undefined && answer.numeric_answer !== '') {
                    row.scores.push(Number(answer.numeric_answer));
                }
            }
        }

        return Array.from(grouped.values())
            .map((row) => ({
                studentName: row.studentName,
                responsesCount: row.responsesCount,
                answersCount: row.scores.length,
                average: row.scores.length
                    ? Number((row.scores.reduce((acc, score) => acc + score, 0) / row.scores.length).toFixed(2))
                    : null,
            }))
            .sort((a, b) => {
                if (a.average === null && b.average === null) {
                    return a.studentName.localeCompare(b.studentName, 'ru');
                }

                if (a.average === null) {
                    return 1;
                }

                if (b.average === null) {
                    return -1;
                }

                return b.average - a.average;
            });
    }, [selectedDrawerGroupId, selectedDisciplineRatingsState.responses]);

    const loadDisciplineRatings = async (disciplineId) => {
        if (!drawerTeacher || !disciplineId) {
            return;
        }

        const key = getDisciplineCacheKey(drawerTeacher.teacherId, disciplineId);
        setDisciplineRatingsCache((prev) => ({
            ...prev,
            [key]: {
                ...(prev[key] || {}),
                loading: true,
                error: '',
            },
        }));

        try {
            const response = await axios.get('/api/questionnaire/admin/results', {
                params: {
                    teacher_id: drawerTeacher.teacherId,
                    discipline_id: disciplineId,
                },
            });

            setDisciplineRatingsCache((prev) => ({
                ...prev,
                [key]: {
                    loading: false,
                    error: '',
                    responses: response.data?.data?.responses || [],
                },
            }));
        } catch (e) {
            setDisciplineRatingsCache((prev) => ({
                ...prev,
                [key]: {
                    loading: false,
                    error: e?.response?.data?.message || 'Не удалось загрузить рейтинги по дисциплине.',
                    responses: [],
                },
            }));
        }
    };

    const handleSelectDrawerDiscipline = async (disciplineId) => {
        setSelectedDrawerDisciplineId(Number(disciplineId));
        setSelectedDrawerGroupId(null);

        if (!drawerTeacher) {
            return;
        }

        const key = getDisciplineCacheKey(drawerTeacher.teacherId, disciplineId);
        const cached = disciplineRatingsCache[key];
        if (!cached) {
            await loadDisciplineRatings(disciplineId);
        }
    };

    return (
        <AuthenticatedLayout>
            <Head title="Анкетирование - Преподаватели" />

            <div className="admin-page-wrap">
                <Card className="border-border/80 bg-white/90 shadow-sm">
                    <CardContent className="space-y-4 pt-6">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Анкетирование / Преподаватели</p>
                                <h1 className="text-2xl font-semibold tracking-tight text-[#132844]">Реестр преподавателей и дисциплин</h1>
                                <p className="mt-1 text-sm text-muted-foreground">Управление связями преподаватель ↔ дисциплина ↔ группа с аналитикой и быстрым доступом.</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <Input
                                    id="questionnaire-teacher-search"
                                    className="w-64"
                                    placeholder="Поиск (Ctrl/Cmd + K)"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                                <Button type="button" variant="outline" className="gap-2" onClick={() => exportCsv(filteredRows)}>
                                    <Download className="h-4 w-4" />
                                    Экспорт CSV
                                </Button>
                                <Button type="button" variant="outline" className="gap-2" onClick={bulkArchiveSelected} disabled={!selectedIds.length}>
                                    <ArchiveIcon />
                                    Архивировать выбранные
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <MetricCard title="Всего преподавателей" value={summary.totalTeachers} icon={<Users className="h-5 w-5 text-[#139AA4]" />} />
                    <MetricCard title="Активных" value={summary.activeTeachers} icon={<Badge className="bg-emerald-600 text-white">active</Badge>} />
                    <MetricCard title="Дисциплин" value={summary.totalDisciplines} icon={<GraduationCap className="h-5 w-5 text-[#139AA4]" />} />
                    <MetricCard title="Назначений" value={summary.totalAssignments} icon={<Filter className="h-5 w-5 text-[#139AA4]" />} />
                    <MetricCard title="Средний рейтинг" value={summary.avgRating ?? '—'} icon={<Star className="h-5 w-5 text-amber-500" />} />
                    <MetricCard title="Проблемные" value={summary.problematic} icon={<AlertTriangle className="h-5 w-5 text-orange-500" />} />
                    <MetricCard title="Без назначений" value={summary.withoutAssignments} icon={<UserX className="h-5 w-5 text-slate-500" />} />
                    <MetricCard title="Топ преподаватель" value={summary.topTeacher} icon={<Pin className="h-5 w-5 text-indigo-500" />} />
                </div>

                {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
                {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}

                <div className="grid grid-cols-1 gap-5 xl:grid-cols-[280px_1fr]">
                    <Card className="h-fit border-border/80 bg-white/90 shadow-sm xl:sticky xl:top-5">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base text-[#132844]">Фильтры</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={filters.academic_year} onChange={(e) => setFilters((prev) => ({ ...prev, academic_year: e.target.value }))}>
                                <option value="">Учебный год: все</option>
                                {academicYearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
                            </select>

                            <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={filters.semester} onChange={(e) => setFilters((prev) => ({ ...prev, semester: e.target.value }))}>
                                <option value="all">Семестр: все</option>
                                <option value="1">Семестр 1</option>
                                <option value="2">Семестр 2</option>
                            </select>

                            <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}>
                                <option value="all">Статус: все</option>
                                <option value="active">active</option>
                                <option value="inactive">inactive</option>
                            </select>

                            <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={filters.min_rating} onChange={(e) => setFilters((prev) => ({ ...prev, min_rating: e.target.value }))}>
                                <option value="all">Рейтинг: любой</option>
                                <option value="4.0">4.0+</option>
                                <option value="4.5">4.5+</option>
                                <option value="4.8">4.8+</option>
                            </select>

                            <label className="flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={filters.only_problematic} onChange={(e) => setFilters((prev) => ({ ...prev, only_problematic: e.target.checked }))} />
                                Только проблемные
                            </label>

                            <label className="flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={filters.only_without_assignments} onChange={(e) => setFilters((prev) => ({ ...prev, only_without_assignments: e.target.checked }))} />
                                Без назначений
                            </label>

                            <Button type="button" variant="outline" className="w-full" onClick={() => setFilters({
                                academic_year: '',
                                semester: 'all',
                                status: 'all',
                                min_rating: 'all',
                                only_problematic: false,
                                only_without_assignments: false,
                            })}>
                                Сбросить фильтры
                            </Button>
                        </CardContent>
                    </Card>

                    <div className="space-y-5">
                        <Card className="border-border/80 bg-white/90 shadow-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base text-[#132844]">Новая привязка преподавателя</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <form className="grid grid-cols-1 gap-3 lg:grid-cols-3" onSubmit={submit}>
                                    <select className="rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.teacher_id} onChange={(e) => setForm((prev) => ({ ...prev, teacher_id: e.target.value }))} disabled={Boolean(editingId)}>
                                        <option value="">Преподаватель</option>
                                        {teachers.map((teacher) => (
                                            <option key={teacher.id} value={teacher.id}>
                                                {teacher.display_name || teacher.name}
                                            </option>
                                        ))}
                                    </select>

                                    <select className="rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.discipline_id} onChange={(e) => setForm((prev) => ({ ...prev, discipline_id: e.target.value }))} disabled={Boolean(editingId)}>
                                        <option value="">Дисциплина</option>
                                        {disciplines.map((discipline) => (
                                            <option key={discipline.id} value={discipline.id}>
                                                {discipline.name}
                                            </option>
                                        ))}
                                    </select>

                                    <div className="flex gap-2">
                                        <Button type="submit">{editingId ? 'Сохранить' : 'Добавить'}</Button>
                                        {editingId && <Button type="button" variant="outline" onClick={resetForm}>Отмена</Button>}
                                    </div>
                                </form>
                            </CardContent>
                        </Card>

                        <Card className="border-border/80 bg-white/90 shadow-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base text-[#132844]">Таблица преподавателей</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {loading ? (
                                    <p className="text-sm text-muted-foreground">Загрузка...</p>
                                ) : filteredRows.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">Нет данных по выбранным фильтрам.</p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full text-sm">
                                            <thead>
                                                <tr className="border-b bg-white text-muted-foreground">
                                                    <th className="sticky top-0 bg-white px-3 py-2 text-left"><input type="checkbox" checked={selectedIds.length === filteredRows.length && filteredRows.length > 0} onChange={toggleSelectAll} /></th>
                                                    <th className="sticky top-0 bg-white px-3 py-2 text-left font-medium">ФИО</th>
                                                    <th className="sticky top-0 bg-white px-3 py-2 text-left font-medium">Кафедра</th>
                                                    <th className="sticky top-0 bg-white px-3 py-2 text-left font-medium">Дисц.</th>
                                                    <th className="sticky top-0 bg-white px-3 py-2 text-left font-medium">Группы</th>
                                                    <th className="sticky top-0 bg-white px-3 py-2 text-left font-medium">Студенты</th>
                                                    <th className="sticky top-0 bg-white px-3 py-2 text-left font-medium">Анкеты</th>
                                                    <th className="sticky top-0 bg-white px-3 py-2 text-left font-medium">Рейтинг</th>
                                                    <th className="sticky top-0 bg-white px-3 py-2 text-left font-medium">Статус</th>
                                                    <th className="sticky top-0 bg-white px-3 py-2 text-right font-medium">Действия</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredRows.map((row) => (
                                                    <tr key={row.teacherId} className="border-b last:border-b-0 hover:bg-muted/40">
                                                        <td className="px-3 py-2"><input type="checkbox" checked={selectedIds.includes(row.teacherId)} onChange={() => setSelectedIds((prev) => prev.includes(row.teacherId) ? prev.filter((id) => id !== row.teacherId) : [...prev, row.teacherId])} /></td>
                                                        <td className="px-3 py-2">
                                                            <button type="button" className="font-medium text-[#132844] hover:underline" onClick={() => openTeacherDrawer(row)}>
                                                                {row.teacherName}
                                                            </button>
                                                        </td>
                                                        <td className="px-3 py-2">{row.department}</td>
                                                        <td className="px-3 py-2">{row.disciplinesCount}</td>
                                                        <td className="px-3 py-2">{row.groupsCount}</td>
                                                        <td className="px-3 py-2">{row.studentsCount}</td>
                                                        <td className="px-3 py-2">{row.surveysCount}</td>
                                                        <td className="px-3 py-2">{row.rating !== null ? row.rating.toFixed(2) : '—'}</td>
                                                        <td className="px-3 py-2">
                                                            <Badge variant={row.status === 'active' ? 'default' : 'secondary'} className={row.status === 'active' ? 'bg-emerald-600 text-white' : ''}>
                                                                {row.status}
                                                            </Badge>
                                                        </td>
                                                        <td className="px-3 py-2 text-right">
                                                            <div className="inline-flex gap-1">
                                                                <Button type="button" size="sm" variant={favorites.includes(row.teacherId) ? 'default' : 'outline'} onClick={() => toggleFavorite(row.teacherId)}>
                                                                    <Star className="h-3.5 w-3.5" />
                                                                </Button>
                                                                <Button type="button" size="sm" variant={pinned.includes(row.teacherId) ? 'default' : 'outline'} onClick={() => togglePinned(row.teacherId)}>
                                                                    <Pin className="h-3.5 w-3.5" />
                                                                </Button>
                                                                <Button type="button" size="sm" variant="outline" onClick={() => {
                                                                    const first = items.find((item) => item.teacher_id === row.teacherId);
                                                                    if (first) {
                                                                        startEdit(first);
                                                                    }
                                                                }}>Ред.</Button>
                                                                <Button type="button" size="sm" variant="outline" className="text-red-700" onClick={() => {
                                                                    const first = items.find((item) => item.teacher_id === row.teacherId);
                                                                    if (first) {
                                                                        remove(first.id);
                                                                    }
                                                                }}>Удалить</Button>
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

                <Sheet open={Boolean(drawerTeacher)} onOpenChange={(open) => !open && setDrawerTeacher(null)}>
                    <SheetContent side="right" className="w-full sm:max-w-3xl">
                        <SheetHeader>
                            <SheetTitle>{drawerTeacher?.teacherName}</SheetTitle>
                            <SheetDescription>
                                {drawerTeacher?.department} · {drawerTeacher?.position}
                            </SheetDescription>
                        </SheetHeader>

                        {drawerTeacher && (
                            <div className="mt-5 space-y-4">
                                <div className="grid gap-3 sm:grid-cols-4">
                                    <MiniStat title="Рейтинг" value={drawerTeacher.rating !== null ? drawerTeacher.rating.toFixed(2) : '—'} />
                                    <MiniStat title="Дисциплины" value={drawerTeacher.disciplinesCount} />
                                    <MiniStat title="Группы" value={drawerTeacher.groupsCount} />
                                    <MiniStat title="Студенты" value={drawerTeacher.studentsCount} />
                                </div>

                                <div className="flex flex-wrap gap-2 rounded-lg border border-border/70 bg-muted/30 p-1">
                                    {Object.entries(PAGE_TABS).map(([key, label]) => (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => setDrawerTab(key)}
                                            className={`rounded-md px-3 py-1.5 text-sm ${drawerTab === key ? 'bg-white text-[#132844] shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>

                                {drawerTab === 'overview' && (
                                    <div className="space-y-3">
                                        <DrawerList title="Дисциплины" items={drawerOverview?.disciplines || []} />
                                        <DrawerList title="Группы" items={drawerOverview?.groups || []} />
                                        <DrawerList title="Периоды" items={drawerOverview?.periods || []} />
                                    </div>
                                )}

                                {drawerTab === 'disciplines' && (
                                    <div className="space-y-4">
                                        {!selectedDrawerDiscipline ? (
                                            <SimpleTable
                                                rows={drawerDisciplineRows.map((row) => ({
                                                    discipline: row.disciplineName,
                                                    groups: row.groups.length,
                                                    status: row.status,
                                                    actions: (
                                                        <Button type="button" size="sm" variant="outline" onClick={() => handleSelectDrawerDiscipline(row.disciplineId)}>
                                                            Открыть в этом окне
                                                        </Button>
                                                    ),
                                                }))}
                                                columns={[
                                                    { key: 'discipline', label: 'Дисциплина' },
                                                    { key: 'groups', label: 'Групп' },
                                                    { key: 'status', label: 'Статус' },
                                                    { key: 'actions', label: 'Действия' },
                                                ]}
                                            />
                                        ) : (
                                            <div className="space-y-3 rounded-lg border border-border/70 p-4">
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className="text-sm font-semibold text-[#132844]">{selectedDrawerDiscipline.disciplineName}</p>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            setSelectedDrawerDisciplineId(null);
                                                            setSelectedDrawerGroupId(null);
                                                        }}
                                                    >
                                                        К списку дисциплин
                                                    </Button>
                                                </div>

                                                {selectedDisciplineRatingsState.loading && (
                                                    <p className="text-sm text-muted-foreground">Загрузка рейтингов по дисциплине...</p>
                                                )}

                                                {selectedDisciplineRatingsState.error && (
                                                    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                                        {selectedDisciplineRatingsState.error}
                                                    </div>
                                                )}

                                                {!selectedDisciplineRatingsState.loading && !selectedDisciplineRatingsState.error && (
                                                    <>
                                                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                                            <MiniStat title="Рейтинг дисциплины" value={disciplineAverageScore !== null ? disciplineAverageScore.toFixed(2) : '—'} />
                                                            <MiniStat title="Анкет" value={selectedDisciplineRatingsState.responses.length} />
                                                            <MiniStat title="Групп в связке" value={selectedDrawerDiscipline.groups.length} />
                                                        </div>

                                                        {!selectedGroupRating ? (
                                                            <SimpleTable
                                                                rows={groupRatingRows.map((row) => ({
                                                                    group: (
                                                                        <button
                                                                            type="button"
                                                                            className="font-medium text-[#132844] hover:underline"
                                                                            onClick={() => setSelectedDrawerGroupId(Number(row.groupId))}
                                                                        >
                                                                            {row.groupName}
                                                                        </button>
                                                                    ),
                                                                    average: row.average !== null ? row.average.toFixed(2) : '—',
                                                                    responses: row.responsesCount,
                                                                }))}
                                                                columns={[
                                                                    { key: 'group', label: 'Группа' },
                                                                    { key: 'average', label: 'Рейтинг группы' },
                                                                    { key: 'responses', label: 'Анкет' },
                                                                ]}
                                                            />
                                                        ) : (
                                                            <div className="space-y-3 rounded-lg border border-border/70 p-3">
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <p className="text-sm font-semibold text-[#132844]">Группа {selectedGroupRating.groupName}</p>
                                                                    <Button
                                                                        type="button"
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={() => setSelectedDrawerGroupId(null)}
                                                                    >
                                                                        К списку групп
                                                                    </Button>
                                                                </div>
                                                                <div className="grid gap-3 sm:grid-cols-2">
                                                                    <MiniStat title="Рейтинг группы" value={selectedGroupRating.average !== null ? selectedGroupRating.average.toFixed(2) : '—'} />
                                                                    <MiniStat title="Анкет" value={selectedGroupRating.responsesCount} />
                                                                </div>

                                                                <SimpleTable
                                                                    rows={studentRatingsInGroup.map((row) => ({
                                                                        student: row.studentName,
                                                                        average: row.average !== null ? row.average.toFixed(2) : '—',
                                                                        responses: row.responsesCount,
                                                                    }))}
                                                                    columns={[
                                                                        { key: 'student', label: 'Студент' },
                                                                        { key: 'average', label: 'Рейтинг студента' },
                                                                        { key: 'responses', label: 'Анкет' },
                                                                    ]}
                                                                />
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                            </div>
                        )}
                    </SheetContent>
                </Sheet>
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

function MetricCard({ title, value, icon }) {
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

function MiniStat({ title, value }) {
    return (
        <div className="rounded-lg border border-border/70 px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
            <p className="mt-1 text-lg font-semibold text-[#132844]">{value}</p>
        </div>
    );
}

function DrawerList({ title, items }) {
    return (
        <div className="rounded-lg border border-border/70 p-3">
            <p className="mb-2 text-sm font-semibold text-[#132844]">{title}</p>
            {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Нет данных</p>
            ) : (
                <div className="flex flex-wrap gap-2">
                    {items.map((item) => (
                        <Badge key={`${title}-${item}`} variant="secondary">{item}</Badge>
                    ))}
                </div>
            )}
        </div>
    );
}

function SimpleTable({ rows, columns }) {
    if (!rows.length) {
        return <div className="rounded-lg border border-border/70 p-4 text-sm text-muted-foreground">Нет данных</div>;
    }

    return (
        <div className="overflow-x-auto rounded-lg border border-border/70">
            <table className="min-w-full text-sm">
                <thead>
                    <tr className="border-b text-muted-foreground">
                        {columns.map((column) => (
                            <th key={column.key} className="px-3 py-2 text-left font-medium">{column.label}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, index) => (
                        <tr key={`row-${index}`} className="border-b last:border-b-0">
                            {columns.map((column) => (
                                <td key={`${index}-${column.key}`} className="px-3 py-2">{row[column.key] ?? '—'}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function ArchiveIcon() {
    return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 8v13H3V8" />
            <path d="M1 3h22v5H1z" />
            <path d="M10 12h4" />
        </svg>
    );
}
