import axios from 'axios';
import { CircleAlert, Download, FileText, LoaderCircle, RefreshCw, Settings2, TriangleAlert } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { DOCUMENT_TYPES } from './logic';
import { buttonClassName, DocumentStatusBadge } from './ui';

const POLL_MS = 1500;
const POLL_LIMIT = 80;
const AUTO_DELAY_MS = 2500;

/**
 * Right-hand panel of the wizard: document tabs, what is missing (click → the field), warnings, the PDF
 * preview (LibreOffice in the queue; by the button or a short delay after the data was saved) and the .docx.
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
    const [generating, setGenerating] = useState(false);
    const runRef = useRef(0);
    const missing = missingByType[docType] ?? [];
    const latest = documents?.[docType]?.[0] ?? null;

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

    const generate = async () => {
        setGenerating(true);
        try {
            await flushSave();
            const { data } = await axios.post(route('hr.hiring.documents.generate', [hiringId, docType]));
            onDocumentsChange(data.documents);
            toast.success(`Сформирована версия ${data.document.version}.`);
            window.location.href = data.document.download_url;
        } catch (error) {
            toast.error(error?.response?.data?.message ?? 'Не удалось сформировать документ. Проверьте ошибки в форме.');
        } finally {
            setGenerating(false);
        }
    };

    return (
        <aside className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 xl:sticky xl:top-4">
            <div role="tablist" className="grid grid-cols-3 gap-1 rounded-2xl bg-slate-100 p-1">
                {DOCUMENT_TYPES.map((type) => {
                    const count = (missingByType[type.value] ?? []).length;
                    return (
                        <button
                            key={type.value}
                            type="button"
                            role="tab"
                            aria-selected={docType === type.value}
                            onClick={() => onDocTypeChange(type.value)}
                            className={`flex items-center justify-center gap-1.5 rounded-xl px-2 py-1.5 text-xs font-medium transition sm:text-sm ${docType === type.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            {type.short}
                            {count > 0 && <span className="rounded-full bg-amber-100 px-1.5 text-[11px] text-amber-800">{count}</span>}
                        </button>
                    );
                })}
            </div>

            {missing.length > 0 ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3">
                    <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-amber-900">
                        <CircleAlert className="h-4 w-4" />
                        Не хватает: {missing.length}. Документ можно скачать — пустые места будут «__________».
                    </p>
                    <ul className="flex flex-wrap gap-1.5">
                        {missing.map((item) => (
                            <li key={item.field}>
                                {item.step === 0 ? (
                                    <a href={route('hr.hiring.settings.index', { tab: 'employer' })} className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-white px-2 py-0.5 text-xs text-amber-900 hover:bg-amber-100">
                                        <Settings2 className="h-3 w-3" />{item.label}
                                    </a>
                                ) : (
                                    <button type="button" onClick={() => onMissingClick(item)} className="rounded-full border border-amber-300 bg-white px-2 py-0.5 text-xs text-amber-900 hover:bg-amber-100">
                                        {item.label}
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            ) : (
                <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Все данные для документа заполнены.</p>
            )}

            {warnings.length > 0 && (
                <ul className="space-y-1">
                    {warnings.map((warning) => (
                        <li key={warning} className="flex items-start gap-1.5 text-xs text-amber-800">
                            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />{warning}
                        </li>
                    ))}
                </ul>
            )}

            <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={generate} disabled={generating} className={buttonClassName.primary}>
                    {generating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    Сформировать .docx
                </button>
                {previewAvailable && (
                    <>
                        <button type="button" onClick={refresh} disabled={preview.status === 'pending'} className={buttonClassName.secondary}>
                            <RefreshCw className={`h-4 w-4 ${preview.status === 'pending' ? 'animate-spin' : ''}`} />
                            Обновить предпросмотр
                        </button>
                        <label className="flex items-center gap-1.5 text-xs text-slate-600">
                            <input type="checkbox" checked={auto} onChange={(event) => setAuto(event.target.checked)} className="rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
                            автоматически
                        </label>
                    </>
                )}
            </div>

            {latest && (
                <p className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <FileText className="h-3.5 w-3.5" />
                    Последняя версия: v{latest.version} от {latest.generated_at}
                    <DocumentStatusBadge status={latest.status} />
                    <a href={latest.download_url} className="font-medium text-teal-700 hover:underline">скачать</a>
                </p>
            )}

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                {!previewAvailable && (
                    <div className="px-4 py-16 text-center text-sm text-slate-600">
                        Предпросмотр недоступен: на сервере не установлен LibreOffice.
                        <br />Скачивание .docx работает.
                    </div>
                )}
                {previewAvailable && preview.status === 'idle' && (
                    <div className="px-4 py-16 text-center text-sm text-slate-500">Нажмите «Обновить предпросмотр» — документ появится здесь в PDF.</div>
                )}
                {previewAvailable && preview.status === 'pending' && (
                    <div className="flex items-center justify-center gap-2 px-4 py-16 text-sm text-slate-500">
                        <LoaderCircle className="h-4 w-4 animate-spin" /> Собираем PDF…
                    </div>
                )}
                {previewAvailable && (preview.status === 'failed' || preview.status === 'unavailable') && (
                    <div className="px-4 py-16 text-center text-sm text-rose-700">{preview.error}</div>
                )}
                {preview.status === 'ready' && (
                    <iframe title="Предпросмотр документа" src={preview.url} className="h-[75vh] w-full bg-white" />
                )}
            </div>
        </aside>
    );
}
