import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { useState } from 'react';
import UpdateProfileInformationForm from './Partials/UpdateProfileInformationForm';


const getInitials = (name) => {
    if (!name) {
        return 'U';
    }

    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('');
};

export default function Edit({ mustVerifyEmail, status, profile }) {
    const [isEditing, setIsEditing] = useState(false);
    const [avatarFailed, setAvatarFailed] = useState(false);
    const avatarSrc = profile.avatar_url && !avatarFailed ? profile.avatar_url : null;
    const isStudent = profile.role_slug === 'student';

    const handleEdit = () => setIsEditing(true);
    const handleCancel = () => setIsEditing(false);

    const copyToClipboard = async (value) => {
        if (!value) {
            return;
        }

        try {
            await navigator.clipboard.writeText(value);
        } catch {
            window.prompt('Скопируйте значение вручную', value);
        }
    };

    return (
        <AuthenticatedLayout>
            <Head title="Profile" />

            <div className="bg-gray-50 py-6 sm:py-8">
                <div className="flex w-full flex-col gap-6 px-4 sm:px-6 lg:px-8">
                    <section className="relative overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
                        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-slate-900 via-slate-700 to-emerald-500" />
                        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                                <div className="relative h-24 w-24 overflow-hidden rounded-full bg-gradient-to-br from-slate-900 via-slate-700 to-emerald-500 p-1 shadow-lg ring-4 ring-white sm:h-28 sm:w-28">
                                    <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-white">
                                        {avatarSrc ? (
                                            <img
                                                src={avatarSrc}
                                                alt={profile.name}
                                                className="h-full w-full object-cover"
                                                onError={() => setAvatarFailed(true)}
                                            />
                                        ) : (
                                            <span className="text-2xl font-bold tracking-tight text-slate-800 sm:text-3xl">
                                                {getInitials(profile.name)}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="min-w-0 space-y-4">
                                    <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
                                                {profile.name}
                                            </h1>
                                        </div>
                                        <p className="mt-2 text-sm font-medium text-gray-600 sm:text-base">
                                            {isStudent ? profile.role_label : `${profile.position_title || 'Степень не указана'} · ${profile.role_label}`}
                                        </p>
                                        {!isStudent && (
                                            <p className="mt-1 text-sm text-gray-500">
                                                {profile.faculty?.name || 'Факультет не привязан'} · {profile.department?.name || 'Кафедра не привязана'}
                                            </p>
                                        )}
                                    </div>

                                    <div className="grid gap-2.5 text-sm text-gray-600 sm:grid-cols-1">
                                        <div className="rounded-2xl bg-gray-50 px-4 py-3">
                                            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-gray-400">Почта</div>
                                            <div className="mt-2 flex flex-wrap items-center gap-2 font-medium text-gray-900">
                                                <span>{profile.email}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => copyToClipboard(profile.email)}
                                                    className="rounded-full border border-gray-200 px-2.5 py-0.5 text-[11px] font-semibold text-gray-600 transition hover:border-gray-300 hover:text-gray-900"
                                                >
                                                    Копировать
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </section>

                    <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
                        <div className="space-y-6">
                            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                                <UpdateProfileInformationForm
                                    mustVerifyEmail={mustVerifyEmail}
                                    status={status}
                                    profile={profile}
                                    editing={isEditing}
                                    onEdit={handleEdit}
                                    onCancel={handleCancel}
                                />
                            </div>
                        </div>

                        <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
                            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                                <h3 className="text-lg font-semibold text-gray-900">Связи и привязки</h3>
                                <p className="mt-1 text-sm text-gray-500">
                                    {isStudent
                                        ? 'Привязка к учебной группе и связанным академическим данным.'
                                        : 'Факультет, кафедра и подразделения, которые уже назначены в системе.'}
                                </p>

                                <div className="mt-4 space-y-4">
                                    {!isStudent && (
                                        <>
                                            {[
                                                { label: 'Факультет', value: profile.faculty?.name },
                                                { label: 'Кафедра', value: profile.department?.name },
                                            ].map((item) => (
                                                <div key={item.label} className="rounded-2xl border border-gray-100 p-4">
                                                    <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-gray-400">{item.label}</div>
                                                    <div className="mt-2 text-sm font-semibold text-gray-900">{item.value || 'Не привязан'}</div>
                                                </div>
                                            ))}
                                        </>
                                    )}

                                    {profile.student_binding && (
                                        <>
                                            {[
                                                { label: 'Группа', value: profile.student_binding.group?.name },
                                                { label: 'Кафедра (группа)', value: profile.student_binding.department?.name },
                                                { label: 'Специальность', value: profile.student_binding.speciality?.name },
                                                { label: 'ОП', value: profile.student_binding.educational_program?.name },
                                            ].map((item) => (
                                                <div key={item.label} className="rounded-2xl border border-gray-100 p-4">
                                                    <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-gray-400">{item.label}</div>
                                                    <div className="mt-2 text-sm font-semibold text-gray-900">{item.value || 'Не привязан'}</div>
                                                </div>
                                            ))}
                                        </>
                                    )}

                                    {!isStudent && (
                                        <div className="rounded-2xl border border-gray-100 p-4">
                                            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-gray-400">Подразделения</div>
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {profile.divisions.length > 0 ? (
                                                    profile.divisions.map((division) => (
                                                        <span
                                                            key={division.id}
                                                            className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700"
                                                        >
                                                            {division.name}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-100">
                                                        Не привязан
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
