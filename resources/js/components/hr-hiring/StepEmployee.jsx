import axios from 'axios';
import { FileUp, ImageUp, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { fieldId, parseIin } from './logic';
import { buttonClassName, Field, formatBytes, inputClassName, Notice, Section, SelectInput, TextInput, validationErrors } from './ui';

export default function StepEmployee({ state, set, errors, options, abilities, hiringId, photoUrl, onPhotoChange, attachments, onAttachmentsChange }) {
    const e = state.employee;
    const iin = parseIin(e.iin);
    const iinMismatch = iin.valid && ((e.birth_date && e.birth_date !== iin.birthDate) || (e.gender && e.gender !== iin.gender));
    const maritalOptions = options.marital.map((item) => ({ value: item.value, label: e.gender === 'f' ? item.female : e.gender === 'm' ? item.male : `${item.male} / ${item.female}` }));
    const err = (path) => errors[path];

    const setList = (key, rows) => set(`employee.${key}`, rows);
    const updateRow = (key, index, patch) => setList(key, (e[key] ?? []).map((row, i) => (i === index ? { ...row, ...patch } : row)));

    return (
        <div className="space-y-6">
            <Section title="ФИО и ИИН" feeds="все документы">
                <div className="grid gap-3 sm:grid-cols-3">
                    {[['last_name', 'Фамилия'], ['first_name', 'Имя'], ['middle_name', 'Отчество']].map(([key, label]) => (
                        <Field key={key} id={fieldId(`employee.${key}`)} label={label} error={err(`employee.${key}`)}>
                            <TextInput id={fieldId(`employee.${key}`)} value={e[key]} onChange={(value) => set(`employee.${key}`, value)} maxLength={100} />
                        </Field>
                    ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
                    <Field
                        id={fieldId('employee.iin')}
                        label="ИИН"
                        error={err('employee.iin') ?? (e.iin && !iin.valid ? iin.error : null)}
                        hint={iin.valid ? 'ИИН верный' : 'Дата рождения и пол подставятся из ИИН'}
                    >
                        <TextInput
                            id={fieldId('employee.iin')}
                            value={e.iin}
                            onChange={(value) => set('employee.iin', value.replace(/\D/g, '').slice(0, 12))}
                            inputMode="numeric"
                            maxLength={12}
                            placeholder="12 цифр"
                            className={`font-mono ${iin.valid ? 'border-emerald-300' : ''}`}
                        />
                    </Field>
                    <Field id={fieldId('employee.birth_date')} label="Дата рождения" error={err('employee.birth_date')}>
                        <TextInput id={fieldId('employee.birth_date')} type="date" value={e.birth_date} onChange={(value) => set('employee.birth_date', value)} />
                    </Field>
                    <Field id={fieldId('employee.gender')} label="Пол" error={err('employee.gender')}>
                        <div id={fieldId('employee.gender')} tabIndex={-1} className="flex h-[38px] items-center gap-4 text-sm">
                            {[['m', 'Мужской'], ['f', 'Женский']].map(([value, label]) => (
                                <label key={value} className="flex items-center gap-1.5">
                                    <input type="radio" name="gender" checked={e.gender === value} onChange={() => set('employee.gender', value)} className="text-teal-600 focus:ring-teal-500" />
                                    {label}
                                </label>
                            ))}
                        </div>
                    </Field>
                </div>
                {iinMismatch && <Notice tone="warning">Дата рождения или пол не совпадают с ИИН ({iin.birthDate.split('-').reverse().join('.')}, {iin.gender === 'm' ? 'мужской' : 'женский'}).</Notice>}
                <div className="grid gap-3 sm:grid-cols-2">
                    <Field id={fieldId('employee.citizenship')} label="Гражданство">
                        <SelectInput
                            id={fieldId('employee.citizenship')}
                            value={e.citizenship ?? 'kz'}
                            onChange={(value) => set('employee.citizenship', value ?? 'kz')}
                            options={[{ value: 'kz', label: 'Республика Казахстан' }, { value: 'other', label: 'Другое' }]}
                        />
                    </Field>
                    {e.citizenship === 'other' && (
                        <>
                            <Field id={fieldId('employee.citizenship_ru')} label="Гражданство (рус., род. п.)" error={err('employee.citizenship_ru')}>
                                <TextInput id={fieldId('employee.citizenship_ru')} value={e.citizenship_ru} onChange={(value) => set('employee.citizenship_ru', value)} placeholder="Республики Узбекистан" />
                            </Field>
                            <Field id={fieldId('employee.citizenship_kz')} label="Гражданство (каз.)" error={err('employee.citizenship_kz')}>
                                <TextInput id={fieldId('employee.citizenship_kz')} value={e.citizenship_kz} onChange={(value) => set('employee.citizenship_kz', value)} placeholder="Өзбекстан Республикасының" />
                            </Field>
                        </>
                    )}
                </div>
            </Section>

            <PhotoSection hiringId={hiringId} photoUrl={photoUrl} onPhotoChange={onPhotoChange} />

            <Section title="Удостоверение личности" feeds="договор · личное дело">
                <div className="grid gap-3 sm:grid-cols-3">
                    <Field id={fieldId('employee.id_card_number')} label="Номер" error={err('employee.id_card_number')}>
                        <TextInput id={fieldId('employee.id_card_number')} value={e.id_card_number} onChange={(value) => set('employee.id_card_number', value)} className="font-mono" maxLength={20} />
                    </Field>
                    <Field id={fieldId('employee.id_card_issued_at')} label="Дата выдачи" error={err('employee.id_card_issued_at')}>
                        <TextInput id={fieldId('employee.id_card_issued_at')} type="date" value={e.id_card_issued_at} onChange={(value) => set('employee.id_card_issued_at', value)} />
                    </Field>
                    <Field id={fieldId('employee.id_card_issuer')} label="Кем выдано">
                        <SelectInput id={fieldId('employee.id_card_issuer')} value={e.id_card_issuer ?? 'mvd'} onChange={(value) => set('employee.id_card_issuer', value ?? 'mvd')} options={options.issuers} />
                    </Field>
                </div>
            </Section>

            <Section title="Адрес и телефон" feeds="договор · личное дело">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                    <Field id={fieldId('employee.city')} label="Город" error={err('employee.city')}>
                        <TextInput id={fieldId('employee.city')} value={e.city} onChange={(value) => set('employee.city', value)} maxLength={100} />
                    </Field>
                    <Field id={fieldId('employee.street')} label="Улица / микрорайон" error={err('employee.street')}>
                        <TextInput id={fieldId('employee.street')} value={e.street} onChange={(value) => set('employee.street', value)} maxLength={150} />
                    </Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                    <Field id={fieldId('employee.house')} label="Дом" error={err('employee.house')}>
                        <TextInput id={fieldId('employee.house')} value={e.house} onChange={(value) => set('employee.house', value)} maxLength={20} />
                    </Field>
                    <Field id={fieldId('employee.apartment')} label="Квартира" error={err('employee.apartment')}>
                        <TextInput id={fieldId('employee.apartment')} value={e.apartment} onChange={(value) => set('employee.apartment', value)} maxLength={20} />
                    </Field>
                    <Field id={fieldId('employee.phone')} label="Телефон" error={err('employee.phone')}>
                        <TextInput id={fieldId('employee.phone')} value={e.phone} onChange={(value) => set('employee.phone', value)} inputMode="tel" placeholder="+7 7__ ___ __ __" className="font-mono" maxLength={30} />
                    </Field>
                </div>
            </Section>

            <Section title="Семья" feeds="личное дело">
                <Field id={fieldId('employee.marital_status')} label="Семейное положение" className="sm:max-w-xs">
                    <SelectInput id={fieldId('employee.marital_status')} value={e.marital_status} onChange={(value) => set('employee.marital_status', value)} options={maritalOptions} placeholder="—" />
                </Field>
                <div className="space-y-2">
                    {(e.children ?? []).map((child, index) => (
                        <div key={child.id ?? `new-${index}`} className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]">
                            <TextInput id={fieldId(`employee.children.${index}.full_name`)} value={child.full_name} onChange={(value) => updateRow('children', index, { full_name: value })} placeholder="ФИО ребёнка" />
                            <TextInput type="date" value={child.birth_date} onChange={(value) => updateRow('children', index, { birth_date: value })} aria-label="Дата рождения ребёнка" />
                            <button type="button" onClick={() => setList('children', e.children.filter((_, i) => i !== index))} className={buttonClassName.danger} title="Удалить">
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                    ))}
                    <button type="button" onClick={() => setList('children', [...(e.children ?? []), { id: null, full_name: '', birth_date: '' }])} className={buttonClassName.ghost}>
                        <Plus className="h-4 w-4" /> Добавить ребёнка
                    </button>
                </div>
            </Section>

            <Section title="Образование" feeds="личное дело" id={fieldId('employee.educations')}>
                {(e.educations ?? []).length === 0 && <p className="text-sm text-slate-500">Добавьте хотя бы одну запись об образовании.</p>}
                {(e.educations ?? []).map((row, index) => (
                    <div key={row.id ?? `new-${index}`} className="space-y-2 rounded-xl border border-slate-200 p-3">
                        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_auto]">
                            <SelectInput value={row.level} onChange={(value) => updateRow('educations', index, { level: value })} options={options.education_levels} placeholder="Уровень" />
                            <TextInput value={row.graduation_year ?? ''} onChange={(value) => updateRow('educations', index, { graduation_year: value.replace(/\D/g, '').slice(0, 4) })} placeholder="Год" inputMode="numeric" />
                            <button type="button" onClick={() => setList('educations', e.educations.filter((_, i) => i !== index))} className={buttonClassName.danger} title="Удалить">
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                        <TextInput value={row.institution} onChange={(value) => updateRow('educations', index, { institution: value })} placeholder="Учебное заведение" />
                        <div className="grid gap-2 sm:grid-cols-2">
                            <TextInput value={row.specialty} onChange={(value) => updateRow('educations', index, { specialty: value })} placeholder="Специальность" />
                            <TextInput value={row.diploma_number} onChange={(value) => updateRow('educations', index, { diploma_number: value })} placeholder="Диплом №" className="font-mono" />
                        </div>
                        {errors[`employee.educations.${index}.graduation_year`] && <p className="text-xs text-rose-600">{errors[`employee.educations.${index}.graduation_year`]}</p>}
                    </div>
                ))}
                <button type="button" onClick={() => setList('educations', [...(e.educations ?? []), { id: null, level: null, institution: '', graduation_year: '', specialty: '', diploma_number: '' }])} className={buttonClassName.ghost}>
                    <Plus className="h-4 w-4" /> Добавить образование
                </button>
            </Section>

            <Section title="Учёт и социальный статус" feeds="личное дело">
                <Field id={fieldId('employee.military_status')} label="Воинский учёт" className="sm:max-w-xs">
                    <SelectInput id={fieldId('employee.military_status')} value={e.military_status} onChange={(value) => set('employee.military_status', value)} options={options.military} placeholder="—" />
                </Field>
                {abilities.sensitive ? (
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,14rem)_1fr]">
                        <Field id={fieldId('employee.disability')} label="Инвалидность">
                            <SelectInput id={fieldId('employee.disability')} value={e.disability ?? 'none'} onChange={(value) => set('employee.disability', value ?? 'none')} options={options.disabilities} />
                        </Field>
                        <div className="flex flex-wrap items-end gap-4 pb-2 text-sm">
                            {[['is_pensioner', 'Пенсионер'], ['is_student', 'Обучающийся'], ['is_large_family', 'Многодетная семья']].map(([key, label]) => (
                                <label key={key} className="flex items-center gap-1.5">
                                    <input type="checkbox" checked={Boolean(e[key])} onChange={(event) => set(`employee.${key}`, event.target.checked)} className="rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
                                    {label}
                                </label>
                            ))}
                        </div>
                    </div>
                ) : (
                    <Notice icon={ShieldCheck}>Социальный статус (пенсия, инвалидность, учёба, многодетность) видят и заполняют сотрудники с отдельным правом.</Notice>
                )}
            </Section>

            <AttachmentsSection hiringId={hiringId} options={options} abilities={abilities} attachments={attachments} onAttachmentsChange={onAttachmentsChange} />
        </div>
    );
}

function PhotoSection({ hiringId, photoUrl, onPhotoChange }) {
    const [busy, setBusy] = useState(false);

    const upload = async (file) => {
        if (!file) {
            return;
        }
        setBusy(true);
        try {
            const form = new FormData();
            form.append('photo', file);
            const { data } = await axios.post(route('hr.hiring.photo.store', hiringId), form);
            onPhotoChange(data.photo_url);
        } catch (error) {
            toast.error(validationErrors(error).photo ?? 'Не удалось загрузить фото.');
        } finally {
            setBusy(false);
        }
    };

    const remove = async () => {
        await axios.delete(route('hr.hiring.photo.destroy', hiringId));
        onPhotoChange(null);
    };

    return (
        <Section title="Фото 3×4" feeds="личное дело" id={fieldId('employee.photo')}>
            <div className="flex items-center gap-4">
                <div className="flex h-28 w-[84px] shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                    {photoUrl ? <img src={photoUrl} alt="Фото сотрудника" className="h-full w-full object-cover" /> : <ImageUp className="h-6 w-6 text-slate-300" />}
                </div>
                <div className="space-y-2">
                    <label className={`${buttonClassName.secondary} cursor-pointer`}>
                        <ImageUp className="h-4 w-4" />
                        {busy ? 'Загрузка…' : photoUrl ? 'Заменить фото' : 'Загрузить фото'}
                        <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={(event) => upload(event.target.files?.[0])} />
                    </label>
                    {photoUrl && <button type="button" onClick={remove} className="block text-xs text-rose-700 hover:underline">Удалить фото</button>}
                    <p className="text-xs text-slate-500">JPG или PNG до 5 МБ, попадёт в личную карточку.</p>
                </div>
            </div>
        </Section>
    );
}

function AttachmentsSection({ hiringId, options, abilities, attachments, onAttachmentsChange }) {
    const [docType, setDocType] = useState('id_card');
    const [busy, setBusy] = useState(false);

    const upload = async (files) => {
        if (!files?.length) {
            return;
        }
        setBusy(true);
        const added = [];
        for (const file of files) {
            try {
                const form = new FormData();
                form.append('file', file);
                form.append('doc_type', docType);
                const { data } = await axios.post(route('hr.hiring.attachments.store', hiringId), form);
                added.push(data.attachment);
            } catch (error) {
                toast.error(`${file.name}: ${validationErrors(error).file ?? 'не удалось загрузить'}`);
            }
        }
        onAttachmentsChange([...attachments, ...added]);
        setBusy(false);
    };

    const remove = async (attachment) => {
        if (!window.confirm(`Удалить «${attachment.original_name}»?`)) {
            return;
        }
        await axios.delete(route('hr.hiring.attachments.destroy', [hiringId, attachment.id]));
        onAttachmentsChange(attachments.filter((item) => item.id !== attachment.id));
    };

    return (
        <Section title="Документы PDF" feeds="личное дело" id="hr-attachments">
            {attachments.length === 0 ? (
                <p className="text-sm text-slate-500">Сканы удостоверения, диплома и других документов в PDF.</p>
            ) : (
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                    {attachments.map((attachment) => (
                        <li key={attachment.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                            <span className="min-w-0">
                                <span className="block font-medium text-slate-800">{attachment.doc_type_label}</span>
                                <span className="block truncate text-xs text-slate-500">{attachment.original_name} · {formatBytes(attachment.size)}</span>
                            </span>
                            {abilities.sensitive ? (
                                <span className="flex items-center gap-2">
                                    <a href={route('hr.hiring.attachments.show', [hiringId, attachment.id])} target="_blank" rel="noreferrer" className={buttonClassName.ghost}>Открыть</a>
                                    <button type="button" onClick={() => remove(attachment)} className="text-xs text-rose-700 hover:underline">Удалить</button>
                                </span>
                            ) : (
                                <span className="text-xs text-slate-400">просмотр — по отдельному праву</span>
                            )}
                        </li>
                    ))}
                </ul>
            )}
            <div className="flex flex-wrap items-center gap-2">
                <select value={docType} onChange={(event) => setDocType(event.target.value)} className={`${inputClassName} w-auto`} aria-label="Вид документа">
                    {options.attachment_types.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                </select>
                <label className={`${buttonClassName.secondary} cursor-pointer`}>
                    <FileUp className="h-4 w-4" />
                    {busy ? 'Загрузка…' : 'Прикрепить PDF'}
                    <input type="file" accept="application/pdf" multiple className="hidden" onChange={(event) => { upload([...(event.target.files ?? [])]); event.target.value = ''; }} />
                </label>
            </div>
        </Section>
    );
}
