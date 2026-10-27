import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { ConfirmDialog } from '@/components/ConfirmDialog';
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
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { EmptyState, FilterBar, InfoField, LoadingState, Notice, PageHeader, StatGrid, StatTile, qdFieldClass } from '@/components/platform';
import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    BookOpen,
    Building2,
    ChevronDown,
    GraduationCap,
    Link2,
    Pencil,
    Plus,
    Search,
    Trash2,
    X,
    ChevronRight,
    User,
    Mail,
    Calendar,
    Award,
    CheckCircle2,
    XCircle,
    Loader2
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import axios from 'axios';

// ─── helpers ───────────────────────────────────────────────────────────────

function FieldError({ message }) {
    if (!message) return null;
    return <p className="mt-1 text-xs text-red-700">{message}</p>;
}

function FormField({ label, children, required }) {
    return (
        <div className="space-y-2">
            <label className="qd-field-label block">
                {label}
                {required && <span className="ml-1 text-red-600">*</span>}
            </label>
            {children}
        </div>
    );
}

// ─── SubjectForm (shared for create / edit) ─────────────────────────────────

// ─── SubjectForm (shared for create / edit) ─────────────────────────────────

function SubjectForm({ form, departments, onSubmit, submitLabel }) {
    return (
        <form className="space-y-4" onSubmit={onSubmit}>
            <FormField label="Название предмета" required>
                <Input
                    value={form.data.name}
                    onChange={(e) => form.setData('name', e.target.value)}
                    placeholder="Например: Математический анализ"
                    autoFocus
                />
                <FieldError message={form.errors.name} />
            </FormField>

            <FormField label="Кафедра">
                <select
                    value={form.data.department_id}
                    onChange={(e) => form.setData('department_id', e.target.value)}
                    className={qdFieldClass}
                >
                    <option value="">— Без кафедры —</option>
                    {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                            {d.name}
                            {d.code ? ` (${d.code})` : ''}
                        </option>
                    ))}
                </select>
                <FieldError message={form.errors.department_id} />
            </FormField>

            <DialogFooter>
                <Button type="submit" disabled={form.processing} className="gap-2">
                    {form.processing ? 'Сохранение...' : submitLabel}
                </Button>
            </DialogFooter>
        </form>
    );
}

// ─── Main page ─────────────────────────────────────────────────────────────

const DEFAULT_FORM = {
    name: '',
    department_id: '',
};

export default function Subjects({ disciplines = [], departments = [], filters }) {
    // search
    const [search, setSearch] = useState(filters?.search ?? '');
    const searchTimer = useRef(null);

    const handleSearch = (value) => {
        setSearch(value);
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => {
            router.get(route('testing.subjects.index'), { search: value }, {
                preserveState: true,
                replace: true,
            });
        }, 400);
    };

    // selected subject for details panel (right column)
    const [selectedSubjectId, setSelectedSubjectId] = useState(null);

    // dialogs
    const [createOpen, setCreateOpen] = useState(false);
    const [editOpen, setEditOpen]     = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const [confirmState, setConfirmState] = useState({ open: false, description: '', onConfirm: null });

    // Drawer for bound students and their results
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [drawerData, setDrawerData] = useState(null); // { id, teacher, subjectName }
    const [drawerStudents, setDrawerStudents] = useState([]);

    const openDrawer = (binding, subjectName) => {
        setDrawerData({
            id: binding.id,
            teacher: binding.teacher,
            subjectName: subjectName
        });
        setDrawerStudents([]);
        setLoadingStudents(true);
        setDrawerOpen(true);

        axios.get(route('testing.subjects.binding-students', binding.id))
            .then(res => {
                setDrawerStudents(res.data.students || []);
            })
            .catch(err => {
                console.error(err);
            })
            .finally(() => {
                setLoadingStudents(false);
            });
    };

    const createForm = useForm({ ...DEFAULT_FORM });
    const editForm   = useForm({ ...DEFAULT_FORM });

    // Find the currently selected subject's full details from disciplines
    const selectedSubject = disciplines.find(s => s.id === selectedSubjectId);

    // Collapsed/expanded departments state
    const [expandedDepts, setExpandedDepts] = useState({});

    // Group subjects by department
    const subjectsByDept = {};
    const unassignedSubjects = [];

    disciplines.forEach(subject => {
        if (subject.department?.id) {
            const deptId = subject.department.id;
            if (!subjectsByDept[deptId]) {
                subjectsByDept[deptId] = [];
            }
            subjectsByDept[deptId].push(subject);
        } else {
            unassignedSubjects.push(subject);
        }
    });

    // Auto-expand departments that contain matching subjects ONLY when search is active
    useEffect(() => {
        if (!search) {
            setExpandedDepts({});
            return;
        }
        const initialExpanded = {};
        departments.forEach(dept => {
            const list = subjectsByDept[dept.id] || [];
            if (list.length > 0) {
                initialExpanded[dept.id] = true;
            }
        });
        if (unassignedSubjects.length > 0) {
            initialExpanded['unassigned'] = true;
        }
        setExpandedDepts(initialExpanded);
    }, [disciplines, search]);

    const toggleDept = (deptId) => {
        setExpandedDepts(prev => ({
            ...prev,
            [deptId]: !prev[deptId]
        }));
    };

    const openEdit = (subject) => {
        setEditTarget(subject);
        editForm.setData({
            name:          subject.name ?? '',
            department_id: subject.department?.id ? String(subject.department.id) : '',
        });
        editForm.clearErrors();
        setEditOpen(true);
    };

    const submitCreate = (e) => {
        e.preventDefault();
        createForm.post(route('testing.subjects.store'), {
            preserveScroll: true,
            onSuccess: () => {
                createForm.reset();
                setCreateOpen(false);
            },
        });
    };

    const submitEdit = (e) => {
        e.preventDefault();
        if (!editTarget) return;
        editForm.patch(route('testing.subjects.update', editTarget.id), {
            preserveScroll: true,
            onSuccess: () => {
                setEditOpen(false);
                setEditTarget(null);
            },
        });
    };
    const handleDelete = (subject) => {
        setConfirmState({
            open: true,
            description: `Удалить предмет «${subject.name}»? Все связанные привязки и тесты также будут удалены.`,
            onConfirm: () => {
                router.delete(route('testing.subjects.destroy', subject.id), {
                    preserveScroll: true,
                    onSuccess: () => {
                        if (selectedSubjectId === subject.id) {
                            setSelectedSubjectId(null);
                        }
                    }
                });
            },
        });
    };

    const renderSubjectRow = (sub) => {
        const isSelected = selectedSubjectId === sub.id;
        const hasBindings = sub.bindings?.length > 0;
        return (
            <button
                type="button"
                key={sub.id}
                onClick={() => setSelectedSubjectId(sub.id)}
                aria-pressed={isSelected}
                className={`group flex w-full items-center justify-between gap-3 border-l-[3px] px-4 py-3 text-left transition-colors ${
                    isSelected
                        ? 'border-l-teal-600 bg-teal-50'
                        : hasBindings
                            ? 'border-l-emerald-500 bg-white hover:bg-slate-50'
                            : 'border-l-amber-400 bg-white hover:bg-slate-50'
                }`}
            >
                <span className="flex min-w-0 flex-col">
                    <span className={`text-sm font-medium transition-colors ${isSelected ? 'text-[#102945]' : 'text-slate-900 group-hover:text-teal-700'}`}>{sub.name}</span>
                    {sub.code && <span className="mt-0.5 font-mono text-[11px] text-slate-500">{sub.code}</span>}
                </span>
                {hasBindings ? (
                    <Badge variant="success" className="shrink-0">Учителей: {sub.bindings.length}</Badge>
                ) : (
                    <Badge variant="warning" className="shrink-0">Свободен</Badge>
                )}
            </button>
        );
    };

    const renderGroup = ({ key, icon: GroupIcon, name, code, list, emptyText }) => {
        const isExpanded = !!expandedDepts[key];
        return (
            <div key={key} className="overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-[0_1px_2px_0_rgba(25,28,29,0.04)]">
                <button
                    type="button"
                    onClick={() => toggleDept(key)}
                    aria-expanded={isExpanded}
                    className={`flex w-full select-none items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors ${
                        isExpanded ? 'border-b border-slate-200 bg-slate-50' : 'bg-white hover:bg-slate-50'
                    }`}
                >
                    <span className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-teal-100 text-teal-700">
                            <GroupIcon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                            <span className="block text-[0.9375rem] font-semibold text-[#102945]">{name}</span>
                            {code && <span className="mt-0.5 block font-mono text-[11px] tracking-wider text-slate-500">{code}</span>}
                        </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                        <Badge variant="secondary" className="tabular-nums">{list.length} предм.</Badge>
                        <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                    </span>
                </button>

                {isExpanded && (
                    <div className="divide-y divide-slate-200">
                        {list.length === 0 ? (
                            <div className="p-4 text-center text-sm text-slate-500">{emptyText}</div>
                        ) : (
                            list.map(renderSubjectRow)
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <AuthenticatedLayout
            headerRight={
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm" className="gap-2">
                            <Plus className="h-4 w-4" />
                            Добавить предмет
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-xl">
                        <DialogHeader>
                            <DialogTitle>Новый предмет</DialogTitle>
                            <DialogDescription>
                                Заполните название и выберите кафедру для нового предмета.
                            </DialogDescription>
                        </DialogHeader>
                        <SubjectForm
                            form={createForm}
                            departments={departments}
                            onSubmit={submitCreate}
                            submitLabel="Создать предмет"
                        />
                    </DialogContent>
                </Dialog>
            }
            header={(
                <PageHeader
                    eyebrow="Справочник предметов"
                    title="Список предметов по кафедрам"
                    description="Выберите предмет из списка по кафедрам слева, чтобы в правой части экрана посмотреть детали о нём и список преподавателей, которые его преподают."
                />
            )}
        >
            <Head title="Управление предметами" />

            {/* Edit dialog */}
            <Dialog
                open={editOpen}
                onOpenChange={(open) => {
                    setEditOpen(open);
                    if (!open) setEditTarget(null);
                }}
            >
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Редактировать предмет</DialogTitle>
                        <DialogDescription>
                            Внесите изменения и сохраните запись.
                        </DialogDescription>
                    </DialogHeader>
                    <SubjectForm
                        form={editForm}
                        departments={departments}
                        onSubmit={submitEdit}
                        submitLabel="Сохранить изменения"
                    />
                </DialogContent>
            </Dialog>

            <div className="admin-page-wrap space-y-6">
                <StatGrid className="xl:grid-cols-2">
                    <StatTile label="Всего предметов" value={disciplines.length} tone="teal" icon={BookOpen} />
                    <StatTile label="Всего кафедр" value={departments.length} tone="navy" icon={Building2} />
                </StatGrid>

                <FilterBar>
                    <label className="block max-w-md space-y-2">
                        <span className="qd-field-label block">Поиск</span>
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <Input
                                value={search}
                                onChange={(e) => handleSearch(e.target.value)}
                                placeholder="Быстрый поиск по названию или коду предмета…"
                                className="pl-9 pr-9"
                            />
                            {search && (
                                <button
                                    type="button"
                                    aria-label="Очистить поиск"
                                    onClick={() => handleSearch('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>
                    </label>
                </FilterBar>

                {/* ── Two column master-detail layout ── */}
                <div className="grid items-start gap-6 lg:grid-cols-12">
                    {/* Left column: Collapsible departments list */}
                    <div className="space-y-3 lg:col-span-7">
                        {departments.map(dept => {
                            const deptSubjects = subjectsByDept[dept.id] || [];

                            // Skip empty departments if search query is active
                            if (search && deptSubjects.length === 0) return null;

                            return renderGroup({
                                key: dept.id,
                                icon: Building2,
                                name: dept.name,
                                code: dept.code,
                                list: deptSubjects,
                                emptyText: 'Нет предметов на этой кафедре',
                            });
                        })}

                        {/* Unassigned subjects (Without department) */}
                        {(!search || unassignedSubjects.length > 0) && renderGroup({
                            key: 'unassigned',
                            icon: GraduationCap,
                            name: 'Без кафедры',
                            code: null,
                            list: unassignedSubjects,
                            emptyText: 'Нет неназначенных предметов',
                        })}
                    </div>

                    {/* Right column: Details panel */}
                    <div className="lg:col-span-5">
                        <Card className="sticky top-6 flex min-h-[440px] flex-col overflow-hidden">
                            {selectedSubject ? (
                                <>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <BookOpen className="h-4 w-4" />
                                            Карточка предмета
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="flex flex-1 flex-col gap-5">
                                        <div className="space-y-2">
                                            <div className="font-display text-2xl font-bold leading-tight text-[#102945]">{selectedSubject.name}</div>
                                            {selectedSubject.code && (
                                                <Badge variant="secondary" className="font-mono tracking-wider">
                                                    Код: {selectedSubject.code}
                                                </Badge>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <InfoField label="Кафедра">
                                                {selectedSubject.department?.name || 'Без кафедры'}
                                            </InfoField>
                                            <InfoField label="Привязок">
                                                <span className="tabular-nums">{selectedSubject.bindings?.length || 0} преподав.</span>
                                            </InfoField>
                                        </div>

                                        <div className="flex-1 space-y-3">
                                            <div className="qd-field-label text-[#102945]">
                                                Привязанные преподаватели
                                            </div>
                                            {selectedSubject.bindings && selectedSubject.bindings.length > 0 ? (
                                                <div className="max-h-[260px] divide-y divide-slate-200 overflow-y-auto rounded-xl border border-slate-200">
                                                    {selectedSubject.bindings.map(binding => (
                                                        <button
                                                            type="button"
                                                            key={binding.id}
                                                            onClick={() => openDrawer(binding, selectedSubject.name)}
                                                            className="group/teacher flex w-full items-center justify-between gap-3 bg-white px-3.5 py-3 text-left transition-colors hover:bg-teal-50"
                                                            title="Посмотреть привязанных студентов и результаты"
                                                        >
                                                            <span className="flex min-w-0 items-center gap-3">
                                                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-700 text-sm font-bold text-white">
                                                                    {binding.teacher?.name ? binding.teacher.name.charAt(0).toUpperCase() : 'У'}
                                                                </span>
                                                                <span className="min-w-0">
                                                                    <span className="block text-sm font-semibold leading-tight text-slate-900 transition-colors group-hover/teacher:text-teal-700">{binding.teacher?.name}</span>
                                                                    {binding.teacher?.email && <span className="mt-0.5 block truncate text-xs text-slate-500">{binding.teacher.email}</span>}
                                                                </span>
                                                            </span>
                                                            <span className="flex shrink-0 items-center gap-2">
                                                                <Badge variant="success">Активен</Badge>
                                                                <ChevronRight className="h-4 w-4 text-slate-400 transition-colors group-hover/teacher:text-teal-700" />
                                                            </span>
                                                        </button>
                                                    ))}
                                                </div>
                                            ) : (
                                                <Notice tone="warning">
                                                    Преподаватели ещё не привязали этот предмет. Он свободен.
                                                </Notice>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-3 border-t border-slate-200 pt-4">
                                            <Button
                                                variant="outline"
                                                onClick={() => openEdit(selectedSubject)}
                                                className="flex-1 gap-2"
                                            >
                                                <Pencil className="h-4 w-4" />
                                                Изменить
                                            </Button>
                                            <Button
                                                variant="destructive"
                                                onClick={() => handleDelete(selectedSubject)}
                                                className="flex-1 gap-2"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                                Удалить
                                            </Button>
                                        </div>
                                    </CardContent>
                                </>
                            ) : (
                                <div className="my-auto flex flex-1 flex-col items-center justify-center p-8 text-center">
                                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-teal-100 text-teal-700">
                                        <BookOpen className="h-7 w-7" />
                                    </div>
                                    <div className="font-display text-lg font-bold text-[#102945]">Сведения о предмете</div>
                                    <p className="mt-2 max-w-[300px] text-sm leading-relaxed text-slate-600">
                                        Выберите нужный предмет из списка кафедр слева, чтобы просмотреть его характеристики, коды и список закрепленных учителей.
                                    </p>
                                </div>
                            )}
                        </Card>
                    </div>
                </div>
            </div>

            {/* ── Drawer (right side, 40% width, full height) ── */}
            <div
                className={`fixed inset-y-0 right-0 z-50 flex w-full transform flex-col justify-between border-l border-slate-200 bg-white shadow-[0_24px_64px_-24px_rgba(16,41,69,0.35)] transition-transform duration-300 ease-in-out sm:w-[40%] ${
                    drawerOpen ? 'translate-x-0' : 'translate-x-full'
                }`}
                role="dialog"
                aria-hidden={!drawerOpen}
            >
                {/* Drawer Header */}
                <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 p-6">
                    <div className="min-w-0 max-w-[85%] space-y-1.5">
                        <p className="qd-kicker">Результаты студентов</p>
                        <h3 className="truncate font-display text-xl font-bold leading-snug text-[#102945]" title={drawerData?.subjectName}>
                            {drawerData?.subjectName}
                        </h3>
                        <p className="flex items-center gap-1 text-sm text-slate-600">
                            <User className="h-3.5 w-3.5 text-slate-400" />
                            Преподаватель: <span className="font-semibold text-slate-900">{drawerData?.teacher?.name}</span>
                        </p>
                    </div>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setDrawerOpen(false)}
                        title="Закрыть"
                        aria-label="Закрыть"
                    >
                        <X className="h-5 w-5" />
                    </Button>
                </div>

                {/* Drawer Content */}
                <div className="flex-1 space-y-6 overflow-y-auto p-6">
                    {loadingStudents ? (
                        <div className="flex justify-center py-20">
                            <LoadingState label="Загрузка результатов студентов..." />
                        </div>
                    ) : drawerStudents.length === 0 ? (
                        <EmptyState
                            title="Нет привязанных студентов"
                            description="Студенты ещё не привязывались к этому преподавателю по этому предмету и не проходили тесты."
                        />
                    ) : (
                        <div className="space-y-4">
                            {drawerStudents.map((student) => (
                                <div key={student.student_id} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                                    {/* Student Profile Info */}
                                    <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-700">
                                                {student.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold leading-tight text-slate-900">{student.name}</p>
                                                <p className="mt-0.5 font-mono text-[11px] text-slate-500">{student.student_id}</p>
                                            </div>
                                        </div>
                                        {student.email && student.email !== '—' && (
                                            <a href={`mailto:${student.email}`} className="rounded-[10px] p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-teal-700" title={student.email}>
                                                <Mail className="h-4 w-4" />
                                            </a>
                                        )}
                                    </div>

                                    {/* Test attempts */}
                                    <div className="space-y-2">
                                        <div className="qd-field-label text-slate-500">
                                            Попытки сдачи тестов
                                        </div>
                                        {student.attempts && student.attempts.length > 0 ? (
                                            <div className="divide-y divide-slate-200">
                                                {student.attempts.map((attempt) => (
                                                    <div key={attempt.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                                                        <div className="min-w-0 max-w-[65%] space-y-0.5">
                                                            <p className="truncate font-medium leading-snug text-slate-900" title={attempt.test_title}>
                                                                {attempt.test_title}
                                                            </p>
                                                            <p className="flex items-center gap-1 text-xs text-slate-500">
                                                                <Calendar className="h-3 w-3" />
                                                                {attempt.completed_at}
                                                            </p>
                                                        </div>
                                                        <div className="flex shrink-0 items-center gap-2.5">
                                                            <span className="font-semibold tabular-nums text-[#102945]">{attempt.score}%</span>
                                                            {attempt.passed ? (
                                                                <Badge variant="success">
                                                                    <CheckCircle2 className="h-3 w-3" />
                                                                    Сдано
                                                                </Badge>
                                                            ) : (
                                                                <Badge variant="destructive">
                                                                    <XCircle className="h-3 w-3" />
                                                                    Не сдано
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="rounded-[10px] border border-dashed border-slate-300 p-3 text-center text-xs text-slate-500">
                                                Ещё не проходил тесты по этому предмету
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Drawer Footer */}
                <div className="flex items-center justify-end border-t border-slate-200 bg-slate-50 p-4">
                    <Button variant="outline" onClick={() => setDrawerOpen(false)}>
                        Закрыть панель
                    </Button>
                </div>
            </div>

            {/* Backdrop for Drawer */}
            {drawerOpen && (
                <div
                    onClick={() => setDrawerOpen(false)}
                    className="fixed inset-0 z-40 bg-[#082834]/40 transition-opacity duration-300"
                />
            )}

            <ConfirmDialog
                open={confirmState.open}
                description={confirmState.description}
                onOpenChange={(open) =>
                    !open && setConfirmState({ open: false, description: '', onConfirm: null })
                }
                onConfirm={() => {
                    confirmState.onConfirm?.();
                    setConfirmState({ open: false, description: '', onConfirm: null });
                }}
            />
        </AuthenticatedLayout>
    );
}
