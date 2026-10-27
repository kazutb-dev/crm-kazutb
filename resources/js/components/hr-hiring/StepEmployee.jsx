import axios from 'axios';
import { FileUp, ImageUp, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { fieldId, parseIin } from './logic';
import { buttonClassName, ChoiceGroup, Field, formatBytes, inputSizedClassName, Notice, Section, SelectInput, TextInput, validationErrors } from './ui';

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
            <Section
                title="Личные данные"
                description="Дата рождения и пол подставятся из ИИН автоматически."
                feeds={['contract', 'order', 'card']}
            >
                <div className="grid gap-4 sm:grid-cols-3">
                    {[['last_name', 'Фамилия'], ['first_name', 'Имя'], ['middle_name', 'Отчество']].map(([key, label]) => (
                        <Field key={key} id={fieldId(`employee.${key}`)} label={label} error={err(`employee.${key}`)}>
                            <TextInput id={fieldId(`employee.${key}`)} value={e[key]} onChange={(value) => set(`employee.${key}`, value)} maxLength={100} />
                        </Field>
                    ))}
                </div>
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto]">
                    <Field
                        id={fieldId('employee.iin')}
                        label="ИИН"
                        error={err('employee.iin') ?? (e.iin && !iin.valid ? iin.error : null)}
                        hint={iin.valid ? 'ИИН верный' : null}
                    >
                        <TextInput
                            id={fieldId('employee.iin')}
                            value={e.iin}
                            onChange={(value) => set('employee.iin', value.replace(/\D/g, '').slice(0, 12))}
                            inputMode="numeric"
                            maxLength={12}
                            placeholder="12 цифр"
                            className={`font-mono ${iin.valid ? 'border-emerald-400' : ''}`}
                        />
                    </Field>
                    <Field id={fieldId('employee.birth_date')} label="Дата рождения" error={err('employee.birth_date')}>
                        <TextInput id={fieldId('employee.birth_date')} type="date" value={e.birth_date} onChange={(value) => set('employee.birth_date', value)} />
                    </Field>
                    <Field id={fieldId('employee.gender')} label="Пол" error={err('employee.gender')}>
                        <ChoiceGroup
                            id={fieldId('employee.gender')}
                            label="Пол"
                            value={e.gender}
                            onChange={(value) => set('employee.gender', value)}
                            options={[{ value: 'm', label: 'Мужской' }, { value: 'f', label: 'Женский' }]}
                        />
                    </Field>
                </div>
                {iinMismatch && <Notice tone="warning">Дата рождения или пол не совпадают с ИИН ({iin.birthDate.split('-').reverse().join('.')}, {iin.gender === 'm' ? 'мужской' : 'женский'}).</Notice>}
                <div className="grid gap-4 sm:grid-cols-2">
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

            <Section title="Удостоверение личности" feeds={['contract', 'card']}>
                <div className="grid gap-4 sm:grid-cols-3">
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

            <Section title="Адрес и телефон" description="Адрес проживания — так, как он будет написан в договоре." feeds={['contract', 'card']}>
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                    <Field id={fieldId('employee.city')} label="Город" error={err('employee.city')}>
                        <TextInput id={fieldId('employee.city')} value={e.city} onChange={(value) => set('employee.city', value)} maxLength={100} />
                    </Field>
                    <Field id={fieldId('employee.street')} label="Улица / микрорайон" error={err('employee.street')}>
                        <TextInput id={fieldId('employee.street')} value={e.street} onChange={(value) => set('employee.street', value)} maxLength={150} />
                    </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
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

            <Section title="Семья" feeds={['card']}>
                <Field id={fieldId('employee.marital_status')} label="Семейное положение" className="sm:max-w-xs">
                    <SelectInput id={fieldId('employee.marital_status')} value={e.marital_status} onChange={(value) => set('employee.marital_status', value)} options={maritalOptions} placeholder="Выберите" />
                </Field>
                <div className="space-y-3">
                    {(e.children ?? []).length > 0 && <p className="qd-field-label border-t border-slate-200 pt-4 text-slate-500">Дети</p>}
                    {(e.children ?? []).map((child, index) => (
                        <div key={child.id ?? `new-${index}`} className="grid items-end gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]">
                            <Field id={fieldId(`employee.children.${index}.full_name`)} label="ФИО ребёнка">
                                <TextInput id={fieldId(`employee.children.${index}.full_name`)} value={child.full_name} onChange={(value) => updateRow('children', index, { full_name: value })} />
                            </Field>
                            <Field id={fieldId(`employee.children.${index}.birth_date`)} label="Дата рождения">
                                <TextInput id={fieldId(`employee.children.${index}.birth_date`)} type="date" value={child.birth_date} onChange={(value) => updateRow('children', index, { birth_date: value })} />
                            </Field>
                            <button type="button" onClick={() => setList('children', e.children.filter((_, i) => i !== index))} className={`${buttonClassName.danger} h-10`} title="Удалить ребёнка" aria-label="Удалить ребёнка">
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                    ))}
                    <button type="button" onClick={() => setList('children', [...(e.children ?? []), { id: null, full_name: '', birth_date: '' }])} className={buttonClassName.ghost}>
                        <Plus className="h-4 w-4" /> Добавить ребёнка
                    </button>
                </div>
            </Section>

            <Section title="Образование" description="Нужна хотя бы одна запись: уровень и учебное заведение." feeds={['card']} id={fieldId('employee.educations')}>
                {(e.educations ?? []).map((row, index) => {
                    const rowId = (key) => fieldId(`employee.educations.${index}.${key}`);
                    return (
                        <div key={row.id ?? `new-${index}`} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
                            <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3">
                                <p className="flex items-center gap-2 text-sm font-semibold text-[#102945]"><span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-teal-100 text-xs font-bold tabular-nums text-teal-700">{index + 1}</span>Образование</p>
                                <button type="button" onClick={() => setList('educations', e.educations.filter((_, i) => i !== index))} className="inline-flex items-center gap-1 rounded-[8px] px-2 py-1 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50">
                                    <Trash2 className="h-3.5 w-3.5" /> Удалить
                                </button>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
                                <Field id={rowId('level')} label="Уровень">
                                    <SelectInput id={rowId('level')} value={row.level} onChange={(value) => updateRow('educations', index, { level: value })} options={options.education_levels} placeholder="Выберите" />
                                </Field>
                                <Field id={rowId('graduation_year')} label="Год окончания" error={errors[`employee.educations.${index}.graduation_year`]}>
                                    <TextInput id={rowId('graduation_year')} value={row.graduation_year ?? ''} onChange={(value) => updateRow('educations', index, { graduation_year: value.replace(/\D/g, '').slice(0, 4) })} placeholder="2018" inputMode="numeric" />
                                </Field>
                            </div>
                            <Field id={rowId('institution')} label="Учебное заведение">
                                <TextInput id={rowId('institution')} value={row.institution} onChange={(value) => updateRow('educations', index, { institution: value })} />
                            </Field>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Field id={rowId('specialty')} label="Специальность">
                                    <TextInput id={rowId('specialty')} value={row.specialty} onChange={(value) => updateRow('educations', index, { specialty: value })} />
                                </Field>
                                <Field id={rowId('diploma_number')} label="Номер диплома">
                                    <TextInput id={rowId('diploma_number')} value={row.diploma_number} onChange={(value) => updateRow('educations', index, { diploma_number: value })} className="font-mono" />
                                </Field>
                            </div>
                        </div>
                    );
                })}
                <button type="button" onClick={() => setList('educations', [...(e.educations ?? []), { id: null, level: null, institution: '', graduation_year: '', specialty: '', diploma_number: '' }])} className={buttonClassName.ghost}>
                    <Plus className="h-4 w-4" /> Добавить образование
                </button>
            </Section>

            <Section title="Воинский учёт и социальный статус" feeds={['card']}>
                <Field id={fieldId('employee.military_status')} label="Воинский учёт" className="sm:max-w-xs">
                    <SelectInput id={fieldId('employee.military_status')} value={e.military_status} onChange={(value) => set('employee.military_status', value)} options={options.military} placeholder="Выберите" />
                </Field>
                {abilities.sensitive ? (
                    <div className="grid gap-4 sm:grid-cols-[minmax(0,14rem)_1fr]">
                        <Field id={fieldId('employee.disability')} label="Инвалидность">
                            <SelectInput id={fieldId('employee.disability')} value={e.disability ?? 'none'} onChange={(value) => set('employee.disability', value ?? 'none')} options={options.disabilities} />
                        </Field>
                        <div className="flex flex-wrap items-end gap-x-5 gap-y-2 pb-2.5 text-sm font-medium text-slate-800">
                            {[['is_pensioner', 'Пенсионер'], ['is_student', 'Обучающийся'], ['is_large_family', 'Многодетная семья']].map(([key, label]) => (
                                <label key={key} className="flex cursor-pointer items-center gap-2">
                                    <input type="checkbox" checked={Boolean(e[key])} onChange={(event) => set(`employee.${key}`, event.target.checked)} className="h-4 w-4 rounded-[4px] border-slate-300 text-teal-700 focus:ring-teal-600/30" />
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
        if (!window.confirm('Удалить фото сотрудника?')) {
            return;
        }
        setBusy(true);
        try {
            await axios.delete(route('hr.hiring.photo.destroy', hiringId));
            onPhotoChange(null);
        } catch {
            toast.error('Не удалось удалить фото.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Section title="Фото 3×4" description="JPG или PNG до 5 МБ." feeds={['card']} id={fieldId('employee.photo')}>
            <div className="flex items-center gap-5">
                <div className="flex h-28 w-[84px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-dashed border-slate-300 bg-slate-50">
                    {photoUrl ? <img src={photoUrl} alt="Фото сотрудника" className="h-full w-full object-cover" /> : <ImageUp className="h-6 w-6 text-teal-600/50" />}
                </div>
                <div className="space-y-2">
                    <label className={`${buttonClassName.secondary} ${busy ? 'pointer-events-none opacity-60' : 'cursor-pointer'}`}>
                        <ImageUp className="h-4 w-4" />
                        {busy ? 'Загрузка…' : photoUrl ? 'Заменить фото' : 'Загрузить фото'}
                        <input
                            type="file"
                            accept="image/png,image/jpeg"
                            className="hidden"
                            disabled={busy}
                            onChange={(event) => { upload(event.target.files?.[0]); event.target.value = ''; }}
                        />
                    </label>
                    {photoUrl && <button type="button" onClick={remove} disabled={busy} className="block text-xs font-semibold text-red-700 underline-offset-2 hover:underline disabled:opacity-60">Удалить фото</button>}
                </div>
            </div>
        </Section>
    );
}

function AttachmentsSection({ hiringId, options, abilities, attachments, onAttachmentsChange }) {
    const [docType, setDocType] = useState('id_card');
    const [busy, setBusy] = useState(false);

    const upload = async (files) => {
        if (!files?.length || busy) {
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
        onAttachmentsChange((current) => [...current, ...added]);
        setBusy(false);
    };

    const remove = async (attachment) => {
        if (!window.confirm(`Удалить «${attachment.original_name}»?`)) {
            return;
        }
        try {
            await axios.delete(route('hr.hiring.attachments.destroy', [hiringId, attachment.id]));
            onAttachmentsChange((current) => current.filter((item) => item.id !== attachment.id));
        } catch {
            toast.error(`Не удалось удалить «${attachment.original_name}».`);
        }
    };

    return (
        <Section
            title="Сканы документов"
            description="Удостоверение, диплом и другие документы в PDF."
            note="Хранятся в личном деле сотрудника и в документы не попадают."
            id="hr-attachments"
        >
            {attachments.length > 0 && (
                <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
                    {attachments.map((attachment) => (
                        <li key={attachment.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                            <span className="min-w-0">
                                <span className="block font-medium text-slate-900">{attachment.doc_type_label}</span>
                                <span className="block truncate text-xs text-slate-500">{attachment.original_name} · {formatBytes(attachment.size)}</span>
                            </span>
                            {abilities.sensitive ? (
                                <span className="flex items-center gap-2">
                                    <a href={route('hr.hiring.attachments.show', [hiringId, attachment.id])} target="_blank" rel="noreferrer" className={buttonClassName.ghost}>Открыть</a>
                                    <button type="button" onClick={() => remove(attachment)} className="rounded-[8px] px-2 py-1 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50">Удалить</button>
                                </span>
                            ) : (
                                <span className="text-xs text-slate-500">просмотр — по отдельному праву</span>
                            )}
                        </li>
                    ))}
                </ul>
            )}
            <div className="flex flex-wrap items-end gap-3">
                <label className="block">
                    <span className="qd-field-label mb-2 block text-[#102945]">Вид документа</span>
                    <select value={docType} onChange={(event) => setDocType(event.target.value)} disabled={busy} className={`${inputSizedClassName} w-auto max-w-full`}>
                        {options.attachment_types.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                    </select>
                </label>
                <label className={`${buttonClassName.secondary} ${busy ? 'pointer-events-none opacity-60' : 'cursor-pointer'}`}>
                    <FileUp className="h-4 w-4" />
                    {busy ? 'Загрузка…' : 'Прикрепить PDF'}
                    <input type="file" accept="application/pdf" multiple disabled={busy} className="hidden" onChange={(event) => { upload([...(event.target.files ?? [])]); event.target.value = ''; }} />
                </label>
            </div>
        </Section>
    );
}
