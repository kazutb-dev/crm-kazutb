import NumberHint from './NumberHint';
import { fieldId, formatMoney, parseIin } from './logic';
import { Field, Section, SelectInput, TextInput } from './ui';

const show = (value) => (value === null || value === undefined || String(value).trim() === '' ? '—' : value);
const date = (value) => (value ? value.split('-').reverse().join('.') : '—');

export default function StepContract({ state, set, errors, options, hiringId, onGoTo }) {
    const c = state.contract;
    const e = state.employee;
    const iin = parseIin(e.iin);
    const isShift = c.schedule === 'shift';
    const issuer = options.issuers.find((item) => item.value === (e.id_card_issuer ?? 'mvd'))?.label;
    const address = [e.city && `г. ${e.city}`, e.street, e.house && `д. ${e.house}`, e.apartment && `кв. ${e.apartment}`].filter(Boolean).join(', ');

    return (
        <div className="space-y-6">
            <Section title="Договор" feeds="договор · приказ">
                <div className="grid gap-3 sm:grid-cols-2">
                    <Field id={fieldId('contract.number')} label="Номер договора" error={errors['contract.number']}>
                        <TextInput id={fieldId('contract.number')} value={c.number} onChange={(value) => set('contract.number', value)} className="font-mono" maxLength={30} placeholder="412" />
                        <NumberHint kind="contract" date={c.date} value={c.number} hiringId={hiringId} onApply={(value) => set('contract.number', value)} />
                    </Field>
                    <Field id={fieldId('contract.date')} label="Дата договора" error={errors['contract.date']}>
                        <TextInput id={fieldId('contract.date')} type="date" value={c.date} onChange={(value) => set('contract.date', value)} />
                    </Field>
                </div>
                <Field id={fieldId('contract.term')} label="Срок трудового договора" error={errors['contract.term']} className="sm:max-w-sm">
                    <SelectInput id={fieldId('contract.term')} value={c.term} onChange={(value) => set('contract.term', value)} options={options.terms} placeholder="—" />
                </Field>
            </Section>

            <Section title="Оплата и режим" feeds="договор">
                <div className="grid gap-3 sm:grid-cols-2">
                    <Field id={fieldId('contract.salary')} label="Должностной оклад, ₸" error={errors['contract.salary']}>
                        <TextInput
                            id={fieldId('contract.salary')}
                            value={formatMoney(c.salary)}
                            onChange={(value) => {
                                const digits = value.replace(/\D/g, '').slice(0, 9);
                                set('contract.salary', digits === '' ? null : Number(digits));
                            }}
                            inputMode="numeric"
                            className="font-mono"
                            placeholder="385 000"
                        />
                    </Field>
                    <Field id={fieldId('contract.vacation_days')} label="Дней трудового отпуска" error={errors['contract.vacation_days']}>
                        <TextInput
                            id={fieldId('contract.vacation_days')}
                            value={c.vacation_days ?? ''}
                            onChange={(value) => {
                                const digits = value.replace(/\D/g, '').slice(0, 3);
                                set('contract.vacation_days', digits === '' ? null : Number(digits));
                            }}
                            inputMode="numeric"
                            className="font-mono"
                        />
                    </Field>
                </div>
                <Field id={fieldId('contract.schedule')} label="График работы (пункт 3.1)" error={errors['contract.schedule']}>
                    <SelectInput id={fieldId('contract.schedule')} value={c.schedule} onChange={(value) => set('contract.schedule', value)} options={options.schedules} placeholder="—" />
                </Field>
                {!isShift && (
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Field id={fieldId('contract.break_start')} label="Перерыв с (п. 3.1.3)" error={errors['contract.break_start']}>
                            <TextInput id={fieldId('contract.break_start')} value={c.break_start} onChange={(value) => set('contract.break_start', value)} placeholder="12.30" className="font-mono" maxLength={5} />
                        </Field>
                        <Field id={fieldId('contract.break_end')} label="Перерыв до" error={errors['contract.break_end']}>
                            <TextInput id={fieldId('contract.break_end')} value={c.break_end} onChange={(value) => set('contract.break_end', value)} placeholder="13.30" className="font-mono" maxLength={5} />
                        </Field>
                    </div>
                )}
                <div id={fieldId('contract.employment')} className="flex flex-wrap gap-4 text-sm">
                    {options.employments.map((item) => (
                        <label key={item.value} className="flex items-center gap-1.5">
                            <input type="radio" name="employment" checked={(c.employment ?? 'main') === item.value} onChange={() => set('contract.employment', item.value)} className="text-teal-600 focus:ring-teal-500" />
                            {item.label}
                        </label>
                    ))}
                </div>
            </Section>

            <Section title="Из карточки сотрудника" feeds="только просмотр">
                <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[10rem_1fr]">
                    <dt className="text-slate-500">ИИН</dt>
                    <dd className="font-mono">{iin.valid ? e.iin : '—'}</dd>
                    <dt className="text-slate-500">Удостоверение</dt>
                    <dd>{e.id_card_number ? `№${e.id_card_number}, ${date(e.id_card_issued_at)}, ${issuer}` : '—'}</dd>
                    <dt className="text-slate-500">Адрес</dt>
                    <dd>{show(address)}</dd>
                    <dt className="text-slate-500">Телефон</dt>
                    <dd>{show(e.phone)}</dd>
                </dl>
                <button type="button" onClick={() => onGoTo({ step: 1, field: 'employee.iin' })} className="text-xs font-medium text-teal-700 hover:underline">
                    Изменить на шаге «Сотрудник»
                </button>
            </Section>
        </div>
    );
}
