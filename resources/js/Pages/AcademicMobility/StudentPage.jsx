import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { useMemo, useState } from 'react';
import { router, usePage } from '@inertiajs/react';

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

    return (
        <AuthenticatedLayout
            header={(
                <div className="space-y-2">
                    <p className="text-sm font-medium uppercase tracking-[0.2em] text-teal-700">Академическая мобильность</p>
                    <h2 className="text-2xl font-semibold text-slate-900">Подайте заявку и прикрепите необходимые документы</h2>
                    <p className="max-w-3xl text-sm text-slate-600">
                        ФИО и email заполняются автоматически. Прикрепляйте файлы в формате PDF, JPG, PNG, DOC, DOCX или TXT.
                    </p>
                </div>
            )}
        >
            <div className="w-full space-y-6 px-4 py-6 sm:px-6 lg:px-8">
                <form onSubmit={submit} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                    {resubmission?.enabled ? (
                        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                            <p className="font-semibold">Предыдущая заявка была отклонена</p>
                            <p className="mt-1">Вы можете подать заявку повторно после исправления замечаний.</p>
                            {resubmission.previous_review_notes ? (
                                <div className="mt-2 rounded-xl border border-amber-200 bg-white p-3 text-amber-800">
                                    Комментарий сотрудника: {resubmission.previous_review_notes}
                                </div>
                            ) : null}
                        </div>
                    ) : null}

                    <div className="grid gap-6 md:grid-cols-2">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">ФИО</label>
                            <input
                                type="text"
                                value={user?.name ?? props.auth?.user?.name ?? ''}
                                className="w-full rounded-xl border border-slate-300 bg-slate-100 px-3 py-2.5 text-slate-700"
                                disabled
                                readOnly
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Email</label>
                            <input
                                type="email"
                                value={user?.email ?? props.auth?.user?.email ?? ''}
                                className="w-full rounded-xl border border-slate-300 bg-slate-100 px-3 py-2.5 text-slate-700"
                                disabled
                                readOnly
                            />
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="phone" className="text-sm font-medium text-slate-700">Телефон</label>
                            <input
                                id="phone"
                                type="tel"
                                value={form.phone}
                                onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                                className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="student_group" className="text-sm font-medium text-slate-700">Группа</label>
                            <input
                                id="student_group"
                                type="text"
                                value={form.student_group}
                                onChange={(event) => setForm((current) => ({ ...current, student_group: event.target.value }))}
                                className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
                                required
                            />
                        </div>
                    </div>

                    <div className="mt-8 space-y-4">
                        <div>
                            <h3 className="text-lg font-semibold text-slate-900">Прикрепите документы</h3>
                            <p className="mt-1 text-sm text-slate-600">Выберите тип документа и загрузите файл. Можно прикрепить несколько документов.</p>
                        </div>

                        <div className="grid gap-4">
                            {documentList.map((document) => (
                                <div key={document} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                        <div>
                                            <p className="font-medium text-slate-900">{document}</p>
                                            <p className="text-sm text-slate-600">Загрузите файл для этого документа.</p>
                                        </div>
                                        <div className="w-full md:max-w-md">
                                            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 transition hover:border-teal-400 hover:bg-teal-50">
                                                <span>{files[document] ? files[document].name : 'Выбрать файл'}</span>
                                                <input
                                                    type="file"
                                                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.txt"
                                                    className="sr-only"
                                                    onChange={(event) => handleFileChange(document, event.target.files?.[0] ?? null)}
                                                />
                                            </label>
                                            {files[document] && (
                                                <p className="mt-1 text-xs text-slate-500">Размер: {formatBytes(files[document].size)}</p>
                                            )}
                                            {fileErrors[document] && (
                                                <p className="mt-1 text-xs font-medium text-rose-600">{fileErrors[document]}</p>
                                            )}
                                            {!fileErrors[document] && serverFileErrorsByDocument[document] && (
                                                <p className="mt-1 text-xs font-medium text-rose-600">{serverFileErrorsByDocument[document]}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {errors.document_files && (
                            <p className="text-sm font-medium text-rose-600">{errors.document_files}</p>
                        )}
                    </div>

                    <div className="mt-8 space-y-2">
                        <label htmlFor="notes" className="text-sm font-medium text-slate-700">Комментарий</label>
                        <textarea
                            id="notes"
                            value={form.notes}
                            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                            className="min-h-24 w-full rounded-xl border border-slate-300 px-3 py-2.5"
                            placeholder="Дополнительная информация"
                        />
                    </div>

                    <div className="mt-8 flex justify-end">
                        <button
                            type="submit"
                            className="rounded-xl bg-slate-900 px-4 py-2.5 font-medium text-white transition hover:bg-slate-700"
                        >
                            Отправить заявку
                        </button>
                    </div>
                </form>
            </div>
        </AuthenticatedLayout>
    );
}
