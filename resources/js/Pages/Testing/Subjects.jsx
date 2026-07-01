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
    return <p className="mt-1 text-xs text-red-500">{message}</p>;
}

function FormField({ label, children, required }) {
    return (
        <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
                {label}
                {required && <span className="ml-1 text-red-500">*</span>}
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
                    className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#139AA4]/50 disabled:cursor-not-allowed disabled:opacity-50"
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

    return (
        <AuthenticatedLayout
            headerRight={
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm" className="gap-2 bg-gradient-to-r from-[#1b4d74] to-[#139AA4] hover:opacity-90 shadow-md transition-all active:scale-[0.98]">
                            <Plus className="h-4 w-4" />
                            Добавить предмет
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-xl border-slate-200/50 shadow-2xl rounded-2xl">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-bold text-[#132844]">Новый предмет</DialogTitle>
                            <DialogDescription className="text-slate-500 text-sm">
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
                <DialogContent className="max-w-xl border-slate-200/50 shadow-2xl rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-[#132844]">Редактировать предмет</DialogTitle>
                        <DialogDescription className="text-slate-500 text-sm">
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
                {/* ── Hero banner ── */}
                <Card className="overflow-hidden border-0 bg-gradient-to-br from-[#123153] via-[#1b4d74] to-[#139AA4] text-white shadow-[0_20px_50px_-20px_rgba(12,45,78,0.55)] rounded-3xl">
                    <CardContent className="relative flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-3xl space-y-3">
                            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-white/90 backdrop-blur-sm">
                                <BookOpen className="h-3.5 w-3.5" />
                                Справочник предметов
                            </div>
                            <h1 className="text-3xl font-semibold leading-tight text-white tracking-tight font-sans">
                                Список предметов по кафедрам
                            </h1>
                            <p className="max-w-2xl text-sm leading-6 text-white/80">
                                Выберите предмет из списка по кафедрам слева, чтобы в правой части экрана посмотреть детали о нём и список преподавателей, которые его преподают.
                            </p>
                        </div>

                        <div className="grid min-w-[240px] grid-cols-2 gap-3 shrink-0">
                            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]">
                                <div className="text-xs uppercase tracking-[0.15em] text-white/70">Всего предметов</div>
                                <div className="mt-2 text-3xl font-bold tracking-tight">{disciplines.length}</div>
                            </div>
                            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]">
                                <div className="text-xs uppercase tracking-[0.15em] text-white/70">Всего кафедр</div>
                                <div className="mt-2 text-3xl font-bold tracking-tight">{departments.length}</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Search */}
                <div className="relative max-w-md shadow-sm rounded-xl">
                    <Search className="absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
                    <Input
                        value={search}
                        onChange={(e) => handleSearch(e.target.value)}
                        placeholder="Быстрый поиск по названию или коду предмета…"
                        className="pl-10 pr-9 h-11 border-slate-200 focus-visible:ring-2 focus-visible:ring-[#139AA4]/20 focus-visible:border-[#139AA4] rounded-xl bg-white shadow-sm"
                    />
                    {search && (
                        <button
                            onClick={() => handleSearch('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>

                {/* ── Two column master-detail layout ── */}
                <div className="grid gap-6 lg:grid-cols-12 items-start">
                    {/* Left column: Collapsible departments list (col-span-7) */}
                    <div className="space-y-4 lg:col-span-7">
                        {departments.map(dept => {
                            const deptSubjects = subjectsByDept[dept.id] || [];
                            const isExpanded = !!expandedDepts[dept.id];

                            // Skip empty departments if search query is active
                            if (search && deptSubjects.length === 0) return null;

                            return (
                                <Card key={dept.id} className="overflow-hidden border border-slate-200/60 shadow-[0_4px_20px_rgba(15,23,42,0.02)] rounded-2xl transition-all duration-300">
                                    <div
                                        onClick={() => toggleDept(dept.id)}
                                        className={`flex cursor-pointer items-center justify-between p-4 transition-all duration-200 select-none ${
                                            isExpanded ? 'bg-slate-50/80 border-b border-slate-100' : 'bg-white hover:bg-slate-50/50'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-xl bg-slate-100 text-slate-500">
                                                <Building2 className="h-4.5 w-4.5" />
                                            </div>
                                            <div>
                                                <div className="font-semibold text-slate-800 text-[15px]">{dept.name}</div>
                                                {dept.code && <span className="text-[11px] font-mono tracking-wider text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md mt-1 inline-block">{dept.code}</span>}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Badge className="bg-slate-200/80 text-slate-600 hover:bg-slate-200/80 rounded-lg px-2 py-0.5 text-xs font-medium">
                                                {deptSubjects.length} предм.
                                            </Badge>
                                            <div className="p-1 rounded-full hover:bg-slate-200/50 transition-colors">
                                                <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180 text-slate-600' : ''}`} />
                                            </div>
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className="bg-white p-2.5 space-y-1">
                                            {deptSubjects.length === 0 ? (
                                                <div className="p-4 text-sm text-slate-400 text-center italic bg-slate-50/50 rounded-xl">
                                                    Нет предметов на этой кафедре
                                                </div>
                                            ) : (
                                                deptSubjects.map(sub => {
                                                    const isSelected = selectedSubjectId === sub.id;
                                                    const hasBindings = sub.bindings?.length > 0;
                                                    return (
                                                        <div
                                                            key={sub.id}
                                                            onClick={() => setSelectedSubjectId(sub.id)}
                                                            className={`group flex cursor-pointer items-center justify-between rounded-xl p-3.5 transition-all duration-200 border-l-4 ${
                                                                isSelected
                                                                    ? 'bg-[#139AA4]/8 border-l-[#139AA4] text-[#132844] font-medium shadow-[inset_0_1px_2px_rgba(0,0,0,0.01)]'
                                                                    : hasBindings
                                                                        ? 'border-l-emerald-500 bg-white hover:bg-slate-50/80 text-slate-700'
                                                                        : 'border-l-amber-500 bg-white hover:bg-slate-50/80 text-slate-700'
                                                            }`}
                                                        >
                                                            <div className="flex flex-col">
                                                                <span className={`text-[14px] font-medium transition-colors ${isSelected ? 'text-[#132844]' : 'group-hover:text-[#139AA4]'}`}>{sub.name}</span>
                                                                {sub.code && <span className="mt-1 font-mono text-[11px] text-slate-400">{sub.code}</span>}
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                {hasBindings ? (
                                                                    <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-50 text-[11px] rounded-lg px-2.5 py-0.5">
                                                                        Учителей: {sub.bindings.length}
                                                                    </Badge>
                                                                ) : (
                                                                    <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50/20 text-[11px] rounded-lg px-2.5 py-0.5">
                                                                        Свободен
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    )}
                                </Card>
                            );
                        })}

                        {/* Unassigned subjects (Without department) */}
                        {(!search || unassignedSubjects.length > 0) && (
                            <Card className="overflow-hidden border border-slate-200/60 shadow-[0_4px_20px_rgba(15,23,42,0.02)] rounded-2xl">
                                <div
                                    onClick={() => toggleDept('unassigned')}
                                    className={`flex cursor-pointer items-center justify-between p-4 transition-all duration-200 select-none ${
                                        expandedDepts['unassigned'] ? 'bg-slate-50/80 border-b border-slate-100' : 'bg-white hover:bg-slate-50/50'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-xl bg-slate-100 text-slate-500">
                                            <GraduationCap className="h-4.5 w-4.5" />
                                        </div>
                                        <div className="font-semibold text-slate-800 text-[15px]">Без кафедры</div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Badge className="bg-slate-200/80 text-slate-600 hover:bg-slate-200/80 rounded-lg px-2 py-0.5 text-xs font-medium">
                                            {unassignedSubjects.length} предм.
                                        </Badge>
                                        <div className="p-1 rounded-full hover:bg-slate-200/50 transition-colors">
                                            <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-300 ${expandedDepts['unassigned'] ? 'rotate-180' : ''}`} />
                                        </div>
                                    </div>
                                </div>

                                {expandedDepts['unassigned'] && (
                                    <div className="bg-white p-2.5 space-y-1">
                                        {unassignedSubjects.length === 0 ? (
                                            <div className="p-4 text-sm text-slate-400 text-center italic bg-slate-50/50 rounded-xl">
                                                Нет неназначенных предметов
                                            </div>
                                        ) : (
                                            unassignedSubjects.map(sub => {
                                                const isSelected = selectedSubjectId === sub.id;
                                                const hasBindings = sub.bindings?.length > 0;
                                                return (
                                                    <div
                                                        key={sub.id}
                                                        onClick={() => setSelectedSubjectId(sub.id)}
                                                        className={`group flex cursor-pointer items-center justify-between rounded-xl p-3.5 transition-all duration-200 border-l-4 ${
                                                            isSelected
                                                                ? 'bg-[#139AA4]/8 border-l-[#139AA4] text-[#132844] font-medium shadow-[inset_0_1px_2px_rgba(0,0,0,0.01)]'
                                                                : hasBindings
                                                                    ? 'border-l-emerald-500 bg-white hover:bg-slate-50/80 text-slate-700'
                                                                    : 'border-l-amber-500 bg-white hover:bg-slate-50/80 text-slate-700'
                                                        }`}
                                                    >
                                                        <div className="flex flex-col">
                                                            <span className={`text-[14px] font-medium transition-colors ${isSelected ? 'text-[#132844]' : 'group-hover:text-[#139AA4]'}`}>{sub.name}</span>
                                                            {sub.code && <span className="mt-1 font-mono text-[11px] text-slate-400">{sub.code}</span>}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {hasBindings ? (
                                                                <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-50 text-[11px] rounded-lg px-2.5 py-0.5">
                                                                    Учителей: {sub.bindings.length}
                                                                </Badge>
                                                            ) : (
                                                                <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50/20 text-[11px] rounded-lg px-2.5 py-0.5">
                                                                    Свободен
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                )}
                            </Card>
                        )}
                    </div>

                    {/* Right column: Details Sidebar (col-span-5) */}
                    <div className="lg:col-span-5">
                        <Card className="sticky top-6 border border-slate-200/70 shadow-[0_16px_50px_-20px_rgba(15,23,42,0.15)] bg-gradient-to-b from-white to-slate-50/50 p-6 min-h-[440px] flex flex-col justify-between rounded-3xl overflow-hidden relative">
                            {selectedSubject ? (
                                <div className="space-y-6 flex-1 flex flex-col justify-between h-full">
                                    <div className="space-y-5">
                                        <div className="space-y-2">
                                            <span className="text-[11px] uppercase font-bold tracking-widest text-[#139AA4]">Карточка предмета</span>
                                            <div className="text-2xl font-bold text-[#132844] leading-tight tracking-tight">{selectedSubject.name}</div>
                                            {selectedSubject.code && (
                                                <span className="mt-2 font-mono text-[11px] tracking-wider bg-slate-100 border border-slate-200 text-slate-600 rounded-md px-2 py-0.5 inline-block">
                                                    Код: {selectedSubject.code}
                                                </span>
                                            )}
                                        </div>

                                        {/* General Specs */}
                                        <div className="grid grid-cols-2 gap-4 rounded-2xl bg-white p-4 border border-slate-100 shadow-sm">
                                            <div>
                                                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Кафедра</span>
                                                <span className="text-[13px] font-semibold text-slate-700 mt-1 block leading-normal">
                                                    {selectedSubject.department?.name || 'Без кафедры'}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Привязок</span>
                                                <span className="text-[13px] font-semibold text-slate-700 mt-1 block leading-normal">
                                                    {selectedSubject.bindings?.length || 0} преподав.
                                                </span>
                                            </div>
                                        </div>

                                        {/* Bound Teachers list */}
                                        <div className="space-y-3 flex-1">
                                            <div className="text-xs font-bold text-[#132844] uppercase tracking-widest">
                                                Привязанные преподаватели
                                            </div>
                                            {selectedSubject.bindings && selectedSubject.bindings.length > 0 ? (
                                                <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                                                    {selectedSubject.bindings.map(binding => (
                                                        <div
                                                            key={binding.id}
                                                            onClick={() => openDrawer(binding, selectedSubject.name)}
                                                            className="rounded-xl border border-slate-100 bg-white p-3.5 shadow-sm hover:shadow-md hover:border-[#139AA4]/30 hover:bg-[#139AA4]/5 transition-all flex items-center justify-between cursor-pointer group/teacher"
                                                            title="Посмотреть привязанных студентов и результаты"
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#1b4d74] to-[#139AA4] text-white flex items-center justify-center font-bold text-sm shadow-sm group-hover/teacher:scale-105 transition-transform">
                                                                    {binding.teacher?.name ? binding.teacher.name.charAt(0).toUpperCase() : 'У'}
                                                                </div>
                                                                <div>
                                                                    <p className="text-sm font-semibold text-slate-800 leading-tight group-hover/teacher:text-[#139AA4] transition-colors">{binding.teacher?.name}</p>
                                                                    {binding.teacher?.email && <p className="text-[11px] text-slate-400 mt-0.5">{binding.teacher.email}</p>}
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/10">
                                                                    Активен
                                                                </span>
                                                                <ChevronRight className="h-4 w-4 text-slate-400 group-hover/teacher:text-[#139AA4] group-hover/teacher:translate-x-0.5 transition-all" />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-slate-400 text-sm italic shadow-sm">
                                                    Преподаватели ещё не привязали этот предмет. Он свободен.
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="pt-4 border-t border-slate-200/60 flex items-center gap-3 bg-slate-50/30 -mx-6 -mb-6 p-6">
                                        <Button
                                            variant="outline"
                                            onClick={() => openEdit(selectedSubject)}
                                            className="flex-1 gap-2 h-10 rounded-xl hover:bg-slate-100 transition-colors"
                                        >
                                            <Pencil className="h-4 w-4" />
                                            Изменить
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            onClick={() => handleDelete(selectedSubject)}
                                            className="flex-1 gap-2 h-10 rounded-xl hover:bg-red-600 transition-colors shadow-sm"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                            Удалить
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 my-auto">
                                    <div className="p-4 bg-slate-100/50 rounded-2xl mb-4 border border-slate-200/20">
                                        <BookOpen className="h-10 w-10 text-slate-400 stroke-1" />
                                    </div>
                                    <div className="font-bold text-slate-700 text-[16px]">Сведения о предмете</div>
                                    <p className="text-xs text-slate-400 mt-2 max-w-[280px] leading-relaxed">
                                        Выберите нужный предмет из списка кафедр слева, чтобы просмотреть его характеристики, коды и список закрепленных учителей.
                                    </p>
                                </div>
                            )}
                        </Card>
                    </div>
                </div>
            </div>

            {/* ── Drawer component (Right side, 40% width, full height) ── */}
            <div
                className={`fixed inset-y-0 right-0 z-50 w-full sm:w-[40%] bg-white shadow-2xl border-l border-slate-200/80 transform transition-transform duration-300 ease-in-out flex flex-col justify-between ${
                    drawerOpen ? 'translate-x-0' : 'translate-x-full'
                }`}
            >
                {/* Drawer Header */}
                <div className="p-6 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
                    <div className="space-y-1.5 max-w-[85%]">
                        <span className="text-[10px] uppercase font-bold tracking-widest text-[#139AA4] block">Результаты студентов</span>
                        <h3 className="text-lg font-bold text-[#132844] leading-snug truncate" title={drawerData?.subjectName}>
                            {drawerData?.subjectName}
                        </h3>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                            <User className="h-3 w-3 text-slate-400" />
                            Преподаватель: <span className="font-semibold text-slate-700">{drawerData?.teacher?.name}</span>
                        </p>
                    </div>
                    <button
                        onClick={() => setDrawerOpen(false)}
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                        title="Закрыть"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Drawer Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {loadingStudents ? (
                        <div className="flex flex-col items-center justify-center py-20 space-y-4">
                            <Loader2 className="h-10 w-10 text-[#139AA4] animate-spin stroke-[1.5]" />
                            <p className="text-sm text-slate-400 font-sans">Загрузка результатов студентов...</p>
                        </div>
                    ) : drawerStudents.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100/50">
                                <GraduationCap className="h-8 w-8 text-slate-300 stroke-1" />
                            </div>
                            <p className="text-sm text-slate-500 font-medium font-sans">Нет привязанных студентов</p>
                            <p className="text-xs text-slate-400 max-w-[240px] leading-relaxed font-sans">
                                Студенты ещё не привязывались к этому преподавателю по этому предмету и не проходили тесты.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {drawerStudents.map((student) => (
                                <div key={student.student_id} className="rounded-2xl border border-slate-100 p-4 space-y-4 bg-slate-50/30 hover:border-slate-200/80 transition-colors">
                                    {/* Student Profile Info */}
                                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                                        <div className="flex items-center gap-3">
                                            <div className="h-9 w-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-sm border border-slate-200/40">
                                                {student.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-slate-800 leading-tight font-sans">{student.name}</p>
                                                <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{student.student_id}</p>
                                            </div>
                                        </div>
                                        {student.email && student.email !== '—' && (
                                            <a href={`mailto:${student.email}`} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors" title={student.email}>
                                                <Mail className="h-4 w-4" />
                                            </a>
                                        )}
                                    </div>

                                    {/* Test attempts */}
                                    <div className="space-y-2">
                                        <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-sans">
                                            Попытки сдачи тестов
                                        </div>
                                        {student.attempts && student.attempts.length > 0 ? (
                                            <div className="space-y-2">
                                                {student.attempts.map((attempt) => (
                                                    <div key={attempt.id} className="flex items-center justify-between rounded-xl bg-white p-3 border border-slate-100/60 shadow-[0_2px_8px_rgba(0,0,0,0.01)] text-xs">
                                                        <div className="space-y-1 max-w-[65%]">
                                                            <p className="font-semibold text-slate-700 leading-snug truncate font-sans" title={attempt.test_title}>
                                                                {attempt.test_title}
                                                            </p>
                                                            <p className="text-[10px] text-slate-400 flex items-center gap-1 font-sans">
                                                                <Calendar className="h-3 w-3 text-slate-400" />
                                                                {attempt.completed_at}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-2.5 shrink-0">
                                                            <div className="text-right">
                                                                <span className="font-bold text-slate-800 font-sans">{attempt.score}%</span>
                                                            </div>
                                                            {attempt.passed ? (
                                                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/10">
                                                                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                                                    Сдано
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700 ring-1 ring-inset ring-red-600/10">
                                                                    <XCircle className="h-3 w-3 text-red-500" />
                                                                    Не сдано
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-xs text-slate-400 italic bg-white rounded-xl p-3 border border-dashed border-slate-100 text-center font-sans">
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
                <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center">
                    <Button onClick={() => setDrawerOpen(false)} className="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-xl border-0 h-10 transition-colors font-sans">
                        Закрыть панель
                    </Button>
                </div>
            </div>

            {/* Glass Backdrop for Drawer */}
            {drawerOpen && (
                <div
                    onClick={() => setDrawerOpen(false)}
                    className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-[2px] transition-opacity duration-300"
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
