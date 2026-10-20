import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { SeverityCounts, StatusBadge, isInProgress } from '@/components/teacher-ai/shared';
import { Link, router, useForm } from '@inertiajs/react';
import { ClipboardPaste, FileText, ShieldCheck, Sparkles, TriangleAlert, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';

const POLL_INTERVAL_MS = 5000;

const inputClassName = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20';

function FieldError({ message }) {
    if (!message) {
        return null;
    }

    return <p className="mt-1.5 text-sm text-rose-600">{message}</p>;
}

export default function Index({ documentTypes = [], reviews = [], aiEnabled = false, limits = {} }) {
    const [mode, setMode] = useState('file');
    const [fileError, setFileError] = useState(null);
    const form = useForm({
        document_type: documentTypes[0]?.value ?? 'syllabus',
        title: '',
        focus: '',
        document: null,
        text: '',
    });

    const dailyLimit = limits.daily ?? 0;
    const usedToday = limits.used_today ?? 0;
    const maxFileMb = limits.max_file_mb ?? 10;
    const limitReached = dailyLimit > 0 && usedToday >= dailyLimit;
    const hasInProgress = reviews.some((review) => isInProgress(review.status));
    const canSubmit = aiEnabled && !limitReached && !form.processing
        && (mode === 'file' ? Boolean(form.data.document) : form.data.text.trim().length > 0);

    useEffect(() => {
        if (!hasInProgress) {
            return undefined;
        }

        const timer = window.setInterval(() => {
            router.reload({ only: ['reviews', 'limits'], preserveScroll: true });
        }, POLL_INTERVAL_MS);

        return () => window.clearInterval(timer);
    }, [hasInProgress]);

    const handleFileChange = (event) => {
        const file = event.target.files?.[0] ?? null;
        setFileError(null);

        if (file && file.size > maxFileMb * 1024 * 1024) {
            setFileError(`Файл больше ${maxFileMb} МБ.`);
            form.setData('document', null);
            event.target.value = '';
            return;
        }

        form.setData('document', file);
    };

    const submit = (event) => {
        event.preventDefault();

        form.transform((data) => (mode === 'file' ? { ...data, text: '' } : { ...data, document: null }));
        form.post(route('teacher-ai.reviews.store'), {
            forceFormData: true,
            preserveScroll: true,
        });
    };

    return (
        <AuthenticatedLayout
            header={(
                <div className="space-y-2">
                    <p className="text-sm font-medium uppercase tracking-[0.2em] text-teal-700">AI-ассистент преподавателя</p>
                    <h2 className="text-2xl font-semibold text-slate-900">Проверка документов</h2>
                    <p className="max-w-3xl text-sm text-slate-600">
                        ИИ кратко перескажет документ и отметит спорные места. Это только подсказки:
                        ИИ может ошибаться, решение всегда принимаете вы.
                    </p>
                </div>
            )}
        >
            <div className="w-full space-y-6 px-4 py-6 sm:px-6 lg:px-8">
                {!aiEnabled && (
                    <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                        <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
                        <p>AI-ассистент сейчас отключён. Обратитесь к администратору системы.</p>
                    </div>
                )}

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                    <form onSubmit={submit} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                        <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
                                <Sparkles className="h-5 w-5" />
                            </span>
                            <div>
                                <h3 className="text-lg font-semibold text-slate-900">Новая проверка</h3>
                                <p className="text-sm text-slate-500">
                                    Сегодня использовано {usedToday} из {dailyLimit}
                                </p>
                            </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <label htmlFor="document_type" className="mb-1.5 block text-sm font-medium text-slate-700">Тип документа</label>
                                <select
                                    id="document_type"
                                    value={form.data.document_type}
                                    onChange={(event) => form.setData('document_type', event.target.value)}
                                    className={inputClassName}
                                >
                                    {documentTypes.map((type) => (
                                        <option key={type.value} value={type.value}>{type.label}</option>
                                    ))}
                                </select>
                                <FieldError message={form.errors.document_type} />
                            </div>
                            <div>
                                <label htmlFor="title" className="mb-1.5 block text-sm font-medium text-slate-700">
                                    Название <span className="font-normal text-slate-400">(необязательно)</span>
                                </label>
                                <input
                                    id="title"
                                    type="text"
                                    value={form.data.title}
                                    onChange={(event) => form.setData('title', event.target.value)}
                                    placeholder="Например: Силлабус «Базы данных»"
                                    maxLength={255}
                                    className={inputClassName}
                                />
                                <FieldError message={form.errors.title} />
                            </div>
                        </div>

                        <div>
                            <div className="mb-3 inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                                {[
                                    { key: 'file', label: 'Загрузить файл', Icon: Upload },
                                    { key: 'text', label: 'Вставить текст', Icon: ClipboardPaste },
                                ].map(({ key, label, Icon }) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => setMode(key)}
                                        className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition ${mode === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        <Icon className="h-4 w-4" />
                                        {label}
                                    </button>
                                ))}
                            </div>

                            {mode === 'file' ? (
                                <div>
                                    <label
                                        htmlFor="document"
                                        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center transition hover:border-teal-400 hover:bg-teal-50/40"
                                    >
                                        <FileText className="h-8 w-8 text-slate-400" />
                                        <span className="text-sm font-medium text-slate-700">
                                            {form.data.document ? form.data.document.name : 'Выберите файл'}
                                        </span>
                                        <span className="text-xs text-slate-500">PDF, DOCX или TXT, до {maxFileMb} МБ</span>
                                    </label>
                                    <input
                                        id="document"
                                        type="file"
                                        accept=".pdf,.docx,.txt"
                                        onChange={handleFileChange}
                                        className="sr-only"
                                    />
                                    <FieldError message={fileError ?? form.errors.document} />
                                </div>
                            ) : (
                                <div>
                                    <textarea
                                        value={form.data.text}
                                        onChange={(event) => form.setData('text', event.target.value)}
                                        rows={10}
                                        placeholder="Вставьте текст документа"
                                        className={inputClassName}
                                    />
                                    <FieldError message={form.errors.text} />
                                </div>
                            )}
                        </div>

                        <div>
                            <label htmlFor="focus" className="mb-1.5 block text-sm font-medium text-slate-700">
                                На что обратить внимание <span className="font-normal text-slate-400">(необязательно)</span>
                            </label>
                            <textarea
                                id="focus"
                                value={form.data.focus}
                                onChange={(event) => form.setData('focus', event.target.value)}
                                rows={2}
                                maxLength={1000}
                                placeholder="Например: проверь политику оценивания и список литературы"
                                className={inputClassName}
                            />
                            <FieldError message={form.errors.focus} />
                        </div>

                        <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
                            <p>
                                Текст документа отправляется во внешний ИИ-сервис. Не загружайте персональные данные
                                студентов и сотрудников: ИИН, телефоны, оценки. Номера из 12 цифр скрываются автоматически.
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <button
                                type="submit"
                                disabled={!canSubmit}
                                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                            >
                                <Sparkles className="h-4 w-4" />
                                {form.processing ? 'Отправка…' : 'Отправить на проверку'}
                            </button>
                            {limitReached && (
                                <span className="text-sm text-amber-700">Дневной лимит проверок исчерпан.</span>
                            )}
                        </div>
                    </form>

                    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                        <h3 className="text-lg font-semibold text-slate-900">Мои проверки</h3>
                        <p className="mt-1 text-sm text-slate-500">Видны только вам.</p>

                        {reviews.length === 0 ? (
                            <div className="mt-6 rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                                Здесь появятся результаты ваших проверок.
                            </div>
                        ) : (
                            <ul className="mt-5 divide-y divide-slate-100">
                                {reviews.map((review) => (
                                    <li key={review.id}>
                                        <Link
                                            href={route('teacher-ai.reviews.show', review.id)}
                                            className="-mx-3 flex flex-col gap-2 rounded-xl px-3 py-3 transition hover:bg-slate-50"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <span className="min-w-0 break-words font-medium text-slate-900">{review.title}</span>
                                                <StatusBadge status={review.status} />
                                            </div>
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-500">
                                                <span>{review.document_type_label}</span>
                                                <span>{review.created_at}</span>
                                                {review.status === 'completed' && <SeverityCounts counts={review.findings_count} />}
                                            </div>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
