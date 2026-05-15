import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import UpdatePasswordForm from './Partials/UpdatePasswordForm';
import UpdateProfileInformationForm from './Partials/UpdateProfileInformationForm';

const visibilityStyles = {
    public: 'bg-blue-50 text-blue-700 ring-blue-100',
    internal: 'bg-amber-50 text-amber-800 ring-amber-100',
    private: 'bg-red-50 text-red-700 ring-red-100',
};

const syncStyles = {
    ad: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    local: 'bg-slate-100 text-slate-700 ring-slate-200',
};

const visibilityLabels = {
    public: 'Публичный',
    internal: 'Внутренний',
    private: 'Приватный',
};

const visibilityChips = {
    public: 'bg-blue-50 text-blue-700 ring-blue-100',
    internal: 'bg-amber-50 text-amber-800 ring-amber-100',
    private: 'bg-red-50 text-red-700 ring-red-100',
};

const syncLabels = {
    ad: 'AD-синхронизация',
    local: 'Локальный аккаунт',
};

const formatDateTime = (value) => {
    if (!value) {
        return 'Не указано';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return 'Не указано';
    }

    return new Intl.DateTimeFormat('ru-RU', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date);
};

const formatRelativeTime = (value) => {
    if (!value) {
        return 'Нет данных';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return 'Нет данных';
    }

    const diffMinutes = Math.round((Date.now() - date.getTime()) / 60000);

    if (diffMinutes < 1) {
        return 'только что';
    }

    if (diffMinutes < 60) {
        return `${diffMinutes} мин назад`;
    }

    const diffHours = Math.round(diffMinutes / 60);

    if (diffHours < 24) {
        return `${diffHours} ч назад`;
    }

    const diffDays = Math.round(diffHours / 24);

    return `${diffDays} дн назад`;
};

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

const StatCard = ({ title, value, hint, tone = 'slate' }) => {
    const toneClasses = {
        slate: 'bg-slate-50 text-slate-900 ring-slate-200',
        blue: 'bg-blue-50 text-blue-900 ring-blue-100',
        amber: 'bg-amber-50 text-amber-900 ring-amber-100',
        emerald: 'bg-emerald-50 text-emerald-900 ring-emerald-100',
        rose: 'bg-rose-50 text-rose-900 ring-rose-100',
    };

    return (
        <div className="flex h-full flex-col justify-between rounded-2xl border border-gray-100 bg-white p-4 shadow-sm lg:p-5">
            <div className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${toneClasses[tone]}`}>
                {title}
            </div>
            <div className="mt-3 text-2xl font-semibold tracking-tight text-gray-900">
                {value}
            </div>
            <p className="mt-2 text-sm leading-5 text-gray-500">{hint}</p>
        </div>
    );
};

export default function Edit({ mustVerifyEmail, status, profile }) {
    const [isEditing, setIsEditing] = useState(false);
    const [avatarFailed, setAvatarFailed] = useState(false);

    const summaryCards = useMemo(() => [
        {
            title: 'Роль',
            value: profile.role_label,
            hint: profile.role_slug,
            tone: 'blue',
        },
        {
            title: 'Последний вход',
            value: formatRelativeTime(profile.last_login_at),
            hint: formatDateTime(profile.last_login_at),
            tone: 'emerald',
        },
        {
            title: 'Входы',
            value: profile.login_count,
            hint: 'Все успешные авторизации',
            tone: 'slate',
        },
        {
            title: 'Синхронизация',
            value: syncLabels[profile.sync_status] ?? profile.sync_label,
            hint: profile.sync_label,
            tone: profile.sync_status === 'ad' ? 'emerald' : 'slate',
        },
        {
            title: 'Заполнение',
            value: `${profile.profile_completion_percent ?? profile.profile_completion ?? 0}%`,
            hint: profile.profile_completed_at ? `Готово с ${formatDateTime(profile.profile_completed_at)}` : 'Требуются дополнительные данные',
            tone: (profile.profile_completion_percent ?? profile.profile_completion ?? 0) >= 100 ? 'emerald' : 'amber',
        },
        {
            title: 'Видимость',
            value: profile.profile_visibility_label,
            hint: 'Уровень доступа профиля',
            tone: profile.profile_visibility === 'public' ? 'blue' : profile.profile_visibility === 'private' ? 'rose' : 'amber',
        },
    ], [profile]);

    const visibilityBadgeClass = visibilityChips[profile.profile_visibility] ?? visibilityChips.internal;
    const syncBadgeClass = syncStyles[profile.sync_status] ?? syncStyles.local;
    const emailVerificationNeeded = mustVerifyEmail && !profile.email_verified_at;
    const avatarSrc = profile.avatar_url && !avatarFailed ? profile.avatar_url : null;

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

    const openTelegram = () => {
        if (!profile.telegram) {
            return;
        }

        const normalized = profile.telegram.replace(/^@/, '').replace(/^https?:\/\/(t\.me|telegram\.me)\//i, '');
        window.open(`https://t.me/${normalized}`, '_blank', 'noopener,noreferrer');
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
                                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${syncBadgeClass}`}>
                                                {profile.sync_label}
                                            </span>
                                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${visibilityBadgeClass}`}>
                                                {profile.profile_visibility_label}
                                            </span>
                                        </div>
                                        <p className="mt-2 text-sm font-medium text-gray-600 sm:text-base">
                                            {profile.position_title || 'Должность не указана'} · {profile.role_label}
                                        </p>
                                        <p className="mt-1 text-sm text-gray-500">
                                            {profile.faculty?.name || 'Факультет не привязан'} · {profile.department?.name || 'Кафедра не привязана'}
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap gap-1.5">
                                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${visibilityBadgeClass}`}>
                                            Видимость: {profile.profile_visibility_label}
                                        </span>
                                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200">
                                            Последний вход: {formatRelativeTime(profile.last_login_at)}
                                        </span>
                                        <span className="inline-flex items-center rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
                                            Обновлён: {formatDateTime(profile.updated_profile_at)}
                                        </span>
                                    </div>

                                    <div className="grid gap-2.5 text-sm text-gray-600 sm:grid-cols-2">
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

                                        <div className="rounded-2xl bg-gray-50 px-4 py-3">
                                            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-gray-400">Телефон / WhatsApp</div>
                                            <div className="mt-2 flex flex-wrap items-center gap-2 font-medium text-gray-900">
                                                <span>{profile.phone || profile.ad_phone || 'Телефон не указан'}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => copyToClipboard(profile.phone || profile.ad_phone)}
                                                    disabled={!profile.phone && !profile.ad_phone}
                                                    className="rounded-full border border-gray-200 px-2.5 py-0.5 text-[11px] font-semibold text-gray-600 transition hover:border-gray-300 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    Копировать
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-2 sm:min-w-[220px] lg:items-end">
                                <button
                                    type="button"
                                    onClick={handleEdit}
                                    className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                                >
                                    {isEditing ? 'Редактирование включено' : 'Редактировать профиль'}
                                </button>
                                <a
                                    href="#security"
                                    className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-gray-300 hover:text-gray-900"
                                >
                                    Сменить пароль
                                </a>
                                <button
                                    type="button"
                                    onClick={openTelegram}
                                    disabled={!profile.telegram}
                                    className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-gray-300 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Telegram
                                </button>
                            </div>
                        </div>
                    </section>

                    <section className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {summaryCards.map((card) => (
                            <StatCard key={card.title} {...card} />
                        ))}
                    </section>

                    <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
                        <div className="space-y-6">
                            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                                <UpdateProfileInformationForm
                                    mustVerifyEmail={mustVerifyEmail}
                                    status={status}
                                    profile={profile}
                                    editing={isEditing}
                                    onCancel={handleCancel}
                                />
                            </div>

                            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900">О себе</h3>
                                        <p className="mt-1 text-sm text-gray-500">Короткое представление профиля и служебная информация.</p>
                                    </div>
                                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${visibilityBadgeClass}`}>
                                        {profile.profile_visibility_label}
                                    </span>
                                </div>

                                <div className="mt-4 space-y-3 text-sm text-gray-600">
                                    <div className="rounded-2xl bg-gray-50 p-4">
                                        {profile.bio ? (
                                            <p className="whitespace-pre-line leading-6 text-gray-700">{profile.bio}</p>
                                        ) : (
                                            <p className="leading-6 text-gray-500">Краткая биография не заполнена. Здесь можно добавить описание, интересы или рабочие заметки.</p>
                                        )}
                                    </div>

                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div className="rounded-2xl border border-gray-100 p-4">
                                            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-gray-400">В системе с</div>
                                            <div className="mt-2 text-sm font-semibold text-gray-900">{formatDateTime(profile.created_at)}</div>
                                        </div>
                                        <div className="rounded-2xl border border-gray-100 p-4">
                                            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-gray-400">Обновлён</div>
                                            <div className="mt-2 text-sm font-semibold text-gray-900">{formatDateTime(profile.updated_profile_at)}</div>
                                        </div>
                                    </div>

                                    <div className="rounded-2xl border border-gray-100 p-4">
                                        <div className="flex items-center justify-between gap-4">
                                            <div>
                                                <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-gray-400">Профиль заполнен</div>
                                                <div className="mt-1 text-sm font-semibold text-gray-900">Профиль заполнен на {profile.profile_completion_percent ?? profile.profile_completion ?? 0}%</div>
                                            </div>
                                            <span className="text-sm font-semibold text-gray-600">{profile.profile_completion_label}</span>
                                        </div>
                                        <div className="mt-3 h-2 rounded-full bg-gray-100">
                                            <div
                                                className="h-2 rounded-full bg-slate-900 transition-all"
                                                style={{ width: `${profile.profile_completion_percent ?? profile.profile_completion ?? 0}%` }}
                                            />
                                        </div>
                                        {profile.profile_completed_at ? (
                                            <p className="mt-2 text-xs text-emerald-700">
                                                Профиль отмечен как завершённый {formatDateTime(profile.profile_completed_at)}
                                            </p>
                                        ) : (
                                            <p className="mt-2 text-xs text-gray-500">
                                                Заполните основные поля, чтобы профиль считался завершённым.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                                <h3 className="text-lg font-semibold text-gray-900">История активности</h3>
                                <p className="mt-1 text-sm text-gray-500">Краткая сводка входов и последних изменений.</p>

                                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                                    <div className="rounded-2xl bg-slate-50 p-4">
                                        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">Последний вход</div>
                                        <div className="mt-2 text-sm font-semibold text-slate-900">{formatDateTime(profile.last_login_at)}</div>
                                        <div className="mt-1 text-xs text-slate-500">{formatRelativeTime(profile.last_login_at)}</div>
                                    </div>
                                    <div className="rounded-2xl bg-slate-50 p-4">
                                        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">Уровень доступа</div>
                                        <div className="mt-2 text-sm font-semibold text-slate-900">{profile.role_label}</div>
                                        <div className="mt-1 text-xs text-slate-500">{syncLabels[profile.sync_status] ?? profile.sync_label}</div>
                                    </div>
                                    <div className="rounded-2xl bg-slate-50 p-4">
                                        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">Всего входов</div>
                                        <div className="mt-2 text-2xl font-semibold text-slate-900">{profile.login_count}</div>
                                        <div className="mt-1 text-xs text-slate-500">Успешные авторизации</div>
                                    </div>
                                    <div className="rounded-2xl bg-slate-50 p-4">
                                        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">Служебный статус</div>
                                        <div className="mt-2 text-sm font-semibold text-slate-900">{syncLabels[profile.sync_status] ?? profile.sync_label}</div>
                                        <div className="mt-1 text-xs text-slate-500">{profile.sync_status === 'ad' ? 'Часть полей может обновляться из AD' : 'Данные редактируются локально'}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
                            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                                <h3 className="text-lg font-semibold text-gray-900">Связи и привязки</h3>
                                <p className="mt-1 text-sm text-gray-500">Факультет, кафедра и подразделения, которые уже назначены в системе.</p>

                                <div className="mt-4 space-y-4">
                                    {[
                                        { label: 'Факультет', value: profile.faculty?.name },
                                        { label: 'Кафедра', value: profile.department?.name },
                                    ].map((item) => (
                                        <div key={item.label} className="rounded-2xl border border-gray-100 p-4">
                                            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-gray-400">{item.label}</div>
                                            <div className="mt-2 text-sm font-semibold text-gray-900">{item.value || 'Не привязан'}</div>
                                        </div>
                                    ))}

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

                                    <div className="rounded-2xl border border-gray-100 p-4">
                                        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-gray-400">Служебный статус</div>
                                        <div className="mt-2 text-sm font-semibold text-gray-900">{syncLabels[profile.sync_status] ?? profile.sync_label}</div>
                                        <p className="mt-1 text-xs leading-5 text-gray-500">
                                            {profile.sync_status === 'ad'
                                                ? 'Часть данных может быть обновлена из AD при следующей синхронизации, но локальные поля остаются редактируемыми.'
                                                : 'Профиль заполняется локально и не зависит от AD-синхронизации.'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div id="security" className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                                <h3 className="text-lg font-semibold text-gray-900">Безопасность</h3>
                                <p className="mt-1 text-sm text-gray-500">Пароль можно обновить отдельно без изменения профиля.</p>

                                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                                    <div className="rounded-2xl bg-slate-50 p-4">
                                        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">Последний вход</div>
                                        <div className="mt-2 text-sm font-semibold text-slate-900">{formatDateTime(profile.last_login_at)}</div>
                                    </div>
                                    <div className="rounded-2xl bg-slate-50 p-4">
                                        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">Уровень доступа</div>
                                        <div className="mt-2 text-sm font-semibold text-slate-900">{profile.role_label}</div>
                                    </div>
                                </div>

                                <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50 p-4">
                                    <UpdatePasswordForm showHeader={false} compact />
                                </div>
                            </div>

                        </div>
                    </section>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
