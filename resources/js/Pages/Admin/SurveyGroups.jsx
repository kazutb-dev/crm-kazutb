import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
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
import { Textarea } from '@/components/ui/textarea';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { Link2, Pencil, Plus, Trash2, Users } from 'lucide-react';
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
        if (!window.confirm(`Удалить группу "${group.name}"?`)) {
            return;
        }

        router.delete(route('admin.surveys.groups.destroy', group.id), {
            preserveScroll: true,
        });
    };

    return (
        <AuthenticatedLayout>
            <Head title="Анкетирование - Группы" />

            <div className="admin-page-wrap">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 bg-white/90 px-5 py-4 shadow-[0_6px_18px_rgba(15,36,63,0.07)] backdrop-blur">
                    <div>
                        <h1 className="text-base font-bold leading-tight text-[#132844]">Анкетирование - Группы</h1>
                        <p className="mt-1 text-xs text-muted-foreground">KPI-стиль управления академическими группами и привязками студентов.</p>
                    </div>
                    <Button type="button" onClick={openCreate} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Новая группа
                    </Button>
                </div>

                {flash?.success && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
                        {flash.success}
                    </div>
                )}

                <Card className="admin-surface">
                    <CardHeader>
                        <CardTitle className="admin-table-title flex items-center justify-between gap-2">
                            <span className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-[#139AA4]" />
                                Список групп
                            </span>
                            <Badge variant="outline">{groups.length}</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {groups.length === 0 ? (
                            <div className="admin-empty-state">Группы пока не добавлены.</div>
                        ) : (
                            <div className="admin-table-wrap">
                                <table className="admin-data-table min-w-[760px]">
                                    <thead>
                                        <tr>
                                            <th className="ps-3">Название</th>
                                            <th>Код</th>
                                            <th>Описание</th>
                                            <th className="text-right">Студентов</th>
                                            <th className="text-right pe-3">Действия</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {groups.map((group) => (
                                            <tr key={group.id}>
                                                <td className="ps-3 font-medium">{group.name}</td>
                                                <td>{group.code}</td>
                                                <td className="text-sm text-muted-foreground">{group.description || '—'}</td>
                                                <td className="text-right tabular-nums">
                                                    <Badge variant="secondary">{group.students_count || 0}</Badge>
                                                </td>
                                                <td className="pe-3">
                                                    <div className="admin-row-actions">
                                                        <Button type="button" variant="outline" size="sm" onClick={() => openBinding(group)} className="gap-1.5">
                                                            <Link2 className="h-3.5 w-3.5" />
                                                            Привязка
                                                        </Button>
                                                        <Button type="button" variant="outline" size="sm" onClick={() => openEdit(group)}>
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button type="button" variant="destructive" size="sm" onClick={() => destroyGroup(group)}>
                                                            <Trash2 className="h-3.5 w-3.5" />
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

                <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
                    <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                            <DialogTitle>{editingGroup ? 'Редактировать группу' : 'Создать группу'}</DialogTitle>
                            <DialogDescription>
                                Заполните реквизиты группы. Форма работает в модальном окне, как в разделе KPI.
                            </DialogDescription>
                        </DialogHeader>

                        <form onSubmit={submitGroup} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Название</label>
                                <Input
                                    value={groupForm.data.name}
                                    onChange={(event) => groupForm.setData('name', event.target.value)}
                                    placeholder="Например: БПМ-20-1"
                                />
                                {groupForm.errors.name && <p className="text-sm text-destructive">{groupForm.errors.name}</p>}
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Код</label>
                                <Input
                                    value={groupForm.data.code}
                                    onChange={(event) => groupForm.setData('code', event.target.value)}
                                    placeholder="Например: BPM-20-1"
                                />
                                {groupForm.errors.code && <p className="text-sm text-destructive">{groupForm.errors.code}</p>}
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Описание</label>
                                <Textarea
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
                                    <label className="text-sm font-medium">Студент для привязки</label>
                                    <select
                                        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
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

                                <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Уже в группе</p>
                                    <p className="mt-1 text-sm font-medium">{groupStudents.length} студентов</p>
                                    <div className="mt-2 max-h-32 space-y-1 overflow-y-auto pr-1 text-xs text-muted-foreground">
                                        {groupStudents.length === 0 && <p>Пока нет привязанных студентов.</p>}
                                        {groupStudents.map((student) => (
                                            <p key={student.id}>{student.full_name}</p>
                                        ))}
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
        </AuthenticatedLayout>
    );
}
