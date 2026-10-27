import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { Award, Camera, ChevronDown, Shield, Trash2, User } from 'lucide-react';
import { useRef, useState } from 'react';
import UpdateProfileInformationForm from './Partials/UpdateProfileInformationForm';

const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
};

function Section({ icon: Icon, title, children }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    {Icon && <Icon className="shrink-0" />}
                    {title}
                </CardTitle>
            </CardHeader>
            <CardContent>{children}</CardContent>
        </Card>
    );
}

function InfoRow({ label, value, mono = false, showEmpty = false }) {
    const empty = value === null || value === undefined || value === '';
    if (empty && !showEmpty) return null;
    return (
        <div className="flex min-w-0 flex-col gap-1 border-b border-slate-200 pb-2">
            <span className="qd-field-label text-slate-500">{label}</span>
            {empty ? (
                <span className="text-sm text-slate-400">Не указано</span>
            ) : (
                <span className={`break-words text-sm font-medium text-slate-900 ${mono ? 'font-mono' : ''}`}>{value}</span>
            )}
        </div>
    );
}

function ActivityRow({ action }) {
    return (
        <div className="flex items-start gap-3 py-2 first:pt-0 last:pb-0">
            <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
            <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-800">{action.description}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{action.created_at_human ?? action.created_at}</p>
            </div>
        </div>
    );
}

function PhotoPanel({ profile, canEdit }) {
    const [avatarFailed, setAvatarFailed] = useState(false);
    const avatarSrc = profile.avatar_url && !avatarFailed ? profile.avatar_url : null;
    const fileRef = useRef(null);
    const uploadForm = useForm({ avatar: null });

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        uploadForm.setData('avatar', file);
        uploadForm.post(route('profile.avatar.upload'), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => { if (fileRef.current) fileRef.current.value = ''; uploadForm.reset(); },
        });
    };

    const handleRemove = () => {
        router.patch(route('profile.update'), { avatar_url: null }, { preserveScroll: true });
    };

    return (
        <div className="flex flex-col items-center gap-3">
            <div className="relative h-32 w-32 overflow-hidden rounded-full sm:h-40 sm:w-40 bg-gradient-to-br from-[#102945] to-teal-500 p-1 shadow-[0_12px_32px_0_rgba(25,28,29,0.10)] ring-4 ring-white">
                <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-teal-50">
                    {avatarSrc ? (
                        <img src={avatarSrc} alt={profile.name} className="h-full w-full object-cover" onError={() => setAvatarFailed(true)} />
                    ) : (
                        <span className="text-4xl font-bold text-[#102945] sm:text-5xl">{getInitials(profile.name)}</span>
                    )}
                </div>
            </div>
            {canEdit && (
                <div className="flex gap-2">
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                    <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploadForm.processing}>
                        <Camera className="mr-1.5 h-3.5 w-3.5" />
                        {profile.avatar_url ? 'Изменить фото' : 'Загрузить фото'}
                    </Button>
                    {profile.avatar_url && (
                        <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={handleRemove}>
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}

export default function Edit({ mustVerifyEmail, status, profile }) {
    const page = usePage();
    const roleSlug = page?.props?.auth?.roleSlug;
    const isAdmin = ['admin', 'superadmin'].includes(roleSlug);
    const isOwnProfile = page?.props?.auth?.user?.id === profile.id;
    const canEdit = isAdmin || isOwnProfile;
    const isStudent = profile.role_slug === 'student';
    const [isEditing, setIsEditing] = useState(false);

    const grants = profile.kpi_grants ?? [];
    const elevatedAuthority = profile.elevated_authority ?? null;
    const recentActivity = profile.recent_activity ?? [];
    const certificates = profile.certificates ?? [];

    return (
        <AuthenticatedLayout
            header={(
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                    <PhotoPanel profile={profile} canEdit={canEdit} />
                    <div className="min-w-0 flex-1 space-y-2">
                        <p className="qd-kicker">{isOwnProfile ? 'Мой профиль' : 'Профиль сотрудника'}</p>
                        <h1>{profile.name}</h1>
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="success">{profile.role_label}</Badge>
                            {isAdmin && profile.sync_status === 'ad' && <Badge variant="info">AD</Badge>}
                            {!isStudent && (
                                <span className="text-sm text-slate-600">
                                    {profile.position_title || 'Должность не указана'}
                                    {profile.faculty?.name ? ` · ${profile.faculty.name}` : ''}
                                </span>
                            )}
                        </div>
                    </div>
                    {canEdit && !isEditing && (
                        <Button className="shrink-0 self-start sm:self-center" onClick={() => setIsEditing(true)}>Редактировать профиль</Button>
                    )}
                </div>
            )}
        >
            <Head title="Профиль" />

            <div className="admin-page-wrap space-y-4">
                {/* Edit form */}
                {isEditing && (
                    <Card>
                        <CardContent>
                            <UpdateProfileInformationForm
                                mustVerifyEmail={mustVerifyEmail}
                                status={status}
                                profile={profile}
                                editing={isEditing}
                                onEdit={() => setIsEditing(true)}
                                onCancel={() => setIsEditing(false)}
                            />
                        </CardContent>
                    </Card>
                )}

                <div className={`grid items-start gap-4 ${certificates.length > 0 ? 'xl:grid-cols-[minmax(0,1fr)_380px]' : ''}`}>
                    <Section icon={User} title="Контакты и работа">
                        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
                            <InfoRow label="Email" value={profile.email} showEmpty />
                            <InfoRow label="Телефон" value={profile.phone || profile.ad_phone} showEmpty />
                            <InfoRow label="Telegram" value={profile.telegram} />
                            <InfoRow label="Кабинет" value={profile.office_location} showEmpty />
                            {isStudent ? (
                                profile.student_binding ? (
                                    <>
                                        <InfoRow label="Группа" value={profile.student_binding.group?.name} showEmpty />
                                        <InfoRow label="Кафедра" value={profile.student_binding.department?.name} />
                                        <InfoRow label="Специальность" value={profile.student_binding.speciality?.name} />
                                        <InfoRow label="Образовательная программа" value={profile.student_binding.educational_program?.name} />
                                    </>
                                ) : (
                                    <InfoRow label="Группа" value={null} showEmpty />
                                )
                            ) : (
                                <>
                                    <InfoRow label="Должность" value={profile.position_title || profile.ad_title} showEmpty />
                                    <InfoRow label="Факультет" value={profile.faculty?.name} showEmpty />
                                    <InfoRow label="Кафедра" value={profile.department?.name} />
                                    {profile.divisions?.length > 0 && (
                                        <div className="border-b border-slate-200 pb-2 sm:col-span-2 xl:col-span-3">
                                            <span className="qd-field-label text-slate-500">Подразделения</span>
                                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                                                {profile.divisions.map((d) => (
                                                    <Badge key={d.id} variant="secondary" className="text-xs">{d.name}</Badge>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                            {profile.bio && <div className="sm:col-span-2 xl:col-span-3"><InfoRow label="О себе" value={profile.bio} /></div>}
                        </div>
                    </Section>

                    {certificates.length > 0 && (
                        <Section icon={Award} title={`Сертификаты · ${certificates.length}`}>
                            <div className="divide-y divide-slate-200">
                                {certificates.map((cert) => (
                                    <div key={cert.id} className="flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium text-slate-800">{cert.title || cert.certificate_number}</p>
                                            <p className="text-xs text-muted-foreground">{cert.issued_at ? new Date(cert.issued_at).toLocaleDateString('ru-RU') : '—'}</p>
                                        </div>
                                        <Badge variant={cert.status === 'issued' ? 'default' : 'secondary'} className="shrink-0 text-xs">
                                            {cert.status === 'issued' ? 'Выдан' : cert.status}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        </Section>
                    )}
                </div>

                {/* Account and access details are for administrators only, folded away by default */}
                {isAdmin && (
                    <details className="group rounded-[14px] border border-slate-200 bg-white shadow-[0_1px_2px_0_rgba(25,28,29,0.04)]">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 sm:px-5 [&::-webkit-details-marker]:hidden">
                            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.1em] text-[#102945]">
                                <Shield className="h-4 w-4 text-teal-700" />
                                Служебная информация
                            </span>
                            <span className="flex items-center gap-2 text-xs text-slate-500">
                                Видно только администраторам
                                <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                            </span>
                        </summary>
                        <div className="grid gap-x-6 gap-y-3 border-t border-slate-200 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-4">
                            <InfoRow label="Роль" value={profile.role_label} />
                            <InfoRow label="Заполненность профиля" value={profile.profile_completion_label} />
                            <InfoRow label="Синхронизация" value={profile.sync_label} />
                            <InfoRow label="Видимость профиля" value={profile.profile_visibility_label} />
                            <InfoRow
                                label="Последний вход"
                                value={profile.last_login_at ? new Date(profile.last_login_at).toLocaleString('ru-RU') : 'Входов ещё не было'}
                            />
                            <InfoRow label="Входов" value={String(profile.login_count ?? 0)} />
                            <InfoRow label="Зарегистрирован" value={profile.created_at ? new Date(profile.created_at).toLocaleDateString('ru-RU') : null} />
                            <InfoRow label="Email подтверждён" value={profile.email_verified_at ? new Date(profile.email_verified_at).toLocaleDateString('ru-RU') : 'Нет'} />
                            {!isStudent && (
                                <>
                                    <InfoRow label="Учёное звание" value={profile.ad_title} />
                                    <InfoRow label="Тип сотрудника" value={profile.ad_employee_type} />
                                    <InfoRow label="Ставка" value={profile.kpi_workload_rate ? `${profile.kpi_workload_rate}` : null} />
                                    <InfoRow label="Описание AD" value={profile.ad_description} />
                                </>
                            )}
                            {grants.length > 0 && (
                                <div className="border-b border-slate-200 pb-2 sm:col-span-2">
                                    <span className="qd-field-label text-slate-500">Дополнительные права (KPI)</span>
                                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                                        {grants.map((g, i) => (
                                            <Badge key={g.id ?? i} variant="outline" className="border-emerald-200 bg-emerald-50 text-xs text-emerald-800">
                                                {g.permission ?? g}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {elevatedAuthority && (elevatedAuthority.has_business || elevatedAuthority.has_technical || elevatedAuthority.has_operator) && (
                                <div className="border-b border-slate-200 pb-2 sm:col-span-2">
                                    <span className="qd-field-label text-slate-500">Повышенный доступ</span>
                                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                                        {elevatedAuthority.has_business && <Badge variant="outline" className="border-blue-200 bg-blue-50 text-xs text-blue-800">Бизнес-суперадмин</Badge>}
                                        {elevatedAuthority.has_technical && <Badge variant="outline" className="border-red-200 bg-red-50 text-xs text-red-800">Технический суперадмин</Badge>}
                                        {elevatedAuthority.has_operator && <Badge variant="outline" className="border-teal-200 bg-teal-50 text-xs text-teal-800">Оператор платформы</Badge>}
                                    </div>
                                </div>
                            )}
                            {recentActivity.length > 0 && (
                                <div className="sm:col-span-2 xl:col-span-4">
                                    <span className="qd-field-label text-slate-500">Последние действия</span>
                                    <div className="mt-1.5 divide-y divide-slate-100">
                                        {recentActivity.map((action, i) => <ActivityRow key={action.id ?? i} action={action} />)}
                                    </div>
                                </div>
                            )}
                        </div>
                    </details>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
