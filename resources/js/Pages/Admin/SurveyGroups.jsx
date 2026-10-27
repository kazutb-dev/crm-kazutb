import { ConfirmDialog } from '@/components/ConfirmDialog';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { EmptyState, Notice, PageHeader, StatGrid, StatTile, qdFieldClass } from '@/components/platform';
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
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { GraduationCap, Link2, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { useMemo, useState } from 'react';

const emptyGroupForm = {
    name: '',
    code: '',
    description: '',
};

const emptyBindForm = {
    student_id: '',
};

export default function SurveyGroups({ groups = [], students = [] }) {
    const { flash } = usePage().props;
    const [confirmState, setConfirmState] = useState({ open: false, description: '', onConfirm: null });
    const [editorOpen, setEditorOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState(null);

    const [bindOpen, setBindOpen] = useState(false);
    const [bindingGroup, setBindingGroup] = useState(null);

    const groupForm = useForm(emptyGroupForm);
    const bindForm = useForm(emptyBindForm);

    const sortedStudents = useMemo(() => {
        return [...students].sort((a, b) => a.full_name.localeCompare(b.full_name, 'ru'));
    }, [students]);

    const groupStudents = useMemo(() => {
        if (!bindingGroup) {
            return [];
        }

        return sortedStudents.filter((student) => Number(student.group_id) === Number(bindingGroup.id));
    }, [bindingGroup, sortedStudents]);

    const assignableStudents = useMemo(() => {
        if (!bindingGroup) {
            return [];
        }

        return sortedStudents.filter((student) => Number(student.group_id) !== Number(bindingGroup.id));
    }, [bindingGroup, sortedStudents]);

    const openCreate = () => {
        setEditingGroup(null);
        groupForm.setData(emptyGroupForm);
        groupForm.clearErrors();
        setEditorOpen(true);
    };

    const openEdit = (group) => {
        setEditingGroup(group);
        groupForm.setData({
            name: group.name || '',
            code: group.code || '',
            description: group.description || '',
        });
        groupForm.clearErrors();
        setEditorOpen(true);
    };

    const closeEditor = () => {
        setEditorOpen(false);
        setEditingGroup(null);
        groupForm.reset();
        groupForm.clearErrors();
    };

    const submitGroup = (event) => {
        event.preventDefault();

        if (editingGroup) {
            groupForm.patch(route('admin.surveys.groups.update', editingGroup.id), {
                preserveScroll: true,
                onSuccess: () => closeEditor(),
            });
            return;
        }

        groupForm.post(route('admin.surveys.groups.store'), {
            preserveScroll: true,
            onSuccess: () => closeEditor(),
        });
    };

    const openBinding = (group) => {
        setBindingGroup(group);
        bindForm.setData(emptyBindForm);
        bindForm.clearErrors();
        setBindOpen(true);
    };

    const closeBinding = () => {
        setBindOpen(false);
        setBindingGroup(null);
        bindForm.reset();
        bindForm.clearErrors();
    };

    const submitBinding = (event) => {
        event.preventDefault();

        if (!bindingGroup || !bindForm.data.student_id) {
            return;
        }

        const studentId = bindForm.data.student_id;

        bindForm
            .transform(() => ({
                group_id: bindingGroup.id,
            }))
            .patch(route('admin.surveys.students.group', studentId), {
                preserveScroll: true,
                onSuccess: () => closeBinding(),
                onFinish: () => bindForm.transform((data) => data),
            });
    };

    const destroyGroup = (group) => {
        setConfirmState({
            open: true,
            description: `Удалить группу "${group.name}"?`,
            onConfirm: () => router.delete(route('admin.surveys.groups.destroy', group.id), { preserveScroll: true }),
        });
    };

    const boundStudentsCount = students.filter((student) => student.group_id).length;
    const groupStudentsTotal = groups.reduce((sum, group) => sum + (Number(group.students_count) || 0), 0);
    const emptyGroupsCount = groups.filter((group) => !Number(group.students_count)).length;

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="Анкетирование"
                    title="Группы"
                    description="Управление академическими группами и привязками студентов."
                    actions={(
                        <Button type="button" onClick={openCreate}>
                            <Plus className="h-4 w-4" />
                            Новая группа
                        </Button>
                    )}
                />
            )}
        >
            <Head title="Анкетирование - Группы" />

            <div className="admin-page-wrap space-y-6">
                {flash?.success && <Notice tone="success">{flash.success}</Notice>}

                <StatGrid>
                    <StatTile label="Групп" value={groups.length} tone="teal" icon={Users} />
                    <StatTile label="Студентов" value={students.length} tone="navy" icon={GraduationCap} />
                    <StatTile label="Привязаны к группе" value={boundStudentsCount} tone="success" icon={Link2} />
                    <StatTile label="Без группы" value={students.length - boundStudentsCount} tone="gold" icon={GraduationCap} hint="студенты без привязки" />
                    <StatTile label="Группы без студентов" value={emptyGroupsCount} tone="warning" icon={Users} hint={groups.length ? `В среднем ${(groupStudentsTotal / groups.length).toFixed(1)} студ. на группу` : null} />
                </StatGrid>

                {groups.length === 0 ? (
                    <EmptyState
                        title="Группы пока не добавлены"
                        description="Создайте первую группу, затем привяжите к ней студентов."
                        action={(
                            <Button type="button" onClick={openCreate}>
                                <Plus className="h-4 w-4" />
                                Новая группа
                            </Button>
                        )}
                    />
                ) : (
                    <Card>
                        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                            <CardTitle className="flex items-center gap-2">
                                <Users />
                                Список групп
                                <Badge variant="secondary" className="ml-1 tabular-nums">{groups.length}</Badge>
                            </CardTitle>
                            <Button type="button" size="sm" variant="outline" onClick={openCreate}>
                                <Plus className="h-3.5 w-3.5" />
                                Новая группа
                            </Button>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="min-w-[760px] w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-200">
                                            <th className="whitespace-nowrap text-left">Название</th>
                                            <th className="whitespace-nowrap text-left">Код</th>
                                            <th className="whitespace-nowrap text-left">Описание</th>
                                            <th className="whitespace-nowrap text-right">Студентов</th>
                                            <th className="whitespace-nowrap">Доля</th>
                                            <th className="whitespace-nowrap text-right">Действия</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {groups.map((group) => (
                                            <tr key={group.id} className="border-b border-slate-200 last:border-b-0 hover:bg-slate-50">
                                                <td className="font-medium text-slate-900">{group.name}</td>
                                                <td className="whitespace-nowrap font-mono text-xs text-slate-600">{group.code}</td>
                                                <td className="max-w-[420px] text-slate-600"><span className="line-clamp-2">{group.description || '—'}</span></td>
                                                <td className="text-right font-semibold tabular-nums text-[#102945]">{group.students_count || 0}</td>
                                                <td>
                                                    <div className="flex w-32 items-center gap-2">
                                                        <div className="h-1.5 flex-1 rounded-full bg-slate-100">
                                                            <div className="h-1.5 rounded-full bg-teal-500" style={{ width: `${groupStudentsTotal ? Math.min(100, ((Number(group.students_count) || 0) / groupStudentsTotal) * 100) : 0}%` }} />
                                                        </div>
                                                        <span className="text-xs tabular-nums text-slate-500">{groupStudentsTotal ? Math.round(((Number(group.students_count) || 0) / groupStudentsTotal) * 100) : 0}%</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="flex justify-end gap-2">
                                                        <Button type="button" variant="secondary" size="sm" onClick={() => openBinding(group)}>
                                                            <Link2 className="h-3.5 w-3.5" />
                                                            Привязка
                                                        </Button>
                                                        <Button type="button" variant="outline" size="sm" onClick={() => openEdit(group)} aria-label="Редактировать" title="Редактировать">
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button type="button" variant="destructive" size="sm" onClick={() => destroyGroup(group)} aria-label="Удалить" title="Удалить">
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                )}

                <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
                    <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                            <DialogTitle>{editingGroup ? 'Редактировать группу' : 'Создать группу'}</DialogTitle>
                            <DialogDescription>
                                Заполните реквизиты группы.
                            </DialogDescription>
                        </DialogHeader>

                        <form onSubmit={submitGroup} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="survey-group-name">Название</Label>
                                <Input
                                    id="survey-group-name"
                                    value={groupForm.data.name}
                                    onChange={(event) => groupForm.setData('name', event.target.value)}
                                    placeholder="Например: БПМ-20-1"
                                />
                                {groupForm.errors.name && <p className="text-sm text-destructive">{groupForm.errors.name}</p>}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="survey-group-code">Код</Label>
                                <Input
                                    id="survey-group-code"
                                    value={groupForm.data.code}
                                    onChange={(event) => groupForm.setData('code', event.target.value)}
                                    placeholder="Например: BPM-20-1"
                                />
                                {groupForm.errors.code && <p className="text-sm text-destructive">{groupForm.errors.code}</p>}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="survey-group-description">Описание</Label>
                                <Textarea
                                    id="survey-group-description"
                                    rows={4}
                                    value={groupForm.data.description}
                                    onChange={(event) => groupForm.setData('description', event.target.value)}
                                    placeholder="Краткое описание группы"
                                />
                                {groupForm.errors.description && <p className="text-sm text-destructive">{groupForm.errors.description}</p>}
                            </div>

                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={closeEditor}>Отмена</Button>
                                <Button type="submit" disabled={groupForm.processing}>
                                    {editingGroup ? 'Сохранить' : 'Создать'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>

                <Dialog open={bindOpen} onOpenChange={setBindOpen}>
                    <DialogContent className="sm:max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Привязка студентов к группе</DialogTitle>
                            <DialogDescription>
                                Группа: <strong>{bindingGroup?.name || '—'}</strong>. Выберите студента, которого нужно привязать к этой группе.
                            </DialogDescription>
                        </DialogHeader>

                        <form onSubmit={submitBinding} className="space-y-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="survey-bind-student">Студент для привязки</Label>
                                    <select
                                        id="survey-bind-student"
                                        className={qdFieldClass}
                                        value={bindForm.data.student_id}
                                        onChange={(event) => bindForm.setData('student_id', event.target.value)}
                                    >
                                        <option value="">Выберите студента</option>
                                        {assignableStudents.map((student) => (
                                            <option key={student.id} value={student.id}>
                                                {student.full_name} ({student.student_id}){student.group_name ? ` — из ${student.group_name}` : ''}
                                            </option>
                                        ))}
                                    </select>
                                    {bindForm.errors.group_id && <p className="text-sm text-destructive">{bindForm.errors.group_id}</p>}
                                </div>

                                <div className="rounded-xl border border-slate-200 bg-white p-4">
                                    <div className="flex items-baseline justify-between gap-2">
                                        <p className="qd-field-label text-slate-500">Уже в группе</p>
                                        <p className="text-sm font-semibold tabular-nums text-[#102945]">{groupStudents.length} студентов</p>
                                    </div>
                                    <div className="mt-2 max-h-32 overflow-y-auto pr-1 text-sm text-slate-700">
                                        {groupStudents.length === 0 && <p className="text-slate-500">Пока нет привязанных студентов.</p>}
                                        <ul className="divide-y divide-slate-100">
                                            {groupStudents.map((student) => (
                                                <li key={student.id} className="py-1">{student.full_name}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={closeBinding}>Отмена</Button>
                                <Button type="submit" disabled={bindForm.processing || !bindForm.data.student_id}>Привязать</Button>
                            </DialogFooter>
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
