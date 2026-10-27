import TextInput from '@/Components/TextInput';
import { InfoField, Notice, qdFieldClass } from '@/components/platform';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Transition } from '@headlessui/react';
import { Link, useForm } from '@inertiajs/react';
import { useEffect, useMemo } from 'react';

function FieldError({ message }) {
    return message ? <p className="mt-1.5 text-sm text-red-700">{message}</p> : null;
}

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
    const identityEditable = Boolean(profile.identity_editable);
    const isStudent = profile.role_slug === 'student';
    const faculties = profile.academic_bindings?.faculties ?? [];
    const departments = profile.academic_bindings?.departments ?? [];
    const positions = profile.academic_bindings?.positions ?? [];
    const pendingAcademicFaculty = faculties.find((faculty) => String(faculty.id) === String(profile.pending_academic_request?.faculty_id ?? ''));
    const pendingAcademicDepartment = departments.find((department) => String(department.id) === String(profile.pending_academic_request?.department_id ?? ''));
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
            request_comment: profile.snapshot.request_comment ?? '',
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
            request_comment: profile.snapshot.request_comment ?? '',
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
            <header className="flex flex-col gap-3 border-b border-slate-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="font-display text-lg font-bold text-[#102945]">
                        Профиль и контакты
                    </h2>

                    <p className="mt-0.5 text-sm text-slate-600">
                        Обновляйте персональные данные, рабочие сведения и контактные поля.
                    </p>
                </div>

                <div className="flex flex-wrap gap-2">
                    {!editing && (
                        <Button type="button" variant="outline" onClick={onEdit}>
                            Редактировать профиль
                        </Button>
                    )}
                    {editing && (
                        <Button type="button" variant="outline" onClick={onCancel}>
                            Режим просмотра
                        </Button>
                    )}
                </div>
            </header>

            <form onSubmit={submit} className="mt-4 space-y-4">
                {!editing && (
                    <div className="space-y-4">
                        <div className="grid gap-x-6 gap-y-3 md:grid-cols-2 xl:grid-cols-4">
                            {[
                                ['name', 'ФИО', profile.snapshot.name || 'Не указано'],
                                ['email', 'Почта', profile.snapshot.email || 'Не указано'],
                            ].map(([key, label, value]) => (
                                <InfoField key={key} label={label}>{value}</InfoField>
                            ))}

                            {!isStudent && (
                                <InfoField label="Степень">
                                    <div>
                                        <span className="font-normal text-slate-500">Текущая степень: </span>
                                        <span className="font-semibold">
                                            {latestSystemPosition || 'Не указана'}
                                        </span>
                                    </div>
                                    {profile.pending_position_request && (
                                        <div className="mt-1 text-sm">
                                            <span className="text-amber-700">На рассмотрении: </span>
                                            <span className="font-semibold text-amber-800">
                                                {profile.pending_position_request.requested_position || 'Не указана'}
                                            </span>
                                        </div>
                                    )}
                                    {profile.snapshot.position_confirmed === null && (
                                        <Badge variant="warning" className="mt-1.5">Требует подтверждения</Badge>
                                    )}
                                </InfoField>
                            )}

                            {canEditAcademicBindings && !isStudent && (
                                <>
                                    <InfoField label="Факультет">{profile.faculty?.name || 'Не указан'}</InfoField>
                                    <InfoField label="Кафедра">{profile.department?.name || 'Не указана'}</InfoField>
                                </>
                            )}

                            {profile.pending_academic_request && !isStudent && (
                                <div className="md:col-span-2 xl:col-span-4">
                                    <Notice tone="warning" title="Pending academic request">
                                        <p>{pendingAcademicFaculty?.name || 'Факультет не указан'} · {pendingAcademicDepartment?.name || 'Кафедра не указана'}</p>
                                        <p className="mt-1 text-xs text-slate-500">
                                            Создано: {profile.pending_academic_request.created_at || '—'}
                                        </p>
                                    </Notice>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {editing && (
                    <div className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <div className="space-y-2">
                                <Label htmlFor="name" className="block">ФИО</Label>
                                <TextInput
                                    id="name"
                                    className={`block w-full ${identityEditable ? '' : 'cursor-not-allowed bg-slate-100 text-slate-600'}`}
                                    value={data.name}
                                    onChange={(e) => setData('name', e.target.value)}
                                    readOnly={!identityEditable}
                                    tabIndex={identityEditable ? undefined : -1}
                                    required
                                    isFocused={identityEditable}
                                    autoComplete="name"
                                />
                                {!identityEditable && (
                                    <p className="text-xs text-slate-500">
                                        ФИО синхронизируется из AD и не меняется через self-service.
                                    </p>
                                )}
                                <FieldError message={errors.name} />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email" className="block">Почта</Label>
                                <TextInput
                                    id="email"
                                    type="email"
                                    className="block w-full cursor-not-allowed bg-slate-100 text-slate-600"
                                    value={data.email}
                                    readOnly
                                    tabIndex={-1}
                                    autoComplete="email"
                                />
                                <FieldError message={errors.email} />
                            </div>

                            {!isStudent && (
                                <div className="space-y-3 border-t border-slate-200 pt-4 md:col-span-2 xl:order-1 xl:col-span-4">
                                    <Label className="block">Степень</Label>

                                    {/* Current position value shown to user */}
                                    <div className="flex flex-wrap items-baseline gap-x-2">
                                        <span className="text-[0.9375rem] font-semibold text-slate-900">
                                            {latestSystemPosition || (
                                                <span className="font-normal text-slate-400">Не указана</span>
                                            )}
                                        </span>
                                        <span className="text-xs text-slate-500">— текущая степень в профиле</span>
                                    </div>

                                    {profile.snapshot.ad_title && (
                                        <p className="text-xs text-slate-500">
                                            Значение из системы кадров: {profile.snapshot.ad_title}
                                        </p>
                                    )}

                                    <Notice tone="info">
                                        Изменения степени, факультета и кафедры больше не применяются напрямую. После сохранения будет создана governance request, а effective access изменится только после approval.
                                    </Notice>

                                    {profile.has_pending_position_request && (
                                        <Notice tone="warning">
                                            Заявка на изменение степени уже на рассмотрении: {profile.pending_position_request?.requested_position || 'степень указана'}
                                        </Notice>
                                    )}

                                    {/* Confirmation buttons */}
                                    {!profile.has_pending_position_request && (
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="mr-1 text-sm text-slate-700">Это ваша степень?</span>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant={data.position_confirmed === true ? 'default' : 'outline'}
                                                aria-pressed={data.position_confirmed === true}
                                                onClick={() => setData((d) => ({ ...d, position_confirmed: true, position_id: '' }))}
                                            >
                                                Да, верно
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant={data.position_confirmed === false ? 'destructive' : 'outline'}
                                                aria-pressed={data.position_confirmed === false}
                                                onClick={() => setData((d) => ({ ...d, position_confirmed: false }))}
                                            >
                                                Нет, другая
                                            </Button>
                                        </div>
                                    )}

                                    {/* Position select – only when "No" */}
                                    {data.position_confirmed === false && (
                                        <div className="space-y-2">
                                            <Label htmlFor="position_id" className="block">Выберите степень из справочника</Label>
                                            <select
                                                id="position_id"
                                                className={qdFieldClass}
                                                value={data.position_id}
                                                onChange={(e) => setData('position_id', e.target.value)}
                                                disabled={profile.has_pending_position_request}
                                            >
                                                <option value="">— выберите степень —</option>
                                                {positions.map((p) => (
                                                    <option key={p.id} value={String(p.id)}>{p.name}</option>
                                                ))}
                                            </select>
                                            <FieldError message={errors.position_id} />
                                        </div>
                                    )}
                                </div>
                            )}

                            {canEditAcademicBindings && !isStudent && (
                                <>
                                    <div className="space-y-2">
                                        <Label htmlFor="faculty_id" className="block">Факультет</Label>

                                        <select
                                            id="faculty_id"
                                            className={qdFieldClass}
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

                                        <FieldError message={errors.faculty_id} />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="department_id" className="block">Кафедра</Label>

                                        <select
                                            id="department_id"
                                            className={qdFieldClass}
                                            value={data.department_id}
                                            onChange={(e) => setData('department_id', e.target.value)}
                                        >
                                            <option value="">Не выбрана</option>
                                            {availableDepartments.map((department) => (
                                                <option key={department.id} value={department.id}>{department.name}</option>
                                            ))}
                                        </select>

                                        <FieldError message={errors.department_id} />
                                    </div>
                                </>
                            )}

                            {!isStudent && (
                                <div className="space-y-2 md:col-span-2 xl:order-2 xl:col-span-4">
                                    <Label htmlFor="request_comment" className="block">Комментарий к заявке</Label>
                                    <Textarea
                                        id="request_comment"
                                        rows={2}
                                        value={data.request_comment}
                                        onChange={(e) => setData('request_comment', e.target.value)}
                                        placeholder="Кратко опишите причину изменения должности / привязки"
                                    />
                                    <FieldError message={errors.request_comment} />
                                </div>
                            )}
                        </div>

                        {mustVerifyEmail && !profile.email_verified_at && (
                            <Notice tone="warning" title="Email не подтверждён.">
                                <Link
                                    href={route('verification.send')}
                                    method="post"
                                    as="button"
                                    className="font-semibold text-teal-700 underline underline-offset-2 hover:text-[#102945]"
                                >
                                    Отправить письмо подтверждения ещё раз.
                                </Link>

                                {status === 'verification-link-sent' && (
                                    <p className="mt-2 font-medium text-emerald-700">
                                        Новая ссылка для подтверждения отправлена.
                                    </p>
                                )}
                            </Notice>
                        )}

                        <div className="mt-2 flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4">
                            <Transition
                                show={recentlySuccessful}
                                enter="transition ease-in-out"
                                enterFrom="opacity-0"
                                leave="transition ease-in-out"
                                leaveTo="opacity-0"
                            >
                                <p className="text-sm font-medium text-emerald-700">Сохранено.</p>
                            </Transition>

                            {onCancel && (
                                <Button type="button" variant="outline" onClick={onCancel}>
                                    Отмена
                                </Button>
                            )}
                            <Button type="submit" disabled={processing} className="h-auto min-h-10 whitespace-normal text-center">Сохранить и отправить на согласование</Button>
                        </div>
                    </div>
                )}
            </form>
        </section>
    );
}
