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
    useSidebar,
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
    CalendarDays,
    CalendarRange,
    FileCheck,
    GraduationCap,
    LayoutDashboard,
    LogOut,
    Home,
    ShieldCheck,
    UserCog,
    Users,
    ClipboardList,
    History,
    TrendingUp,
    SlidersHorizontal,
    CheckCircle2,
    CircleX,
    Timer,
    Clock,
    ChevronDown,
    Megaphone,
    MapPinned,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const SIDEBAR_GROUPS_STORAGE_KEY = 'kazutb.crm.sidebar.expanded-groups.v2';
const SIDEBAR_GROUP_KEYS = [
    'main',
    'directories',
    'governance',
    'kpi',
    'questionnaire',
    'hr',
    'library',
    'calendarAdmin',
    'calendarShared',
    'templates',
    'deptRequests',
    'phonebook',
];

const SIDEBAR_DEFAULT_GROUP_STATE = SIDEBAR_GROUP_KEYS.reduce((acc, key) => {
    acc[key] = false;
    return acc;
}, {});

const ROLE_LABELS = {
    admin: 'Администратор',
    superadmin: 'Суперадмин',
    certificates: 'Оператор сертификатов',
    teacher: 'Преподаватель',
    hod: 'Завед. кафедрой',
    department_head: 'Завед. кафедрой',
    dean: 'Декан',
    department: 'Департаменты',
    structural: 'Структурные подразделения',
    student: 'Студент',
};

function readSidebarExpandedGroups() {
    if (typeof window === 'undefined') {
        return {
            hasStoredState: false,
            state: { ...SIDEBAR_DEFAULT_GROUP_STATE },
        };
    }

    try {
        const raw = window.localStorage.getItem(SIDEBAR_GROUPS_STORAGE_KEY);
        if (!raw) {
            return {
                hasStoredState: false,
                state: { ...SIDEBAR_DEFAULT_GROUP_STATE },
            };
        }

        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') {
            return {
                hasStoredState: false,
                state: { ...SIDEBAR_DEFAULT_GROUP_STATE },
            };
        }

        return {
            hasStoredState: true,
            state: {
                ...SIDEBAR_DEFAULT_GROUP_STATE,
                ...parsed,
            },
        };
    } catch {
        return {
            hasStoredState: false,
            state: { ...SIDEBAR_DEFAULT_GROUP_STATE },
        };
    }
}

export function AppSidebar() {
    const page = usePage();
    const { auth, kpi, calendar: calendarShared = {} } = page.props;
    const currentComponent = page.component;
    const user = auth.user;
    const roleSlug = auth.roleSlug;
    const kpiGrants = new Set(kpi?.grants ?? []);
    const TEMP_HIDE_MAIN_MENUS = false;
    const isAdminRole = ['admin', 'superadmin'].includes(roleSlug);
    const isCertificatesRole = roleSlug === 'certificates';
    const isKpiAdminGrant =
        kpiGrants.has('kpi_admin')
        || kpiGrants.has('kpi-admin')
        || kpiGrants.has('kpi administrator')
        || roleSlug === 'kpi_admin';
    const isTeacherRole = roleSlug === 'teacher';
    const isHodRole = ['hod', 'department_head'].includes(roleSlug);
    const isDeanRole = roleSlug === 'dean';
    const isDepartmentRole = roleSlug === 'department';
    const isStructuralRole = roleSlug === 'structural';
    const isStudentRole = roleSlug === 'student';
    const hasTemplatesEmailAccess = String(user?.email ?? '').toLowerCase() === 'a.khastayeva@kaztbu.edu.kz';
    const canAccessTemplatesSection = isAdminRole || hasTemplatesEmailAccess || isCertificatesRole;
    const canAccessPositionRequests =
        isAdminRole
        || isStructuralRole
        || isDeanRole
        || isHodRole
        || isKpiAdminGrant;
    const canAccessCalendar = calendarShared?.can_access ?? false;
    const sharedAccessCount = calendarShared?.shared_access_count ?? 0;
    const showAllKpiMenus = isAdminRole;
    const showOnlyKpiMenus = false;
    const showOnlyCertificatesMenus = isCertificatesRole;
    const roleLabel = ROLE_LABELS[roleSlug] ?? (roleSlug || '—');
    const facultyLabel = user?.faculty?.name ?? user?.faculty_name ?? user?.ad_division ?? '—';
    const departmentLabel = user?.department?.name ?? user?.department_name ?? user?.ad_department ?? '—';
    const handleLogout = () => {
        router.post(route('logout'));
    };

    // KPI разделы по ролям
    const kpiMenuItems = (() => {
        let items = [];

        if (isAdminRole) {
            items = [
                {
                    title: 'KPI — Настройки',
                    href: route('kpi.settings'),
                    icon: ClipboardList,
                    active: route().current('kpi.settings'),
                },
                {
                    title: 'KPI — Мои показатели',
                    href: route('kpi.my-form'),
                    icon: ClipboardList,
                    active: route().current('kpi.my-form'),
                },
                {
                    title: 'KPI — Проверка Завкафедрой',
                    href: route('kpi.review-queue'),
                    icon: ClipboardList,
                    active: route().current('kpi.review-queue'),
                },
                {
                    title: 'KPI — Проверка Деканом',
                    href: route('kpi.approval-queue'),
                    icon: ClipboardList,
                    active: route().current('kpi.approval-queue'),
                },
                {
                    title: 'KPI — Проверка Структурным подразделением',
                    href: route('kpi.structural-queue'),
                    icon: ClipboardList,
                    active: route().current('kpi.structural-queue'),
                },
                {
                    title: 'KPI — Сводка',
                    href: route('kpi.summary'),
                    icon: ClipboardList,
                    active: route().current('kpi.summary'),
                },
                {
                    title: 'KPI — Структурные подразделения',
                    href: route('kpi.structural-units.index'),
                    icon: Building2,
                    active: route().current('kpi.structural-units.*'),
                },
            ];
        } else if (isTeacherRole || isDepartmentRole) {
            items = [
                {
                    title: 'KPI — Мои показатели',
                    href: route('kpi.my-form'),
                    icon: ClipboardList,
                    active: route().current('kpi.my-form'),
                },
            ];
        } else if (isHodRole) {
            items = [
                {
                    title: 'KPI — Мои показатели',
                    href: route('kpi.my-form'),
                    icon: ClipboardList,
                    active: route().current('kpi.my-form'),
                },
                {
                    title: 'KPI — Проверка Завкафедрой',
                    href: route('kpi.review-queue'),
                    icon: ClipboardList,
                    active: route().current('kpi.review-queue'),
                },
                {
                    title: 'KPI — Сводка',
                    href: route('kpi.summary'),
                    icon: ClipboardList,
                    active: route().current('kpi.summary'),
                },
            ];
        } else if (isDeanRole) {
            items = [
                {
                    title: 'KPI — Мои показатели',
                    href: route('kpi.my-form'),
                    icon: ClipboardList,
                    active: route().current('kpi.my-form'),
                },
                {
                    title: 'KPI — Проверка Деканом',
                    href: route('kpi.approval-queue'),
                    icon: ClipboardList,
                    active: route().current('kpi.approval-queue'),
                },
                {
                    title: 'KPI — Сводка',
                    href: route('kpi.summary'),
                    icon: ClipboardList,
                    active: route().current('kpi.summary'),
                },
            ];
        } else if (isStructuralRole) {
            items = [
                {
                    title: 'KPI — Проверка Структурным подразделением',
                    href: route('kpi.structural-queue'),
                    icon: ClipboardList,
                    active: route().current('kpi.structural-queue'),
                },
                {
                    title: 'KPI — Сводка',
                    href: route('kpi.summary'),
                    icon: ClipboardList,
                    active: route().current('kpi.summary'),
                },
            ];
        }

        if (!isAdminRole && kpiGrants.size > 0) {
            // Build additional menu items based on KPI access grants
            const grantedItems = [];

            if (isKpiAdminGrant) {
                grantedItems.push(
                    {
                        title: 'KPI — Настройки',
                        href: route('kpi.settings'),
                        icon: ClipboardList,
                        active: route().current('kpi.settings'),
                    },
                    {
                        title: 'KPI — Структурные подразделения',
                        href: route('kpi.structural-units.index'),
                        icon: Building2,
                        active: route().current('kpi.structural-units.*'),
                    }
                );
            }

            if (kpiGrants.has('review_queue')) {
                grantedItems.push({
                    title: 'KPI — Проверка Завкафедрой',
                    href: route('kpi.review-queue'),
                    icon: ClipboardList,
                    active: route().current('kpi.review-queue'),
                });
            }

            if (kpiGrants.has('approval_queue')) {
                grantedItems.push({
                    title: 'KPI — Проверка Деканом',
                    href: route('kpi.approval-queue'),
                    icon: ClipboardList,
                    active: route().current('kpi.approval-queue'),
                });
            }

            if (kpiGrants.has('structural_queue')) {
                grantedItems.push({
                    title: 'KPI — Проверка Структурным подразделением',
                    href: route('kpi.structural-queue'),
                    icon: ClipboardList,
                    active: route().current('kpi.structural-queue'),
                });
            }

            // Also add summary for users with any grant
            if (!items.some((item) => item.href === route('kpi.summary'))) {
                grantedItems.push({
                    title: 'KPI — Сводка',
                    href: route('kpi.summary'),
                    icon: ClipboardList,
                    active: route().current('kpi.summary'),
                });
            }

            // Add granted items that don't already exist
            grantedItems.forEach((extraItem) => {
                if (!items.some((item) => item.href === extraItem.href)) {
                    items.push(extraItem);
                }
            });
        }

        return items;
    })();

    const navigation = [
        {
            title: 'Профиль',
            href: route('profile.edit'),
            icon: UserCog,
            active: route().current('profile.*'),
        },
        ...(isAdminRole ? [{
            title: 'Панель управления',
            href: route('dashboard'),
            icon: LayoutDashboard,
            active: route().current('dashboard'),
        }] : []),
        ...(canAccessPositionRequests ? [{
            title: 'Заявки на должность',
            href: route('position-requests.index'),
            icon: BriefcaseBusiness,
            active: route().current('position-requests.index'),
        }] : []),
        ...(isAdminRole ? [
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
                title: 'Заявки (тикеты)',
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
                }, {
                    title: 'Мониторинг системы',
                    href: route('admin.monitoring.index'),
                    icon: TrendingUp,
                    active: route().current('admin.monitoring.*'),
                }]
                : []),
            ...(isAdminRole
                ? [{
                    title: 'Объявления',
                    href: route('announcements.index'),
                    icon: Megaphone,
                    active: route().current('announcements.*'),
                }]
                : []),
        ] : []),
    ];

    const management = isAdminRole ? [
        {
            title: 'Факультеты и кафедры',
            href: route('faculties.index'),
            icon: GraduationCap,
            active: route().current('faculties.*') || route().current('departments.*'),
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
        {
            title: 'Права администратора',
            href: route('users.admin-access'),
            icon: UserCog,
            active: route().current('users.admin-access'),
        },
        ...(isAdminRole
            ? [{
                title: 'Навигация',
                href: route('nav.index'),
                icon: MapPinned,
                active: route().current('nav.index') || route().current('nav.routes.*'),
            }]
            : []),
    ] : [];


    const hr = isAdminRole ? [
        {
            title: 'Панель HR',
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
            title: 'Отчеты',
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
            title: 'Главная',
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
                title: 'Бронирование книг',
                href: route('library.reservations.admin'),
                icon: Timer,
                active: route().current('library.reservations.admin'),
            }]
            : []),
    ] : [];

    const questionnaire = isAdminRole ? [
        {
            title: 'Группы',
            href: route('questionnaire.admin.groups'),
            icon: Users,
            active: route().current('questionnaire.admin.groups') || route().current('questionnaire.admin.index'),
        },
        {
            title: 'Специальности',
            href: route('questionnaire.admin.specialities'),
            icon: GraduationCap,
            active: route().current('questionnaire.admin.specialities'),
        },
        {
            title: 'Преподаватели',
            href: route('questionnaire.admin.teacher-disciplines'),
            icon: UserCog,
            active: route().current('questionnaire.admin.teacher-disciplines'),
        },
        {
            title: 'Опросы',
            href: route('questionnaire.admin.surveys'),
            icon: CheckCircle2,
            active: route().current('questionnaire.admin.surveys'),
        },
        {
            title: 'Отчеты',
            href: route('questionnaire.admin.reports'),
            icon: BarChart3,
            active: route().current('questionnaire.admin.reports'),
        },
    ] : isStudentRole ? [
        {
            title: 'Анкетирование',
            href: route('questionnaire.student.index'),
            icon: CheckCircle2,
            active: route().current('questionnaire.student.index') || route().current('questionnaire.student.take'),
        },
    ] : [];

    const nonAdminCalendarItems = [
        {
            title: 'Мой календарь',
            href: route('calendar.index'),
            icon: CalendarRange,
            active: route().current('calendar.index'),
        },
        ...(sharedAccessCount > 0
            ? [{
                title: 'Совместные',
                href: route('calendar.shared'),
                icon: Users,
                active: route().current('calendar.shared'),
            }]
            : []),
    ];

    const adminCalendarItems = [
        {
            title: 'Мой календарь',
            href: route('calendar.index'),
            icon: CalendarRange,
            active: route().current('calendar.index'),
        },
        {
            title: 'Сотрудники',
            href: route('calendar.employees'),
            icon: Users,
            active: route().current('calendar.employees') || route().current('calendar.employees.*'),
        },
        {
            title: 'Конференции',
            href: route('calendar.conferences'),
            icon: CalendarDays,
            active: route().current('calendar.conferences'),
        },
        {
            title: 'Аналитика',
            href: route('calendar.analytics'),
            icon: TrendingUp,
            active: route().current('calendar.analytics'),
        },
        {
            title: 'Настройки',
            href: route('calendar.settings'),
            icon: SlidersHorizontal,
            active: route().current('calendar.settings'),
        },
    ];

    const templateItems = [
        {
            title: 'Шаблоны',
            href: route('templates.index'),
            icon: FileCheck,
            active: route().current('templates.*'),
        },
        {
            title: 'Сертификаты',
            href: route('certificates.index'),
            icon: Award,
            active: route().current('certificates.index'),
        },
        {
            title: 'Реестр сертификатов',
            href: route('certificates.registry.page'),
            icon: BookOpenText,
            active: route().current('certificates.registry.page') || route().current('certificates.show'),
        },
    ];

    // Department requests — visible to all authenticated users
    const deptRequestItems = [
        {
            title: 'Мои заявки',
            href: route('dept-requests.index'),
            icon: ClipboardList,
            active: route().current('dept-requests.index'),
        },
        {
            title: 'Отделы',
            href: route('dept-requests.departments'),
            icon: BookOpenText,
            active: route().current('dept-requests.departments'),
        },
        ...(isAdminRole ? [
            {
                title: 'Все заявки',
                href: route('dept-requests.admin'),
                icon: AlertCircle,
                active: route().current('dept-requests.admin'),
            },
        ] : [
            // Non-admin but assigned as handler
        ]),
    ];

    const phonebookItems = [
        {
            title: 'Телефонный справочник',
            href: route('phonebook.index'),
            icon: Users,
            active: route().current('phonebook.*'),
        },
    ];

    const governance = isAdminRole ? [
        {
            title: 'Запросы доступа',
            href: route('governance.access-requests'),
            icon: ShieldCheck,
            active: route().current('governance.access-requests'),
        },
        {
            title: 'Оргструктура',
            href: route('governance.org-structure'),
            icon: Building2,
            active: route().current('governance.org-structure'),
        },
        {
            title: 'Роль-доступ',
            href: route('governance.role-access'),
            icon: UserCog,
            active: route().current('governance.role-access'),
        },
        {
            title: 'Журнал полномочий',
            href: route('governance.authority-ledger'),
            icon: History,
            active: route().current('governance.authority-ledger'),
        },
    ] : [];

    const { state: sidebarState } = useSidebar();
    const sidebarContentRef = useRef(null);
    const groupRefs = useRef({});
    const hasStoredExpandedGroupsRef = useRef(false);

    const [expandedGroups, setExpandedGroups] = useState(() => {
        const stored = readSidebarExpandedGroups();
        hasStoredExpandedGroupsRef.current = stored.hasStoredState;
        return stored.state;
    });

    const groupActivity = {
        directories: !TEMP_HIDE_MAIN_MENUS && isAdminRole && !showOnlyKpiMenus && management.some((item) => item.active),
        governance: isAdminRole && !showOnlyKpiMenus && governance.some((item) => item.active),
        kpi: kpiMenuItems.length > 0 && kpiMenuItems.some((item) => item.active),
        questionnaire: !showOnlyKpiMenus && questionnaire.some((item) => item.active),
        calendarShared: !isAdminRole && (canAccessCalendar || sharedAccessCount > 0) && nonAdminCalendarItems.some((item) => item.active),
        hr: isAdminRole && !showOnlyKpiMenus && hr.some((item) => item.active),
        library: isAdminRole && !showOnlyKpiMenus && library.some((item) => item.active),
        calendarAdmin: isAdminRole && !showOnlyKpiMenus && adminCalendarItems.some((item) => item.active),
        templates: canAccessTemplatesSection && !showOnlyKpiMenus && templateItems.some((item) => item.active),
        deptRequests: !showOnlyKpiMenus && deptRequestItems.some((item) => item.active),
        phonebook: !showOnlyKpiMenus && phonebookItems.some((item) => item.active),
    };

    const activeGroupKeys = SIDEBAR_GROUP_KEYS.filter((key) => groupActivity[key]);
    const activeGroupsSignature = activeGroupKeys.join('|');

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        window.localStorage.setItem(SIDEBAR_GROUPS_STORAGE_KEY, JSON.stringify(expandedGroups));
    }, [expandedGroups]);

    useEffect(() => {
        if (hasStoredExpandedGroupsRef.current) {
            return;
        }

        setExpandedGroups((prev) => {
            const next = { ...prev };
            let changed = false;

            activeGroupKeys.forEach((key) => {
                if (!next[key]) {
                    next[key] = true;
                    changed = true;
                }
            });

            return changed ? next : prev;
        });

        hasStoredExpandedGroupsRef.current = true;
    }, [activeGroupsSignature]);

    useEffect(() => {
        if (sidebarState === 'collapsed') {
            return;
        }

        const contentEl = sidebarContentRef.current;
        if (!contentEl) {
            return;
        }

        const activeKey = SIDEBAR_GROUP_KEYS.find((key) => groupActivity[key] && (expandedGroups[key] ?? true));
        if (!activeKey) {
            return;
        }

        const activeNode = groupRefs.current[activeKey];
        if (!activeNode) {
            return;
        }

        const contentRect = contentEl.getBoundingClientRect();
        const nodeRect = activeNode.getBoundingClientRect();
        const currentTopOffset = nodeRect.top - contentRect.top;
        const targetTopOffset = 12;
        const targetScrollTop = contentEl.scrollTop + currentTopOffset - targetTopOffset;
        const maxScrollTop = Math.max(0, contentEl.scrollHeight - contentEl.clientHeight);
        const clampedTop = Math.min(Math.max(0, targetScrollTop), maxScrollTop);

        contentEl.scrollTo({
            top: clampedTop,
            behavior: 'smooth',
        });
    }, [currentComponent, expandedGroups, sidebarState, activeGroupsSignature]);

    const toggleGroup = (key) => {
        setExpandedGroups((prev) => ({
            ...prev,
            [key]: !(prev[key] ?? true),
        }));
    };

    const setGroupsExpanded = (keys, expanded) => {
        setExpandedGroups((prev) => {
            const next = { ...prev };

            keys.forEach((key) => {
                next[key] = expanded;
            });

            return next;
        });
    };

    const groupVisibility = {
        main: !showOnlyCertificatesMenus && !TEMP_HIDE_MAIN_MENUS && !showOnlyKpiMenus,
        directories: !showOnlyCertificatesMenus && !TEMP_HIDE_MAIN_MENUS && isAdminRole && !showOnlyKpiMenus,
        governance: !showOnlyCertificatesMenus && isAdminRole && !showOnlyKpiMenus,
        kpi: !showOnlyCertificatesMenus && kpiMenuItems.length > 0,
        questionnaire: !showOnlyCertificatesMenus && isAdminRole && !showOnlyKpiMenus,
        calendarShared: !showOnlyCertificatesMenus && !isAdminRole && (canAccessCalendar || sharedAccessCount > 0),
        hr: !showOnlyCertificatesMenus && isAdminRole && !showOnlyKpiMenus,
        library: !showOnlyCertificatesMenus && isAdminRole && !showOnlyKpiMenus,
        calendarAdmin: !showOnlyCertificatesMenus && isAdminRole && !showOnlyKpiMenus,
        templates: canAccessTemplatesSection && !showOnlyKpiMenus,
        deptRequests: !showOnlyCertificatesMenus && !showOnlyKpiMenus,
        phonebook: !showOnlyCertificatesMenus && !showOnlyKpiMenus,
    };

    const groupItems = {
        main: navigation,
        directories: management,
        governance,
        kpi: kpiMenuItems,
        questionnaire,
        calendarShared: nonAdminCalendarItems,
        hr,
        library,
        calendarAdmin: adminCalendarItems,
        templates: templateItems,
        deptRequests: deptRequestItems,
        phonebook: phonebookItems,
    };

    const visibleGroupKeys = SIDEBAR_GROUP_KEYS.filter((key) => groupVisibility[key] && (groupItems[key]?.length ?? 0) > 0);
    const areAllVisibleGroupsExpanded = visibleGroupKeys.length > 0 && visibleGroupKeys.every((key) => expandedGroups[key] ?? true);

    const renderGroup = (key, title, items) => {
        if (!items.length) {
            return null;
        }

        const isExpanded = expandedGroups[key] ?? true;
        const showContent = isExpanded || sidebarState === 'collapsed';

        return (
            <div
                ref={(node) => {
                    if (node) {
                        groupRefs.current[key] = node;
                    }
                }}
                data-group-key={key}
                data-group-active={groupActivity[key] ? 'true' : 'false'}
                className="scroll-mt-3"
            >
                <SidebarGroup>
                    <SidebarGroupLabel asChild>
                        <button
                            type="button"
                            onClick={() => toggleGroup(key)}
                            aria-expanded={isExpanded}
                            className="flex w-full items-center justify-between rounded-lg px-2.5 py-1 text-left text-sidebar-foreground/85 transition hover:bg-sidebar-accent/55 hover:text-sidebar-accent-foreground"
                        >
                            <span>{title}</span>
                            <ChevronDown
                                className={`h-4 w-4 shrink-0 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                            />
                        </button>
                    </SidebarGroupLabel>
                    <div
                        className={`grid transition-[grid-template-rows,opacity,margin] duration-300 ease-out ${showContent ? 'mt-1 grid-rows-[1fr] opacity-100' : 'mt-0 grid-rows-[0fr] opacity-0'}`}
                    >
                        <div className="overflow-hidden">
                            <SidebarGroupContent>
                                <SidebarMenu>
                                    {items.map((item) => (
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
                        </div>
                    </div>
                </SidebarGroup>
            </div>
        );
    };

    return (
        <Sidebar collapsible="icon" variant="sidebar">
            <SidebarHeader className="border-b border-sidebar-border/80 pb-3 pt-3">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild size="lg" className="h-auto p-0">
                            <Link
                                href={route('dashboard')}
                                className="group/brand flex w-full items-center gap-3 rounded-2xl border border-sidebar-border/80 bg-[linear-gradient(165deg,rgba(21,53,88,.95),rgba(17,44,75,.9))] p-3 shadow-[0_14px_30px_rgba(6,16,30,.35)] transition hover:border-sidebar-ring/35 hover:bg-[linear-gradient(165deg,rgba(24,64,102,.96),rgba(18,48,82,.92))] group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-xl group-data-[collapsible=icon]:p-2"
                            >
                                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:w-10">
                                    <img src="/assets/images/logo.png" alt="KazUTB" className="h-full w-full object-cover" />
                                </div>
                                <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                                    <p className="text-sm font-semibold leading-snug text-white break-words">КазУТБ имени <br /> К. Кулажанова</p>
                                    <p className="mt-0.5 text-xs leading-snug text-sidebar-foreground/80">Административная панель</p>
                                </div>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>

                {sidebarState !== 'collapsed' && visibleGroupKeys.length > 0 && (
                    <div className="mt-2 px-1">
                        <button
                            type="button"
                            onClick={() => setGroupsExpanded(visibleGroupKeys, !areAllVisibleGroupsExpanded)}
                            className="w-full rounded-md border border-sidebar-border/80 px-2 py-1 text-xs font-medium text-sidebar-foreground/80 transition hover:bg-sidebar-accent/55 hover:text-sidebar-accent-foreground"
                        >
                            {areAllVisibleGroupsExpanded ? 'Свернуть все разделы' : 'Развернуть все разделы'}
                        </button>
                    </div>
                )}
            </SidebarHeader>

            <SidebarContent ref={sidebarContentRef} className="pb-2">
                {!showOnlyCertificatesMenus && !TEMP_HIDE_MAIN_MENUS && !showOnlyKpiMenus && (
                    renderGroup('main', 'Основное', navigation)
                )}

                {!showOnlyCertificatesMenus && !TEMP_HIDE_MAIN_MENUS && isAdminRole && !showOnlyKpiMenus && (
                    renderGroup('directories', 'Справочники', management)
                )}

                {!showOnlyCertificatesMenus && isAdminRole && !showOnlyKpiMenus && (
                    renderGroup('governance', 'Управление доступом', governance)
                )}

                {!showOnlyCertificatesMenus && kpiMenuItems.length > 0 && (
                    renderGroup('kpi', 'KPI Система', kpiMenuItems)
                )}

                {!showOnlyCertificatesMenus && questionnaire.length > 0 && !showOnlyKpiMenus && (
                    renderGroup('questionnaire', 'Анкетирование', questionnaire)
                )}

                {/* Календарь для пользователей без прав администратора */}
                {!showOnlyCertificatesMenus && !isAdminRole && (canAccessCalendar || sharedAccessCount > 0) && (
                    renderGroup('calendarShared', 'Календарь', nonAdminCalendarItems)
                )}

                {!showOnlyCertificatesMenus && isAdminRole && !showOnlyKpiMenus && (
                    renderGroup('hr', 'HR и учет', hr)
                )}

                {!showOnlyCertificatesMenus && isAdminRole && !showOnlyKpiMenus && (
                    renderGroup('library', 'Библиотека', library)
                )}

                {!showOnlyCertificatesMenus && isAdminRole && !showOnlyKpiMenus && (
                    renderGroup('calendarAdmin', 'Календарь', adminCalendarItems)
                )}

                {canAccessTemplatesSection && !showOnlyKpiMenus && (
                    renderGroup('templates', 'Шаблоны и сертификаты', templateItems)
                )}

                {!showOnlyCertificatesMenus && !showOnlyKpiMenus && deptRequestItems.length > 0 && (
                    renderGroup('deptRequests', 'Заявки', deptRequestItems)
                )}

                {!showOnlyCertificatesMenus && !showOnlyKpiMenus && (
                    renderGroup('phonebook', 'Справочник', phonebookItems)
                )}
            </SidebarContent>

            <SidebarFooter className="mt-auto border-t border-sidebar-border/80 pb-3 pt-3">
                <SidebarMenu className="gap-1">
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild tooltip="Главная">
                            <a href="http://10.0.1.47/">
                                <Home />
                                <span>Главная</span>
                            </a>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    {!isStudentRole && (
                        <SidebarMenuItem>
                            <SidebarMenuButton
                                className="h-auto min-h-[3.5rem] items-start bg-sidebar-accent/60 py-2 hover:bg-sidebar-accent/75 data-[active=true]:bg-sidebar-accent/70"
                                tooltip={user.email ?? user.name}
                            >
                                <ShieldCheck className="mt-0.5 shrink-0" />
                                <span className="flex min-w-0 flex-col gap-0.5 overflow-visible py-0.5 leading-[1.15]">
                                    <span className="font-medium leading-tight">{user.display_name ?? user.name}</span>
                                    <span className="text-[10px] leading-tight text-sidebar-foreground/70">Роль: {roleLabel}</span>
                                    <span className="text-[10px] leading-tight text-sidebar-foreground/70">Факультет: {facultyLabel}</span>
                                    <span className="text-[10px] leading-tight text-sidebar-foreground/70">Кафедра: {departmentLabel}</span>
                                </span>
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
