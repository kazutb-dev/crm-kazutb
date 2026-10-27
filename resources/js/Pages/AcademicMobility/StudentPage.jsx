import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { FormGrid, Notice, PageHeader } from '@/components/platform';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { router, usePage } from '@inertiajs/react';
import { CircleCheck, FileText, MessageSquareText, Paperclip, Send, UserRound } from 'lucide-react';
import { useMemo, useState } from 'react';

const DOCUMENT_OPTIONS = [
    'Заявление',
    'Транскрипт',
    'Индивидуальный учебный план',
    'Анкета',
    'Приказ',
    'Трёхсторонний договор',
];

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_FILE_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx', 'txt'];

const formatBytes = (bytes) => {
    if (!bytes || bytes <= 0) {
        return '0 Б';
    }

    const units = ['Б', 'КБ', 'МБ', 'ГБ'];
    const power = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / (1024 ** power);

    return `${value.toFixed(value >= 10 || power === 0 ? 0 : 1)} ${units[power]}`;
};

const getFileExtension = (fileName = '') => {
    const parts = fileName.toLowerCase().split('.');
    return parts.length > 1 ? parts.pop() : '';
};

export default function StudentPage({ documents = DOCUMENT_OPTIONS, user, resubmission = null }) {
    const { props } = usePage();
    const errors = props.errors ?? {};
    const [form, setForm] = useState({
        phone: '',
        student_group: '',
        notes: '',
    });
    const [selectedDocuments, setSelectedDocuments] = useState([]);
    const [files, setFiles] = useState({});
    const [fileErrors, setFileErrors] = useState({});

    const documentList = useMemo(() => documents ?? DOCUMENT_OPTIONS, [documents]);

    const serverFileErrorsByDocument = useMemo(() => {
        const byDocument = {};

        selectedDocuments.forEach((documentName, index) => {
            const key = `document_files.${index}`;
            if (errors[key]) {
                byDocument[documentName] = errors[key];
            }
        });

        return byDocument;
    }, [errors, selectedDocuments]);

    const handleFileChange = (documentName, file) => {
        if (!file) {
            setFileErrors((current) => {
                const next = { ...current };
                delete next[documentName];
                return next;
            });

            setFiles((current) => {
                const next = { ...current };
                delete next[documentName];
                return next;
            });

            setSelectedDocuments((current) => current.filter((item) => item !== documentName));
            return;
        }

        const extension = getFileExtension(file.name);

        if (!ALLOWED_FILE_EXTENSIONS.includes(extension)) {
            setFileErrors((current) => ({
                ...current,
                [documentName]: 'Недопустимый формат файла. Разрешены: PDF, JPG, PNG, DOC, DOCX, TXT.',
            }));
            return;
        }

        if (file.size > MAX_FILE_SIZE_BYTES) {
            setFileErrors((current) => ({
                ...current,
                [documentName]: `Файл слишком большой (${formatBytes(file.size)}). Максимум 10 МБ.`,
            }));
            return;
        }

        setFileErrors((current) => {
            const next = { ...current };
            delete next[documentName];
            return next;
        });

        setFiles((current) => ({
            ...current,
            [documentName]: file,
        }));

        setSelectedDocuments((current) => {
            if (file && !current.includes(documentName)) {
                return [...current, documentName];
            }

            if (!file && current.includes(documentName)) {
                return current.filter((item) => item !== documentName);
            }

            return current;
        });
    };

    const submit = (event) => {
        event.preventDefault();

        if (Object.keys(fileErrors).length > 0) {
            return;
        }

        const formData = new FormData();
        formData.append('phone', form.phone);
        formData.append('student_group', form.student_group);
        formData.append('notes', form.notes);

        selectedDocuments.forEach((documentName) => {
            formData.append('document_types[]', documentName);
            const file = files[documentName];
            if (file) {
                formData.append('document_files[]', file);
            }
        });

        router.post(route('academic-mobility.student.store'), formData, {
            forceFormData: true,
            preserveScroll: true,
        });
    };

    const attachedCount = Object.keys(files).length;

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="Академическая мобильность"
                    title="Подайте заявку и прикрепите необходимые документы"
                    description="ФИО и email заполняются автоматически. Прикрепляйте файлы в формате PDF, JPG, PNG, DOC, DOCX или TXT."
                    meta={<Badge variant={attachedCount > 0 ? 'success' : 'secondary'}>Прикреплено: {attachedCount} из {documentList.length}</Badge>}
                />
            )}
        >
            <div className="admin-page-wrap">
                <form onSubmit={submit} className="mx-auto max-w-5xl space-y-6">
                    {resubmission?.enabled ? (
                        <Notice tone="warning" title="Предыдущая заявка была отклонена">
                            <p>Вы можете подать заявку повторно после исправления замечаний.</p>
                            {resubmission.previous_review_notes ? (
                                <p className="mt-2 border-l-2 border-amber-400 pl-3 text-slate-800">
                                    Комментарий сотрудника: {resubmission.previous_review_notes}
                                </p>
                            ) : null}
                        </Notice>
                    ) : null}

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <UserRound className="shrink-0" />
                                Данные заявителя
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <FormGrid>
                                <div className="space-y-2">
                                    <Label className="block">ФИО</Label>
                                    <Input
                                        type="text"
                                        value={user?.name ?? props.auth?.user?.name ?? ''}
                                        disabled
                                        readOnly
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label className="block">Email</Label>
                                    <Input
                                        type="email"
                                        value={user?.email ?? props.auth?.user?.email ?? ''}
                                        disabled
                                        readOnly
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="phone" className="block">Телефон</Label>
                                    <Input
                                        id="phone"
                                        type="tel"
                                        value={form.phone}
                                        onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="student_group" className="block">Группа</Label>
                                    <Input
                                        id="student_group"
                                        type="text"
                                        value={form.student_group}
                                        onChange={(event) => setForm((current) => ({ ...current, student_group: event.target.value }))}
                                        required
                                    />
                                </div>
                            </FormGrid>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Paperclip className="shrink-0" />
                                Прикрепите документы
                            </CardTitle>
                            <p className="text-sm text-slate-600">Выберите тип документа и загрузите файл. Можно прикрепить несколько документов.</p>
                        </CardHeader>
                        <CardContent>
                            <div className="divide-y divide-slate-200">
                                {documentList.map((document) => {
                                    const attached = Boolean(files[document]);
                                    return (
                                        <div key={document} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 md:flex-row md:items-center md:justify-between">
                                            <div className="flex items-start gap-3">
                                                <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${attached ? 'bg-emerald-100 text-emerald-700' : 'bg-teal-50 text-teal-700'}`}>
                                                    {attached ? <CircleCheck className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                                                </span>
                                                <div>
                                                    <p className="font-medium text-slate-900">{document}</p>
                                                    <p className="text-sm text-slate-500">Загрузите файл для этого документа.</p>
                                                </div>
                                            </div>
                                            <div className="w-full md:max-w-md">
                                                <label className={`flex cursor-pointer items-center justify-between gap-3 rounded-[10px] border border-dashed px-3 py-2.5 text-sm transition-colors ${attached ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-300 bg-white text-slate-700 hover:border-teal-500 hover:bg-teal-50'}`}>
                                                    <span className="truncate">{attached ? files[document].name : 'Выбрать файл'}</span>
                                                    <span className="shrink-0 text-xs font-bold uppercase tracking-[0.07em] text-teal-700">{attached ? 'Заменить' : 'Обзор'}</span>
                                                    <input
                                                        type="file"
                                                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.txt"
                                                        className="sr-only"
                                                        onChange={(event) => handleFileChange(document, event.target.files?.[0] ?? null)}
                                                    />
                                                </label>
                                                {attached && (
                                                    <p className="mt-1 text-xs tabular-nums text-slate-500">Размер: {formatBytes(files[document].size)}</p>
                                                )}
                                                {fileErrors[document] && (
                                                    <p className="mt-1 text-xs font-medium text-red-700">{fileErrors[document]}</p>
                                                )}
                                                {!fileErrors[document] && serverFileErrorsByDocument[document] && (
                                                    <p className="mt-1 text-xs font-medium text-red-700">{serverFileErrorsByDocument[document]}</p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {errors.document_files && (
                                <Notice tone="danger" className="mb-4">{errors.document_files}</Notice>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <MessageSquareText className="shrink-0" />
                                Комментарий
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Label htmlFor="notes" className="sr-only">Комментарий</Label>
                            <Textarea
                                id="notes"
                                value={form.notes}
                                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                                placeholder="Дополнительная информация"
                            />
                        </CardContent>
                    </Card>

                    <div className="flex justify-end">
                        <Button type="submit" size="lg">
                            <Send />
                            Отправить заявку
                        </Button>
                    </div>
                </form>
            </div>
        </AuthenticatedLayout>
    );
}
