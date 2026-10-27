import { ConfirmDialog } from '@/components/ConfirmDialog';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { EmptyState, Notice, PageHeader, StatusBadge, UnderlineTabs } from '@/components/platform';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import KpiIndicatorsManager from '@/Pages/Kpi/Partials/KpiIndicatorsManager';
import KpiPeriodsManager from '@/Pages/Kpi/Partials/KpiPeriodsManager';
import { Head, router, useForm } from '@inertiajs/react';
import { BookOpen, Building2, CalendarRange, GraduationCap, KeyRound, ListChecks, Plus, Save, Scale, ShieldCheck, Trash2, UserCheck, Users } from 'lucide-react';
import { useState } from 'react';

const PAGE_TABS = {
    indicators: 'Индикаторы',
    seasons: 'Сезоны',
    settings: 'НПУ',
    access: 'Доступы',
};

const PAGE_TAB_ICONS = {
    indicators: ListChecks,
    seasons: CalendarRange,
    settings: Scale,
    access: ShieldCheck,
};

const PAGE_TAB_DESCRIPTIONS = {
    indicators: 'Справочник KPI-индикаторов: баллы, уровни, правила подтверждения.',
    seasons: 'Учебные годы и периоды KPI: план, факт, рассмотрение и окна проверки.',
    settings: 'Нормативная педагогическая условная нагрузка (НПУ) по должностям ППС, завкафедрами и деканам.',
    access: 'Назначение и отзыв полного доступа KPI-администратора.',
};

function PointsBadge({ value }) {
    return (
        <Badge variant="secondary" className="font-mono text-xs tabular-nums">
            {value} баллов
        </Badge>
    );
}

function RuleRow({ rule, index, onChange, onRemove }) {
    return (
        <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 lg:grid-cols-[1.1fr_140px_1.2fr_auto]">
            <label className="block space-y-2">
                <span className="qd-field-label block">Должность</span>
                <Input
                    value={rule.label}
                    onChange={(e) => onChange(index, 'label', e.target.value)}
                    placeholder="Например: Профессор"
                />
            </label>
            <label className="block space-y-2">
                <span className="qd-field-label block">Баллы</span>
                <Input
                    type="number"
                    min="0"
                    className="tabular-nums"
                    value={rule.points}
                    onChange={(e) => onChange(index, 'points', e.target.value)}
                />
            </label>
            <label className="block space-y-2">
                <span className="qd-field-label block">Ключевые слова</span>
                <Input
                    value={rule.keywords_text}
                    onChange={(e) => onChange(index, 'keywords_text', e.target.value)}
                    placeholder="через запятую: профессор, и.о. профессора"
                />
            </label>
            <div className="flex items-end">
                <Button type="button" variant="ghost" size="icon" onClick={() => onRemove(index)} aria-label="Удалить правило" title="Удалить правило">
                    <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
            </div>
        </div>
    );
}

export default function KpiSettings({ npuSettings = {}, periods, academicYears = [], filters = {}, statusOptions = ['draft', 'active', 'closed'], permissions = {}, indicators, indicatorFilters = {}, indicatorOptions = {}, indicatorPermissions = {}, accessGrants = [], accessOptions = {}, accessPermissions = {}, activeTab: initialTab = 'indicators' }) {
    const [confirmState, setConfirmState] = useState({ open: false, description: '', onConfirm: null });
    const [activeTab, setActiveTab] = useState(PAGE_TABS[initialTab] ? initialTab : 'indicators');
    const staffOptions = accessOptions.staff ?? [];
    const canManageFullAccess = Boolean(accessPermissions.canManageFullAccess);
    const requiresFullAccessReason = Boolean(accessPermissions.requiresDangerousActionReason);
    const [accessSearch, setAccessSearch] = useState('');
    const [accessSearchOpen, setAccessSearchOpen] = useState(false);
    const teacherRules = (npuSettings.teacher?.rules ?? []).map((rule) => ({
        label: rule.label ?? '',
        points: rule.points ?? 0,
        keywords_text: (rule.keywords ?? []).join(', '),
    }));

    const accessForm = useForm({
        user_id: '',
        reason: '',
    });

    const { data, setData, post, processing, recentlySuccessful, errors } = useForm({
        teacher: {
            default_points: npuSettings.teacher?.default_points ?? 0,
            rules: teacherRules.length > 0 ? teacherRules : [{ label: '', points: 0, keywords_text: '' }],
        },
        hod: {
            default_points: npuSettings.hod?.default_points ?? 0,
            special_points: npuSettings.hod?.special_points ?? 0,
            special_department_codes_text: (npuSettings.hod?.special_department_codes ?? []).join(', '),
        },
        dean: {
            points: npuSettings.dean?.points ?? 0,
        },
    });

    const updateRule = (index, field, value) => {
        setData('teacher', {
            ...data.teacher,
            rules: data.teacher.rules.map((rule, ruleIndex) => (
                ruleIndex === index ? { ...rule, [field]: field === 'points' ? Number(value) : value } : rule
            )),
        });
    };

    const addRule = () => {
        setData('teacher', {
            ...data.teacher,
            rules: [...data.teacher.rules, { label: '', points: 0, keywords_text: '' }],
        });
    };

    const removeRule = (index) => {
        setData('teacher', {
            ...data.teacher,
            rules: data.teacher.rules.filter((_, ruleIndex) => ruleIndex !== index),
        });
    };

    const submit = (e) => {
        e.preventDefault();
        post(route('kpi.settings.update'));
    };

    const submitAccess = (e) => {
        e.preventDefault();
        accessForm.post(route('kpi.settings.accesses.store'), {
            preserveScroll: true,
            onSuccess: () => {
                accessForm.reset();
                setAccessSearch('');
                setAccessSearchOpen(false);
            },
        });
    };

    const revokeAccess = (grantId) => {
        let reason = '';

        if (requiresFullAccessReason) {
            reason = window.prompt('Укажите reason для отзыва KPI-admin доступа') ?? '';

            if (reason.trim().length < 8) {
                accessForm.setError('reason', 'Reason должен быть минимум 8 символов.');
                return;
            }
        }

        accessForm.clearErrors('reason');

        setConfirmState({
            open: true,
            description: 'Отозвать KPI-админ доступ у сотрудника?',
            onConfirm: () => router.delete(route('kpi.settings.accesses.destroy', grantId), {
                data: { reason: reason.trim() },
                preserveScroll: true,
            }),
        });
    };

    const accessSearchNormalized = accessSearch.trim().toLowerCase();
    const accessReasonReady = !requiresFullAccessReason || accessForm.data.reason.trim().length >= 8;
    const selectedAccessUser = staffOptions.find((staff) => String(staff.id) === String(accessForm.data.user_id));
    const filteredAccessStaff = accessSearchNormalized === ''
        ? staffOptions.slice(0, 8)
        : staffOptions
            .filter((staff) => [staff.name, staff.department, staff.email, staff.title]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .includes(accessSearchNormalized))
            .slice(0, 8);

    const pickAccessUser = (staff) => {
        accessForm.setData('user_id', String(staff.id));
        setAccessSearch(staff.name ?? '');
        setAccessSearchOpen(false);
    };

    const tabItems = Object.entries(PAGE_TABS).map(([key, label]) => ({
        key,
        label,
        icon: PAGE_TAB_ICONS[key],
        count: key === 'access' ? accessGrants.length : undefined,
    }));

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="KPI · Администрирование"
                    title="Настройки KPI"
                    description={PAGE_TAB_DESCRIPTIONS[activeTab]}
                    meta={<StatusBadge tone="info">Раздел: {PAGE_TABS[activeTab]}</StatusBadge>}
                />
            )}
        >
            <Head title="KPI / Настройка НПУ" />

            <div className="admin-page-wrap space-y-6">
                <UnderlineTabs items={tabItems} value={activeTab} onChange={setActiveTab} />

                {activeTab === 'settings' && (
                    <form className="grid gap-6 xl:grid-cols-[1.4fr_1fr]" onSubmit={submit}>
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Users />
                                    ППС: НПУ по должности
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                <div className="grid gap-4 border-b border-slate-200 pb-5 lg:grid-cols-[220px_1fr]">
                                    <div>
                                        <span className="qd-field-label block">НПУ по умолчанию</span>
                                        <p className="mt-1 text-xs text-slate-500">Применяется, если должность не попала ни под одно правило.</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Input
                                            type="number"
                                            min="0"
                                            className="tabular-nums"
                                            value={data.teacher.default_points}
                                            onChange={(e) => setData('teacher', { ...data.teacher, default_points: Number(e.target.value) })}
                                        />
                                        {errors['teacher.default_points'] && <div className="text-xs text-red-700">{errors['teacher.default_points']}</div>}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="qd-field-label">Правила по должностям</span>
                                        <span className="text-xs tabular-nums text-slate-500">{data.teacher.rules.length}</span>
                                    </div>
                                    {data.teacher.rules.map((rule, index) => (
                                        <RuleRow
                                            key={`rule-${index}`}
                                            rule={rule}
                                            index={index}
                                            onChange={updateRule}
                                            onRemove={removeRule}
                                        />
                                    ))}
                                    <Button type="button" variant="secondary" onClick={addRule}>
                                        <Plus className="h-4 w-4" />
                                        Добавить правило
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <GraduationCap />
                                        Деканы
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <label className="block space-y-2">
                                        <span className="qd-field-label block">Фиксированное значение для декана</span>
                                        <Input
                                            type="number"
                                            min="0"
                                            className="tabular-nums"
                                            value={data.dean.points}
                                            onChange={(e) => setData('dean', { points: Number(e.target.value) })}
                                        />
                                    </label>
                                    <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                                        Текущее значение: <PointsBadge value={data.dean.points} />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Building2 />
                                        Завкафедры
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-5 text-sm">
                                    <label className="block space-y-2 border-b border-slate-200 pb-5">
                                        <span className="qd-field-label block">Базовое значение для заведующего кафедрой</span>
                                        <Input
                                            type="number"
                                            min="0"
                                            className="tabular-nums"
                                            value={data.hod.default_points}
                                            onChange={(e) => setData('hod', { ...data.hod, default_points: Number(e.target.value) })}
                                        />
                                    </label>

                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 font-semibold text-[#102945]">
                                            <BookOpen className="h-4 w-4 text-amber-600" />
                                            Специальное значение для отдельных кафедр
                                        </div>
                                        <label className="block space-y-2">
                                            <span className="qd-field-label block">Льготные баллы</span>
                                            <Input
                                                type="number"
                                                min="0"
                                                className="tabular-nums"
                                                value={data.hod.special_points}
                                                onChange={(e) => setData('hod', { ...data.hod, special_points: Number(e.target.value) })}
                                            />
                                        </label>
                                        <label className="block space-y-2">
                                            <span className="qd-field-label block">Коды кафедр</span>
                                            <Textarea
                                                rows={4}
                                                value={data.hod.special_department_codes_text}
                                                onChange={(e) => setData('hod', { ...data.hod, special_department_codes_text: e.target.value })}
                                                placeholder="Например: ГиИЯ, СГД, ФВ"
                                            />
                                            <span className="block text-xs text-slate-500">Можно вводить через запятую или с новой строки.</span>
                                        </label>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-slate-200 bg-white px-5 py-4 shadow-[0_1px_2px_0_rgba(25,28,29,0.04)] xl:col-span-2">
                            <p className="text-sm text-slate-600">
                                Изменения применяются к KPI-сводкам сразу после сохранения.
                            </p>
                            <Button type="submit" disabled={processing} className="min-w-32">
                                <Save className="h-4 w-4" />
                                {processing ? 'Сохранение...' : (recentlySuccessful ? 'Сохранено' : 'Сохранить')}
                            </Button>
                        </div>
                    </form>
                )}

                {activeTab === 'access' && (
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <ShieldCheck />
                                    KPI-администраторы
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {!canManageFullAccess && (
                                    <Notice tone="warning" title="Только просмотр">
                                        Полный KPI-admin доступ могут выдавать только admin, superadmin и governance elevated категории business/technical.
                                    </Notice>
                                )}

                                <form className="space-y-4" onSubmit={submitAccess}>
                                    <div className="grid gap-4 lg:grid-cols-2">
                                        <div className="space-y-2">
                                            <span className="qd-field-label block">Сотрудник</span>
                                            <Input
                                                disabled={!canManageFullAccess}
                                                value={accessSearch}
                                                onChange={(e) => {
                                                    setAccessSearch(e.target.value);
                                                    accessForm.setData('user_id', '');
                                                    setAccessSearchOpen(true);
                                                }}
                                                onFocus={() => setAccessSearchOpen(true)}
                                                placeholder="Введите ФИО, подразделение или email"
                                            />
                                            {canManageFullAccess && accessSearchOpen && !selectedAccessUser && (
                                                <div className="max-h-52 overflow-auto rounded-[10px] border border-slate-200 bg-white shadow-[0_8px_24px_0_rgba(25,28,29,0.08)]">
                                                    {filteredAccessStaff.length === 0 ? (
                                                        <div className="px-3 py-2 text-xs text-slate-500">Совпадений не найдено.</div>
                                                    ) : (
                                                        filteredAccessStaff.map((staff) => (
                                                            <button
                                                                key={staff.id}
                                                                type="button"
                                                                onMouseDown={() => pickAccessUser(staff)}
                                                                className="w-full border-b border-slate-200 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-teal-50"
                                                            >
                                                                <div className="font-medium text-slate-900">{staff.name}</div>
                                                                <div className="text-xs text-slate-500">{[staff.department, staff.email].filter(Boolean).join(' • ')}</div>
                                                            </button>
                                                        ))
                                                    )}
                                                </div>
                                            )}
                                            {selectedAccessUser && (
                                                <div className="flex items-center gap-2 rounded-[10px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                                                    <UserCheck className="h-4 w-4 shrink-0" />
                                                    Выбран: {selectedAccessUser.name} ({selectedAccessUser.department || 'без подразделения'})
                                                </div>
                                            )}
                                            {accessForm.errors.user_id && <div className="text-xs text-red-700">{accessForm.errors.user_id}</div>}
                                        </div>

                                        {requiresFullAccessReason && (
                                            <label className="block space-y-2">
                                                <span className="qd-field-label block">Reason</span>
                                                <Input
                                                    disabled={!canManageFullAccess}
                                                    value={accessForm.data.reason}
                                                    onChange={(e) => accessForm.setData('reason', e.target.value)}
                                                    placeholder="Не менее 8 символов"
                                                />
                                                {accessForm.errors.reason && <span className="block text-xs text-red-700">{accessForm.errors.reason}</span>}
                                            </label>
                                        )}
                                    </div>

                                    <div className="flex justify-end border-t border-slate-200 pt-4">
                                        <Button type="submit" disabled={!canManageFullAccess || accessForm.processing || !accessForm.data.user_id || !accessReasonReady}>
                                            <KeyRound className="h-4 w-4" />
                                            Назначить KPI-админом
                                        </Button>
                                    </div>
                                </form>
                            </CardContent>
                        </Card>

                        {accessGrants.length === 0 ? (
                            <EmptyState
                                title="Текущих доступов нет"
                                description="Пока никому не назначен KPI-админ доступ. Выберите сотрудника в форме выше."
                            />
                        ) : (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Users />
                                        Текущие доступы
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="overflow-x-auto">
                                        <table className="w-full min-w-[860px] text-sm">
                                            <thead>
                                                <tr className="border-b border-slate-200 text-left">
                                                    <th className="px-4 py-3">Сотрудник</th>
                                                    <th className="px-4 py-3">Email</th>
                                                    <th className="px-4 py-3">Подразделение</th>
                                                    <th className="px-4 py-3">Кем выдано</th>
                                                    <th className="px-4 py-3">Когда</th>
                                                    <th className="px-4 py-3 text-right">Действия</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {accessGrants.map((grant) => (
                                                    <tr key={grant.id} className="border-b border-slate-200 align-top last:border-0">
                                                        <td className="px-4 py-3">
                                                            <div className="font-medium text-slate-900">{grant.user?.display_name || grant.user?.name || '—'}</div>
                                                            <div className="text-xs text-slate-500">{grant.user?.ad_title || 'Без должности'}</div>
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-700">{grant.user?.email || '—'}</td>
                                                        <td className="px-4 py-3 text-slate-700">{grant.user?.ad_department || '—'}</td>
                                                        <td className="px-4 py-3">
                                                            <Badge variant="outline">{grant.granted_by?.display_name || grant.granted_by?.name || '—'}</Badge>
                                                        </td>
                                                        <td className="px-4 py-3 tabular-nums text-slate-700">{grant.granted_at ? new Date(grant.granted_at).toLocaleString('ru-RU') : '—'}</td>
                                                        <td className="px-4 py-3 text-right">
                                                            <Button type="button" variant="destructive" size="sm" onClick={() => revokeAccess(grant.id)} disabled={!canManageFullAccess}>
                                                                <Trash2 className="h-4 w-4" />
                                                                Отозвать
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                )}

                {activeTab === 'seasons' && (
                    <KpiPeriodsManager
                        periods={periods}
                        academicYears={academicYears}
                        filters={filters}
                        statusOptions={statusOptions}
                        permissions={permissions}
                        filterRouteName="kpi.settings"
                        filterRouteParams={{ tab: 'seasons' }}
                    />
                )}

                {activeTab === 'indicators' && (
                    <KpiIndicatorsManager
                        indicators={indicators}
                        filters={indicatorFilters}
                        options={indicatorOptions}
                        permissions={indicatorPermissions}
                        filterRouteName="kpi.settings"
                        filterRouteParams={{ tab: 'indicators' }}
                    />
                )}
            </div>
            <ConfirmDialog
                open={confirmState.open}
                onOpenChange={(open) => !open && setConfirmState({ open: false, description: '', onConfirm: null })}
                description={confirmState.description}
                onConfirm={() => {
                    confirmState.onConfirm?.();
                    setConfirmState({ open: false, description: '', onConfirm: null });
                }}
            />
        </AuthenticatedLayout>
    );
}
