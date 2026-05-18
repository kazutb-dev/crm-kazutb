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
    onCancel,
    className = '',
}) {
    const canEditAcademicBindings = Boolean(profile.academic_bindings?.can_edit);
    const faculties = profile.academic_bindings?.faculties ?? [];
    const departments = profile.academic_bindings?.departments ?? [];
    const { data, setData, patch, errors, processing, recentlySuccessful, reset } =
        useForm({
            name: profile.snapshot.name ?? '',
            email: profile.snapshot.email ?? '',
            position_title: profile.snapshot.position_title ?? '',
            office_location: profile.snapshot.office_location ?? '',
            bio: profile.snapshot.bio ?? '',
            avatar_url: profile.snapshot.avatar_url ?? '',
            profile_visibility: profile.snapshot.profile_visibility ?? 'internal',
            faculty_id: profile.snapshot.faculty_id ? String(profile.snapshot.faculty_id) : '',
            department_id: profile.snapshot.department_id ? String(profile.snapshot.department_id) : '',
        });

    const availableDepartments = useMemo(() => {
        if (!data.faculty_id) {
            return departments;
        }

        return departments.filter((department) => String(department.faculty_id ?? '') === String(data.faculty_id));
    }, [data.faculty_id, departments]);

    useEffect(() => {
        setData({
            name: profile.snapshot.name ?? '',
            email: profile.snapshot.email ?? '',
            position_title: profile.snapshot.position_title ?? '',
            office_location: profile.snapshot.office_location ?? '',
            bio: profile.snapshot.bio ?? '',
            avatar_url: profile.snapshot.avatar_url ?? '',
            profile_visibility: profile.snapshot.profile_visibility ?? 'internal',
            faculty_id: profile.snapshot.faculty_id ? String(profile.snapshot.faculty_id) : '',
            department_id: profile.snapshot.department_id ? String(profile.snapshot.department_id) : '',
        });
    }, [profile, setData]);

    const submit = (e) => {
        e.preventDefault();

        patch(route('profile.update'), {
            preserveScroll: true,
            onSuccess: () => {
                reset();
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
                            onClick={onCancel}
                            className="inline-flex items-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:text-gray-900"
                        >
                            Режим просмотра
                        </button>
                    )}
                    {editing && (
                        <SecondaryButton type="button" onClick={onCancel}>
                            Отменить
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
                                ['position_title', 'Должность', profile.snapshot.position_title || 'Не указана'],
                                ['office_location', 'Локация', profile.snapshot.office_location || 'Не указана'],
                            ].map(([key, label, value]) => (
                                <div key={key} className="rounded-2xl bg-gray-50 p-3.5">
                                    <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-gray-400">{label}</div>
                                    <div className="mt-2 text-sm font-semibold text-gray-900">{value}</div>
                                </div>
                            ))}

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

                        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3.5 text-sm text-gray-600">
                            {profile.sync_status === 'ad' ? (
                                <p>
                                    Профиль синхронизирован с AD. Локальные поля можно редактировать, но некоторые исходные данные могут быть обновлены при следующей синхронизации.
                                </p>
                            ) : (
                                <p>
                                    Профиль ведётся локально и не зависит от AD.
                                </p>
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



                            <div>
                                <InputLabel htmlFor="position_title" value="Должность" />

                                <TextInput
                                    id="position_title"
                                    type="text"
                                    className="mt-1 block w-full"
                                    value={data.position_title}
                                    onChange={(e) => setData('position_title', e.target.value)}
                                    placeholder="Официальная должность"
                                />

                                <InputError className="mt-2" message={errors.position_title} />
                            </div>

                            <div>
                                <InputLabel htmlFor="office_location" value="Локация" />

                                <TextInput
                                    id="office_location"
                                    type="text"
                                    className="mt-1 block w-full"
                                    value={data.office_location}
                                    onChange={(e) => setData('office_location', e.target.value)}
                                    placeholder="Корпус, кабинет, этаж"
                                />

                                <InputError className="mt-2" message={errors.office_location} />
                            </div>

                            <div className="lg:col-span-2">
                                <InputLabel htmlFor="avatar_url" value="Ссылка на аватар" />

                                <TextInput
                                    id="avatar_url"
                                    type="url"
                                    className="mt-1 block w-full"
                                    value={data.avatar_url}
                                    onChange={(e) => setData('avatar_url', e.target.value)}
                                    placeholder="https://..."
                                />

                                <InputError className="mt-2" message={errors.avatar_url} />
                            </div>

                            <div>
                                <InputLabel htmlFor="profile_visibility" value="Видимость" />

                                <select
                                    id="profile_visibility"
                                    className="mt-1 block w-full rounded-xl border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:ring-slate-500"
                                    value={data.profile_visibility}
                                    onChange={(e) => setData('profile_visibility', e.target.value)}
                                >
                                    <option value="public">Публичный</option>
                                    <option value="internal">Внутренний</option>
                                    <option value="private">Приватный</option>
                                </select>

                                <InputError className="mt-2" message={errors.profile_visibility} />
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

                        <div>
                            <InputLabel htmlFor="bio" value="О себе" />

                            <textarea
                                id="bio"
                                rows="4"
                                className="mt-1 block w-full rounded-2xl border-gray-300 px-4 py-3 text-sm shadow-sm focus:border-slate-500 focus:ring-slate-500"
                                value={data.bio}
                                onChange={(e) => setData('bio', e.target.value)}
                                placeholder="Короткое описание, интересы, рабочие заметки"
                            />

                            <InputError className="mt-2" message={errors.bio} />
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

                {!editing && (
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-xs leading-6 text-slate-600">
                        {profile.sync_status === 'ad'
                            ? 'Часть данных может обновляться из AD. Локальные поля профиля остаются доступными для редактирования.'
                            : 'Профиль заполняется локально. Вы можете редактировать персональные и контактные поля самостоятельно.'}
                    </div>
                )}
            </form>
        </section>
    );
}
