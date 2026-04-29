import ApplicationLogo from '@/Components/ApplicationLogo';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
} from '@/components/ui/sidebar';
import { Link, router, usePage } from '@inertiajs/react';
import {
    AlertCircle,
    Award,
    BarChart3,
    BookOpenText,
    BriefcaseBusiness,
    Building2,
    Building,
    Calendar,
    CalendarRange,
    FileCheck,
    GraduationCap,
    LayoutDashboard,
    LogOut,
    ShieldCheck,
    UserCog,
    Users,
    Video,
    ScrollText,
    ClipboardList,
    History,
    TrendingUp,
    SlidersHorizontal,
    CircleX,
    Timer,
    Clock,
    Megaphone,
    MapPinned,
} from 'lucide-react';

export function AppSidebar() {
    const { auth, calendar } = usePage().props;
    const user = auth.user;
    const roleSlug = auth.roleSlug;
    const incomingCalendarCount = Number(calendar?.incoming_count ?? 0);
    const sharedCalendarCount = Number(calendar?.shared_access_count ?? 0);
    const TEMP_HIDE_MAIN_MENUS = false;
    const isAdminRole = ['admin', 'superadmin'].includes(roleSlug);
    const isTeacherRole = roleSlug === 'teacher';
    const isDepartmentRole = roleSlug === 'department';
    const isStudentRole = roleSlug === 'student';
    const normalizedDivision = String(user?.ad_division ?? '')
        .trim()
        .toLowerCase();
    const isRatingAccreditationDivision = normalizedDivision === 'отдел рейтинга и аккредитации';
    const showAllKpiMenus = isAdminRole || isRatingAccreditationDivision;
    const showOnlyKpiMenus = isRatingAccreditationDivision;
    const canUseCalendar = Boolean(calendar?.can_access);
    const isCalendarRoute = route().current('calendar.*');

    const kpiHref = (() => {
        if (roleSlug === 'teacher') {
            return route('kpi.my-form');
        }

        if (roleSlug === 'department_head' || roleSlug === 'hod' || roleSlug === 'dean') {
            return route('kpi.review-queue');
        }

        return route('kpi.index');
    })();

    const handleLogout = () => {
        router.post(route('logout'));
    };

    const navigation = isAdminRole ? [
        {
            title: 'Панель управления',
            href: route('dashboard'),
            icon: LayoutDashboard,
            active: route().current('dashboard'),
        },
        {
            title: 'Сотрудники',
            href: route('users.index'),
            icon: Users,
            active: route().current('users.index'),
        },
        {
            title: 'Студенты',
            href: route('users.students'),
            icon: GraduationCap,
            active: route().current('users.students'),
        },
        {
            title: 'Заявки',
            href: route('tickets.admin'),
            icon: ClipboardList,
            active: route().current('tickets.admin'),
        },
        ...(isAdminRole
            ? [{
                title: 'Маршруты навигации',
                href: route('nav.routes.admin'),
                icon: MapPinned,
                active: route().current('nav.routes.*'),
            }]
            : []),
        ...(isAdminRole
            ? [{
                title: 'Журнал действий',
                href: route('admin.audit-logs.index'),
                icon: History,
                active: route().current('admin.audit-logs.*'),
            }]
            : []),
        ...(roleSlug === 'superadmin'
            ? [{
                title: 'KPI Аналитика',
                href: route('kpi.analytics.index'),
                icon: TrendingUp,
                active: route().current('kpi.analytics.*'),
            }]
            : []),
    ] : [];

    const management = isAdminRole ? [
        {
            title: 'Факультеты',
            href: route('faculties.index'),
            icon: GraduationCap,
            active: route().current('faculties.*'),
        },
        {
            title: 'Кафедры',
            href: route('departments.index'),
            icon: Building2,
            active: route().current('departments.*'),
        },
        {
            title: 'Департаменты',
            href: route('divisions.index'),
            icon: Building,
            active: route().current('divisions.*'),
        },
        {
            title: 'Должности',
            href: route('positions.index'),
            icon: BriefcaseBusiness,
            active: route().current('positions.*'),
        },
        {
            title: 'Учебные годы',
            href: route('academic-years.index'),
            icon: CalendarRange,
            active: route().current('academic-years.*'),
        },
        {
            title: 'Образовательные программы',
            href: route('educational-programs.index'),
            icon: BookOpenText,
            active: route().current('educational-programs.*'),
        },
        ...(isAdminRole
            ? [{
                title: 'KPI Индикаторы',
                href: route('kpi.indicators.index'),
                icon: SlidersHorizontal,
                active: route().current('kpi.indicators.*'),
            }]
            : []),
    ] : [];

    const kafedras = [
        // ППС: только свои KPI
        ...((['teacher'].includes(roleSlug) || showAllKpiMenus)
            ? [{
                title: 'KPI — Мои показатели',
                href: route('kpi.my-form'),
                icon: BarChart3,
                active: route().current('kpi.my-form'),
            }]
            : []),

        // Зав. кафедрой: очередь проверки (submitted → pending_dean)
        ...((['hod', 'department_head'].includes(roleSlug) || showAllKpiMenus)
            ? [{
                title: 'KPI — Очередь проверки',
                href: route('kpi.review-queue'),
                icon: BarChart3,
                active: route().current('kpi.review-queue'),
            }]
            : []),

        // Декан: очередь утверждения (pending_dean → pending_structural)
        ...((['dean'].includes(roleSlug) || showAllKpiMenus)
            ? [{
                title: 'KPI — Утверждение',
                href: route('kpi.approval-queue'),
                icon: ShieldCheck,
                active: route().current('kpi.approval-queue'),
            }]
            : []),

        // Структурные подразделения: финальное утверждение (pending_structural → approved/rejected)
        ...((['department'].includes(roleSlug) || showAllKpiMenus)
            ? [{
                title: 'KPI — На утверждение',
                href: route('kpi.structural-queue'),
                icon: ShieldCheck,
                active: route().current('kpi.structural-queue'),
            }]
            : []),

        ...(!showOnlyKpiMenus
            ? [
                {
                    title: 'Дипломные работы',
                    href: route('diplomas.index'),
                    icon: ScrollText,
                    active: route().current('diplomas.*'),
                },
                {
                    title: 'Объявления',
                    href: route('announcements.index'),
                    icon: Megaphone,
                    active: route().current('announcements.*'),
                },
            ]
            : []),
    ];

    const hr = isAdminRole ? [
        {
            title: 'HR Dashboard',
            href: route('hr.dashboard'),
            icon: BarChart3,
            active: route().current('hr.dashboard'),
        },
        {
            title: 'Все сотрудники',
            href: route('hr.perco.index'),
            icon: BriefcaseBusiness,
            active: route().current('hr.perco.index'),
        },
        {
            title: 'Опоздавшие',
            href: route('hr.perco.late'),
            icon: AlertCircle,
            active: route().current('hr.perco.late'),
        },
        {
            title: 'Отсутствующие',
            href: route('hr.perco.absence'),
            icon: CircleX,
            active: route().current('hr.perco.absence'),
        },
        {
            title: 'Ранний выход',
            href: route('hr.perco.early'),
            icon: History,
            active: route().current('hr.perco.early'),
        },
        {
            title: 'Отчет',
            href: route('hr.perco.timetracking'),
            icon: Clock,
            active: route().current('hr.perco.timetracking'),
        },
        {
            title: 'Настройки Perco',
            href: route('hr.perco.settings'),
            icon: SlidersHorizontal,
            active: route().current('hr.perco.settings'),
        },
    ] : [];

    const library = isAdminRole ? [
        {
            title: 'Library Dashboard',
            href: route('library.dashboard'),
            icon: BookOpenText,
            active: route().current('library.dashboard'),
        },
        {
            title: 'Выдать книгу',
            href: route('library.issue-book'),
            icon: ClipboardList,
            active: route().current('library.issue-book'),
        },
        ...(isAdminRole
            ? [{
                title: 'Брони книг',
                href: route('library.reservations.admin'),
                icon: Timer,
                active: route().current('library.reservations.admin'),
            }]
            : []),
    ] : [];

    const calendarNavigation = [
        { title: 'Календарь', href: route('calendar.index'), icon: Calendar, active: route().current('calendar.index') },
        ...(sharedCalendarCount > 0
            ? [{ title: 'Совместный календарь', href: route('calendar.shared'), icon: CalendarRange, active: route().current('calendar.shared') }]
            : []),
        { title: 'Сотрудники', href: route('calendar.employees'), icon: Users, active: route().current('calendar.employees') || route().current('calendar.employees.profile') },
        { title: 'Конференции', href: route('calendar.conferences'), icon: Video, active: route().current('calendar.conferences') },
        { title: 'Настройки', href: route('calendar.settings'), icon: SlidersHorizontal, active: route().current('calendar.settings') },
        ...((isAdminRole || ['rector', 'prorector', 'dean', 'director', 'hod', 'department_head'].includes(roleSlug))
            ? [{ title: 'Аналитика', href: route('calendar.analytics'), icon: BarChart3, active: route().current('calendar.analytics') }]
            : []),
    ];

    const calendarGroup = canUseCalendar && (
        <SidebarGroup>
            <SidebarGroupLabel>Smart Calendar</SidebarGroupLabel>
            <SidebarGroupContent>
                <SidebarMenu>
                    {calendarNavigation.map(item => (
                        <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton asChild isActive={item.active} tooltip={item.title}>
                                <Link href={item.href}>
                                    <item.icon />
                                    <span>{item.title}</span>
                                    {item.title === 'Календарь' && incomingCalendarCount > 0 && (
                                        <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
                                            {incomingCalendarCount}
                                        </span>
                                    )}
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    ))}
                </SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>
    );

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild size="lg">
                            <Link href={route('dashboard')}>
                                <ApplicationLogo className="size-5 shrink-0 fill-current text-sidebar-primary" />
                                <span className="font-semibold">Админпанель</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Аккаунт</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild isActive={route().current('profile.*')} tooltip="Профиль">
                                    <Link href={route('profile.edit')}>
                                        <UserCog />
                                        <span>Профиль</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                {isCalendarRoute && calendarGroup}

                {!TEMP_HIDE_MAIN_MENUS && isAdminRole && !showOnlyKpiMenus && (
                    <SidebarGroup>
                        <SidebarGroupLabel>Навигация</SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {navigation.map((item) => (
                                    <SidebarMenuItem key={item.title}>
                                        <SidebarMenuButton asChild isActive={item.active} tooltip={item.title}>
                                            <Link href={item.href}>
                                                <item.icon />
                                                <span>{item.title}</span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                )}

                {!TEMP_HIDE_MAIN_MENUS && isAdminRole && !showOnlyKpiMenus && (
                    <SidebarGroup>
                        <SidebarGroupLabel>Управление</SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {management.map((item) => (
                                    <SidebarMenuItem key={item.title}>
                                        <SidebarMenuButton asChild isActive={item.active} tooltip={item.title}>
                                            <Link href={item.href}>
                                                <item.icon />
                                                <span>{item.title}</span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                )}

                {(isAdminRole || isTeacherRole || isDepartmentRole || isRatingAccreditationDivision) && (
                    <SidebarGroup>
                        <SidebarGroupLabel>Кафедра</SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {kafedras.map((item) => (
                                    <SidebarMenuItem key={item.title}>
                                        <SidebarMenuButton asChild isActive={item.active} tooltip={item.title}>
                                            <Link href={item.href}>
                                                <item.icon />
                                                <span>{item.title}</span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                )}

                {isAdminRole && !showOnlyKpiMenus && (
                    <SidebarGroup>
                        <SidebarGroupLabel>HR</SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {hr.map((item) => (
                                    <SidebarMenuItem key={item.title}>
                                        <SidebarMenuButton asChild isActive={item.active} tooltip={item.title}>
                                            <Link href={item.href}>
                                                <item.icon />
                                                <span>{item.title}</span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                )}

                {isAdminRole && !showOnlyKpiMenus && (
                    <SidebarGroup>
                        <SidebarGroupLabel>Библиотека</SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {library.map((item) => (
                                    <SidebarMenuItem key={item.title}>
                                        <SidebarMenuButton asChild isActive={item.active} tooltip={item.title}>
                                            <Link href={item.href}>
                                                <item.icon />
                                                <span>{item.title}</span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                )}

                {!isCalendarRoute && calendarGroup}

                {isAdminRole && !showOnlyKpiMenus && (
                    <SidebarGroup>
                        <SidebarGroupLabel>Шаблоны и сертификаты</SidebarGroupLabel>                        <SidebarGroupContent>
                            <SidebarMenu>
                                <SidebarMenuItem>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={route().current('templates.*')}
                                        tooltip="Шаблоны"
                                    >
                                        <Link href={route('templates.index')}>
                                            <FileCheck />
                                            <span>Шаблоны</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                                <SidebarMenuItem>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={route().current('certificates.*')}
                                        tooltip="Сертификаты"
                                    >
                                        <Link href={route('certificates.index')}>
                                            <Award />
                                            <span>Сертификаты</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                )}
            </SidebarContent>

            <SidebarFooter>
                <SidebarMenu>
                    {!isStudentRole && (
                        <SidebarMenuItem>
                            <SidebarMenuButton>
                                <ShieldCheck />
                                <span>{user.name}</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    )}
                    <SidebarMenuItem>
                        <SidebarMenuButton tooltip="Выйти" onClick={handleLogout}>
                            <LogOut />
                            <span>Выход</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    );
}
