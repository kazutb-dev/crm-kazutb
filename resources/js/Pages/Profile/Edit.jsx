import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import {
    Award, Building2, Camera, ClipboardList, GraduationCap,
    History, Mail, MapPin, Phone, Shield, Trash2, User,
} from 'lucide-react';
import { useRef, useState } from 'react';
import UpdateProfileInformationForm from './Partials/UpdateProfileInformationForm';

const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
};

function Section({ icon: Icon, title, children }) {
    return (
        <Card className="shadow-sm">
            <CardHeader className="border-b border-border/60 pb-3 pt-4">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
                    {Icon && <Icon className="h-4 w-4 shrink-0 text-slate-500" />}
                    {title}
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">{children}</CardContent>
        </Card>
    );
}

function InfoRow({ label, value, mono = false }) {
    if (value === null || value === undefined || value === '') return null;
    return (
        <div className="flex flex-col gap-0.5 rounded-lg border border-border/50 bg-slate-50/50 px-3 py-2.5">
            <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">{label}</span>
            <span className={`text-sm font-medium text-slate-900 ${mono ? 'font-mono' : ''}`}>{value}</span>
        </div>
    );
}

function ActivityRow({ action }) {
    return (
        <div className="flex items-start gap-3 border-b border-border/40 py-2.5 last:border-0">
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
            <div className="relative h-28 w-28 overflow-hidden rounded-full bg-gradient-to-br from-slate-900 via-slate-700 to-emerald-500 p-1 shadow-lg ring-4 ring-white">
                <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-white">
                    {avatarSrc ? (
                        <img src={avatarSrc} alt={profile.name} className="h-full w-full object-cover" onError={() => setAvatarFailed(true)} />
                    ) : (
                        <span className="text-3xl font-bold tracking-tight text-slate-800">{getInitials(profile.name)}</span>
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
        <AuthenticatedLayout>
            <Head title="Профиль" />

            <div className="admin-page-wrap space-y-6">
                {/* Header */}
                <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-white shadow-[0_4px_24px_rgba(15,23,42,0.07)]">
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-slate-900 via-slate-700 to-emerald-500" />
                    <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
                        <PhotoPanel profile={profile} canEdit={canEdit} />
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{profile.name}</h1>
                                <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800 text-xs">{profile.role_label}</Badge>
                                {profile.sync_status === 'ad' && (
                                    <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 text-xs">AD</Badge>
                                )}
                            </div>
                            {!isStudent && (
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {profile.position_title || '—'}
                                    {profile.faculty?.name ? ` · ${profile.faculty.name}` : ''}
                                </p>
                            )}
                            <div className="mt-3 flex flex-wrap gap-3 text-sm text-muted-foreground">
                                {profile.email && <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{profile.email}</span>}
                                {(profile.phone || profile.ad_phone) && <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{profile.phone || profile.ad_phone}</span>}
                                {profile.office_location && <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{profile.office_location}</span>}
                            </div>
                        </div>
                        {canEdit && !isEditing && (
                            <Button variant="outline" size="sm" className="shrink-0" onClick={() => setIsEditing(true)}>Редактировать</Button>
                        )}
                    </div>
                </div>

                {/* Edit form */}
                {isEditing && (
                    <Card className="shadow-sm">
                        <CardContent className="pt-5">
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

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
                    {/* Left column */}
                    <div className="space-y-6">
                        <Section icon={User} title="Основные данные">
                            <div className="grid gap-2 sm:grid-cols-2">
                                <InfoRow label="ФИО" value={profile.name} />
                                <InfoRow label="Email" value={profile.email} mono />
                                <InfoRow label="Телефон" value={profile.phone || profile.ad_phone} />
                                <InfoRow label="Должность" value={profile.position_title || profile.ad_title} />
                                {profile.office_location && <InfoRow label="Кабинет" value={profile.office_location} />}
                                {profile.bio && <div className="sm:col-span-2"><InfoRow label="О себе" value={profile.bio} /></div>}
                            </div>
                        </Section>

                        <Section icon={Building2} title="Организационная структура">
                            <div className="grid gap-2 sm:grid-cols-2">
                                {!isStudent ? (
                                    <>
                                        <InfoRow label="Факультет" value={profile.faculty?.name} />
                                        <InfoRow label="Кафедра" value={profile.department?.name} />
                                        {profile.divisions?.length > 0 && (
                                            <div className="sm:col-span-2 rounded-lg border border-border/50 bg-slate-50/50 px-3 py-2.5">
                                                <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">Подразделения</span>
                                                <div className="mt-2 flex flex-wrap gap-1.5">
                                                    {profile.divisions.map((d) => (
                                                        <Badge key={d.id} variant="secondary" className="text-xs">{d.name}</Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    profile.student_binding && (
                                        <>
                                            <InfoRow label="Группа" value={profile.student_binding.group?.name} />
                                            <InfoRow label="Кафедра" value={profile.student_binding.department?.name} />
                                            <InfoRow label="Специальность" value={profile.student_binding.speciality?.name} />
                                            <InfoRow label="Образовательная программа" value={profile.student_binding.educational_program?.name} />
                                        </>
                                    )
                                )}
                            </div>
                        </Section>

                        {!isStudent && (
                            <Section icon={GraduationCap} title="Академические данные">
                                <div className="grid gap-2 sm:grid-cols-2">
                                    <InfoRow label="Учёное звание" value={profile.ad_title} />
                                    <InfoRow label="Тип сотрудника" value={profile.ad_employee_type} />
                                    <InfoRow label="Ставка" value={profile.kpi_workload_rate ? `${profile.kpi_workload_rate}` : null} />
                                    <InfoRow label="Описание AD" value={profile.ad_description} />
                                </div>
                            </Section>
                        )}
                    </div>

                    {/* Right column */}
                    <div className="space-y-6">
                        <Section icon={Shield} title="Роли и доступ">
                            <div className="space-y-3">
                                <div className="rounded-lg border border-border/50 bg-slate-50/50 px-3 py-2.5">
                                    <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">Роль</span>
                                    <p className="mt-1 text-sm font-medium text-slate-900">{profile.role_label}</p>
                                </div>
                                {grants.length > 0 && (
                                    <div className="rounded-lg border border-border/50 bg-slate-50/50 px-3 py-2.5">
                                        <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">Дополнительные права (KPI)</span>
                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                            {grants.map((g, i) => (
                                                <Badge key={g.id ?? i} variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800 text-xs">
                                                    {g.permission ?? g}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {elevatedAuthority && (elevatedAuthority.has_business || elevatedAuthority.has_technical || elevatedAuthority.has_operator) && (
                                    <div className="rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-2.5">
                                        <span className="text-[11px] font-medium uppercase tracking-widest text-blue-600">Повышенный доступ</span>
                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                            {elevatedAuthority.has_business && <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-800 text-xs">Бизнес-суперадмин</Badge>}
                                            {elevatedAuthority.has_technical && <Badge variant="outline" className="border-red-200 bg-red-50 text-red-800 text-xs">Технический суперадмин</Badge>}
                                            {elevatedAuthority.has_operator && <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-800 text-xs">Оператор платформы</Badge>}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Section>

                        <Section icon={Award} title="Сертификаты">
                            {certificates.length > 0 ? (
                                <div className="space-y-2">
                                    {certificates.map((cert) => (
                                        <div key={cert.id} className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2">
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-medium text-slate-800">{cert.title || cert.certificate_number}</p>
                                                <p className="text-xs text-muted-foreground">{cert.issued_at ? new Date(cert.issued_at).toLocaleDateString('ru-RU') : '—'}</p>
                                            </div>
                                            <Badge variant={cert.status === 'issued' ? 'default' : 'secondary'} className="ml-2 shrink-0 text-xs">
                                                {cert.status === 'issued' ? 'Выдан' : cert.status}
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">Нет выданных сертификатов</p>
                            )}
                        </Section>

                        <Section icon={History} title="Последние действия">
                            {recentActivity.length > 0 ? (
                                <div className="divide-y divide-border/40">
                                    {recentActivity.map((action, i) => <ActivityRow key={action.id ?? i} action={action} />)}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">Нет записей активности</p>
                            )}
                        </Section>

                        <Section icon={ClipboardList} title="Метаданные">
                            <div className="space-y-2">
                                <InfoRow label="Заполненность" value={profile.profile_completion_label} />
                                <InfoRow label="Последний вход" value={profile.last_login_at ? new Date(profile.last_login_at).toLocaleString('ru-RU') : null} />
                                <InfoRow label="Зарегистрирован" value={profile.created_at ? new Date(profile.created_at).toLocaleDateString('ru-RU') : null} />
                                <InfoRow label="Синхронизация" value={profile.sync_label} />
                            </div>
                        </Section>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
