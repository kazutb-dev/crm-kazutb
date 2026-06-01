import { ConfirmDialog } from '@/components/ConfirmDialog';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import KpiIndicatorsManager from '@/Pages/Kpi/Partials/KpiIndicatorsManager';
import KpiPeriodsManager from '@/Pages/Kpi/Partials/KpiPeriodsManager';
import { Head, useForm } from '@inertiajs/react';
import { BookOpen, Building2, GraduationCap, KeyRound, Plus, ShieldCheck, Trash2, Users } from 'lucide-react';
import { useState } from 'react';

const PAGE_TABS = {
    indicators: 'Индикаторы',
    seasons: 'Сезоны',
    settings: 'НПУ',
    access: 'Доступы',
};

function PointsBadge({ value }) {
    return (
        <Badge variant="secondary" className="font-mono text-xs">
            {value} баллов
        </Badge>
    );
}

function RuleRow({ rule, index, onChange, onRemove }) {
    return (
        <div className="grid gap-3 rounded-xl border border-border/70 p-4 lg:grid-cols-[1.1fr_140px_1.2fr_44px]">
            <div className="space-y-2">
                <label className="text-sm font-medium text-[#132844]">Должность</label>
                <Input
                    value={rule.label}
                    onChange={(e) => onChange(index, 'label', e.target.value)}
                    placeholder="Например: Профессор"
                />
            </div>
            <div className="space-y-2">
                <label className="text-sm font-medium text-[#132844]">Баллы</label>
                <Input
                    type="number"
                    min="0"
                    value={rule.points}
                    onChange={(e) => onChange(index, 'points', e.target.value)}
                />
            </div>
            <div className="space-y-2">
                <label className="text-sm font-medium text-[#132844]">Ключевые слова</label>
                <Input
                    value={rule.keywords_text}
                    onChange={(e) => onChange(index, 'keywords_text', e.target.value)}
                    placeholder="через запятую: профессор, и.о. профессора"
                />
            </div>
            <div className="flex items-end">
                <Button type="button" variant="outline" size="icon" onClick={() => onRemove(index)}>
                    <Trash2 className="h-4 w-4" />
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
    const [accessSearch, setAccessSearch] = useState('');
    const [accessSearchOpen, setAccessSearchOpen] = useState(false);
    const teacherRules = (npuSettings.teacher?.rules ?? []).map((rule) => ({
        label: rule.label ?? '',
        points: rule.points ?? 0,
        keywords_text: (rule.keywords ?? []).join(', '),
    }));

    const accessForm = useForm({
        user_id: '',
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
        setConfirmState({
            open: true,
            description: 'Отозвать KPI-админ доступ у сотрудника?',
            onConfirm: () => accessForm.delete(route('kpi.settings.accesses.destroy', grantId), { preserveScroll: true }),
        });
    };

    const accessSearchNormalized = accessSearch.trim().toLowerCase();
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

    return (
        <AuthenticatedLayout>
            <Head title="KPI / Настройка НПУ" />

            <div className="admin-page-wrap">
                <div className="flex items-center gap-1 rounded-xl border border-border/70 bg-muted/30 p-1 w-fit">
                    {Object.entries(PAGE_TABS).map(([key, label]) => {
                        const isActive = activeTab === key;

                        return (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setActiveTab(key)}
                                className={[
                                    'rounded-lg px-4 py-2 text-sm font-medium transition-all',
                                    isActive
                                        ? 'bg-white shadow-sm text-[#132844] border border-border/60'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-white/60',
                                ].join(' ')}
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>

                {activeTab === 'settings' && (
                    <form className="grid gap-4 xl:grid-cols-[1.4fr_1fr]" onSubmit={submit}>
                        <Card className="border-border/80 bg-white/90 shadow-sm">
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-base text-[#132844]">
                                    <Users className="h-4 w-4 text-[#139AA4]" />
                                    ППС: НПУ по должности
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-4 rounded-xl border border-dashed border-border/70 px-4 py-4 lg:grid-cols-[220px_1fr]">
                                    <div>
                                        <div className="text-sm font-medium text-[#132844]">НПУ по умолчанию</div>
                                        <p className="mt-1 text-xs text-muted-foreground">Применяется, если должность не попала ни под одно правило.</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Input
                                            type="number"
                                            min="0"
                                            value={data.teacher.default_points}
                                            onChange={(e) => setData('teacher', { ...data.teacher, default_points: Number(e.target.value) })}
                                        />
                                        {errors['teacher.default_points'] && <div className="text-xs text-destructive">{errors['teacher.default_points']}</div>}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {data.teacher.rules.map((rule, index) => (
                                        <RuleRow
                                            key={`rule-${index}`}
                                            rule={rule}
                                            index={index}
                                            onChange={updateRule}
                                            onRemove={removeRule}
                                        />
                                    ))}
                                    <Button type="button" variant="outline" onClick={addRule} className="gap-2">
                                        <Plus className="h-4 w-4" />
                                        Добавить правило
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="space-y-4">
                            <Card className="border-border/80 bg-white/90 shadow-sm">
                                <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-base text-[#132844]">
                                        <GraduationCap className="h-4 w-4 text-[#139AA4]" />
                                        Деканы
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="rounded-xl border border-border/70 px-4 py-3 text-sm space-y-2">
                                        <div className="mb-2 font-medium text-[#132844]">Фиксированное значение для декана</div>
                                        <Input
                                            type="number"
                                            min="0"
                                            value={data.dean.points}
                                            onChange={(e) => setData('dean', { points: Number(e.target.value) })}
                                        />
                                        <div className="text-xs text-muted-foreground">
                                            Текущее значение: <PointsBadge value={data.dean.points} />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-border/80 bg-white/90 shadow-sm">
                                <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-base text-[#132844]">
                                        <Building2 className="h-4 w-4 text-[#139AA4]" />
                                        Завкафедры
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4 text-sm">
                                    <div className="rounded-xl border border-border/70 px-4 py-3 space-y-2">
                                        <div className="mb-2 font-medium text-[#132844]">Базовое значение для заведующего кафедрой</div>
                                        <Input
                                            type="number"
                                            min="0"
                                            value={data.hod.default_points}
                                            onChange={(e) => setData('hod', { ...data.hod, default_points: Number(e.target.value) })}
                                        />
                                    </div>

                                    <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 space-y-3">
                                        <div className="mb-2 flex items-center gap-2 font-medium text-amber-900">
                                            <BookOpen className="h-4 w-4" />
                                            Специальное значение для отдельных кафедр
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-amber-900">Льготные баллы</label>
                                            <Input
                                                type="number"
                                                min="0"
                                                value={data.hod.special_points}
                                                onChange={(e) => setData('hod', { ...data.hod, special_points: Number(e.target.value) })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-amber-900">Коды кафедр</label>
                                            <Textarea
                                                rows={4}
                                                value={data.hod.special_department_codes_text}
                                                onChange={(e) => setData('hod', { ...data.hod, special_department_codes_text: e.target.value })}
                                                placeholder="Например: ГиИЯ, СГД, ФВ"
                                            />
                                            <div className="text-xs text-amber-900/80">Можно вводить через запятую или с новой строки.</div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
                                        <div className="text-xs text-muted-foreground">
                                            Изменения применяются к KPI-сводкам сразу после сохранения.
                                        </div>
                                        <Button type="submit" disabled={processing} className="min-w-32">
                                            {processing ? 'Сохранение...' : (recentlySuccessful ? 'Сохранено' : 'Сохранить')}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </form>
                )}

                {activeTab === 'access' && (
                    <div className="space-y-6">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between gap-4">
                                <CardTitle className="flex items-center gap-2">
                                    <ShieldCheck className="h-5 w-5" />
                                    KPI-администраторы
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {!canManageFullAccess && (
                                    <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                                        Только системные администраторы и KPI-администраторы могут назначать и отзывать полный доступ KPI.
                                    </div>
                                )}

                                <form className="flex flex-wrap items-end gap-3" onSubmit={submitAccess}>
                                    <div className="min-w-[320px] flex-1 space-y-2">
                                        <label className="text-sm font-medium">Сотрудник</label>
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
                                            <div className="max-h-52 overflow-auto rounded-md border border-border bg-background">
                                                {filteredAccessStaff.length === 0 ? (
                                                    <div className="px-3 py-2 text-xs text-muted-foreground">Совпадений не найдено.</div>
                                                ) : (
                                                    filteredAccessStaff.map((staff) => (
                                                        <button
                                                            key={staff.id}
                                                            type="button"
                                                            onMouseDown={() => pickAccessUser(staff)}
                                                            className="w-full border-b border-border/50 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted/50"
                                                        >
                                                            <div className="font-medium">{staff.name}</div>
                                                            <div className="text-xs text-muted-foreground">{[staff.department, staff.email].filter(Boolean).join(' • ')}</div>
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                        {selectedAccessUser && (
                                            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                                                Выбран: {selectedAccessUser.name} ({selectedAccessUser.department || 'без подразделения'})
                                            </div>
                                        )}
                                        {accessForm.errors.user_id && <div className="text-xs text-destructive">{accessForm.errors.user_id}</div>}
                                    </div>

                                    <Button type="submit" disabled={!canManageFullAccess || accessForm.processing || !accessForm.data.user_id}>
                                        <KeyRound className="mr-2 h-4 w-4" />
                                        Назначить KPI-админом
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Текущие доступы</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {accessGrants.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">Пока никому не назначен KPI-админ доступ.</p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full min-w-[860px] text-sm">
                                            <thead>
                                                <tr className="border-b text-left text-muted-foreground">
                                                    <th className="py-3 pe-3 font-medium">Сотрудник</th>
                                                    <th className="py-3 pe-3 font-medium">Email</th>
                                                    <th className="py-3 pe-3 font-medium">Подразделение</th>
                                                    <th className="py-3 pe-3 font-medium">Кем выдано</th>
                                                    <th className="py-3 pe-3 font-medium">Когда</th>
                                                    <th className="py-3 text-right font-medium">Действия</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {accessGrants.map((grant) => (
                                                    <tr key={grant.id} className="border-b align-top last:border-0">
                                                        <td className="py-3 pe-3">
                                                            <div className="font-medium">{grant.user?.display_name || grant.user?.name || '—'}</div>
                                                            <div className="text-xs text-muted-foreground">{grant.user?.ad_title || 'Без должности'}</div>
                                                        </td>
                                                        <td className="py-3 pe-3">{grant.user?.email || '—'}</td>
                                                        <td className="py-3 pe-3">{grant.user?.ad_department || '—'}</td>
                                                        <td className="py-3 pe-3">
                                                            <Badge variant="outline">{grant.granted_by?.display_name || grant.granted_by?.name || '—'}</Badge>
                                                        </td>
                                                        <td className="py-3 pe-3">{grant.granted_at ? new Date(grant.granted_at).toLocaleString('ru-RU') : '—'}</td>
                                                        <td className="py-3 text-right">
                                                            <Button type="button" variant="destructive" size="sm" onClick={() => revokeAccess(grant.id)} disabled={!canManageFullAccess}>
                                                                <Trash2 className="mr-2 h-4 w-4" />
                                                                Отозвать
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
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
        </AuthenticatedLayout>
        <ConfirmDialog
            open={confirmState.open}
            onOpenChange={(open) => !open && setConfirmState({ open: false, description: '', onConfirm: null })}
            description={confirmState.description}
            onConfirm={() => {
                confirmState.onConfirm?.();
                setConfirmState({ open: false, description: '', onConfirm: null });
            }}
        />
    );
}
