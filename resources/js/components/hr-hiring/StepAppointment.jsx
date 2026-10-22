import { RotateCcw } from 'lucide-react';
import CatalogCombobox from './CatalogCombobox';
import NumberHint from './NumberHint';
import PersonCombobox from './PersonCombobox';
import { fieldId, positionFull } from './logic';
import { Field, Section, SelectInput, TextInput } from './ui';

const UNIT_FORMS = [
    { key: 'name_ru_gen', label: 'Родительный падеж (рус.)', placeholder: 'кафедры «Информационные технологии»' },
    { key: 'name_kz_gen', label: 'Форма на казахском', placeholder: '… кафедрасының / факультетінің', hint: 'Пример: «Ақпараттық технологиялар» кафедрасының' },
];

const POSITION_FORMS = [
    { key: 'name_ru_gen', label: 'Родительный падеж (рус.)', placeholder: 'старшего преподавателя' },
    { key: 'name_kz_poss', label: 'Форма на казахском (притяжательная)', placeholder: 'аға оқытушысы', hint: 'Пример: аға оқытушысы, бас маманы' },
];

export default function StepAppointment({ state, set, errors, options, abilities, hiringId, autoAccusative, onAccusativeReset }) {
    const h = state.hiring;
    const c = state.contract;
    const full = positionFull(h);
    const topId = h.top_unit?.id ?? null;
    const topChosen = Boolean(h.top_unit?.name_ru);
    const isReplacement = c.term === 'replacement';

    return (
        <div className="space-y-4">
            <Section
                title="Должность и подразделение"
                description="Выберите из справочника или введите вручную. Категория персонала задаёт отпуск и график по умолчанию."
                feeds={['contract', 'order', 'card']}
            >
                <div id={fieldId('hiring.staff_category')} role="radiogroup" aria-label="Категория персонала" className="grid gap-2 sm:grid-cols-3">
                    {options.categories.map((category) => (
                        <label key={category.value} className={`flex cursor-pointer flex-col rounded-xl border px-3 py-2 text-sm transition ${h.staff_category === category.value ? 'border-teal-500 bg-teal-50 text-teal-900' : 'border-slate-200 hover:bg-slate-50'}`}>
                            <input type="radio" name="staff_category" className="sr-only" checked={h.staff_category === category.value} onChange={() => set('hiring.staff_category', category.value)} />
                            <span className="font-semibold">{category.label}</span>
                            <span className="text-xs leading-snug text-slate-500">{category.name}</span>
                            {category.defaults?.vacation_days && <span className="mt-1 text-xs text-slate-400">отпуск {category.defaults.vacation_days} дн.</span>}
                        </label>
                    ))}
                </div>

                <CatalogCombobox
                    id={fieldId('hiring.top_unit')}
                    label="Департамент, управление, факультет"
                    value={h.top_unit}
                    onChange={(value) => {
                        set('hiring.top_unit', value);
                        if ((value?.id ?? null) !== topId) {
                            set('hiring.sub_unit', { id: null, name_ru: '', name_ru_gen: '', name_kz_gen: '', verified: null, add_to_catalog: false });
                        }
                    }}
                    searchUrl={(q) => route('hr.hiring.lookup.units', { q: q || undefined })}
                    inflectKind="unit"
                    forms={UNIT_FORMS}
                    canAddToCatalog={abilities.catalog}
                    errors={errors}
                    errorPrefix="hiring.top_unit"
                />
                <CatalogCombobox
                    id={fieldId('hiring.sub_unit')}
                    label="Отдел, кафедра (если есть)"
                    value={h.sub_unit}
                    onChange={(value) => set('hiring.sub_unit', value)}
                    searchUrl={(q) => route('hr.hiring.lookup.units', { parent: topId ?? 0, q: q || undefined })}
                    inflectKind="unit"
                    forms={UNIT_FORMS}
                    canAddToCatalog={abilities.catalog && Boolean(topId)}
                    disabled={!topChosen}
                    emptyHint="Сначала выберите департамент, управление или факультет"
                    errors={errors}
                    errorPrefix="hiring.sub_unit"
                />
                <CatalogCombobox
                    id={fieldId('hiring.position')}
                    label="Должность"
                    value={h.position}
                    onChange={(value) => set('hiring.position', value)}
                    searchUrl={(q) => route('hr.hiring.lookup.positions', { category: h.staff_category || undefined, q: q || undefined })}
                    inflectKind="position"
                    forms={POSITION_FORMS}
                    canAddToCatalog={abilities.catalog}
                    errors={errors}
                    errorPrefix="hiring.position"
                />

                {full.ru && (
                    <div className="space-y-1.5 rounded-xl border border-teal-100 bg-teal-50/50 px-4 py-3 text-sm text-slate-700">
                        <p className="text-xs font-medium uppercase tracking-wide text-teal-800">Так будет написано в договоре</p>
                        <p>на должность <span className="font-medium text-slate-900">{full.ru}</span></p>
                        <p><span className="font-medium text-slate-900">{full.kz}</span> лауазымына</p>
                    </div>
                )}
            </Section>

            <Section title="Дата приёма" feeds={['contract', 'order']}>
                <div className="grid gap-3 sm:grid-cols-2">
                    <Field id={fieldId('hiring.start_date')} label="Дата приёма на работу" error={errors['hiring.start_date']}>
                        <TextInput id={fieldId('hiring.start_date')} type="date" value={h.start_date} onChange={(value) => set('hiring.start_date', value)} />
                    </Field>
                    <Field id={fieldId('hiring.probation_months')} label="Испытательный срок">
                        <SelectInput
                            id={fieldId('hiring.probation_months')}
                            value={String(h.probation_months ?? 0)}
                            onChange={(value) => set('hiring.probation_months', Number(value ?? 0))}
                            options={options.probation.map((item) => ({ value: String(item.value), label: item.label }))}
                        />
                    </Field>
                </div>
                <label className="flex items-start gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800">
                    <input
                        type="checkbox"
                        checked={isReplacement}
                        onChange={(event) => set('contract.term', event.target.checked ? 'replacement' : null)}
                        className="mt-0.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                    <span>
                        На время замещения работника
                        <span className="block text-xs text-slate-500">Срок договора станет «на время замещения».</span>
                    </span>
                </label>
                {isReplacement && (
                    <Field id={fieldId('hiring.replaces')} label="Замещаемый работник">
                        <PersonCombobox id={fieldId('hiring.replaces')} value={h.replaces} onChange={(value) => set('hiring.replaces', value)} error={errors['hiring.replaces.full_name']} />
                    </Field>
                )}
            </Section>

            <Section title="Приказ о приёме" description="Номер подсказывается по счётчику приказов этого года." feeds={['order']}>
                <div className="grid gap-3 sm:grid-cols-2">
                    <Field id={fieldId('hiring.order_number')} label="Номер приказа" error={errors['hiring.order_number']}>
                        <TextInput id={fieldId('hiring.order_number')} value={h.order_number} onChange={(value) => set('hiring.order_number', value)} className="font-mono" maxLength={30} placeholder="412-К" />
                        <NumberHint kind="order" date={h.order_date || c.date} value={h.order_number} hiringId={hiringId} onApply={(value) => set('hiring.order_number', value)} />
                    </Field>
                    <Field id={fieldId('hiring.order_date')} label="Дата приказа" hint="По умолчанию — дата договора" error={errors['hiring.order_date']}>
                        <TextInput id={fieldId('hiring.order_date')} type="date" value={h.order_date} onChange={(value) => set('hiring.order_date', value)} />
                    </Field>
                </div>
                <Field
                    id={fieldId('hiring.fio_accusative')}
                    label="ФИО в приказе (кого?)"
                    error={errors['hiring.fio_accusative']}
                    hint={h.fio_accusative_manual ? 'Исправлено вручную — автоматически больше не меняется.' : 'Склоняется автоматически, можно исправить вручную.'}
                >
                    <div className="flex gap-2">
                        <TextInput id={fieldId('hiring.fio_accusative')} value={h.fio_accusative} onChange={(value) => set('hiring.fio_accusative', value)} placeholder={autoAccusative} />
                        {h.fio_accusative_manual && (
                            <button type="button" onClick={onAccusativeReset} className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-50" title="Склонять автоматически">
                                <RotateCcw className="h-3.5 w-3.5" /> Авто
                            </button>
                        )}
                    </div>
                </Field>
            </Section>
        </div>
    );
}
