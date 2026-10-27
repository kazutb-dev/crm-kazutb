
import { AppSidebar } from '@/components/app-sidebar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PanelDesignProvider } from '@/components/ui/panel-design';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Head, usePage, router } from '@inertiajs/react';
import { ChevronRight, Home } from 'lucide-react';
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
        'TeacherAi/Index': 'AI-ассистент — Проверка документов',
        'TeacherAi/Show': 'AI-ассистент — Результат проверки',
        'TeacherAi/Lessons/Index': 'AI-ассистент — Лекции и презентации',
        'TeacherAi/Lessons/Show': 'AI-ассистент — Материалы занятия',
        'Hr/Hiring/Index': 'Список приёмов',
        'Hr/Hiring/Wizard': 'Оформление приёма',
        'Hr/Hiring/Show': 'Карточка приёма',
        'Hr/Hiring/Settings': 'Настройки модуля',
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
        'Calendar/Overview': 'Календарь — Обзор',
        'Calendar/My': 'Календарь — Мой календарь',
        'Calendar/Shared': 'Календарь — Совместное управление',
        'Calendar/EmployeeProfile': 'Календарь — Профиль сотрудника',
        'Certificates/GeneratePage': 'Сертификаты — Генерация',
        'Certificates/Registry': 'Сертификаты — Реестр',
        'Nav/AdminRoutes': 'Маршруты навигации',
        'Kpi/StructuralDivisionDashboard': 'KPI — Структурные подразделения',
        'Kpi/ApprovedEmployees': 'KPI — Прошедшие полную проверку',
        'Kpi/DivisionEmployees': 'KPI — Сотрудники подразделения',
        'Kpi/SummaryTeacherCard': 'KPI — Карточка преподавателя',
        'Kpi/Settings': 'KPI — Настройки',
        'Kpi/DivisionTables': 'KPI — Таблицы подразделений',
        'Kpi/Analytics': 'KPI — Аналитика',
        'Kpi/Access': 'KPI — Доступ к модулям',
        'Special/LoginImage': 'Приветствие',
        'Positions/Index': 'Должности',
        'PositionRequests/AdminIndex': 'Заявки на изменение должности',
        'Announcements/Index': 'Объявления',
        'AcademicMobility/StudentPage': 'Академическая мобильность',
        'AcademicMobility/StaffPage': 'Академическая мобильность',
        'AcademicMobility/StudentStatusPage': 'Академическая мобильность — Статус заявки',
        'Questionnaire/Admin/Reports': 'Анкетирование — Отчёты',
        'Questionnaire/Admin/Students': 'Анкетирование — Студенты',
        'Questionnaire/Admin/Groups': 'Анкетирование — Группы',
        'Questionnaire/Admin/GroupAssignments': 'Анкетирование — Назначения',
        'Questionnaire/Admin/GroupDetails': 'Анкетирование — Детали группы',
        'Questionnaire/Admin/Questions': 'Анкетирование — Опросы и вопросы',
        'Questionnaire/Admin/TeacherDisciplines': 'Анкетирование — Преподаватели',
        'Questionnaire/Admin/Disciplines': 'Анкетирование — Дисциплины',
        'Admin/SurveyStudents': 'Анкетирование — Студенты',
        'Admin/SurveyGroups': 'Анкетирование — Группы',
        'Testing/Subjects': 'Тестирование — Управление предметами',
        'HR/PercoLateEmployee': 'HR — Карточка опозданий',
        'HR/PercoTimetracking': 'HR — Рабочее время',
        'HR/DivisionLatePeople': 'HR — Опоздавшие сотрудники',
        'HR/PercoDayEvents': 'HR — История проходов за день',
        'Errors/403': 'Доступ запрещён',
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

    // «Раздел — Страница» titles become a breadcrumb trail plus the page name; the HR module keeps its own trail.
    const titleParts = pageTitleBase.split(' — ');
    const pageName = titleParts.at(-1);
    const trail = component.startsWith('Hr/Hiring/')
        ? ['Отдел кадров', 'Приём на работу']
        : titleParts.slice(0, -1);
    const breadcrumbs = component === 'Dashboard' ? ['КазУТБ CRM'] : ['Панель', ...trail];

    return (
        <SidebarProvider>
            <Head />
            <AppSidebar />
            <SidebarInset className="qd-panel">
                <PanelDesignProvider>
                    {/* Reminder Modal for incomplete profile */}
                    <ReminderProfileModal
                        open={showReminder}
                        onClose={() => setShowReminder(false)}
                        goToProfile={goToProfile}
                    />

                    <header className="admin-shell-topbar">
                        <div className="admin-shell-topbar-row">
                            <SidebarTrigger className="h-10 w-10 shrink-0 border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50" />
                            <div className="min-w-0 flex-1">
                                <nav aria-label="Навигационная цепочка" className="flex min-w-0 items-center gap-1 text-xs font-medium text-slate-500">
                                    {breadcrumbs.map((crumb, index) => (
                                        <span key={`${crumb}-${index}`} className="flex min-w-0 items-center gap-1">
                                            {index > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />}
                                            <span className="truncate">{crumb}</span>
                                        </span>
                                    ))}
                                </nav>
                                <div className="mt-0.5 flex min-w-0 items-center gap-2">
                                    <h1 className="truncate font-display text-[1.375rem] font-bold leading-tight tracking-[-0.01em] text-[#102945]">{pageName}</h1>
                                    {queueScopeTitle && <Badge className="max-w-[40%] shrink truncate">{queueScopeTitle}</Badge>}
                                </div>
                            </div>

                            <Button asChild variant="outline" className="hidden sm:inline-flex">
                                <a href={import.meta.env.VITE_HOME_URL ?? '/'}>
                                    <Home />
                                    Главная
                                </a>
                            </Button>

                            {headerRight && <div className="admin-header-actions shrink-0">{headerRight}</div>}
                        </div>
                    </header>

                    {header && <section className="qd-hero">{header}</section>}

                    <main className="flex-1">{children}</main>
                </PanelDesignProvider>
            </SidebarInset>
        </SidebarProvider>
    );
}
