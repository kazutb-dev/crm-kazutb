
import { AppSidebar } from '@/components/app-sidebar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Head, usePage, router } from '@inertiajs/react';
import { Home } from 'lucide-react';
import ReminderProfileModal from '@/components/ReminderProfileModal';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

export default function AuthenticatedLayout({ header, headerRight, children }) {
    const page = usePage();
    const { component, props } = page;
    const user = props?.auth?.user;
    const roleSlug = props?.auth?.roleSlug;
    const profileReminderAfterLogin = Boolean(props?.flash?.profileReminderAfterLogin);
    const flash = props?.flash ?? {};
    const errors = props?.errors ?? {};

    // Profile completeness check
    const facultyId = user?.faculty_id;
    const departmentId = user?.department_id;
    const isProfileIncomplete = user && (!facultyId || !departmentId);
    const [showReminder, setShowReminder] = useState(false);
    const lastToastSignatureRef = useRef('');

    useEffect(() => {
        if (profileReminderAfterLogin && isProfileIncomplete) {
            setShowReminder(true);
        }
    }, [profileReminderAfterLogin, isProfileIncomplete]);

    useEffect(() => {
        const success = typeof flash?.success === 'string' ? flash.success.trim() : '';
        const error = typeof flash?.error === 'string' ? flash.error.trim() : '';
        const warning = typeof flash?.warning === 'string' ? flash.warning.trim() : '';
        const kpiError = typeof errors?.kpi_entry === 'string' ? errors.kpi_entry.trim() : '';

        const signature = JSON.stringify({ component, success, error, warning, kpiError });

        if (!success && !error && !warning && !kpiError) {
            return;
        }

        if (lastToastSignatureRef.current === signature) {
            return;
        }

        lastToastSignatureRef.current = signature;

        if (success) {
            toast.success(success);
        }

        if (warning) {
            toast.warning(warning);
        }

        if (error) {
            toast.error(error);
        }

        if (kpiError) {
            toast.error(kpiError);
        }
    }, [component, flash?.success, flash?.error, flash?.warning, errors?.kpi_entry]);

    const goToProfile = () => {
        setShowReminder(false);
        router.visit(route('profile.edit'));
    };

    const pageTitles = {
        Dashboard: 'Панель управления',
        'Profile/Edit': 'Профиль',
        'Faculties/Index': 'Факультеты',
        'Departments/Index': 'Кафедры',
        'Divisions/Index': 'Департаменты',
        'Departments/Create': 'Новая кафедра',
        'Departments/Edit': 'Редактирование кафедры',
        'AcademicYears/Index': 'Учебные годы',
        'EducationalPrograms/Index': 'Образовательные программы',
        'Phonebook/Index': 'Справочник сотрудников',
        'Users/Index': 'Пользователи',
        'Users/AdminAccess': 'Права администратора',
        'Governance/OrgStructure': 'Управление доступом — Оргструктура',
        'Governance/RoleAccess': 'Управление доступом — Роль-доступ',
        'Governance/AccessRequests': 'Управление доступом — Запросы доступа',
        'Governance/AuthorityLedger': 'Управление доступом — Журнал полномочий',
        'Kpi/Index': 'KPI-сезоны',
        'Kpi/TeacherForm': 'KPI — Мои показатели',
        'Kpi/TeacherDashboard': 'KPI — Мои показатели',
        'Kpi/ReviewQueue': 'KPI — Проверка Завкафедрой',
        'Kpi/ApprovalQueue': 'KPI — Проверка Деканом',
        'Kpi/StructuralQueue': 'KPI — Проверка Структурным подразделением',
        'Kpi/EntryShow': 'KPI-запись',
        'Kpi/Indicators': 'KPI-индикаторы',
        'Kpi/Summary': 'KPI — Сводка',
        'Kpi/StructuralUnitsManager': 'KPI — Структурные подразделения',
        'Kpi/StructuralUnitShow': 'KPI — Структурное подразделение',
        'Kpi/Divisions': 'KPI — Департаменты',
        'Admin/AuditLogs': 'Журнал действий',
        'Admin/Monitoring': 'Мониторинг системы',
        'HR/Dashboard': 'HR — Панель HR',
        'HR/Perco': 'HR — Все сотрудники',
        'HR/PercoLate': 'HR — Опоздавшие',
        'HR/PercoAbsence': 'HR — Отсутствующие',
        'HR/PercoEarly': 'HR — Ушедшие раньше',
        'HR/PercoOvertime': 'HR — Переработка',
        'HR/PercoSettings': 'HR — Настройки Perco',
        'Library/Dashboard': 'Библиотека — Главная',
        'Library/IssueBook': 'Библиотека — Выдать книгу',
        'Library/ReservationsAdmin': 'Библиотека — Бронирование книг',
        'Diplomas/Index': 'Дипломные работы',
        'Tickets/AdminIndex': 'Заявки',
        'Templates/Index': 'Шаблоны сертификатов',
        'Certificates/Index': 'Сертификаты',
        'Certificates/Show': 'Сертификат',
        'LanguageTesting/Tests/Index': 'Проверка знаний языка — Тесты',
        'LanguageTesting/Questions/Index': 'Проверка знаний языка — Вопросы',
        'LanguageTesting/Statistics/Index': 'Проверка знаний языка — Статистика',
        'DepartmentRequests/Index': 'Заявки',
        'DepartmentRequests/Departments': 'Отделы для заявок',
        'DepartmentRequests/Admin/Index': 'Заявки — Администрирование',
        'Calendar/Index': 'Календарь — Мой календарь',
        'Calendar/Employees': 'Календарь — Сотрудники',
        'Calendar/Conferences': 'Календарь — Конференции',
        'Calendar/Analytics': 'Календарь — Аналитика',
        'Calendar/Settings': 'Календарь — Настройки',
        'Questionnaire/Student/Index': 'Анкетирование — Студент',
        'Questionnaire/Admin/Specialities': 'Анкетирование — Специальности',
        'Testing/Index': 'Тестирование — Предметы',
        'Testing/BindingShow': 'Тестирование — Привязка предмета',
        'Testing/TestForm': 'Тестирование — Конструктор теста',
        'Testing/BindingAnalytics': 'Тестирование — Аналитика',
    };

    const pageTitleBase =
        pageTitles[component] ?? component.split('/').at(-1) ?? 'Страница';

    const queueScopeTitle = (() => {
        if (!['Kpi/ReviewQueue', 'Kpi/ApprovalQueue', 'Kpi/StructuralQueue'].includes(component)) {
            return null;
        }

        if (roleSlug === 'admin' || roleSlug === 'superadmin') {
            return 'Админ';
        }

        if (component === 'Kpi/ReviewQueue' && props?.reviewScope?.type === 'department') {
            return props?.reviewScope?.label ?? null;
        }

        if (component === 'Kpi/ApprovalQueue' && props?.reviewScope?.type === 'faculty') {
            return props?.reviewScope?.label ?? null;
        }

        if (component === 'Kpi/StructuralQueue') {
            const scope = props?.structuralScope;

            if (scope?.type === 'divisions' && Array.isArray(scope.divisions) && scope.divisions.length > 0) {
                const divisionNames = scope.divisions
                    .map((division) => division?.name ?? division?.code)
                    .filter(Boolean);

                if (divisionNames.length > 0) {
                    return divisionNames.join(', ');
                }
            }

            if (scope?.type === 'info' && user?.ad_division) {
                return user.ad_division;
            }

            if (scope?.type === 'unrestricted') {
                return 'Без ограничений';
            }
        }

        return null;
    })();

    const pageTitle = queueScopeTitle ? `${pageTitleBase} — ${queueScopeTitle}` : pageTitleBase;
    const [section = 'Раздел', sectionPage = 'Страница'] = component.split('/');

    return (
        <SidebarProvider>
            <Head />
            <AppSidebar />
            <SidebarInset>
                <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
                    <div style={{ position: 'absolute', left: -120, top: -180, width: 320, height: 320, borderRadius: '50%', background: 'rgba(9,186,178,0.12)', filter: 'blur(72px)' }} />
                    <div style={{ position: 'absolute', right: -140, top: -140, width: 384, height: 384, borderRadius: '50%', background: 'rgba(252,187,89,0.12)', filter: 'blur(80px)' }} />
                </div>

                {/* Reminder Modal for incomplete profile */}
                <ReminderProfileModal
                    open={showReminder}
                    onClose={() => setShowReminder(false)}
                    goToProfile={goToProfile}
                />

                <header className="admin-shell-topbar">
                    <div className="admin-shell-topbar-row">
                        <SidebarTrigger className="h-9 w-9 rounded-md border border-border/80 bg-white/90" />
                        <Separator orientation="vertical" className="h-5" />
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" style={{ borderColor: 'var(--teal-200)', background: 'var(--teal-50)', color: 'var(--teal-800)' }}>{section}</Badge>
                                <p className="truncate text-sm font-medium text-muted-foreground/90">{sectionPage}</p>
                            </div>
                            <h1 className="mt-0.5 truncate text-[1.1rem] font-semibold" style={{ color: 'var(--navy-800)', fontFamily: 'var(--font-sans)' }}>{pageTitle}</h1>
                        </div>

                        <a
                            href={import.meta.env.VITE_HOME_URL ?? '/'}
                            className="hidden h-9 items-center gap-2 rounded-lg border border-border/80 bg-white/90 px-3 text-sm font-medium text-foreground shadow-sm transition hover:-translate-y-0.5 hover:bg-accent/30 sm:inline-flex"
                        >
                            <Home className="h-4 w-4" />
                            Главная
                        </a>

                        {headerRight && <div className="admin-header-actions shrink-0">{headerRight}</div>}
                    </div>
                </header>

                {header && (
                    <div className="px-4 pt-4 sm:px-6 sm:pt-6">
                        <div className="admin-surface p-5 sm:p-6">
                            {header}
                        </div>
                    </div>
                )}

                <main className="flex-1">{children}</main>
            </SidebarInset>
        </SidebarProvider>
    );
}
