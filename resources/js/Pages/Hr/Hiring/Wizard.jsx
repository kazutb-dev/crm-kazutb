import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import PreviewPanel from '@/components/hr-hiring/PreviewPanel';
import StepAppointment from '@/components/hr-hiring/StepAppointment';
import StepContract from '@/components/hr-hiring/StepContract';
import StepEmployee from '@/components/hr-hiring/StepEmployee';
import { fieldElementId, fieldId, fullNameAccusative, missingFields, parseIin } from '@/components/hr-hiring/logic';
import { buttonClassName, MissingFieldsContext, StatusBadge, validationErrors } from '@/components/hr-hiring/ui';
import { Head, Link, router } from '@inertiajs/react';
import axios from 'axios';
import { ArrowLeft, ArrowRight, Check, CircleAlert, FlaskConical, FolderOpen, LoaderCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const SAVE_DELAY_MS = 1200;

const STEPS = [
    { value: 1, label: 'Сотрудник', hint: 'Кто принимается на работу: личные данные, удостоверение, адрес, семья, образование.' },
    { value: 2, label: 'Назначение', hint: 'На какую должность и в какое подразделение, с какой даты, номер приказа.' },
    { value: 3, label: 'Условия договора', hint: 'Номер и срок договора, оклад, отпуск и режим работы.' },
];

const blank = (value) => String(value ?? '').trim() === '';

const EMPLOYEE_KEYS = [
    'last_name', 'first_name', 'middle_name', 'iin', 'birth_date', 'gender', 'citizenship', 'citizenship_ru', 'citizenship_kz',
    'id_card_number', 'id_card_issued_at', 'id_card_issuer', 'city', 'street', 'house', 'apartment', 'phone',
    'marital_status', 'military_status', 'is_pensioner', 'disability', 'is_student', 'is_large_family',
];
const SENSITIVE_KEYS = ['is_pensioner', 'disability', 'is_student', 'is_large_family'];

function toState(hiring) {
    const employee = Object.fromEntries(EMPLOYEE_KEYS.map((key) => [key, hiring.employee[key] ?? (key === 'citizenship' ? 'kz' : null)]));
    employee.children = hiring.employee.children ?? [];
    employee.educations = hiring.employee.educations ?? [];

    return {
        employee,
        hiring: { ...hiring.hiring },
        contract: { ...hiring.contract },
    };
}

function setIn(object, path, value) {
    const [head, ...rest] = path.split('.');
    return { ...object, [head]: rest.length === 0 ? value : setIn(object[head] ?? {}, rest.join('.'), value) };
}

const getIn = (object, path) => path.split('.').reduce((current, key) => current?.[key], object);

/** One change plus the field links of the prototype (IIN → birth date and gender, category → defaults, …). */
function applyChange(previous, path, value, categories) {
    let next = setIn(previous, path, value);
    const e = next.employee;

    if (path === 'employee.iin') {
        const iin = parseIin(value);
        if (iin.valid) {
            if (!e.birth_date) next = setIn(next, 'employee.birth_date', iin.birthDate);
            if (!e.gender) next = setIn(next, 'employee.gender', iin.gender);
        }
    }

    if (path === 'hiring.fio_accusative') {
        next = setIn(next, 'hiring.fio_accusative_manual', true);
    } else if (!next.hiring.fio_accusative_manual && ['employee.last_name', 'employee.first_name', 'employee.middle_name', 'employee.gender', 'employee.iin'].includes(path)) {
        const n = next.employee;
        next = setIn(next, 'hiring.fio_accusative', fullNameAccusative(n.last_name, n.first_name, n.middle_name, n.gender));
    }

    if (path === 'hiring.staff_category') {
        const before = categories.find((category) => category.value === previous.hiring.staff_category)?.defaults ?? {};
        const after = categories.find((category) => category.value === value)?.defaults ?? {};
        const contract = next.contract;
        if (!contract.vacation_days || Number(contract.vacation_days) === Number(before.vacation_days)) {
            next = setIn(next, 'contract.vacation_days', after.vacation_days ?? contract.vacation_days);
        }
        if (!contract.schedule || contract.schedule === before.schedule) {
            next = setIn(next, 'contract.schedule', after.schedule ?? contract.schedule);
        }
    }

    // The order date follows the contract date until it is changed by hand.
    if (path === 'contract.date' && (!previous.hiring.order_date || previous.hiring.order_date === previous.contract.date)) {
        next = setIn(next, 'hiring.order_date', value);
    }

    return next;
}

/** Keeps the rows being edited (incl. empty new rows) and takes the ids the server gave to the saved ones. */
function mergeRows(clientRows, serverRows, keyField) {
    const ids = serverRows.map((row) => row.id);
    let index = 0;
    return clientRows.map((row) => (String(row[keyField] ?? '').trim() !== '' ? { ...row, id: ids[index++] ?? row.id } : row));
}

function buildPayload(state, abilities) {
    const employee = { ...state.employee };
    if (!abilities.sensitive) {
        SENSITIVE_KEYS.forEach((key) => delete employee[key]);
    }

    return { employee, hiring: state.hiring, contract: state.contract };
}

export default function Wizard({ hiring, options, abilities, previewAvailable }) {
    const [state, setState] = useState(() => toState(hiring));
    const [checks, setChecks] = useState(hiring.checks);
    const [documents, setDocuments] = useState(hiring.documents);
    const [photoUrl, setPhotoUrl] = useState(hiring.employee.photo_url);
    const [attachments, setAttachments] = useState(hiring.employee.attachments ?? []);
    const [errors, setErrors] = useState({});
    const [saveState, setSaveState] = useState({ status: 'saved', at: null });
    const [savedVersion, setSavedVersion] = useState(0);
    const [step, setStep] = useState(() => Number(new URLSearchParams(window.location.search).get('step')) || 1);
    const [docType, setDocType] = useState('contract');

    const stateRef = useRef(state);
    stateRef.current = state;
    const editRef = useRef(0);
    const savedEditRef = useRef(0);
    const inflightRef = useRef(null);
    const timerRef = useRef(null);

    const runSave = useCallback(async () => {
        while (inflightRef.current) {
            await inflightRef.current.catch(() => {});
        }
        if (editRef.current === savedEditRef.current) {
            return;
        }

        const editAtStart = editRef.current;
        setSaveState((current) => ({ ...current, status: 'saving' }));
        const request = axios.put(route('hr.hiring.update', hiring.id), buildPayload(stateRef.current, abilities))
            .then(({ data }) => {
                savedEditRef.current = editAtStart;
                setChecks(data.hiring.checks);
                setDocuments(data.hiring.documents);
                setErrors({});
                const server = toState(data.hiring);
                if (editRef.current === editAtStart) {
                    setState((current) => ({
                        ...server,
                        employee: {
                            ...server.employee,
                            children: mergeRows(current.employee.children, server.employee.children, 'full_name'),
                            educations: mergeRows(current.employee.educations, server.employee.educations, 'level'),
                        },
                    }));
                } else {
                    setState((current) => setIn(setIn(current,
                        'employee.children', mergeRows(current.employee.children, server.employee.children, 'full_name')),
                        'employee.educations', mergeRows(current.employee.educations, server.employee.educations, 'level')));
                }
                setSaveState({ status: editRef.current === editAtStart ? 'saved' : 'dirty', at: new Date() });
                setSavedVersion((version) => version + 1);
            })
            .catch((error) => {
                const fieldErrors = validationErrors(error);
                setErrors(fieldErrors);
                setSaveState({ status: 'error', at: null, message: Object.keys(fieldErrors).length ? 'Исправьте отмеченные поля' : 'Не удалось сохранить' });
                throw error;
            })
            .finally(() => {
                inflightRef.current = null;
            });
        inflightRef.current = request;

        return request;
    }, [hiring.id, abilities]);

    const markDirty = useCallback(() => {
        editRef.current += 1;
        setSaveState((current) => ({ ...current, status: 'dirty' }));
        window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => runSave().catch(() => {}), SAVE_DELAY_MS);
    }, [runSave]);

    const set = useCallback((path, value) => {
        setState((previous) => applyChange(previous, path, value, options.categories));
        markDirty();
    }, [options.categories, markDirty]);

    /** Saves now (before a preview or a .docx); rejects when the data has errors. */
    const flushSave = useCallback(async () => {
        window.clearTimeout(timerRef.current);
        await runSave();
        while (inflightRef.current) {
            await inflightRef.current;
        }
    }, [runSave]);

    useEffect(() => {
        const warn = (event) => {
            if (editRef.current !== savedEditRef.current) {
                event.preventDefault();
                event.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, []);

    const resetAccusative = () => {
        setState((current) => {
            const e = current.employee;
            return setIn(setIn(current, 'hiring.fio_accusative_manual', false), 'hiring.fio_accusative', fullNameAccusative(e.last_name, e.first_name, e.middle_name, e.gender));
        });
        markDirty();
    };

    /** Administrators: replace the data of this draft with demo data (the page reloads from the server). */
    const fillDemo = () => {
        if (!window.confirm('Заменить все данные этого черновика демо-данными?')) {
            return;
        }
        window.clearTimeout(timerRef.current);
        savedEditRef.current = editRef.current;
        router.post(route('hr.hiring.demo.fill', hiring.id), {}, { preserveState: false, preserveScroll: false });
    };

    const changeStep = (target) => {
        setStep(target);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const goTo = ({ step: target, field }) => {
        setStep(target);
        window.setTimeout(() => {
            const element = document.getElementById(fieldElementId(field));
            if (!element) {
                return;
            }
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.focus?.({ preventScroll: true });
            element.classList.add('ring-2', 'ring-amber-400', 'ring-offset-2');
            window.setTimeout(() => element.classList.remove('ring-2', 'ring-amber-400', 'ring-offset-2'), 1800);
        }, 80);
    };

    const missingByType = useMemo(() => {
        const result = {};
        for (const type of ['contract', 'order', 'card']) {
            const local = missingFields(state, type, { hasPhoto: Boolean(photoUrl) });
            const settings = (checks?.[type]?.missing ?? []).filter((item) => item.step === 0);
            result[type] = [...local, ...settings];
        }
        return result;
    }, [state, checks, photoUrl]);

    const stepCounts = useMemo(() => {
        const counts = { 1: new Set(), 2: new Set(), 3: new Set() };
        Object.values(missingByType).flat().forEach((item) => counts[item.step]?.add(item.field));
        return Object.fromEntries(Object.entries(counts).map(([key, fields]) => [key, fields.size]));
    }, [missingByType]);

    /** DOM ids of the empty fields the documents need: their labels get a marker. */
    const missingIds = useMemo(() => {
        const ids = new Set();
        const e = state.employee;
        const c = state.contract;
        Object.values(missingByType).flat().forEach(({ field }) => {
            if (field === 'employee.address') {
                ['city', 'street', 'house'].filter((key) => blank(e[key])).forEach((key) => ids.add(fieldId(`employee.${key}`)));
            } else if (field === 'contract.break') {
                ['break_start', 'break_end'].filter((key) => blank(c[key])).forEach((key) => ids.add(fieldId(`contract.${key}`)));
            } else {
                ids.add(fieldElementId(field));
            }
        });
        return ids;
    }, [missingByType, state.employee, state.contract]);

    const warnings = useMemo(() => {
        const list = [...(checks?.[docType]?.warnings ?? [])];
        const iin = parseIin(state.employee.iin);
        if (iin.valid && state.employee.birth_date && state.employee.birth_date !== iin.birthDate && !list.includes('Дата рождения не совпадает с ИИН.')) {
            list.push('Дата рождения не совпадает с ИИН.');
        }
        return list;
    }, [checks, docType, state.employee.iin, state.employee.birth_date]);

    const fullName = [state.employee.last_name, state.employee.first_name, state.employee.middle_name].filter(Boolean).join(' ');
    const autoAccusative = fullNameAccusative(state.employee.last_name, state.employee.first_name, state.employee.middle_name, state.employee.gender);
    const stepProps = { state, set, errors, options, abilities, hiringId: hiring.id };

    const current = STEPS[step - 1];

    return (
        <AuthenticatedLayout>
            <Head title={`${fullName || 'Новый приём'} — приём на работу`} />
            <div className="w-full space-y-5 px-4 py-6 sm:px-6 lg:px-8">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div className="min-w-0">
                        <Link href={route('hr.hiring.index')} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
                            <ArrowLeft className="h-4 w-4" /> Все приёмы
                        </Link>
                        <h2 className="mt-1 flex flex-wrap items-center gap-3 text-2xl font-semibold text-slate-900">
                            {fullName || 'Новый приём'}
                            <StatusBadge status={hiring.status} label={hiring.status_label} />
                        </h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                        <SaveIndicator saveState={saveState} />
                        {abilities.rights && hiring.status === 'draft' && (
                            <button type="button" onClick={fillDemo} className={buttonClassName.secondary} title="Заполнить выдуманными данными для проверки документов (видят только администраторы)">
                                <FlaskConical className="h-4 w-4" /> Демо-данные
                            </button>
                        )}
                        <Link href={route('hr.hiring.show', hiring.id)} className={buttonClassName.secondary}>
                            <FolderOpen className="h-4 w-4" /> Карточка приёма
                        </Link>
                    </div>
                </div>

                <nav role="tablist" aria-label="Шаги оформления" className="grid grid-cols-3 gap-2">
                    {STEPS.map((item) => {
                        const active = step === item.value;
                        const count = stepCounts[item.value];
                        return (
                            <button
                                key={item.value}
                                type="button"
                                role="tab"
                                aria-selected={active}
                                onClick={() => changeStep(item.value)}
                                className={`flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-2.5 text-center transition sm:flex-row sm:gap-3 sm:px-4 sm:py-3 sm:text-left ${active ? 'border-teal-500 bg-white shadow-sm ring-1 ring-teal-500/30' : 'border-slate-200 bg-white/70 hover:border-slate-300 hover:bg-white'}`}
                            >
                                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${active ? 'bg-teal-600 text-white' : count === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                                    {count === 0 && !active ? <Check className="h-4 w-4" /> : item.value}
                                </span>
                                <span className="min-w-0">
                                    <span className="block text-xs font-semibold text-slate-900 sm:text-sm">{item.label}</span>
                                    <span className={`hidden text-xs sm:block ${count > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                                        {count > 0 ? `Нужно заполнить: ${count}` : 'Всё заполнено'}
                                    </span>
                                </span>
                            </button>
                        );
                    })}
                </nav>

                <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(400px,0.8fr)]">
                    <section aria-label="Данные приёма" className="min-w-0 space-y-4">
                        <p className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
                            <span>{current.hint}</span>
                            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                                <span className="h-2 w-2 rounded-full bg-amber-400" /> — нужно для документов
                            </span>
                        </p>

                        <MissingFieldsContext.Provider value={missingIds}>
                            {step === 1 && (
                                <StepEmployee
                                    {...stepProps}
                                    photoUrl={photoUrl}
                                    onPhotoChange={setPhotoUrl}
                                    attachments={attachments}
                                    onAttachmentsChange={setAttachments}
                                />
                            )}
                            {step === 2 && <StepAppointment {...stepProps} autoAccusative={autoAccusative} onAccusativeReset={resetAccusative} />}
                            {step === 3 && <StepContract {...stepProps} onGoTo={goTo} />}
                        </MissingFieldsContext.Provider>

                        <div className="sticky bottom-3 z-20 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-[0_8px_30px_rgba(15,23,42,0.12)] backdrop-blur">
                            <button type="button" disabled={step === 1} onClick={() => changeStep(step - 1)} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 disabled:invisible">
                                <ArrowLeft className="h-4 w-4" /> Назад
                            </button>
                            <span className="hidden text-xs text-slate-500 sm:block">Шаг {step} из {STEPS.length}</span>
                            {step < STEPS.length ? (
                                <button type="button" onClick={() => changeStep(step + 1)} className={buttonClassName.primary}>
                                    Далее: {STEPS[step].label} <ArrowRight className="h-4 w-4" />
                                </button>
                            ) : (
                                <Link href={route('hr.hiring.show', hiring.id)} className={buttonClassName.primary}>
                                    Готово — к документам приёма <ArrowRight className="h-4 w-4" />
                                </Link>
                            )}
                        </div>
                    </section>

                    <PreviewPanel
                        hiringId={hiring.id}
                        docType={docType}
                        onDocTypeChange={setDocType}
                        missingByType={missingByType}
                        warnings={warnings}
                        onMissingClick={goTo}
                        previewAvailable={previewAvailable}
                        flushSave={flushSave}
                        savedVersion={savedVersion}
                        documents={documents}
                        onDocumentsChange={setDocuments}
                    />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

function SaveIndicator({ saveState }) {
    if (saveState.status === 'saving') {
        return <span className="inline-flex items-center gap-1.5 text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" /> Сохранение…</span>;
    }
    if (saveState.status === 'dirty') {
        return <span className="text-slate-500">Изменения сохранятся автоматически</span>;
    }
    if (saveState.status === 'error') {
        return <span className="inline-flex items-center gap-1.5 text-rose-700"><CircleAlert className="h-4 w-4" /> {saveState.message}</span>;
    }

    return (
        <span className="inline-flex items-center gap-1.5 text-emerald-700">
            <Check className="h-4 w-4" />
            {saveState.at ? `Сохранено в ${saveState.at.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}` : 'Сохранено'}
        </span>
    );
}
