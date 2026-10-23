import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DOCUMENT_TYPES, formatMoney } from '@/components/hr-hiring/logic';
import { buttonClassName, DocumentStatusBadge, formatBytes, inputClassName, Notice, StatusBadge } from '@/components/hr-hiring/ui';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { CircleAlert, Download, FilePenLine, FileSignature, History, LoaderCircle, Paperclip, Pencil, ScanLine, Trash2, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';

const date = (value) => (value ? value.split('-').reverse().join('.') : '—');
const text = (value) => (value === null || value === undefined || String(value).trim() === '' ? '—' : value);

export default function Show({ hiring, history = [], options, abilities }) {
    const e = hiring.employee;
    const h = hiring.hiring;
    const c = hiring.contract;
    const fullName = e.full_name || 'Без имени';
    const label = (list, value) => options[list]?.find((item) => String(item.value) === String(value))?.label;
    const marital = options.marital.find((item) => item.value === e.marital_status);
    const [signing, setSigning] = useState(null);
    const [executor, setExecutor] = useState(hiring.documents.contract?.[0]?.oup_executor ?? '');
    const [generating, setGenerating] = useState(null);

    const generate = (type) => {
        setGenerating(type);
        router.post(route('hr.hiring.documents.generate', [hiring.id, type]), type === 'contract' && executor ? { executor } : {}, {
            preserveScroll: true,
            onFinish: () => setGenerating(null),
        });
    };

    const [busy, setBusy] = useState(false);

    const remove = () => {
        if (!busy && window.confirm('Удалить черновик приёма? Сформированные документы, фото и сканы удалятся сразу.')) {
            setBusy(true);
            router.delete(route('hr.hiring.destroy', hiring.id), { onFinish: () => setBusy(false) });
        }
    };

    const rehire = () => {
        if (!busy && window.confirm(`Оформить новый приём для «${fullName}»? Личные данные возьмутся из этого приёма.`)) {
            setBusy(true);
            router.post(route('hr.hiring.rehire', hiring.id), {}, { onFinish: () => setBusy(false) });
        }
    };

    return (
        <AuthenticatedLayout
            header={(
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div className="space-y-1">
                        <p className="text-sm font-medium uppercase tracking-[0.2em] text-teal-700">Отдел кадров · Приём на работу · #{hiring.id}</p>
                        <h2 className="flex flex-wrap items-center gap-3 text-2xl font-semibold text-slate-900">
                            {fullName}
                            <StatusBadge status={hiring.status} label={hiring.status_label} />
                        </h2>
                        <p className="text-sm text-slate-600">{[h.position?.name_ru, h.sub_unit?.name_ru, h.top_unit?.name_ru].filter(Boolean).join(' · ') || 'Должность не указана'}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Link href={route('hr.hiring.index')} className={buttonClassName.secondary}>К списку</Link>
                        <button type="button" onClick={rehire} disabled={busy} className={buttonClassName.secondary}>
                            <UserPlus className="h-4 w-4" /> Новый приём этого сотрудника
                        </button>
                        {hiring.status === 'draft' && (
                            <button type="button" onClick={remove} disabled={busy} className={`${buttonClassName.danger} disabled:opacity-60`}><Trash2 className="h-4 w-4" /> Удалить черновик</button>
                        )}
                        <Link href={route('hr.hiring.edit', hiring.id)} className={buttonClassName.primary}><Pencil className="h-4 w-4" /> Редактировать</Link>
                    </div>
                </div>
            )}
        >
            <Head title={`${fullName} — приём на работу`} />
            <div className="grid w-full gap-6 px-4 py-6 sm:px-6 lg:px-8 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <div className="space-y-6">
                    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="flex gap-5">
                            <div className="flex h-32 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-400">
                                {e.photo_url ? <img src={e.photo_url} alt="Фото сотрудника" className="h-full w-full object-cover" /> : 'Фото 3×4'}
                            </div>
                            <dl className="grid flex-1 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[9rem_1fr]">
                                <dt className="text-slate-500">ИИН</dt><dd className="font-mono">{text(e.iin)}</dd>
                                <dt className="text-slate-500">Дата рождения</dt><dd>{date(e.birth_date)}{e.gender && `, ${e.gender === 'm' ? 'мужской' : 'женский'}`}</dd>
                                <dt className="text-slate-500">Удостоверение</dt><dd>{e.id_card_number ? `№${e.id_card_number} от ${date(e.id_card_issued_at)}, ${label('issuers', e.id_card_issuer ?? 'mvd')}` : '—'}</dd>
                                <dt className="text-slate-500">Адрес</dt><dd>{[e.city && `г. ${e.city}`, e.street, e.house && `д. ${e.house}`, e.apartment && `кв. ${e.apartment}`].filter(Boolean).join(', ') || '—'}</dd>
                                <dt className="text-slate-500">Телефон</dt><dd>{text(e.phone)}</dd>
                                <dt className="text-slate-500">Семья</dt><dd>{marital ? (e.gender === 'f' ? marital.female : marital.male) : '—'}{e.children?.length ? `, детей: ${e.children.length}` : ''}</dd>
                                <dt className="text-slate-500">Воинский учёт</dt><dd>{text(label('military', e.military_status))}</dd>
                                {abilities.sensitive && (
                                    <>
                                        <dt className="text-slate-500">Соцстатус</dt>
                                        <dd>{[e.is_pensioner && 'пенсионер', e.disability && e.disability !== 'none' && label('disabilities', e.disability), e.is_student && 'обучающийся', e.is_large_family && 'многодетная семья'].filter(Boolean).join(', ') || 'нет'}</dd>
                                    </>
                                )}
                            </dl>
                        </div>
                    </section>

                    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                        <h3 className="mb-3 text-base font-semibold text-slate-900">Назначение и условия</h3>
                        <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[11rem_1fr]">
                            <dt className="text-slate-500">Категория</dt><dd>{text(options.categories.find((item) => item.value === h.staff_category)?.name)}</dd>
                            <dt className="text-slate-500">Дата приёма</dt><dd>{date(h.start_date)}</dd>
                            <dt className="text-slate-500">Испытательный срок</dt><dd>{label('probation', h.probation_months ?? 0)}</dd>
                            {c.term === 'replacement' && (<><dt className="text-slate-500">Замещаемый</dt><dd>{text(h.replaces?.full_name)}</dd></>)}
                            <dt className="text-slate-500">Договор</dt><dd>{c.number ? `№${c.number} от ${date(c.date)}` : '—'}, {text(label('terms', c.term))}</dd>
                            <dt className="text-slate-500">Приказ</dt><dd>{h.order_number ? `№${h.order_number} от ${date(h.order_date)}` : '—'}</dd>
                            <dt className="text-slate-500">Оклад</dt><dd>{c.salary ? `${formatMoney(c.salary)} ₸` : '—'}</dd>
                            <dt className="text-slate-500">Отпуск, график</dt><dd>{c.vacation_days ? `${c.vacation_days} дн.` : '—'}, {text(label('schedules', c.schedule))}</dd>
                            <dt className="text-slate-500">Вид работы</dt><dd>{label('employments', c.employment ?? 'main')}</dd>
                        </dl>
                    </section>

                    <AttachmentsCard hiring={hiring} abilities={abilities} />

                    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                        <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900"><History className="h-4 w-4" /> История действий</h3>
                        {history.length === 0 ? <p className="text-sm text-slate-500">Пока пусто.</p> : (
                            <ol className="max-h-96 space-y-2 overflow-y-auto pr-1 text-sm">
                                {history.map((item, index) => (
                                    <li key={index} className="flex gap-3">
                                        <span className="w-28 shrink-0 font-mono text-xs text-slate-400">{item.at}</span>
                                        <span className="min-w-0"><span className="text-slate-800">{item.description}</span> <span className="text-xs text-slate-500">— {item.actor}</span></span>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </section>
                </div>

                <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className="text-base font-semibold text-slate-900">Документы</h3>
                        <Link href={route('hr.hiring.edit', hiring.id)} className={buttonClassName.ghost}><FilePenLine className="h-4 w-4" /> Предпросмотр в мастере</Link>
                    </div>
                    {[...new Set(DOCUMENT_TYPES.flatMap((type) => hiring.checks?.[type.value]?.warnings ?? []))].map((warning) => (
                        <Notice key={warning} tone="warning" icon={CircleAlert}>{warning}</Notice>
                    ))}
                    {DOCUMENT_TYPES.map((type) => {
                        const versions = hiring.documents[type.value] ?? [];
                        const missing = hiring.checks?.[type.value]?.missing ?? [];
                        return (
                            <div key={type.value} className="space-y-3 rounded-2xl border border-slate-200 p-4">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <h4 className="font-medium text-slate-900">{type.label}</h4>
                                    <div className="flex flex-wrap items-center gap-2">
                                        {type.value === 'contract' && (
                                            <input
                                                value={executor}
                                                onChange={(event) => setExecutor(event.target.value)}
                                                placeholder="Исполнитель ОУП (по умолчанию — вы)"
                                                title="Подпись исполнителя ОУП в разделе 11 договора"
                                                className={`${inputClassName} w-56 py-1.5`}
                                            />
                                        )}
                                        <button type="button" disabled={generating !== null} onClick={() => generate(type.value)} className={buttonClassName.secondary}>
                                            {generating === type.value ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileSignature className="h-4 w-4" />}
                                            {versions.length ? 'Новая версия' : 'Сформировать'}
                                        </button>
                                    </div>
                                </div>
                                {missing.length > 0 && (
                                    <Notice tone="warning">Не хватает: {missing.map((item) => item.label).join(', ')}.</Notice>
                                )}
                                {versions.length === 0 ? <p className="text-sm text-slate-500">Документ ещё не формировался.</p> : (
                                    <ul className="divide-y divide-slate-100 text-sm">
                                        {versions.map((doc) => (
                                            <li key={doc.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                                                <span className="min-w-0">
                                                    <span className="font-medium text-slate-800">v{doc.version}</span>
                                                    <span className="ml-2 text-xs text-slate-500">
                                                        {doc.generated_at} · {doc.generated_by ?? '—'} · шаблон v{doc.template_version}
                                                        {doc.missing_count > 0 && ` · пустых полей: ${doc.missing_count}`}
                                                        {doc.signed_at && ` · подписан ${doc.signed_at}`}
                                                    </span>
                                                </span>
                                                <span className="flex flex-wrap items-center gap-2">
                                                    <DocumentStatusBadge status={doc.status} />
                                                    <a href={doc.download_url} className={buttonClassName.ghost}><Download className="h-4 w-4" />.docx</a>
                                                    {doc.scan_url && <a href={doc.scan_url} target="_blank" rel="noreferrer" className={buttonClassName.ghost}><ScanLine className="h-4 w-4" />скан</a>}
                                                    {doc.status !== 'signed' && (
                                                        <button type="button" onClick={() => setSigning({ ...doc, type: type.label })} className={buttonClassName.ghost}>Отметить подписанным</button>
                                                    )}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        );
                    })}
                    <p className="text-xs text-slate-500">
                        Каждое формирование — новая версия; подписанные версии не меняются. Скачать можно и неполный документ — пустые места будут «__________».
                    </p>
                </section>
            </div>

            <SignDialog hiringId={hiring.id} document={signing} onClose={() => setSigning(null)} />
        </AuthenticatedLayout>
    );
}

function SignDialog({ hiringId, document, onClose }) {
    const form = useForm({ scan: null });

    // Every document starts with an empty file: a scan picked for one version and cancelled must not go to another.
    useEffect(() => {
        form.reset();
        form.clearErrors();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [document?.id]);

    const submit = (event) => {
        event.preventDefault();
        form.post(route('hr.hiring.documents.sign', [hiringId, document.id]), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                onClose();
            },
        });
    };

    return (
        <Dialog open={document !== null} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="bg-white">
                {document && (
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>{document.type}, версия {document.version}: подписан</DialogTitle>
                            <DialogDescription>Приложите скан подписанного экземпляра (PDF, JPG или PNG). После этого версия становится окончательной.</DialogDescription>
                        </DialogHeader>
                        <input type="file" accept="application/pdf,image/png,image/jpeg" onChange={(event) => form.setData('scan', event.target.files?.[0] ?? null)} className="block w-full text-sm" />
                        {form.errors.scan && <p className="text-sm text-rose-600">{form.errors.scan}</p>}
                        <DialogFooter>
                            <button type="button" onClick={onClose} className={buttonClassName.secondary}>Отмена</button>
                            <button type="submit" disabled={!form.data.scan || form.processing} className={buttonClassName.primary}>
                                {form.processing && <LoaderCircle className="h-4 w-4 animate-spin" />} Отметить подписанным
                            </button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}

function AttachmentsCard({ hiring, abilities }) {
    const attachments = hiring.employee.attachments ?? [];

    return (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900"><Paperclip className="h-4 w-4" /> Документы PDF личного дела</h3>
            {attachments.length === 0 ? <p className="text-sm text-slate-500">Не прикреплены. Добавить можно в мастере, шаг «Сотрудник».</p> : (
                <ul className="divide-y divide-slate-100 text-sm">
                    {attachments.map((attachment) => (
                        <li key={attachment.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                            <span className="min-w-0">
                                <span className="block text-slate-800">{attachment.doc_type_label}</span>
                                <span className="block truncate text-xs text-slate-500">{attachment.original_name} · {formatBytes(attachment.size)} · {attachment.uploaded_at}</span>
                            </span>
                            {abilities.sensitive
                                ? <a href={attachment.url} target="_blank" rel="noreferrer" className={buttonClassName.ghost}>Открыть</a>
                                : <span className="text-xs text-slate-400">просмотр — по отдельному праву</span>}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
