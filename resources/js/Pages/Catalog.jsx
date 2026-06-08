import { Head, Link } from '@inertiajs/react';
import {
    ArrowLeft,
    ArrowRight,
    Award,
    BarChart3,
    Bot,
    BookOpenText,
    BriefcaseBusiness,
    Building,
    Building2,
    CalendarDays,
    CalendarRange,
    CheckCircle2,
    ClipboardList,
    CircleX,
    Clock,
    ExternalLink,
    FileCheck,
    GraduationCap,
    History,
    LayoutDashboard,
    MapPinned,
    Megaphone,
    Search,
    ShieldCheck,
    SlidersHorizontal,
    Timer,
    TrendingUp,
    UserCog,
    Users,
    X,
} from 'lucide-react';
import PublicLayout from '@/Layouts/PublicLayout';
import { useMemo, useState } from 'react';

const headingFont = { fontFamily: '"Playfair Display", Georgia, "Times New Roman", serif' };

const CATEGORY_FILTERS = [
    'Все',
    'Учебный процесс',
    'Студентам',
    'Сотрудникам',
    'Документы',
    'Навигация',
    'Сервисы',
    'AI',
];

const SEARCH_EXAMPLES = ['библиотека', 'справка', 'расписание', 'общежитие', 'KPI'];

const STATE_LABELS = {
    internal: 'Внутренний сервис',
    external: 'Внешний сервис',
    new: 'Новый',
    popular: 'Популярный',
};

const STATE_STYLES = {
    internal: 'border-white/14 bg-white/8 text-white/62',
    external: 'border-[#00B0AD]/25 bg-[#00B0AD]/10 text-white/70',
    new: 'border-[#E8A020]/30 bg-[#E8A020]/12 text-[#f0ba53]',
    popular: 'border-white/18 bg-white/12 text-white/78',
};

const safeRoute = (name) => {
    try {
        return route(name);
    } catch {
        return '#';
    }
};

const getLibraryHref = () => import.meta.env?.VITE_LIBRARY_URL?.trim() || safeRoute('library.dashboard');

const normalizeText = (value) =>
    String(value ?? '')
        .toLowerCase()
        .replace(/ё/g, 'е')
        .trim();

const unique = (values) => Array.from(new Set(values.filter(Boolean)));

function serviceMatchesQuery(item, query) {
    const tokens = normalizeText(query).split(/\s+/).filter(Boolean);

    if (tokens.length === 0) {
        return true;
    }

    const searchable = normalizeText([
        item.title,
        item.desc,
        item.category,
        item.scope,
        item.kind,
        item.sectionTitle,
        ...(item.keywords ?? []),
    ].join(' '));

    return tokens.every((token) => searchable.includes(token));
}

function buildCatalogSections() {
    const libraryHref = getLibraryHref();

    const sections = [
        {
            title: 'Внешние платформы',
            subtitle: 'Подключенные сервисы и партнерские системы',
            badge: 'Платформы',
            items: [
                {
                    title: 'AI-tutor',
                    href: 'https://ai-tutor.kaztbu.edu.kz/login',
                    external: true,
                    icon: Bot,
                    scope: 'Внешний сервис',
                    kind: 'Помощник для обучения',
                    desc: 'Ассистент для консультаций, учебных задач и быстрого поиска ответов.',
                    category: 'AI',
                    facets: ['AI', 'Учебный процесс', 'Сотрудникам', 'Сервисы'],
                    keywords: ['ai', 'tutor', 'ии', 'преподаватель', 'обучение', 'помощник'],
                    states: ['popular'],
                },
                {
                    title: 'AI-Student',
                    href: 'https://ai-student.kaztbu.edu.kz/login',
                    external: true,
                    icon: Bot,
                    scope: 'Внешний сервис',
                    kind: 'Помощник студента',
                    desc: 'Цифровой ассистент студента для учебных задач, справок и навигации.',
                    category: 'AI',
                    facets: ['AI', 'Учебный процесс', 'Студентам', 'Сервисы'],
                    keywords: ['ai', 'student', 'ии', 'студент', 'справка', 'помощник'],
                    states: ['new', 'popular'],
                },
                {
                    title: 'KazUTB Library',
                    href: libraryHref,
                    external: /^https?:\/\//.test(libraryHref),
                    icon: BookOpenText,
                    scope: 'Для студентов и сотрудников',
                    kind: 'Библиотечный контур',
                    desc: 'Доступ к библиотечным ресурсам, каталогу и связанным сервисам.',
                    category: 'Библиотека',
                    facets: ['Учебный процесс', 'Студентам', 'Сотрудникам', 'Сервисы'],
                    keywords: ['library', 'библиотека', 'книга', 'каталог', 'читатель'],
                    states: ['popular'],
                },
            ],
        },
        {
            title: 'Основное',
            subtitle: 'Стартовые экраны и быстрые обращения',
            badge: 'Основное',
            items: [
                {
                    title: 'Профиль',
                    href: safeRoute('profile.edit'),
                    icon: UserCog,
                    scope: 'Личный кабинет',
                    kind: 'Персональные данные',
                    desc: 'Личные данные, роль, контакты и настройки доступа пользователя.',
                    category: 'Личный кабинет',
                    facets: ['Студентам', 'Сотрудникам', 'Сервисы'],
                    keywords: ['профиль', 'личный кабинет', 'контакты', 'роль', 'доступ'],
                    states: ['popular'],
                },
                {
                    title: 'Панель управления',
                    href: safeRoute('dashboard'),
                    icon: LayoutDashboard,
                    scope: 'Стартовый экран',
                    kind: 'Рабочая точка входа',
                    desc: 'Единая стартовая панель с рабочими модулями и быстрыми переходами.',
                    category: 'Основное',
                    facets: ['Студентам', 'Сотрудникам', 'Сервисы'],
                    keywords: ['dashboard', 'панель', 'главная', 'рабочий стол'],
                    states: ['popular'],
                },
                {
                    title: 'Заявки на должность',
                    href: safeRoute('position-requests.index'),
                    icon: BriefcaseBusiness,
                    scope: 'Для руководителей',
                    kind: 'Кадровые заявки',
                    desc: 'Согласование и статус кадровых заявок на изменение должности.',
                    category: 'HR',
                    facets: ['Сотрудникам', 'Сервисы'],
                    keywords: ['должность', 'кадры', 'заявка', 'согласование', 'hr'],
                },
                {
                    title: 'Заявки (тикеты)',
                    href: safeRoute('tickets.index'),
                    icon: ClipboardList,
                    scope: 'Service Desk',
                    kind: 'Обращения',
                    desc: 'Обращения в поддержку, хозяйственные запросы и служебные заявки.',
                    category: 'Сервис',
                    facets: ['Студентам', 'Сотрудникам', 'Сервисы'],
                    keywords: ['тикеты', 'заявки', 'обращения', 'поддержка', 'service desk', 'помощь'],
                    states: ['popular'],
                },
                {
                    title: 'Навигация',
                    href: safeRoute('nav.index'),
                    icon: MapPinned,
                    scope: 'Кампус и корпуса',
                    kind: 'Маршруты',
                    desc: 'Корпуса, аудитории и маршруты по кампусу с быстрым поиском.',
                    category: 'Навигация',
                    facets: ['Студентам', 'Сотрудникам', 'Навигация', 'Сервисы'],
                    keywords: ['навигация', 'общежитие', 'кампус', 'корпус', 'аудитория', 'маршрут'],
                    states: ['popular'],
                },
            ],
        },
        {
            title: 'Справочники',
            subtitle: 'Структура университета и управление данными',
            badge: 'Справочник',
            items: [
                {
                    title: 'Факультеты и кафедры',
                    href: safeRoute('faculties.index'),
                    icon: GraduationCap,
                    scope: 'Структура обучения',
                    kind: 'Справочник',
                    desc: 'Факультеты, кафедры и связи внутри академической структуры.',
                    category: 'Учебный процесс',
                    facets: ['Учебный процесс', 'Студентам', 'Сотрудникам'],
                    keywords: ['факультет', 'кафедра', 'структура', 'университет'],
                },
                {
                    title: 'Департаменты',
                    href: safeRoute('departments.index'),
                    icon: Building,
                    scope: 'Администрация',
                    kind: 'Справочник',
                    desc: 'Административные подразделения и их привязка к процессам.',
                    category: 'Справочник',
                    facets: ['Сотрудникам'],
                    keywords: ['департамент', 'подразделение', 'отдел', 'администрация'],
                },
                {
                    title: 'Должности',
                    href: safeRoute('positions.index'),
                    icon: BriefcaseBusiness,
                    scope: 'Кадровый контур',
                    kind: 'Справочник',
                    desc: 'Список должностей, ролей и служебных наименований.',
                    category: 'HR',
                    facets: ['Сотрудникам'],
                    keywords: ['должность', 'роль', 'кадры', 'позиция'],
                },
                {
                    title: 'Учебные годы',
                    href: safeRoute('academic-years.index'),
                    icon: CalendarRange,
                    scope: 'Учебный цикл',
                    kind: 'Справочник',
                    desc: 'Настройка учебных годов и рабочих периодов.',
                    category: 'Учебный процесс',
                    facets: ['Учебный процесс', 'Сотрудникам'],
                    keywords: ['учебный год', 'академический год', 'период'],
                },
                {
                    title: 'Образовательные программы',
                    href: safeRoute('educational-programs.index'),
                    icon: BookOpenText,
                    scope: 'Учебные планы',
                    kind: 'Справочник',
                    desc: 'Образовательные программы, направления и учебные траектории.',
                    category: 'Учебный процесс',
                    facets: ['Учебный процесс', 'Студентам', 'Сотрудникам'],
                    keywords: ['образовательная программа', 'специальность', 'учебный план'],
                },
                {
                    title: 'Права администратора',
                    href: safeRoute('users.admin-access'),
                    icon: ShieldCheck,
                    scope: 'Администрирование',
                    kind: 'Доступы',
                    desc: 'Права доступа, административные роли и контроль полномочий.',
                    category: 'Админ',
                    facets: ['Сотрудникам'],
                    keywords: ['админ', 'права', 'доступ', 'роль', 'безопасность'],
                },
            ],
        },
        {
            title: 'KPI Система',
            subtitle: 'Показатели, проверки и сводка',
            badge: 'KPI',
            items: [
                {
                    title: 'KPI — Мои показатели',
                    href: safeRoute('kpi.my-form'),
                    icon: ClipboardList,
                    scope: 'Личный KPI',
                    kind: 'Заполнение данных',
                    desc: 'Ввод показателей, фактических значений и подтверждающих материалов.',
                    category: 'KPI',
                    facets: ['Сотрудникам', 'Сервисы'],
                    keywords: ['kpi', 'показатели', 'мои показатели', 'форма', 'отчет'],
                    states: ['popular'],
                },
                {
                    title: 'KPI — Настройки',
                    href: safeRoute('kpi.settings'),
                    icon: SlidersHorizontal,
                    scope: 'Администрирование',
                    kind: 'Параметры системы',
                    desc: 'Периоды, правила, доступы и конфигурация KPI-сценариев.',
                    category: 'KPI',
                    facets: ['Сотрудникам'],
                    keywords: ['kpi', 'настройки', 'период', 'правила', 'доступ'],
                },
                {
                    title: 'KPI — Проверка Завкафедрой',
                    href: safeRoute('kpi.review-queue'),
                    icon: CheckCircle2,
                    scope: 'Проверка',
                    kind: 'Очередь согласования',
                    desc: 'Очередь проверки показателей на уровне заведующего кафедрой.',
                    category: 'KPI',
                    facets: ['Сотрудникам', 'Сервисы'],
                    keywords: ['kpi', 'проверка', 'завкафедрой', 'очередь', 'согласование'],
                },
                {
                    title: 'KPI — Проверка Деканом',
                    href: safeRoute('kpi.approval-queue'),
                    icon: ShieldCheck,
                    scope: 'Проверка',
                    kind: 'Окончательное согласование',
                    desc: 'Финальное согласование KPI на уровне деканата.',
                    category: 'KPI',
                    facets: ['Сотрудникам', 'Сервисы'],
                    keywords: ['kpi', 'декан', 'утверждение', 'проверка'],
                },
                {
                    title: 'KPI — Проверка Структурным подразделением',
                    href: safeRoute('kpi.structural-queue'),
                    icon: Building2,
                    scope: 'Проверка',
                    kind: 'Контроль данных',
                    desc: 'Контроль и подтверждение данных по структурным подразделениям.',
                    category: 'KPI',
                    facets: ['Сотрудникам', 'Сервисы'],
                    keywords: ['kpi', 'структурное подразделение', 'контроль', 'проверка'],
                },
                {
                    title: 'KPI — Сводка',
                    href: safeRoute('kpi.summary'),
                    icon: BarChart3,
                    scope: 'Аналитика',
                    kind: 'Сводные отчеты',
                    desc: 'Сводные отчеты, агрегированные данные и аналитика по показателям.',
                    category: 'KPI',
                    facets: ['Сотрудникам', 'Сервисы'],
                    keywords: ['kpi', 'сводка', 'аналитика', 'отчет', 'рейтинг'],
                    states: ['popular'],
                },
                {
                    title: 'KPI — Структурные подразделения',
                    href: safeRoute('kpi.structural-units.index'),
                    icon: Building2,
                    scope: 'Справочник',
                    kind: 'Структура KPI',
                    desc: 'Управление структурными единицами и привязками в KPI-системе.',
                    category: 'KPI',
                    facets: ['Сотрудникам'],
                    keywords: ['kpi', 'структура', 'подразделение', 'справочник'],
                },
            ],
        },
        {
            title: 'Анкетирование',
            subtitle: 'Опросы, группы и отчеты',
            badge: 'Опросы',
            items: [
                {
                    title: 'Группы',
                    href: safeRoute('questionnaire.admin.groups'),
                    icon: Users,
                    scope: 'Администрирование',
                    kind: 'Групповые настройки',
                    desc: 'Список групп и привязка групп к доступным анкетам.',
                    category: 'Учебный процесс',
                    facets: ['Учебный процесс', 'Сотрудникам'],
                    keywords: ['анкета', 'опрос', 'группа', 'студенты'],
                },
                {
                    title: 'Специальности',
                    href: safeRoute('questionnaire.admin.specialities'),
                    icon: GraduationCap,
                    scope: 'Справочник',
                    kind: 'Учебные направления',
                    desc: 'Каталог специальностей для настройки анкетирования.',
                    category: 'Учебный процесс',
                    facets: ['Учебный процесс', 'Сотрудникам'],
                    keywords: ['анкета', 'специальность', 'направление'],
                },
                {
                    title: 'Преподаватели',
                    href: safeRoute('questionnaire.admin.teacher-disciplines'),
                    icon: UserCog,
                    scope: 'Справочник',
                    kind: 'Преподавательский блок',
                    desc: 'Связка преподавателей с дисциплинами и сценариями опросов.',
                    category: 'Учебный процесс',
                    facets: ['Учебный процесс', 'Сотрудникам'],
                    keywords: ['анкета', 'преподаватель', 'дисциплина', 'опрос'],
                },
                {
                    title: 'Опросы',
                    href: safeRoute('questionnaire.admin.surveys'),
                    icon: CheckCircle2,
                    scope: 'Рабочий процесс',
                    kind: 'Создание и запуск',
                    desc: 'Создание, запуск и управление внутренними опросами.',
                    category: 'Учебный процесс',
                    facets: ['Учебный процесс', 'Студентам', 'Сотрудникам', 'Сервисы'],
                    keywords: ['опрос', 'анкета', 'анкетирование', 'форма'],
                    states: ['new'],
                },
                {
                    title: 'Отчеты',
                    href: safeRoute('questionnaire.admin.reports'),
                    icon: BarChart3,
                    scope: 'Аналитика',
                    kind: 'Сводные данные',
                    desc: 'Аналитические отчеты и результаты по ответам и активностям.',
                    category: 'Учебный процесс',
                    facets: ['Учебный процесс', 'Сотрудникам'],
                    keywords: ['анкета', 'опрос', 'отчет', 'аналитика'],
                },
                {
                    title: 'Анкетирование студентов',
                    href: safeRoute('questionnaire.student.index'),
                    icon: FileCheck,
                    scope: 'Студентам',
                    kind: 'Пользовательский вход',
                    desc: 'Личный вход студента в доступные анкеты, опросы и формы.',
                    category: 'Учебный процесс',
                    facets: ['Учебный процесс', 'Студентам', 'Сервисы'],
                    keywords: ['студент', 'опрос', 'анкета', 'анкетирование'],
                    states: ['popular'],
                },
            ],
        },
        {
            title: 'Smart Calendar',
            subtitle: 'Личный и командный календарь университета',
            badge: 'Календарь',
            items: [
                {
                    title: 'Мой календарь',
                    href: safeRoute('calendar.index'),
                    icon: CalendarRange,
                    scope: 'Личный календарь',
                    kind: 'События и слоты',
                    desc: 'Личные события, встречи, доступные слоты и рабочие планы.',
                    category: 'Календарь',
                    facets: ['Студентам', 'Сотрудникам', 'Сервисы'],
                    keywords: ['расписание', 'календарь', 'встреча', 'слот', 'занятость'],
                    states: ['popular'],
                },
                {
                    title: 'Совместные',
                    href: safeRoute('calendar.shared'),
                    icon: Users,
                    scope: 'Совместный доступ',
                    kind: 'Календари руководителей',
                    desc: 'Календари руководителей и сотрудников с открытым доступом.',
                    category: 'Календарь',
                    facets: ['Сотрудникам', 'Сервисы'],
                    keywords: ['календарь', 'совместный', 'руководитель', 'расписание'],
                },
                {
                    title: 'Сотрудники',
                    href: safeRoute('calendar.employees'),
                    icon: Building2,
                    scope: 'Поиск сотрудников',
                    kind: 'Командный просмотр',
                    desc: 'Просмотр занятости сотрудников и профилей с доступными слотами.',
                    category: 'Календарь',
                    facets: ['Сотрудникам', 'Сервисы'],
                    keywords: ['сотрудник', 'календарь', 'занятость', 'расписание'],
                },
                {
                    title: 'Конференции',
                    href: safeRoute('calendar.conferences'),
                    icon: CalendarDays,
                    scope: 'События',
                    kind: 'Планирование встреч',
                    desc: 'Конференции, мероприятия и событийное планирование.',
                    category: 'Календарь',
                    facets: ['Студентам', 'Сотрудникам', 'Сервисы'],
                    keywords: ['конференция', 'мероприятие', 'встреча', 'расписание'],
                },
                {
                    title: 'Аналитика',
                    href: safeRoute('calendar.analytics'),
                    icon: TrendingUp,
                    scope: 'Аналитика',
                    kind: 'Загрузка и активность',
                    desc: 'Статистика загрузки календаря и сводная аналитика.',
                    category: 'Календарь',
                    facets: ['Сотрудникам'],
                    keywords: ['календарь', 'аналитика', 'статистика'],
                },
                {
                    title: 'Настройки',
                    href: safeRoute('calendar.settings'),
                    icon: SlidersHorizontal,
                    scope: 'Администрирование',
                    kind: 'Доступы и правила',
                    desc: 'Доступы, исключения и параметры календарного контура.',
                    category: 'Календарь',
                    facets: ['Сотрудникам'],
                    keywords: ['календарь', 'настройки', 'доступ', 'правила'],
                },
            ],
        },
        {
            title: 'HR и учет',
            subtitle: 'Посещаемость, учет времени и отчеты',
            badge: 'HR',
            items: [
                {
                    title: 'HR Dashboard',
                    href: safeRoute('hr.dashboard'),
                    icon: BarChart3,
                    scope: 'Обзор',
                    kind: 'Сводная панель',
                    desc: 'HR-панель по посещаемости, статусам и оперативным показателям.',
                    category: 'HR',
                    facets: ['Сотрудникам', 'Сервисы'],
                    keywords: ['hr', 'dashboard', 'посещаемость', 'персонал'],
                },
                {
                    title: 'Все сотрудники',
                    href: safeRoute('hr.perco.index'),
                    icon: Users,
                    scope: 'Персонал',
                    kind: 'Каталог сотрудников',
                    desc: 'Список сотрудников и данные по учету рабочего времени.',
                    category: 'HR',
                    facets: ['Сотрудникам', 'Сервисы'],
                    keywords: ['сотрудники', 'персонал', 'perco', 'учет времени'],
                    states: ['popular'],
                },
                {
                    title: 'Опоздавшие',
                    href: safeRoute('hr.perco.late'),
                    icon: Clock,
                    scope: 'Контроль',
                    kind: 'Нарушения режима',
                    desc: 'Список сотрудников с опозданиями за выбранный период.',
                    category: 'HR',
                    facets: ['Сотрудникам'],
                    keywords: ['опоздание', 'perco', 'посещаемость', 'учет времени'],
                },
                {
                    title: 'Отсутствующие',
                    href: safeRoute('hr.perco.absence'),
                    icon: CircleX,
                    scope: 'Контроль',
                    kind: 'Нарушения режима',
                    desc: 'Отсутствия и пропуски по данным учета рабочего времени.',
                    category: 'HR',
                    facets: ['Сотрудникам'],
                    keywords: ['отсутствие', 'пропуск', 'perco', 'учет времени'],
                },
                {
                    title: 'Ранний выход',
                    href: safeRoute('hr.perco.early'),
                    icon: History,
                    scope: 'Контроль',
                    kind: 'Нарушения режима',
                    desc: 'Фиксация ранних уходов и спорных отметок по времени.',
                    category: 'HR',
                    facets: ['Сотрудникам'],
                    keywords: ['ранний выход', 'уход', 'perco', 'учет времени'],
                },
                {
                    title: 'Отчет',
                    href: safeRoute('hr.perco.timetracking'),
                    icon: TrendingUp,
                    scope: 'Отчетность',
                    kind: 'Табель и аналитика',
                    desc: 'Табель учета времени и динамика посещаемости.',
                    category: 'HR',
                    facets: ['Сотрудникам'],
                    keywords: ['отчет', 'табель', 'perco', 'учет времени'],
                },
                {
                    title: 'Настройки Perco',
                    href: safeRoute('hr.perco.settings'),
                    icon: SlidersHorizontal,
                    scope: 'Настройки',
                    kind: 'Синхронизация',
                    desc: 'Параметры интеграции, синхронизации и правил учета.',
                    category: 'HR',
                    facets: ['Сотрудникам'],
                    keywords: ['perco', 'настройки', 'интеграция', 'синхронизация'],
                },
            ],
        },
        {
            title: 'Библиотека',
            subtitle: 'Выдача, бронирования и доступ к фондам',
            badge: 'Библиотека',
            items: [
                {
                    title: 'Library Dashboard',
                    href: safeRoute('library.dashboard'),
                    icon: BookOpenText,
                    scope: 'Обзор',
                    kind: 'Библиотечный контур',
                    desc: 'Панель библиотечных операций, учета и текущего состояния.',
                    category: 'Библиотека',
                    facets: ['Учебный процесс', 'Студентам', 'Сотрудникам', 'Сервисы'],
                    keywords: ['library', 'библиотека', 'книги', 'читатель', 'фонд'],
                    states: ['popular'],
                },
                {
                    title: 'Выдать книгу',
                    href: safeRoute('library.issue-book'),
                    icon: ClipboardList,
                    scope: 'Операции',
                    kind: 'Выдача из фонда',
                    desc: 'Оформление выдачи книг, проверка читателя и контроль сроков.',
                    category: 'Библиотека',
                    facets: ['Учебный процесс', 'Сотрудникам', 'Сервисы'],
                    keywords: ['библиотека', 'выдать книгу', 'книга', 'читатель'],
                },
                {
                    title: 'Брони книг',
                    href: safeRoute('library.reservations.admin'),
                    icon: Timer,
                    scope: 'Резервы',
                    kind: 'Очередь бронирований',
                    desc: 'Подтверждение, обработка и управление бронированиями книг.',
                    category: 'Библиотека',
                    facets: ['Учебный процесс', 'Студентам', 'Сотрудникам', 'Сервисы'],
                    keywords: ['библиотека', 'бронь', 'резерв', 'книга'],
                },
            ],
        },
        {
            title: 'Шаблоны и сертификаты',
            subtitle: 'Документы, формы и реестры',
            badge: 'Документы',
            items: [
                {
                    title: 'Шаблоны',
                    href: safeRoute('templates.index'),
                    icon: FileCheck,
                    scope: 'Документы',
                    kind: 'Готовые формы',
                    desc: 'Готовые шаблоны справок, писем и внутренних документов.',
                    category: 'Документы',
                    facets: ['Документы', 'Студентам', 'Сотрудникам', 'Сервисы'],
                    keywords: ['шаблон', 'справка', 'справки', 'документ', 'форма', 'письмо'],
                    states: ['popular'],
                },
                {
                    title: 'Сертификаты',
                    href: safeRoute('certificates.index'),
                    icon: Award,
                    scope: 'Документы',
                    kind: 'Создание и выпуск',
                    desc: 'Создание, выпуск и управление сертификатами университета.',
                    category: 'Документы',
                    facets: ['Документы', 'Студентам', 'Сотрудникам', 'Сервисы'],
                    keywords: ['сертификат', 'справка', 'документ', 'выдача'],
                    states: ['popular'],
                },
                {
                    title: 'Реестр сертификатов',
                    href: safeRoute('certificates.registry.index'),
                    icon: BookOpenText,
                    scope: 'Реестр',
                    kind: 'Учет выданных документов',
                    desc: 'Просмотр, поиск и экспорт реестра выданных сертификатов.',
                    category: 'Документы',
                    facets: ['Документы', 'Сотрудникам'],
                    keywords: ['реестр', 'сертификат', 'документ', 'экспорт'],
                },
                {
                    title: 'Проверка сертификата',
                    href: safeRoute('certificates.verify'),
                    icon: ShieldCheck,
                    scope: 'Проверка',
                    kind: 'Публичная верификация',
                    desc: 'Проверка подлинности сертификата по номеру или коду.',
                    category: 'Документы',
                    facets: ['Документы', 'Студентам', 'Сотрудникам', 'Сервисы'],
                    keywords: ['проверка', 'сертификат', 'верификация', 'код', 'справка'],
                },
            ],
        },
        {
            title: 'Администрирование',
            subtitle: 'Пользователи, объявления и контроль',
            badge: 'Админ',
            items: [
                {
                    title: 'Сотрудники',
                    href: safeRoute('users.index'),
                    icon: Users,
                    scope: 'Доступ по роли',
                    kind: 'Справочник',
                    desc: 'Каталог сотрудников, связи с ролями и административные операции.',
                    category: 'Админ',
                    facets: ['Сотрудникам'],
                    keywords: ['сотрудники', 'пользователи', 'администрирование', 'роль'],
                },
                {
                    title: 'Студенты',
                    href: safeRoute('users.students'),
                    icon: GraduationCap,
                    scope: 'Доступ по роли',
                    kind: 'Справочник',
                    desc: 'Студенческий каталог и связанные учебные данные.',
                    category: 'Админ',
                    facets: ['Учебный процесс', 'Студентам', 'Сотрудникам'],
                    keywords: ['студенты', 'пользователи', 'каталог', 'группа'],
                },
                {
                    title: 'Объявления',
                    href: safeRoute('announcements.index'),
                    icon: Megaphone,
                    scope: 'Коммуникации',
                    kind: 'Внутренние сообщения',
                    desc: 'Публикация и управление внутренними объявлениями.',
                    category: 'Сервис',
                    facets: ['Студентам', 'Сотрудникам', 'Сервисы'],
                    keywords: ['объявление', 'новость', 'коммуникация', 'сообщение'],
                },
                {
                    title: 'Журнал действий',
                    href: safeRoute('admin.audit-logs.index'),
                    icon: History,
                    scope: 'Безопасность',
                    kind: 'Аудит',
                    desc: 'История административных действий и журнал изменений.',
                    category: 'Админ',
                    facets: ['Сотрудникам'],
                    keywords: ['аудит', 'журнал', 'безопасность', 'действия'],
                },
                {
                    title: 'Мониторинг системы',
                    href: safeRoute('admin.monitoring.index'),
                    icon: TrendingUp,
                    scope: 'Техконтроль',
                    kind: 'Состояние платформы',
                    desc: 'Технические метрики, статус компонентов и мониторинг.',
                    category: 'Админ',
                    facets: ['Сотрудникам'],
                    keywords: ['мониторинг', 'система', 'статус', 'метрики'],
                    states: ['new'],
                },
                {
                    title: 'Маршруты навигации',
                    href: safeRoute('nav.routes.admin'),
                    icon: MapPinned,
                    scope: 'Администрирование',
                    kind: 'Редактирование точек',
                    desc: 'Редактирование маршрутов, точек и связей навигации.',
                    category: 'Навигация',
                    facets: ['Сотрудникам', 'Навигация'],
                    keywords: ['навигация', 'маршрут', 'точка', 'кампус', 'корпус'],
                },
            ],
        },
    ];

    return sections.map((section) => ({
        ...section,
        items: section.items.map((item) => {
            const externalState = item.external ? 'external' : 'internal';

            return {
                ...item,
                sectionTitle: section.title,
                sectionSubtitle: section.subtitle,
                category: item.category ?? section.badge,
                facets: unique(item.facets ?? ['Сервисы']),
                states: unique([externalState, ...(item.states ?? [])]),
                keywords: unique([
                    section.title,
                    section.subtitle,
                    section.badge,
                    item.category,
                    item.scope,
                    item.kind,
                    ...(item.keywords ?? []),
                ]),
            };
        }),
    }));
}

function buildQuickAccess() {
    const libraryHref = getLibraryHref();

    return [
        {
            title: 'Профиль',
            desc: 'Личные данные',
            href: safeRoute('profile.edit'),
            icon: UserCog,
        },
        {
            title: 'Расписание',
            desc: 'Мой календарь',
            href: safeRoute('calendar.index'),
            icon: CalendarRange,
        },
        {
            title: 'Справки',
            desc: 'Шаблоны и сертификаты',
            href: safeRoute('templates.index'),
            icon: FileCheck,
        },
        {
            title: 'Навигация',
            desc: 'Кампус и маршруты',
            href: safeRoute('nav.index'),
            icon: MapPinned,
        },
        {
            title: 'Библиотека',
            desc: 'Фонд и брони',
            href: libraryHref,
            external: /^https?:\/\//.test(libraryHref),
            icon: BookOpenText,
        },
        {
            title: 'AI Ассистент',
            desc: 'Учебная помощь',
            href: 'https://ai-student.kaztbu.edu.kz/login',
            external: true,
            icon: Bot,
        },
    ];
}

function ServiceLink({ href, external, className, children, ariaLabel }) {
    if (external) {
        return (
            <a href={href} target="_blank" rel="noopener noreferrer" className={className} aria-label={ariaLabel}>
                {children}
            </a>
        );
    }

    return (
        <Link href={href} className={className} aria-label={ariaLabel}>
            {children}
        </Link>
    );
}

function ServiceSearch({ query, onQueryChange, onExampleSelect, totalServices, resultCount }) {
    return (
        <section>
            <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#0f243f]/45" />
                <input
                    id="service-search"
                    type="search"
                    value={query}
                    onChange={(event) => onQueryChange(event.target.value)}
                    placeholder="Поиск сервиса..."
                    className="h-13 h-[52px] w-full rounded-2xl bg-white/95 py-3 pl-12 pr-11 text-[15px] font-medium text-[#0f243f] shadow-none outline-none transition placeholder:text-[#0f243f]/55 focus:bg-white"
                    autoComplete="off"
                />
                {query && (
                    <button
                        type="button"
                        onClick={() => onQueryChange('')}
                        className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[#0f243f]/45 transition hover:bg-black/5 hover:text-[#0f243f]"
                        aria-label="Очистить поиск"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1 text-[12px] text-white/45">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-white/38">Примеры:</span>
                    {SEARCH_EXAMPLES.map((example) => (
                        <button
                            key={example}
                            type="button"
                            onClick={() => onExampleSelect(example)}
                            className="rounded-full bg-white/[0.07] px-3 py-1 text-white/55 transition hover:bg-white/[0.12] hover:text-white/85"
                        >
                            {example}
                        </button>
                    ))}
                </div>
                <span className="text-white/38">Найдено: {resultCount} из {totalServices}</span>
            </div>
        </section>
    );
}

function ServiceQuickAccess({ shortcuts }) {
    return (
        <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {shortcuts.map((shortcut) => {
                const Icon = shortcut.icon ?? BookOpenText;

                return (
                    <ServiceLink
                        key={shortcut.title}
                        href={shortcut.href}
                        external={shortcut.external}
                        className="group flex min-h-[64px] items-center gap-2.5 rounded-xl bg-white/[0.07] p-3 text-left transition hover:bg-white/[0.11]"
                    >
                        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#E8A020]/12 text-[#E8A020]">
                            <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                            <span className="block truncate text-xs font-bold text-white/88">{shortcut.title}</span>
                            <span className="mt-0.5 block truncate text-[11px] text-white/42">{shortcut.desc}</span>
                        </span>
                    </ServiceLink>
                );
            })}
        </section>
    );
}

function ServiceSectionHeading({ title, subtitle, count }) {
    return (
        <div className="space-y-1.5">
            <div className="flex items-baseline gap-3">
                <h2 style={headingFont} className="text-xl font-bold tracking-[-0.02em] text-white sm:text-[1.7rem]">
                    {title}
                </h2>
                {typeof count === 'number' && (
                    <span className="text-[13px] text-white/35">{count}</span>
                )}
                <div className="h-px flex-1 bg-gradient-to-r from-white/15 to-white/0" />
            </div>
            {subtitle && (
                <p className="max-w-3xl text-[13px] leading-6 text-white/50 sm:text-sm">
                    {subtitle}
                </p>
            )}
        </div>
    );
}

function ServiceCategoryTabs({ categories, activeCategory, onCategoryChange }) {
    return (
        <nav aria-label="Категории сервисов" className="flex flex-wrap items-center gap-x-1 gap-y-1">
            {categories.map((category) => {
                const isActive = activeCategory === category.label;

                return (
                    <button
                        key={category.label}
                        type="button"
                        onClick={() => onCategoryChange(category.label)}
                        aria-pressed={isActive}
                        className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition ${
                            isActive
                                ? 'bg-[#E8A020]/14 text-[#f0ba53]'
                                : 'text-white/48 hover:bg-white/[0.06] hover:text-white/78'
                        }`}
                    >
                        <span>{category.label}</span>
                        <span className={`text-[11px] tabular-nums ${
                            isActive ? 'text-[#f0ba53]/60' : 'text-white/28'
                        }`}>{category.count}</span>
                    </button>
                );
            })}
        </nav>
    );
}

function ServiceCard({ item }) {
    const Icon = item.icon ?? BookOpenText;

    return (
        <ServiceLink
            href={item.href}
            external={item.external}
            ariaLabel={`Открыть сервис ${item.title}`}
            className="group flex h-full flex-col rounded-xl bg-white/[0.07] p-4 transition hover:bg-white/[0.11]"
        >
            <div className="flex items-start gap-3.5">
                <span className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#E8A020]/12 text-[#E8A020] transition group-hover:bg-[#E8A020]/18">
                    <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                    <h3 style={headingFont} className="text-[15px] font-bold leading-snug text-white/92">
                        {item.title}
                    </h3>
                    <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-white/55">{item.desc}</p>
                </div>
            </div>

            <div className="mt-auto pt-4">
                <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#E8A020]/75 transition group-hover:text-[#E8A020]">
                    {item.external ? 'Открыть' : 'Перейти'}
                    {item.external ? <ExternalLink className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}
                </span>
            </div>
        </ServiceLink>
    );
}

function ServiceCategory({ section }) {
    return (
        <section className="space-y-4">
            <header className="flex items-baseline gap-3">
                <h2 style={headingFont} className="text-xl font-bold tracking-[-0.02em] text-white sm:text-2xl">
                    {section.title}
                </h2>
                <span className="text-[13px] text-white/35">{section.items.length}</span>
                <div className="h-px flex-1 bg-gradient-to-r from-white/15 to-white/0" />
            </header>

            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-4">
                {section.items.map((item) => (
                    <ServiceCard key={`${section.title}-${item.title}`} item={item} />
                ))}
            </div>
        </section>
    );
}

function Catalog() {
    const sections = useMemo(() => buildCatalogSections(), []);
    const quickAccess = useMemo(() => buildQuickAccess(), []);
    const allServices = useMemo(() => sections.flatMap((section) => section.items), [sections]);
    const totalServices = allServices.length;
    const [query, setQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('Все');

    const categoryCounts = useMemo(() => (
        CATEGORY_FILTERS.map((label) => ({
            label,
            count: label === 'Все'
                ? totalServices
                : allServices.filter((item) => item.facets.includes(label)).length,
        }))
    ), [allServices, totalServices]);

    const matchesActiveFilters = (item) => {
        const matchesCategory = activeCategory === 'Все' || item.facets.includes(activeCategory);
        return matchesCategory && serviceMatchesQuery(item, query);
    };

    const popularServices = useMemo(() => (
        allServices
            .filter((item) => item.states.includes('popular'))
            .filter(matchesActiveFilters)
            .slice(0, 8)
    ), [activeCategory, allServices, query]);

    const visibleSections = useMemo(() => (
        sections
            .map((section) => ({
                ...section,
                items: section.items.filter(matchesActiveFilters),
            }))
            .filter((section) => section.items.length > 0)
    ), [sections, activeCategory, query]);

    const visibleTotal = visibleSections.reduce((sum, section) => sum + section.items.length, 0);

    return (
        <>
            <Head title="Каталог сервисов · КазУТБ">
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
                <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Manrope:wght@400..800&display=swap" rel="stylesheet" />
            </Head>

            <main
                className="relative flex min-h-screen flex-col items-center justify-start overflow-x-hidden p-3 font-['Manrope'] sm:p-4 lg:p-6"
                style={{ fontFamily: '"Manrope", ui-sans-serif, system-ui, sans-serif' }}
            >
                <section className="animate-fade-slide-up relative z-10 w-full max-w-[1380px] rounded-2xl bg-[#0f243f]/55 px-5 py-6 text-white sm:px-6 lg:px-8 lg:py-8">
                    <div className="flex items-start justify-between gap-4">
                        <div className="max-w-3xl">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#E8A020]/60">
                                Единый цифровой портал · КазУТБ
                            </p>
                            <h1 style={headingFont} className="mt-2 text-3xl font-extrabold leading-tight tracking-[-0.03em] text-white sm:text-4xl lg:text-[2.8rem]">
                                Каталог сервисов
                            </h1>
                            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/76 sm:text-base">
                                Все сервисы собраны в единой цифровой витрине университета: та же визуальная среда, что на главной странице, логине и навигации.
                            </p>
                        </div>
                    </div>

                    <div className="mt-4 space-y-6">
                            <ServiceSearch
                                query={query}
                                onQueryChange={setQuery}
                                onExampleSelect={setQuery}
                                totalServices={totalServices}
                                resultCount={visibleTotal}
                            />

                        {popularServices.length > 0 && (
                            <section className="space-y-4">
                                <ServiceSectionHeading
                                    title="Популярные сервисы"
                                    subtitle="Ключевые цифровые сервисы университета для быстрого старта."
                                    count={popularServices.length}
                                />
                                <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-4">
                                    {popularServices.map((item) => (
                                        <ServiceCard key={`popular-${item.sectionTitle}-${item.title}`} item={item} />
                                    ))}
                                </div>
                            </section>
                        )}

                        <section className="space-y-4">
                            <ServiceSectionHeading
                                title="Быстрый доступ"
                                subtitle="Самые частые точки входа для студентов, сотрудников и повседневных задач."
                            />
                            <ServiceQuickAccess shortcuts={quickAccess} />
                        </section>

                        <section className="space-y-4 pt-1">
                            <ServiceSectionHeading
                                title="Все сервисы"
                                subtitle="Полный каталог сервисов с фильтрацией по направлениям и поиском по названию, описанию и ключевым словам."
                                count={visibleTotal}
                            />
                            <div>
                                <ServiceCategoryTabs
                                    categories={categoryCounts}
                                    activeCategory={activeCategory}
                                    onCategoryChange={setActiveCategory}
                                />
                            </div>

                            {visibleSections.length > 0 ? (
                                <div className="space-y-6 pt-1">
                                    {visibleSections.map((section) => (
                                        <ServiceCategory key={section.title} section={section} />
                                    ))}
                                </div>
                            ) : (
                                <div className="py-10 text-center text-[15px] text-white/40">
                                    Сервисы не найдены. Измените запрос или категорию.
                                </div>
                            )}
                        </section>
                    </div>

                    <div className="mt-8 flex items-center justify-between border-t border-white/[0.07] pt-5 text-[12px] text-white/38">
                        <span>Сервисов: {totalServices}</span>
                        <Link href="/" className="inline-flex items-center gap-1.5 text-white/45 transition hover:text-white/75">
                            <ArrowLeft className="h-3.5 w-3.5" />
                            На главную
                        </Link>
                    </div>
                </section>
            </main>
        </>
    );
}

Catalog.layout = page => <PublicLayout>{page}</PublicLayout>;
export default Catalog;
