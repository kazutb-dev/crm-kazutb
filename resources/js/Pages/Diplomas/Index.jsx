import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { EmptyState, PageHeader, StatGrid, StatTile, qdFieldClass } from '@/components/platform';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { CircleCheck, Clock3, FileText, FileUp, Plus, ScrollText, SearchCheck } from 'lucide-react';
import { useMemo, useState } from 'react';

const statusLabels = {
    draft: 'Черновик',
    submitted: 'Отправлена',
    in_review: 'На проверке',
    approved: 'Одобрена',
    rejected: 'Отклонена',
    archived: 'Архив',
};

const statusVariants = {
    draft: 'secondary',
    submitted: 'info',
    in_review: 'warning',
    approved: 'success',
    rejected: 'destructive',
    archived: 'outline',
};

const semesterLabels = {
    fall: 'Осенний',
    spring: 'Весенний',
};

function Field({ label, error, className = '', children }) {
    return (
        <div className={`space-y-2 ${className}`}>
            <Label className="block">{label}</Label>
            {children}
            {error && <p className="text-sm text-red-700">{error}</p>}
        </div>
    );
}

export default function Index({ diplomas, faculties = [], departments = [], programs = [], typeOptions = [], userRole = 'department' }) {
    const items = diplomas?.data ?? [];
    const links = diplomas?.links ?? [];
    const total = diplomas?.total ?? items.length;

    const [createOpen, setCreateOpen] = useState(false);
    const [importOpen, setImportOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const createForm = useForm({
        year: new Date().getFullYear(),
        semester: 'spring',
        faculty_id: '',
        department_id: '',
        program_id: '',
        student_id: '',
        external_student_code: '',
        supervisor_id: '',
        title_ru: '',
        title_kz: '',
        title_en: '',
        abstract: '',
        keywords_text: '',
        type: typeOptions[0] ?? 'diploma',
        file_path: '',
    });

    const importForm = useForm({
        file: null,
    });

    const departmentOptions = useMemo(() => {
        return departments;
    }, [departments]);

    const programOptions = useMemo(() => {
        if (!createForm.data.department_id) {
            return programs;
        }

        return programs.filter(
            (program) => String(program.department_id) === String(createForm.data.department_id),
        );
    }, [programs, createForm.data.department_id]);

    const pendingCount = items.filter((diploma) => ['submitted', 'in_review'].includes(diploma.status)).length;
    const approvedCount = items.filter((diploma) => diploma.status === 'approved').length;
    const draftCount = items.filter((diploma) => ['draft', 'rejected'].includes(diploma.status)).length;

    const submitCreate = (e) => {
        e?.preventDefault();

        if (isSubmitting) {
            return;
        }

        const keywords = createForm.data.keywords_text
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);

        router.post(route('diplomas.store'), {
            ...createForm.data,
            keywords,
            student_id: createForm.data.student_id || null,
            supervisor_id: createForm.data.supervisor_id || null,
        }, {
            preserveScroll: true,
            onStart: () => setIsSubmitting(true),
            onFinish: () => setIsSubmitting(false),
            onError: (errors) => {
                createForm.setError(errors);
            },
            onSuccess: () => {
                createForm.reset();
                createForm.clearErrors();
                setCreateOpen(false);
            },
        });
    };

    const submitImport = (e) => {
        e.preventDefault();

        importForm.post(route('diplomas.import'), {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => {
                importForm.reset();
                setImportOpen(false);
            },
        });
    };

    const transition = (diplomaId, action) => {
        router.post(route(`diplomas.${action}`, diplomaId), {}, { preserveScroll: true });
    };

    const canModerate = userRole === 'department' || userRole === 'umo';

    const renderCheckSummary = (diploma) => {
        const check = diploma.topic_checks?.[0];

        if (!check) {
            return <span className="text-xs text-slate-500">Проверка не запускалась</span>;
        }

        const high = check.items?.find((item) => item.risk_level === 'high');
        const medium = check.items?.find((item) => item.risk_level === 'medium');

        if (high) {
            return <Badge variant="destructive">Высокий риск <span className="tabular-nums">{high.score}</span></Badge>;
        }

        if (medium) {
            return <Badge variant="warning">Средний риск <span className="tabular-nums">{medium.score}</span></Badge>;
        }

        return <Badge variant="success">Низкий риск</Badge>;
    };

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="Учебный процесс"
                    title="Дипломные работы"
                    description="Реестр тем дипломных работ: заявки кафедр, модерация и проверка тем на совпадения с прошлыми годами."
                    actions={(
                        <>
                            <Dialog open={importOpen} onOpenChange={setImportOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="outline">
                                        <FileUp />
                                        Импорт CSV
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Импорт истории дипломов</DialogTitle>
                                        <DialogDescription>
                                            Формат: year, department, program, title_ru, student, supervisor, keywords
                                        </DialogDescription>
                                    </DialogHeader>
                                    <form className="space-y-4" onSubmit={submitImport}>
                                        <Field label="CSV файл" error={importForm.errors.file}>
                                            <Input
                                                type="file"
                                                accept=".csv,text/csv"
                                                onChange={(e) => importForm.setData('file', e.target.files?.[0] ?? null)}
                                            />
                                        </Field>
                                        <DialogFooter>
                                            <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>Отмена</Button>
                                            <Button type="submit" disabled={importForm.processing}>
                                                Импортировать
                                            </Button>
                                        </DialogFooter>
                                    </form>
                                </DialogContent>
                            </Dialog>

                            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                                <DialogTrigger asChild>
                                    <Button>
                                        <Plus />
                                        Новая заявка
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
                                    <DialogHeader>
                                        <DialogTitle>Новая дипломная работа</DialogTitle>
                                        <DialogDescription>
                                            Создайте карточку темы и отправьте ее в workflow.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <form
                                        id="diploma-create-form"
                                        className="grid gap-4 sm:grid-cols-2"
                                        onSubmit={submitCreate}
                                    >
                                        <Field label="Год" error={createForm.errors.year}>
                                            <Input
                                                type="number"
                                                value={createForm.data.year}
                                                onChange={(e) => createForm.setData('year', e.target.value)}
                                            />
                                        </Field>
                                        <Field label="Семестр" error={createForm.errors.semester}>
                                            <select
                                                className={qdFieldClass}
                                                value={createForm.data.semester}
                                                onChange={(e) => createForm.setData('semester', e.target.value)}
                                            >
                                                <option value="spring">Весенний</option>
                                                <option value="fall">Осенний</option>
                                            </select>
                                        </Field>

                                        <Field label="Факультет" error={createForm.errors.faculty_id}>
                                            <select
                                                className={qdFieldClass}
                                                value={createForm.data.faculty_id}
                                                onChange={(e) => {
                                                    createForm.setData('faculty_id', e.target.value);
                                                    createForm.setData('department_id', '');
                                                    createForm.setData('program_id', '');
                                                }}
                                            >
                                                <option value="">Выберите факультет</option>
                                                {faculties.map((faculty) => (
                                                    <option key={faculty.id} value={faculty.id}>{faculty.name}</option>
                                                ))}
                                            </select>
                                        </Field>
                                        <Field label="Кафедра" error={createForm.errors.department_id}>
                                            <select
                                                className={qdFieldClass}
                                                value={createForm.data.department_id}
                                                onChange={(e) => {
                                                    createForm.setData('department_id', e.target.value);
                                                    createForm.setData('program_id', '');
                                                }}
                                            >
                                                <option value="">Выберите кафедру</option>
                                                {departmentOptions.map((department) => (
                                                    <option key={department.id} value={department.id}>{department.name}</option>
                                                ))}
                                            </select>
                                        </Field>

                                        <Field label="ОП" error={createForm.errors.program_id} className="sm:col-span-2">
                                            <select
                                                className={qdFieldClass}
                                                value={createForm.data.program_id}
                                                onChange={(e) => createForm.setData('program_id', e.target.value)}
                                            >
                                                <option value="">Выберите ОП</option>
                                                {programOptions.map((program) => (
                                                    <option key={program.id} value={program.id}>{program.name}</option>
                                                ))}
                                            </select>
                                        </Field>

                                        <Field label="Тема (RU)" error={createForm.errors.title_ru} className="sm:col-span-2">
                                            <Input
                                                value={createForm.data.title_ru}
                                                onChange={(e) => createForm.setData('title_ru', e.target.value)}
                                            />
                                        </Field>

                                        <Field label="Аннотация" error={createForm.errors.abstract} className="sm:col-span-2">
                                            <Textarea
                                                className="min-h-20"
                                                value={createForm.data.abstract}
                                                onChange={(e) => createForm.setData('abstract', e.target.value)}
                                            />
                                        </Field>

                                        <Field label="Ключевые слова (через запятую)" error={createForm.errors.keywords} className="sm:col-span-2">
                                            <Input
                                                value={createForm.data.keywords_text}
                                                onChange={(e) => createForm.setData('keywords_text', e.target.value)}
                                            />
                                        </Field>

                                        <Field label="Тип" error={createForm.errors.type}>
                                            <select
                                                className={qdFieldClass}
                                                value={createForm.data.type}
                                                onChange={(e) => createForm.setData('type', e.target.value)}
                                            >
                                                {typeOptions.map((item) => (
                                                    <option key={item} value={item}>{item}</option>
                                                ))}
                                            </select>
                                        </Field>
                                        <Field label="external_student_code" error={createForm.errors.external_student_code}>
                                            <Input
                                                value={createForm.data.external_student_code}
                                                onChange={(e) => createForm.setData('external_student_code', e.target.value)}
                                            />
                                        </Field>

                                        <div className="border-t border-slate-200 pt-4 sm:col-span-2">
                                            <DialogFooter>
                                                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Отмена</Button>
                                                <Button
                                                    type="submit"
                                                    form="diploma-create-form"
                                                    onClick={submitCreate}
                                                    disabled={isSubmitting}
                                                >
                                                    Сохранить
                                                </Button>
                                            </DialogFooter>
                                        </div>
                                    </form>
                                </DialogContent>
                            </Dialog>
                        </>
                    )}
                />
            )}
        >
            <Head title="Дипломные работы" />

            <div className="admin-page-wrap space-y-6">
                <StatGrid>
                    <StatTile label="Всего работ" value={total} icon={ScrollText} tone="teal" hint="Во всём реестре" />
                    <StatTile label="Ждут решения" value={pendingCount} icon={Clock3} tone="warning" hint="Отправлены или на проверке · на странице" />
                    <StatTile label="Одобрены" value={approvedCount} icon={CircleCheck} tone="success" hint="Среди показанных" />
                    <StatTile label="Черновики и отклонённые" value={draftCount} icon={FileText} tone="neutral" hint="Можно отправить повторно" />
                </StatGrid>

                {items.length === 0 ? (
                    <EmptyState
                        title="Записей пока нет"
                        description="Создайте заявку на тему дипломной работы или импортируйте историю прошлых лет из CSV."
                        action={(
                            <div className="flex flex-wrap justify-center gap-2">
                                <Button onClick={() => setCreateOpen(true)}>
                                    <Plus />
                                    Новая заявка
                                </Button>
                                <Button variant="outline" onClick={() => setImportOpen(true)}>
                                    <FileUp />
                                    Импорт CSV
                                </Button>
                            </div>
                        )}
                    />
                ) : (
                    <Card className="overflow-hidden">
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[1100px] text-sm">
                                    <thead>
                                        <tr>
                                            <th className="text-left">ID</th>
                                            <th className="text-left">Год / семестр</th>
                                            <th className="text-left">Тема</th>
                                            <th className="text-left">ОП</th>
                                            <th className="text-left">Статус</th>
                                            <th className="text-left">Проверка</th>
                                            <th className="text-right">Действия</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((diploma) => (
                                            <tr key={diploma.id} className="border-b border-slate-200 align-top last:border-0 hover:bg-slate-50">
                                                <td className="tabular-nums text-slate-500">#{diploma.id}</td>
                                                <td className="whitespace-nowrap tabular-nums text-slate-700">
                                                    {diploma.year} / {semesterLabels[diploma.semester] ?? diploma.semester}
                                                </td>
                                                <td className="max-w-md">
                                                    <div className="font-medium text-slate-900">{diploma.title_ru}</div>
                                                    <div className="text-xs text-slate-500">
                                                        {diploma.department?.name} / {diploma.faculty?.name}
                                                    </div>
                                                </td>
                                                <td className="text-slate-600">{diploma.program?.name ?? '—'}</td>
                                                <td>
                                                    <Badge variant={statusVariants[diploma.status] ?? 'outline'}>
                                                        {statusLabels[diploma.status] ?? diploma.status}
                                                    </Badge>
                                                </td>
                                                <td>{renderCheckSummary(diploma)}</td>
                                                <td className="text-right">
                                                    <div className="flex flex-wrap justify-end gap-2">
                                                        {diploma.status === 'draft' || diploma.status === 'rejected' ? (
                                                            <Button size="sm" variant="outline" onClick={() => transition(diploma.id, 'submit')}>
                                                                Отправить
                                                            </Button>
                                                        ) : null}

                                                        {canModerate && diploma.status === 'submitted' ? (
                                                            <Button size="sm" variant="outline" onClick={() => transition(diploma.id, 'in-review')}>
                                                                На проверку
                                                            </Button>
                                                        ) : null}

                                                        {canModerate && (diploma.status === 'submitted' || diploma.status === 'in_review') ? (
                                                            <>
                                                                <Button size="sm" onClick={() => transition(diploma.id, 'approve')}>
                                                                    Одобрить
                                                                </Button>
                                                                <Button size="sm" variant="destructive" onClick={() => transition(diploma.id, 'reject')}>
                                                                    Отклонить
                                                                </Button>
                                                            </>
                                                        ) : null}

                                                        {canModerate && !['approved', 'archived'].includes(diploma.status) ? (
                                                            <Button size="sm" variant="secondary" onClick={() => transition(diploma.id, 'check')}>
                                                                <SearchCheck />
                                                                Проверка
                                                            </Button>
                                                        ) : null}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {links.length > 3 && (
                                <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 px-5 py-3 sm:px-6 justify-between">
                                    <span className="text-xs font-medium text-slate-500">
                                        Показано {diplomas?.from ?? 0}–{diplomas?.to ?? 0} из {total}
                                    </span>
                                    <div className="flex flex-wrap gap-1.5">
                                        {links.map((link, index) => (
                                            <Button
                                                key={`${link.label}-${index}`}
                                                variant={link.active ? 'default' : 'outline'}
                                                size="sm"
                                                disabled={!link.url}
                                                asChild={Boolean(link.url)}
                                            >
                                                {link.url ? (
                                                    <Link href={link.url} dangerouslySetInnerHTML={{ __html: link.label }} />
                                                ) : (
                                                    <span dangerouslySetInnerHTML={{ __html: link.label }} />
                                                )}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
