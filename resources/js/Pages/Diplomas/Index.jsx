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
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { FileUp, Plus, SearchCheck } from 'lucide-react';
import { useMemo, useState } from 'react';

const statusLabels = {
    draft: 'Черновик',
    submitted: 'Отправлена',
    in_review: 'На проверке',
    approved: 'Одобрена',
    rejected: 'Отклонена',
    archived: 'Архив',
};

const semesterLabels = {
    fall: 'Осенний',
    spring: 'Весенний',
};

export default function Index({ diplomas, faculties = [], departments = [], programs = [], typeOptions = [], userRole = 'department' }) {
    const items = diplomas?.data ?? [];
    const links = diplomas?.links ?? [];

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
            return <span className="text-xs text-muted-foreground">Проверка не запускалась</span>;
        }

        const high = check.items?.find((item) => item.risk_level === 'high');
        const medium = check.items?.find((item) => item.risk_level === 'medium');

        if (high) {
            return <Badge variant="destructive">Высокий риск {high.score}</Badge>;
        }

        if (medium) {
            return <Badge variant="secondary">Средний риск {medium.score}</Badge>;
        }

        return <Badge variant="outline">Низкий риск</Badge>;
    };

    return (
        <AuthenticatedLayout
            headerRight={
                <div className="flex items-center gap-2">
                    <Dialog open={importOpen} onOpenChange={setImportOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
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
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">CSV файл</label>
                                    <Input
                                        type="file"
                                        accept=".csv,text/csv"
                                        onChange={(e) =>
                                            importForm.setData('file', e.target.files?.[0] ?? null)
                                        }
                                    />
                                    {importForm.errors.file && (
                                        <p className="text-sm text-destructive">{importForm.errors.file}</p>
                                    )}
                                </div>
                                <DialogFooter>
                                    <Button type="submit" disabled={importForm.processing}>
                                        Импортировать
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm">
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
                                className="grid gap-3 sm:grid-cols-2"
                                onSubmit={submitCreate}
                            >
                                <div className="space-y-1">
                                    <label className="text-sm font-medium">Год</label>
                                    <Input
                                        type="number"
                                        value={createForm.data.year}
                                        onChange={(e) => createForm.setData('year', e.target.value)}
                                    />
                                    {createForm.errors.year && (
                                        <p className="text-sm text-destructive">{createForm.errors.year}</p>
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-medium">Семестр</label>
                                    <select
                                        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                                        value={createForm.data.semester}
                                        onChange={(e) => createForm.setData('semester', e.target.value)}
                                    >
                                        <option value="spring">Весенний</option>
                                        <option value="fall">Осенний</option>
                                    </select>
                                    {createForm.errors.semester && (
                                        <p className="text-sm text-destructive">{createForm.errors.semester}</p>
                                    )}
                                </div>

                                <div className="space-y-1">
                                    <label className="text-sm font-medium">Факультет</label>
                                    <select
                                        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
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
                                    {createForm.errors.faculty_id && (
                                        <p className="text-sm text-destructive">{createForm.errors.faculty_id}</p>
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-medium">Кафедра</label>
                                    <select
                                        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
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
                                    {createForm.errors.department_id && (
                                        <p className="text-sm text-destructive">{createForm.errors.department_id}</p>
                                    )}
                                </div>

                                <div className="space-y-1 sm:col-span-2">
                                    <label className="text-sm font-medium">ОП</label>
                                    <select
                                        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                                        value={createForm.data.program_id}
                                        onChange={(e) => createForm.setData('program_id', e.target.value)}
                                    >
                                        <option value="">Выберите ОП</option>
                                        {programOptions.map((program) => (
                                            <option key={program.id} value={program.id}>{program.name}</option>
                                        ))}
                                    </select>
                                    {createForm.errors.program_id && (
                                        <p className="text-sm text-destructive">{createForm.errors.program_id}</p>
                                    )}
                                </div>

                                <div className="space-y-1 sm:col-span-2">
                                    <label className="text-sm font-medium">Тема (RU)</label>
                                    <Input
                                        value={createForm.data.title_ru}
                                        onChange={(e) => createForm.setData('title_ru', e.target.value)}
                                    />
                                    {createForm.errors.title_ru && (
                                        <p className="text-sm text-destructive">{createForm.errors.title_ru}</p>
                                    )}
                                </div>

                                <div className="space-y-1 sm:col-span-2">
                                    <label className="text-sm font-medium">Аннотация</label>
                                    <textarea
                                        className="min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                                        value={createForm.data.abstract}
                                        onChange={(e) => createForm.setData('abstract', e.target.value)}
                                    />
                                    {createForm.errors.abstract && (
                                        <p className="text-sm text-destructive">{createForm.errors.abstract}</p>
                                    )}
                                </div>

                                <div className="space-y-1 sm:col-span-2">
                                    <label className="text-sm font-medium">Ключевые слова (через запятую)</label>
                                    <Input
                                        value={createForm.data.keywords_text}
                                        onChange={(e) => createForm.setData('keywords_text', e.target.value)}
                                    />
                                    {createForm.errors.keywords && (
                                        <p className="text-sm text-destructive">{createForm.errors.keywords}</p>
                                    )}
                                </div>

                                <div className="space-y-1">
                                    <label className="text-sm font-medium">Тип</label>
                                    <select
                                        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                                        value={createForm.data.type}
                                        onChange={(e) => createForm.setData('type', e.target.value)}
                                    >
                                        {typeOptions.map((item) => (
                                            <option key={item} value={item}>{item}</option>
                                        ))}
                                    </select>
                                    {createForm.errors.type && (
                                        <p className="text-sm text-destructive">{createForm.errors.type}</p>
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-medium">external_student_code</label>
                                    <Input
                                        value={createForm.data.external_student_code}
                                        onChange={(e) => createForm.setData('external_student_code', e.target.value)}
                                    />
                                    {createForm.errors.external_student_code && (
                                        <p className="text-sm text-destructive">
                                            {createForm.errors.external_student_code}
                                        </p>
                                    )}
                                </div>

                                <div className="sm:col-span-2">
                                    <DialogFooter>
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
                </div>
            }
        >
            <Head title="Дипломные работы" />

            <div className="admin-page-wrap">
                <Card>
                    <CardHeader>
                        <CardTitle>Реестр дипломных работ</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {items.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Записей пока нет.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[1100px] text-sm">
                                    <thead>
                                        <tr className="border-b text-left text-muted-foreground">
                                            <th className="py-3 pe-3 font-medium">ID</th>
                                            <th className="py-3 pe-3 font-medium">Год/семестр</th>
                                            <th className="py-3 pe-3 font-medium">Тема</th>
                                            <th className="py-3 pe-3 font-medium">ОП</th>
                                            <th className="py-3 pe-3 font-medium">Статус</th>
                                            <th className="py-3 pe-3 font-medium">Проверка</th>
                                            <th className="py-3 text-right font-medium">Действия</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((diploma) => (
                                            <tr key={diploma.id} className="border-b last:border-0 align-top">
                                                <td className="py-3 pe-3">#{diploma.id}</td>
                                                <td className="py-3 pe-3">{diploma.year} / {semesterLabels[diploma.semester] ?? diploma.semester}</td>
                                                <td className="max-w-md py-3 pe-3">
                                                    <div className="font-medium">{diploma.title_ru}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {diploma.department?.name} / {diploma.faculty?.name}
                                                    </div>
                                                </td>
                                                <td className="py-3 pe-3 text-muted-foreground">{diploma.program?.name ?? '-'}</td>
                                                <td className="py-3 pe-3">
                                                    <Badge variant={diploma.status === 'approved' ? 'default' : 'outline'}>
                                                        {statusLabels[diploma.status] ?? diploma.status}
                                                    </Badge>
                                                </td>
                                                <td className="py-3 pe-3">{renderCheckSummary(diploma)}</td>
                                                <td className="py-3 text-right">
                                                    <div className="flex justify-end gap-2">
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
                        )}

                        {links.length > 3 && (
                            <div className="mt-6 flex flex-wrap gap-2">
                                {links.map((link, index) => (
                                    <Button
                                        key={`${link.label}-${index}`}
                                        variant={link.active ? 'default' : 'outline'}
                                        size="sm"
                                        disabled={!link.url}
                                        asChild={Boolean(link.url)}
                                    >
                                        {link.url ? (
                                            <Link
                                                href={link.url}
                                                dangerouslySetInnerHTML={{ __html: link.label }}
                                            />
                                        ) : (
                                            <span dangerouslySetInnerHTML={{ __html: link.label }} />
                                        )}
                                    </Button>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}
