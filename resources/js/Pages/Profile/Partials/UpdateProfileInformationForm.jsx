import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';
import { Transition } from '@headlessui/react';
import { Link, useForm } from '@inertiajs/react';
import { useEffect, useMemo } from 'react';

export default function UpdateProfileInformation({
    mustVerifyEmail,
    status,
    profile,
    editing,
    onEdit,
    onCancel,
    className = '',
}) {
    const toSelectValue = (value, fallback = '') => {
        if (value === null || value === undefined || value === '') {
            return fallback;
        }

        return String(value);
    };

    const canEditAcademicBindings = Boolean(profile.academic_bindings?.can_edit);
    const faculties = profile.academic_bindings?.faculties ?? [];
    const departments = profile.academic_bindings?.departments ?? [];
    const positions = profile.academic_bindings?.positions ?? [];
    const { data, setData, patch, errors, processing, recentlySuccessful } =
        useForm({
            name: profile.snapshot.name ?? '',
            email: profile.snapshot.email ?? '',
            position_confirmed: profile.snapshot.position_confirmed ?? null,
            position_id: profile.snapshot.position_id ?? '',
            office_location: profile.snapshot.office_location ?? '',
            bio: profile.snapshot.bio ?? '',
            avatar_url: profile.snapshot.avatar_url ?? '',
            profile_visibility: profile.snapshot.profile_visibility ?? 'internal',
            faculty_id: toSelectValue(profile.snapshot.faculty_id, toSelectValue(profile.faculty?.id)),
            department_id: toSelectValue(profile.snapshot.department_id, toSelectValue(profile.department?.id)),
        });

    const availableDepartments = useMemo(() => {
        if (!data.faculty_id) {
            return departments;
        }

        return departments.filter((department) => String(department.faculty_id ?? '') === String(data.faculty_id));
    }, [data.faculty_id, departments]);

    const latestSystemPosition =
        profile.position_title
        || profile.snapshot.position_title
        || profile.snapshot.ad_title
        || '';

    useEffect(() => {
        setData({
            name: profile.snapshot.name ?? '',
            email: profile.snapshot.email ?? '',
            position_confirmed: profile.snapshot.position_confirmed ?? null,
            position_id: profile.snapshot.position_id ?? '',
            office_location: profile.snapshot.office_location ?? '',
            bio: profile.snapshot.bio ?? '',
            avatar_url: profile.snapshot.avatar_url ?? '',
            profile_visibility: profile.snapshot.profile_visibility ?? 'internal',
            faculty_id: toSelectValue(profile.snapshot.faculty_id, toSelectValue(profile.faculty?.id)),
            department_id: toSelectValue(profile.snapshot.department_id, toSelectValue(profile.department?.id)),
        });
    }, [profile, setData]);

    const submit = (e) => {
        e.preventDefault();

        patch(route('profile.update'), {
            preserveScroll: true,
            preserveState: false,
            onSuccess: () => {
                onCancel?.();
            },
        });
    };

    const currentCompletion = profile.profile_completion_percent ?? profile.profile_completion ?? 0;

    return (
        <section className={className}>
            <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                        Профиль и контакты
                    </h2>

                    <p className="mt-1 text-sm leading-6 text-gray-500">
                        Обновляйте персональные данные, рабочие сведения и контактные поля.
                    </p>
                </div>

                <div className="flex flex-wrap gap-2">
                    {!editing && (
                        <button
                            type="button"
                            onClick={onEdit}
                            className="inline-flex items-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:text-gray-900"
                        >
                            Редактировать профиль
                        </button>
                    )}
                    {editing && (
                        <SecondaryButton type="button" onClick={onCancel}>
                            Режим просмотра
                        </SecondaryButton>
                    )}
                </div>
            </header>

            <form onSubmit={submit} className="mt-5 space-y-5">
                {!editing && (
                    <div className="space-y-4">
                        <div className="grid gap-3 md:grid-cols-2">
                            {[
                                ['name', 'ФИО', profile.snapshot.name || 'Не указано'],
                                ['email', 'Почта', profile.snapshot.email || 'Не указано'],
                            ].map(([key, label, value]) => (
                                <div key={key} className="rounded-2xl bg-gray-50 p-3.5">
                                    <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-gray-400">{label}</div>
                                    <div className="mt-2 text-sm font-semibold text-gray-900">{value}</div>
                                </div>
                            ))}

                            {/* Degree view card */}
                            <div className="rounded-2xl bg-gray-50 p-3.5">
                                <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-gray-400">Степень</div>
                                <div className="mt-2 text-sm text-gray-900">
                                    <div>
                                        <span className="text-gray-500">Текущая степень: </span>
                                        <span className="font-semibold">
                                            {latestSystemPosition || 'Не указана'}
                                        </span>
                                    </div>
                                    {profile.pending_position_request && (
                                        <div className="mt-1">
                                            <span className="text-amber-600">На рассмотрении: </span>
                                            <span className="font-semibold text-amber-700">
                                                {profile.pending_position_request.requested_position || 'Не указана'}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                {profile.snapshot.position_confirmed === null && (
                                    <div className="mt-1 text-[11px] text-amber-500">Требует подтверждения</div>
                                )}
                            </div>

                            {canEditAcademicBindings && (
                                <>
                                    <div className="rounded-2xl bg-gray-50 p-3.5">
                                        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-gray-400">Факультет</div>
                                        <div className="mt-2 text-sm font-semibold text-gray-900">{profile.faculty?.name || 'Не указан'}</div>
                                    </div>
                                    <div className="rounded-2xl bg-gray-50 p-3.5">
                                        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-gray-400">Кафедра</div>
                                        <div className="mt-2 text-sm font-semibold text-gray-900">{profile.department?.name || 'Не указана'}</div>
                                    </div>
                                </>
                            )}
                        </div>

                    </div>
                )}

                {editing && (
                    <div className="space-y-5">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <InputLabel htmlFor="name" value="ФИО" />
                                <TextInput
                                    id="name"
                                    className="mt-1 block w-full"
                                    value={data.name}
                                    onChange={(e) => setData('name', e.target.value)}
                                    required
                                    isFocused
                                    autoComplete="name"
                                />
                                <InputError className="mt-2" message={errors.name} />
                            </div>

                            <div>
                                <InputLabel htmlFor="email" value="Почта" />
                                <TextInput
                                    id="email"
                                    type="email"
                                    className="mt-1 block w-full bg-gray-100 cursor-not-allowed"
                                    value={data.email}
                                    readOnly
                                    tabIndex={-1}
                                    autoComplete="email"
                                />
                                <InputError className="mt-2" message={errors.email} />
                            </div>



                            <div className="md:col-span-2">
                                <InputLabel value="Степень" />

                                {/* Current position value shown to user */}
                                <div className="mt-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                                    {latestSystemPosition || (
                                        <span className="text-gray-400">Не указана</span>
                                    )}
                                </div>

                                <p className="mt-1 text-xs text-gray-400">
                                    Текущая степень в профиле
                                </p>

                                {profile.has_pending_position_request && (
                                    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                                        Заявка на изменение степени уже на рассмотрении: {profile.pending_position_request?.requested_position || 'степень указана'}
                                    </div>
                                )}

                                {profile.snapshot.ad_title && (
                                    <p className="mt-1 text-xs text-gray-400">
                                        Значение из системы кадров: {profile.snapshot.ad_title}
                                    </p>
                                )}

                                {/* Confirmation buttons */}
                                {!profile.has_pending_position_request && (
                                    <div className="mt-3 flex flex-wrap items-center gap-2">
                                        <span className="text-sm text-gray-600">Это ваша степень?</span>
                                        <button
                                            type="button"
                                            onClick={() => setData((d) => ({ ...d, position_confirmed: true, position_id: '' }))}
                                            className={`rounded-lg border px-3 py-1 text-sm font-medium transition ${
                                                data.position_confirmed === true
                                                    ? 'border-emerald-600 bg-emerald-600 text-white'
                                                    : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                                            }`}
                                        >
                                            Да, верно
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setData((d) => ({ ...d, position_confirmed: false }))}
                                            className={`rounded-lg border px-3 py-1 text-sm font-medium transition ${
                                                data.position_confirmed === false
                                                    ? 'border-rose-500 bg-rose-500 text-white'
                                                    : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                                            }`}
                                        >
                                            Нет, другая
                                        </button>
                                    </div>
                                )}

                                {/* Position select – only when "No" */}
                                {data.position_confirmed === false && (
                                    <div className="mt-3">
                                        <InputLabel htmlFor="position_id" value="Выберите степень из справочника" />
                                        <select
                                            id="position_id"
                                            className="mt-1 block w-full rounded-xl border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:ring-slate-500"
                                            value={data.position_id}
                                            onChange={(e) => setData('position_id', e.target.value)}
                                            disabled={profile.has_pending_position_request}
                                        >
                                            <option value="">— выберите степень —</option>
                                            {positions.map((p) => (
                                                <option key={p.id} value={String(p.id)}>{p.name}</option>
                                            ))}
                                        </select>
                                        <InputError className="mt-2" message={errors.position_id} />
                                    </div>
                                )}
                            </div>

                            {canEditAcademicBindings && (
                                <>
                                    <div>
                                        <InputLabel htmlFor="faculty_id" value="Факультет" />

                                        <select
                                            id="faculty_id"
                                            className="mt-1 block w-full rounded-xl border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:ring-slate-500"
                                            value={data.faculty_id}
                                            onChange={(e) => {
                                                const facultyId = e.target.value;
                                                setData((current) => ({
                                                    ...current,
                                                    faculty_id: facultyId,
                                                    department_id: current.department_id && facultyId && !departments.some(
                                                        (department) => String(department.id) === String(current.department_id)
                                                            && String(department.faculty_id ?? '') === String(facultyId),
                                                    )
                                                        ? ''
                                                        : facultyId === ''
                                                            ? ''
                                                            : current.department_id,
                                                }));
                                            }}
                                        >
                                            <option value="">Не выбран</option>
                                            {faculties.map((faculty) => (
                                                <option key={faculty.id} value={faculty.id}>{faculty.name}</option>
                                            ))}
                                        </select>

                                        <InputError className="mt-2" message={errors.faculty_id} />
                                    </div>

                                    <div>
                                        <InputLabel htmlFor="department_id" value="Кафедра" />

                                        <select
                                            id="department_id"
                                            className="mt-1 block w-full rounded-xl border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:ring-slate-500"
                                            value={data.department_id}
                                            onChange={(e) => setData('department_id', e.target.value)}
                                        >
                                            <option value="">Не выбрана</option>
                                            {availableDepartments.map((department) => (
                                                <option key={department.id} value={department.id}>{department.name}</option>
                                            ))}
                                        </select>

                                        <InputError className="mt-2" message={errors.department_id} />
                                    </div>
                                </>
                            )}
                        </div>

                        {mustVerifyEmail && !profile.email_verified_at && (
                            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-3.5 text-sm text-amber-800">
                                <p>
                                    Email не подтверждён.
                                    <Link
                                        href={route('verification.send')}
                                        method="post"
                                        as="button"
                                        className="ml-1 font-semibold underline decoration-amber-300 underline-offset-2 hover:text-amber-900"
                                    >
                                        Отправить письмо подтверждения ещё раз.
                                    </Link>
                                </p>

                                {status === 'verification-link-sent' && (
                                    <p className="mt-2 font-medium text-emerald-700">
                                        Новая ссылка для подтверждения отправлена.
                                    </p>
                                )}
                            </div>
                        )}

                        <div className="flex flex-wrap items-center gap-3">
                            <PrimaryButton disabled={processing}>Сохранить</PrimaryButton>

                            <Transition
                                show={recentlySuccessful}
                                enter="transition ease-in-out"
                                enterFrom="opacity-0"
                                leave="transition ease-in-out"
                                leaveTo="opacity-0"
                            >
                                <p className="text-sm font-medium text-emerald-700">Сохранено.</p>
                            </Transition>
                        </div>
                    </div>
                )}
            </form>
        </section>
    );
}
