import axios from 'axios';
import { Download, Eye, FileCheck2, FileText, LoaderCircle, RefreshCw, Settings2, TriangleAlert } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { DOCUMENT_TYPES } from './logic';
import { buttonClassName, DocumentStatusBadge } from './ui';

const POLL_MS = 1500;
const POLL_LIMIT = 80;
const AUTO_DELAY_MS = 2500;

/**
 * Right-hand panel of the wizard: the three documents with what each still needs (click → the field) and a
 * .docx button each; under them the PDF preview of the selected document (LibreOffice in the queue; by the
 * button or a short delay after the data was saved).
 */
export default function PreviewPanel({
    hiringId,
    docType,
    onDocTypeChange,
    missingByType,
    warnings,
    onMissingClick,
    previewAvailable,
    flushSave,
    savedVersion,
    documents,
    onDocumentsChange,
}) {
    const [preview, setPreview] = useState({ status: 'idle' });
    const [auto, setAuto] = useState(true);
    const [generating, setGenerating] = useState(null);
    const runRef = useRef(0);
    const selected = DOCUMENT_TYPES.find((type) => type.value === docType);

    const refresh = useCallback(async () => {
        if (!previewAvailable) {
            return;
        }
        const run = ++runRef.current;
        setPreview((current) => ({ ...current, status: 'pending', error: null }));
        try {
            await flushSave();
            let { data } = await axios.post(route('hr.hiring.previews.store', [hiringId, docType]));
            let item = data.preview;
            for (let i = 0; item.status === 'pending' && i < POLL_LIMIT; i++) {
                await new Promise((resolve) => window.setTimeout(resolve, POLL_MS));
                if (run !== runRef.current) {
                    return;
                }
                ({ data } = await axios.get(item.status_url));
                item = data.preview;
            }
            if (run !== runRef.current) {
                return;
            }
            setPreview(item.status === 'ready'
                ? { status: 'ready', url: `${item.pdf_url}#toolbar=1&view=FitH` }
                : { status: item.status === 'pending' ? 'failed' : item.status, error: item.error ?? 'Предпросмотр не построен.' });
        } catch (error) {
            if (run === runRef.current) {
                setPreview({ status: 'failed', error: error?.response?.data?.message ?? 'Не удалось построить предпросмотр. Проверьте ошибки в форме.' });
            }
        }
    }, [hiringId, docType, flushSave, previewAvailable]);

    useEffect(() => {
        setPreview({ status: 'idle' });
        runRef.current++;
    }, [docType]);

    useEffect(() => {
        if (!auto || !previewAvailable || savedVersion === 0) {
            return undefined;
        }
        const timer = window.setTimeout(refresh, AUTO_DELAY_MS);
        return () => window.clearTimeout(timer);
    }, [savedVersion, docType, auto, previewAvailable, refresh]);

    const generate = async (type) => {
        setGenerating(type);
        try {
            await flushSave();
            const { data } = await axios.post(route('hr.hiring.documents.generate', [hiringId, type]));
            onDocumentsChange(data.documents);
            toast.success(`Сформирована версия ${data.document.version}.`);
            window.location.href = data.document.download_url;
        } catch (error) {
            toast.error(error?.response?.data?.message ?? 'Не удалось сформировать документ. Проверьте ошибки в форме.');
        } finally {
            setGenerating(null);
        }
    };

    return (
        <aside className="space-y-4 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto xl:pb-1">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <header className="mb-3">
                    <h3 className="text-base font-semibold text-slate-900">Документы</h3>
                    <p className="mt-0.5 text-sm text-slate-500">Собираются из данных формы. Скачать можно в любой момент — пустые места останутся «__________».</p>
                </header>

                <ul className="space-y-2">
                    {DOCUMENT_TYPES.map((type) => {
                        const missing = missingByType[type.value] ?? [];
                        const latest = documents?.[type.value]?.[0] ?? null;
                        const isSelected = docType === type.value;
                        const ready = missing.length === 0;
                        return (
                            <li key={type.value} className={`rounded-xl border transition ${isSelected ? 'border-teal-300 bg-teal-50/30' : 'border-slate-200'}`}>
                                <div className="flex items-center gap-3 p-3">
                                    <button
                                        type="button"
                                        aria-pressed={isSelected}
                                        onClick={() => onDocTypeChange(type.value)}
                                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                                    >
                                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${ready ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                            {ready ? <FileCheck2 className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                                        </span>
                                        <span className="min-w-0">
                                            <span className="block font-medium text-slate-900">{type.label}</span>
                                            <span className={`block text-xs ${ready ? 'text-emerald-700' : 'text-amber-800'}`}>
                                                {ready ? 'Все данные заполнены' : `Не хватает данных: ${missing.length}`}
                                            </span>
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => generate(type.value)}
                                        disabled={generating !== null}
                                        title={`Сформировать и скачать: ${type.label}`}
                                        className={`${buttonClassName.secondary} shrink-0 px-3`}
                                    >
                                        {generating === type.value ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                        .docx
                                    </button>
                                </div>

                                {isSelected && (missing.length > 0 || warnings.length > 0 || latest) && (
                                    <div className="space-y-3 border-t border-slate-200/70 px-3 py-3">
                                        {missing.length > 0 && (
                                            <div>
                                                <p className="mb-1.5 text-xs font-medium text-slate-600">Чего не хватает — нажмите, чтобы перейти к полю:</p>
                                                <ul className="flex flex-wrap gap-1.5">
                                                    {missing.map((item) => (
                                                        <li key={item.field}>
                                                            {item.step === 0 ? (
                                                                <a href={route('hr.hiring.settings.index', { tab: 'employer' })} className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-white px-2.5 py-1 text-xs text-amber-900 hover:bg-amber-50">
                                                                    <Settings2 className="h-3 w-3" />{item.label}
                                                                </a>
                                                            ) : (
                                                                <button type="button" onClick={() => onMissingClick(item)} className="rounded-full border border-amber-300 bg-white px-2.5 py-1 text-xs text-amber-900 hover:bg-amber-50">
                                                                    {item.label}
                                                                </button>
                                                            )}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {warnings.length > 0 && (
                                            <div className="rounded-lg bg-amber-50/70 px-3 py-2">
                                                <p className="mb-1 text-xs font-medium text-amber-900">Проверьте перед печатью</p>
                                                <ul className="space-y-1">
                                                    {warnings.map((warning) => (
                                                        <li key={warning} className="flex items-start gap-1.5 text-xs text-amber-900">
                                                            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />{warning}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {latest && (
                                            <p className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                                Последняя версия: v{latest.version} от {latest.generated_at}
                                                <DocumentStatusBadge status={latest.status} />
                                                <a href={latest.download_url} className="font-medium text-teal-700 hover:underline">скачать</a>
                                            </p>
                                        )}
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            </section>

            {previewAvailable ? (
                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                        <div>
                            <h3 className="text-sm font-semibold text-slate-900">Предпросмотр: {selected?.label}</h3>
                            <label className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                                <input type="checkbox" checked={auto} onChange={(event) => setAuto(event.target.checked)} className="rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
                                обновлять после изменений
                            </label>
                        </div>
                        {preview.status !== 'idle' && (
                            <button type="button" onClick={refresh} disabled={preview.status === 'pending'} className={`${buttonClassName.secondary} px-3`}>
                                <RefreshCw className={`h-4 w-4 ${preview.status === 'pending' ? 'animate-spin' : ''}`} />
                                Обновить
                            </button>
                        )}
                    </header>
                    <div className="bg-slate-100">
                        {preview.status === 'idle' && (
                            <div className="px-4 py-12 text-center">
                                <p className="text-sm text-slate-600">Посмотрите документ перед печатью — он соберётся в PDF.</p>
                                <button type="button" onClick={refresh} className={`${buttonClassName.primary} mt-4`}>
                                    <Eye className="h-4 w-4" /> Показать предпросмотр
                                </button>
                            </div>
                        )}
                        {preview.status === 'pending' && (
                            <div className="flex flex-col items-center justify-center gap-1 px-4 py-14 text-sm text-slate-500">
                                <span className="flex items-center gap-2"><LoaderCircle className="h-4 w-4 animate-spin" /> Собираем PDF…</span>
                                <span className="text-xs text-slate-400">Обычно это занимает до минуты.</span>
                            </div>
                        )}
                        {(preview.status === 'failed' || preview.status === 'unavailable') && (
                            <div className="px-4 py-12 text-center text-sm text-rose-700">{preview.error}</div>
                        )}
                        {preview.status === 'ready' && (
                            <iframe title="Предпросмотр документа" src={preview.url} className="h-[70vh] w-full bg-white" />
                        )}
                    </div>
                </section>
            ) : (
                <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    Предпросмотр недоступен: на сервере не настроен LibreOffice. Скачивание .docx работает.
                </p>
            )}
        </aside>
    );
}
