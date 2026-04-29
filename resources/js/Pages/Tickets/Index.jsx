import SiteHeader from '@/Components/SiteHeader';
import { Head, useForm } from '@inertiajs/react';
import '../../../css/welcome.css';

const typeOptions = [
    { value: 'facility', label: 'Хозяйственная' },
    { value: 'it', label: 'IT-поддержка' },
    { value: 'study', label: 'Учебный процесс' },
];

export default function Index({ flash = {} }) {
    const form = useForm({
        type: '',
        building: '',
        room: '',
        contact: '',
        description: '',
    });

    const submit = (e) => {
        e.preventDefault();

        form.post(route('tickets.store'), {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
            },
        });
    };

    return (
        <>
            <Head title="Подать заявку" />

            <div className="page">
                <div className="brand-blob" aria-hidden="true"></div>
                <div className="container">
                    <SiteHeader />

                    <h1 className="page-title">Подать заявку</h1>
                    <p className="subtitle">
                        Заполните форму, и обращение будет передано в соответствующую службу университета.
                    </p>

                    <section className="tiles-wrap">
                        {flash?.success && (
                            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                                {flash.success}
                            </div>
                        )}

                        <form onSubmit={submit}>
                            <div className="fr2 mt20">
                                <div className="field">
                                    <label htmlFor="type">Тип заявки</label>
                                    <select
                                        id="type"
                                        value={form.data.type}
                                        onChange={(e) => form.setData('type', e.target.value)}
                                    >
                                        <option value="" disabled>Выберите тип</option>
                                        {typeOptions.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                    {form.errors.type && <p className="text-sm text-red-600">{form.errors.type}</p>}
                                </div>

                                <div className="field">
                                    <label htmlFor="building">Корпус / Этаж</label>
                                    <input
                                        id="building"
                                        placeholder="Корпус 1, 3 этаж"
                                        value={form.data.building}
                                        onChange={(e) => form.setData('building', e.target.value)}
                                    />
                                    {form.errors.building && <p className="text-sm text-red-600">{form.errors.building}</p>}
                                </div>

                                <div className="field">
                                    <label htmlFor="room">Кабинет</label>
                                    <input
                                        id="room"
                                        placeholder="315"
                                        value={form.data.room}
                                        onChange={(e) => form.setData('room', e.target.value)}
                                    />
                                    {form.errors.room && <p className="text-sm text-red-600">{form.errors.room}</p>}
                                </div>

                                <div className="field">
                                    <label htmlFor="contact">Контакт (телефон / ID)</label>
                                    <input
                                        id="contact"
                                        placeholder="+7 7XX XXX XX XX"
                                        value={form.data.contact}
                                        onChange={(e) => form.setData('contact', e.target.value)}
                                    />
                                    {form.errors.contact && <p className="text-sm text-red-600">{form.errors.contact}</p>}
                                </div>

                                <div className="field full">
                                    <label className="field" htmlFor="description">Описание проблемы</label>
                                    <textarea
                                        id="description"
                                        className="tickets-textarea"
                                        placeholder="Опишите ситуацию..."
                                        value={form.data.description}
                                        onChange={(e) => form.setData('description', e.target.value)}
                                    />
                                    {form.errors.description && <p className="text-sm text-red-600">{form.errors.description}</p>}
                                </div>
                            </div>

                            <button className="btn btn-primary" type="submit" disabled={form.processing}>
                                {form.processing ? 'Отправка...' : 'Отправить заявку →'}
                            </button>
                        </form>
                    </section>
                </div>
            </div>
        </>
    );
}
