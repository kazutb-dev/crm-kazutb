import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DOCUMENT_TYPES, formatMoney } from '@/components/hr-hiring/logic';
import { buttonClassName, DocumentStatusBadge, formatBytes, inputClassName, Notice, StatusBadge } from '@/components/hr-hiring/ui';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { BriefcaseBusiness, CircleAlert, Download, FilePenLine, FileSignature, History, IdCard, LoaderCircle, Paperclip, Pencil, ScanLine, Trash2, UserPlus } from 'lucide-react';
import { PageHeader } from '@/components/platform';
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
                <PageHeader
                    eyebrow={`Отдел кадров · Приём на работу · #${hiring.id}`}
                    title={fullName}
                    description={[h.position?.name_ru, h.sub_unit?.name_ru, h.top_unit?.name_ru].filter(Boolean).join(' · ') || 'Должность не указана'}
                    meta={<StatusBadge status={hiring.status} label={hiring.status_label} />}
                    actions={(
                        <>
                            <Link href={route('hr.hiring.index')} className={buttonClassName.secondary}>К списку</Link>
                            <button type="button" onClick={rehire} disabled={busy} className={buttonClassName.secondary}>
                                <UserPlus className="h-4 w-4" /> Новый приём этого сотрудника
                            </button>
                            {hiring.status === 'draft' && (
                                <button type="button" onClick={remove} disabled={busy} className={`${buttonClassName.danger} disabled:opacity-60`}><Trash2 className="h-4 w-4" /> Удалить черновик</button>
                            )}
                            <Link href={route('hr.hiring.edit', hiring.id)} className={buttonClassName.primary}><Pencil className="h-4 w-4" /> Редактировать</Link>
                        </>
                    )}
                />
            )}
        >
            <Head title={`${fullName} — приём на работу`} />
            <div className="admin-page-wrap grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <div className="space-y-6">
                    <Panel icon={IdCard} title="Сотрудник">
                        <div className="flex flex-col gap-5 sm:flex-row">
                            <div className="flex h-32 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-400">
                                {e.photo_url ? <img src={e.photo_url} alt="Фото сотрудника" className="h-full w-full object-cover" /> : 'Фото 3×4'}
                            </div>
                            <dl className="grid flex-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                                <Info label="ИИН" mono>{text(e.iin)}</Info>
                                <Info label="Дата рождения">{date(e.birth_date)}{e.gender && `, ${e.gender === 'm' ? 'мужской' : 'женский'}`}</Info>
                                <Info label="Удостоверение" wide>{e.id_card_number ? `№${e.id_card_number} от ${date(e.id_card_issued_at)}, ${label('issuers', e.id_card_issuer ?? 'mvd')}` : '—'}</Info>
                                <Info label="Адрес" wide>{[e.city && `г. ${e.city}`, e.street, e.house && `д. ${e.house}`, e.apartment && `кв. ${e.apartment}`].filter(Boolean).join(', ') || '—'}</Info>
                                <Info label="Телефон">{text(e.phone)}</Info>
                                <Info label="Семья">{marital ? (e.gender === 'f' ? marital.female : marital.male) : '—'}{e.children?.length ? `, детей: ${e.children.length}` : ''}</Info>
                                <Info label="Воинский учёт">{text(label('military', e.military_status))}</Info>
                                {abilities.sensitive && (
                                    <Info label="Соцстатус">{[e.is_pensioner && 'пенсионер', e.disability && e.disability !== 'none' && label('disabilities', e.disability), e.is_student && 'обучающийся', e.is_large_family && 'многодетная семья'].filter(Boolean).join(', ') || 'нет'}</Info>
                                )}
                            </dl>
                        </div>
                    </Panel>

                    <Panel icon={BriefcaseBusiness} title="Назначение и условия">
                        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                            <Info label="Категория" wide>{text(options.categories.find((item) => item.value === h.staff_category)?.name)}</Info>
                            <Info label="Дата приёма">{date(h.start_date)}</Info>
                            <Info label="Испытательный срок">{label('probation', h.probation_months ?? 0)}</Info>
                            {c.term === 'replacement' && <Info label="Замещаемый" wide>{text(h.replaces?.full_name)}</Info>}
                            <Info label="Договор">{c.number ? `№${c.number} от ${date(c.date)}` : '—'}, {text(label('terms', c.term))}</Info>
                            <Info label="Приказ">{h.order_number ? `№${h.order_number} от ${date(h.order_date)}` : '—'}</Info>
                            <Info label="Оклад" mono>{c.salary ? `${formatMoney(c.salary)} ₸` : '—'}</Info>
                            <Info label="Отпуск, график">{c.vacation_days ? `${c.vacation_days} дн.` : '—'}, {text(label('schedules', c.schedule))}</Info>
                            <Info label="Вид работы">{label('employments', c.employment ?? 'main')}</Info>
                        </dl>
                    </Panel>

                    <AttachmentsCard hiring={hiring} abilities={abilities} />

                    <Panel icon={History} title="История действий">
                        {history.length === 0 ? <p className="text-sm text-slate-500">Пока пусто.</p> : (
                            <ol className="max-h-96 overflow-y-auto pr-1 text-sm">
                                {history.map((item, index) => (
                                    <li key={index} className="flex items-start gap-3 border-b border-slate-200 py-2.5 last:border-0">
                                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-teal-500" />
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-slate-800">{item.description}</span>
                                            <span className="mt-0.5 block text-xs text-slate-500"><span className="font-mono tabular-nums">{item.at}</span> · {item.actor}</span>
                                        </span>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </Panel>
                </div>

                <Panel
                    icon={FileSignature}
                    title="Документы"
                    action={<Link href={route('hr.hiring.edit', hiring.id)} className={buttonClassName.ghost}><FilePenLine className="h-4 w-4" /> Предпросмотр в мастере</Link>}
                >
                    <div className="space-y-4">
                    {[...new Set(DOCUMENT_TYPES.flatMap((type) => hiring.checks?.[type.value]?.warnings ?? []))].map((warning) => (
                        <Notice key={warning} tone="warning" icon={CircleAlert}>{warning}</Notice>
                    ))}
                    {DOCUMENT_TYPES.map((type) => {
                        const versions = hiring.documents[type.value] ?? [];
                        const missing = hiring.checks?.[type.value]?.missing ?? [];
                        return (
                            <div key={type.value} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <h4 className="font-display text-base font-bold text-[#102945]">{type.label}</h4>
                                    <div className="flex flex-wrap items-center gap-2">
                                        {type.value === 'contract' && (
                                            <input
                                                value={executor}
                                                onChange={(event) => setExecutor(event.target.value)}
                                                placeholder="Исполнитель ОУП (по умолчанию — вы)"
                                                title="Подпись исполнителя ОУП в разделе 11 договора"
                                                className={`${inputClassName} w-56`}
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
                                    <ul className="divide-y divide-slate-200 border-t border-slate-200 text-sm">
                                        {versions.map((doc) => (
                                            <li key={doc.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                                                <span className="flex min-w-0 items-baseline gap-2">
                                                    <span className="inline-flex h-6 min-w-8 items-center justify-center rounded-full bg-slate-100 px-2 text-xs font-bold tabular-nums text-[#102945]">v{doc.version}</span>
                                                    <span className="text-xs text-slate-500">
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
                    <p className="border-t border-slate-200 pt-3 text-xs text-slate-500">
                        Каждое формирование — новая версия; подписанные версии не меняются. Скачать можно и неполный документ — пустые места будут «__________».
                    </p>
                    </div>
                </Panel>
            </div>

            <SignDialog hiringId={hiring.id} document={signing} onClose={() => setSigning(null)} />
        </AuthenticatedLayout>
    );
}

/** Qadam card: a raised strip with the title in spaced capitals, then the body. */
function Panel({ icon: Icon, title, action = null, children }) {
    return (
        <section className="overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-[0_1px_2px_0_rgba(25,28,29,0.04)]">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-5 py-3 sm:px-6">
                <h3 className="flex items-center gap-2 text-[0.75rem] font-bold uppercase tracking-[0.1em] text-[#102945]">
                    {Icon && <Icon className="h-4 w-4 text-teal-700" />}
                    {title}
                </h3>
                {action}
            </header>
            <div className="p-5 sm:p-6">{children}</div>
        </section>
    );
}

/** Read-only value: label in spaced capitals over the value, separated by a rule. */
function Info({ label, mono = false, wide = false, children }) {
    return (
        <div className={`flex flex-col gap-1 border-b border-slate-200 pb-3 ${wide ? 'sm:col-span-2' : ''}`}>
            <dt className="qd-field-label text-slate-500">{label}</dt>
            <dd className={`text-[0.9375rem] font-medium text-slate-900 ${mono ? 'font-mono text-sm' : ''}`}>{children}</dd>
        </div>
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
                        <input type="file" accept="application/pdf,image/png,image/jpeg" onChange={(event) => form.setData('scan', event.target.files?.[0] ?? null)} className="block w-full rounded-[10px] border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-700 file:mr-3 file:rounded-[8px] file:border-0 file:bg-teal-700 file:px-3 file:py-1.5 file:text-xs file:font-bold file:uppercase file:tracking-[0.08em] file:text-white hover:file:bg-[#102945]" />
                        {form.errors.scan && <p className="text-sm text-red-700">{form.errors.scan}</p>}
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
        <Panel icon={Paperclip} title="Документы PDF личного дела">
            {attachments.length === 0 ? <p className="text-sm text-slate-500">Не прикреплены. Добавить можно в мастере, шаг «Сотрудник».</p> : (
                <ul className="divide-y divide-slate-200 text-sm">
                    {attachments.map((attachment) => (
                        <li key={attachment.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                            <span className="min-w-0">
                                <span className="block font-medium text-slate-900">{attachment.doc_type_label}</span>
                                <span className="block truncate text-xs text-slate-500">{attachment.original_name} · {formatBytes(attachment.size)} · {attachment.uploaded_at}</span>
                            </span>
                            {abilities.sensitive
                                ? <a href={attachment.url} target="_blank" rel="noreferrer" className={buttonClassName.ghost}>Открыть</a>
                                : <span className="text-xs text-slate-500">просмотр — по отдельному праву</span>}
                        </li>
                    ))}
                </ul>
            )}
        </Panel>
    );
}
