import NumberHint from './NumberHint';
import { fieldId, formatMoney, parseIin } from './logic';
import { ChoiceGroup, Field, Section, SelectInput, TextInput } from './ui';

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
            <Section title="Номер и срок договора" description="Номер подсказывается по счётчику договоров этого года." feeds={['contract', 'order']}>
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field id={fieldId('contract.number')} label="Номер договора" error={errors['contract.number']}>
                        <TextInput id={fieldId('contract.number')} value={c.number} onChange={(value) => set('contract.number', value)} className="font-mono" maxLength={30} placeholder="412" />
                        <NumberHint kind="contract" date={c.date} value={c.number} hiringId={hiringId} onApply={(value) => set('contract.number', value)} />
                    </Field>
                    <Field id={fieldId('contract.date')} label="Дата договора" error={errors['contract.date']}>
                        <TextInput id={fieldId('contract.date')} type="date" value={c.date} onChange={(value) => set('contract.date', value)} />
                    </Field>
                </div>
                <Field id={fieldId('contract.term')} label="Срок трудового договора" error={errors['contract.term']} className="sm:max-w-sm">
                    <SelectInput id={fieldId('contract.term')} value={c.term} onChange={(value) => set('contract.term', value)} options={options.terms} placeholder="Выберите" />
                </Field>
            </Section>

            <Section title="Оплата и режим работы" description="Отпуск и график подставляются по категории персонала — их можно изменить." feeds={['contract']}>
                <div className="grid gap-4 sm:grid-cols-2">
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
                    <SelectInput id={fieldId('contract.schedule')} value={c.schedule} onChange={(value) => set('contract.schedule', value)} options={options.schedules} placeholder="Выберите" />
                </Field>
                {!isShift && (
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field id={fieldId('contract.break_start')} label="Перерыв с (п. 3.1.3)" error={errors['contract.break_start']}>
                            <TextInput id={fieldId('contract.break_start')} value={c.break_start} onChange={(value) => set('contract.break_start', value)} placeholder="12.30" className="font-mono" maxLength={5} />
                        </Field>
                        <Field id={fieldId('contract.break_end')} label="Перерыв до" error={errors['contract.break_end']}>
                            <TextInput id={fieldId('contract.break_end')} value={c.break_end} onChange={(value) => set('contract.break_end', value)} placeholder="13.30" className="font-mono" maxLength={5} />
                        </Field>
                    </div>
                )}
                <Field id={fieldId('contract.employment')} label="Вид работы">
                    <ChoiceGroup
                        id={fieldId('contract.employment')}
                        label="Вид работы"
                        value={c.employment ?? 'main'}
                        onChange={(value) => set('contract.employment', value)}
                        options={options.employments}
                    />
                </Field>
            </Section>

            <Section title="Проверьте данные сотрудника" note="Только просмотр: так эти данные попадут в договор.">
                <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-1 border-b border-slate-200 pb-3">
                        <dt className="qd-field-label text-slate-500">ИИН</dt>
                        <dd className="font-mono text-[0.9375rem] font-medium text-slate-900">{iin.valid ? e.iin : '—'}</dd>
                    </div>
                    <div className="flex flex-col gap-1 border-b border-slate-200 pb-3">
                        <dt className="qd-field-label text-slate-500">Удостоверение</dt>
                        <dd className="text-[0.9375rem] font-medium text-slate-900">{e.id_card_number ? `№${e.id_card_number}, ${date(e.id_card_issued_at)}, ${issuer}` : '—'}</dd>
                    </div>
                    <div className="flex flex-col gap-1 border-b border-slate-200 pb-3">
                        <dt className="qd-field-label text-slate-500">Адрес</dt>
                        <dd className="text-[0.9375rem] font-medium text-slate-900">{show(address)}</dd>
                    </div>
                    <div className="flex flex-col gap-1 border-b border-slate-200 pb-3">
                        <dt className="qd-field-label text-slate-500">Телефон</dt>
                        <dd className="text-[0.9375rem] font-medium text-slate-900">{show(e.phone)}</dd>
                    </div>
                </dl>
                <button type="button" onClick={() => onGoTo({ step: 1, field: 'employee.iin' })} className="text-xs font-bold uppercase tracking-[0.08em] text-teal-700 underline-offset-4 hover:text-[#102945] hover:underline">
                    Изменить на шаге «Сотрудник»
                </button>
            </Section>
        </div>
    );
}
