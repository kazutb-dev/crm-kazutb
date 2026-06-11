import { Head, Link } from '@inertiajs/react';
import {
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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Star } from 'lucide-react';
import useReveal from '@/hooks/useReveal';

const FAVORITES_KEY = 'kazutb.catalog.favorites';
const RECENT_KEY = 'kazutb.catalog.recent';

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
            title: 'Внутренние платформы',
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

/* ============================================================
   Presentation layer — progressive-disclosure catalog:
   search-first, favorites, recently used, accordion sections.
   ============================================================ */

const serviceId = (item) => `${item.sectionTitle}::${item.title}`;

function readStoredList(key, limit) {
    if (typeof window === 'undefined') {
        return [];
    }

    try {
        const parsed = JSON.parse(window.localStorage.getItem(key) ?? '[]');
        return Array.isArray(parsed)
            ? parsed.filter((value) => typeof value === 'string').slice(0, limit)
            : [];
    } catch {
        return [];
    }
}

function useStoredList(key, limit) {
    const [list, setList] = useState(() => readStoredList(key, limit));

    const update = useCallback((next) => {
        const trimmed = next.slice(0, limit);
        setList(trimmed);
        try {
            window.localStorage.setItem(key, JSON.stringify(trimmed));
        } catch {
            // Storage unavailable (private mode) — favorites stay in-memory.
        }
    }, [key, limit]);

    return [list, update];
}

function CatalogSearch({ query, onQueryChange, resultCount, totalServices, isFiltering, inputRef }) {
    return (
        <section>
            <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40" />
                <input
                    ref={inputRef}
                    id="service-search"
                    type="search"
                    value={query}
                    onChange={(event) => onQueryChange(event.target.value)}
                    placeholder="Найти сервис: справка, KPI, библиотека…"
                    className="kz-field h-[54px] !pl-12 !pr-20 text-[15px]"
                    autoComplete="off"
                />
                <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
                    {query ? (
                        <button
                            type="button"
                            onClick={() => onQueryChange('')}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-white/45 transition hover:bg-white/10 hover:text-white"
                            aria-label="Очистить поиск"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    ) : (
                        <kbd className="hidden rounded-md border border-white/15 bg-white/5 px-2 py-1 font-[var(--font-mono)] text-[11px] text-white/40 sm:block">
                            /
                        </kbd>
                    )}
                </div>
            </div>

            {isFiltering && (
                <div className="mt-3 px-1 text-[12px]" role="status">
                    <span className="text-white/45">Найдено: {resultCount} из {totalServices}</span>
                </div>
            )}
        </section>
    );
}

function ServiceRow({ item, isFavorite, onToggleFavorite, onOpen }) {
    const Icon = item.icon ?? BookOpenText;
    const id = serviceId(item);

    return (
        <div className="kz-tile relative">
            <div className="min-w-0 flex-1" onClickCapture={() => onOpen(item)}>
                <ServiceLink
                    href={item.href}
                    external={item.external}
                    ariaLabel={`Открыть сервис ${item.title}`}
                    className="flex min-h-[64px] items-center gap-3 p-3.5 pr-11"
                >
                    <span className="kz-icon-badge h-10 w-10">
                        <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <span className="min-w-0">
                        <span className="flex items-center gap-1.5 text-[14px] font-bold leading-snug text-white/92">
                            <span className="truncate">{item.title}</span>
                            {item.external && <ExternalLink className="h-3 w-3 flex-shrink-0 text-white/35" aria-label="Внешний сервис" />}
                        </span>
                        <span className="mt-0.5 block truncate text-[12.5px] text-white/50">{item.desc}</span>
                    </span>
                </ServiceLink>
            </div>
            <button
                type="button"
                onClick={() => onToggleFavorite(id)}
                aria-pressed={isFavorite}
                aria-label={isFavorite ? `Убрать «${item.title}» из избранного` : `Добавить «${item.title}» в избранное`}
                className={`absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full transition ${
                    isFavorite
                        ? 'text-[var(--gold-400)] hover:bg-white/10'
                        : 'text-white/25 hover:bg-white/10 hover:text-white/70'
                }`}
            >
                <Star className="h-4 w-4" fill={isFavorite ? 'currentColor' : 'none'} />
            </button>
        </div>
    );
}

function ServiceGrid({ items, favorites, onToggleFavorite, onOpen }) {
    return (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
                <ServiceRow
                    key={serviceId(item)}
                    item={item}
                    isFavorite={favorites.includes(serviceId(item))}
                    onToggleFavorite={onToggleFavorite}
                    onOpen={onOpen}
                />
            ))}
        </div>
    );
}

function CatalogSection({ section, isOpen, onToggle, favorites, onToggleFavorite, onOpen }) {
    return (
        <section className="kz-panel overflow-hidden">
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-white/[0.04]"
            >
                <div className="min-w-0 flex-1">
                    <h2 className="kz-display text-[16px] font-semibold">{section.title}</h2>
                    <p className="mt-0.5 truncate text-[13px] text-white/50">{section.subtitle}</p>
                </div>
                <span className="rounded-full bg-white/[0.07] px-2.5 py-0.5 text-[12px] tabular-nums text-white/55">
                    {section.items.length}
                </span>
                <ChevronDown
                    className="h-4 w-4 flex-shrink-0 text-white/45"
                    style={{
                        transform: isOpen ? 'rotate(180deg)' : 'none',
                        transition: 'transform var(--dur-base) var(--ease-out)',
                    }}
                />
            </button>
            {isOpen && (
                <div className="animate-fade-in px-4 pb-4">
                    <ServiceGrid
                        items={section.items}
                        favorites={favorites}
                        onToggleFavorite={onToggleFavorite}
                        onOpen={onOpen}
                    />
                </div>
            )}
        </section>
    );
}

function SectionHeading({ title, count, action }) {
    return (
        <div className="flex items-baseline gap-3">
            <h2 className="kz-display text-[19px] font-semibold sm:text-[22px]">{title}</h2>
            {typeof count === 'number' && <span className="text-[13px] tabular-nums text-white/35">{count}</span>}
            <div className="h-px flex-1 bg-gradient-to-r from-white/12 to-white/0" />
            {action}
        </div>
    );
}

function Catalog() {
    useReveal();
    const sections = useMemo(() => buildCatalogSections(), []);
    const quickAccess = useMemo(() => buildQuickAccess(), []);
    const allServices = useMemo(() => sections.flatMap((section) => section.items), [sections]);
    const servicesById = useMemo(
        () => new Map(allServices.map((item) => [serviceId(item), item])),
        [allServices],
    );
    const totalServices = allServices.length;

    const [query, setQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('Все');
    const [favorites, setFavorites] = useStoredList(FAVORITES_KEY, 30);
    const [recent, setRecent] = useStoredList(RECENT_KEY, 6);
    const [openSections, setOpenSections] = useState(() => new Set());
    const searchRef = useRef(null);

    // "/" focuses search from anywhere on the page
    useEffect(() => {
        const handler = (event) => {
            if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) {
                return;
            }
            const tag = event.target?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || event.target?.isContentEditable) {
                return;
            }
            event.preventDefault();
            searchRef.current?.focus();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    const isFiltering = query.trim() !== '' || activeCategory !== 'Все';

    const matchesActiveFilters = useCallback((item) => {
        const matchesCategory = activeCategory === 'Все' || item.facets.includes(activeCategory);
        return matchesCategory && serviceMatchesQuery(item, query);
    }, [activeCategory, query]);

    const visibleSections = useMemo(() => (
        sections
            .map((section) => ({
                ...section,
                items: section.items.filter(matchesActiveFilters),
            }))
            .filter((section) => section.items.length > 0)
    ), [sections, matchesActiveFilters]);

    const visibleTotal = visibleSections.reduce((sum, section) => sum + section.items.length, 0);

    const toggleFavorite = useCallback((id) => {
        setFavorites(
            favorites.includes(id)
                ? favorites.filter((entry) => entry !== id)
                : [id, ...favorites],
        );
    }, [favorites, setFavorites]);

    const recordRecent = useCallback((item) => {
        const id = serviceId(item);
        setRecent([id, ...recent.filter((entry) => entry !== id)]);
    }, [recent, setRecent]);

    const favoriteItems = favorites.map((id) => servicesById.get(id)).filter(Boolean);
    const recentItems = recent
        .map((id) => servicesById.get(id))
        .filter(Boolean)
        .filter((item) => !favorites.includes(serviceId(item)));

    const toggleSection = (title) => {
        setOpenSections((prev) => {
            const next = new Set(prev);
            if (next.has(title)) {
                next.delete(title);
            } else {
                next.add(title);
            }
            return next;
        });
    };

    const allOpen = openSections.size >= sections.length;
    const toggleAll = () => {
        setOpenSections(allOpen ? new Set() : new Set(sections.map((section) => section.title)));
    };

    return (
        <>
            <Head title="Каталог сервисов · КазУТБ" />

            <main
                className="relative mx-auto w-full max-w-[var(--container-xl)] px-[var(--gutter)] pb-14 pt-8 text-white lg:pt-12"
                style={{ fontFamily: 'var(--font-sans)' }}
            >
                {/* ── Header ── */}
                <header className="kz-up max-w-3xl">
                    <h1 className="kz-display text-[clamp(1.6rem,2.8vw,2.2rem)] font-semibold">
                        Каталог сервисов
                    </h1>
                    <p className="mt-2 text-sm leading-6 text-white/60 sm:text-[15px]">
                        {totalServices} цифровых сервисов университета — поиск, фильтры и избранное.
                    </p>
                </header>

                <div className="kz-up mt-6 space-y-6" style={{ animationDelay: '120ms' }}>
                    <CatalogSearch
                        query={query}
                        onQueryChange={setQuery}
                        resultCount={visibleTotal}
                        totalServices={totalServices}
                        isFiltering={isFiltering}
                        inputRef={searchRef}
                    />

                    {isFiltering ? (
                        /* ── Search / filter results: relevant sections, expanded ── */
                        visibleSections.length > 0 ? (
                            <div className="space-y-7">
                                {visibleSections.map((section) => (
                                    <section key={section.title} className="space-y-3">
                                        <SectionHeading title={section.title} count={section.items.length} />
                                        <ServiceGrid
                                            items={section.items}
                                            favorites={favorites}
                                            onToggleFavorite={toggleFavorite}
                                            onOpen={recordRecent}
                                        />
                                    </section>
                                ))}
                            </div>
                        ) : (
                            <div className="kz-panel px-6 py-12 text-center">
                                <p className="text-[15px] text-white/60">Сервисы не найдены.</p>
                                <p className="mt-1 text-sm text-white/40">
                                    Измените запрос или сбросьте фильтр категории.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => { setQuery(''); setActiveCategory('Все'); }}
                                    className="kz-btn kz-btn--ghost mt-5 !min-h-[40px]"
                                >
                                    Сбросить фильтры
                                </button>
                            </div>
                        )
                    ) : (
                        <>
                            {/* ── Favorites ── */}
                            {favoriteItems.length > 0 && (
                                <section className="space-y-3">
                                    <SectionHeading title="Избранное" count={favoriteItems.length} />
                                    <ServiceGrid
                                        items={favoriteItems}
                                        favorites={favorites}
                                        onToggleFavorite={toggleFavorite}
                                        onOpen={recordRecent}
                                    />
                                </section>
                            )}

                            {/* ── Quick access until the user builds favorites ── */}
                            {favoriteItems.length === 0 && (
                                <section className="space-y-3">
                                    <SectionHeading title="Быстрый доступ" />
                                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                                        {quickAccess.map((shortcut) => {
                                            const Icon = shortcut.icon ?? BookOpenText;
                                            return (
                                                <ServiceLink
                                                    key={shortcut.title}
                                                    href={shortcut.href}
                                                    external={shortcut.external}
                                                    className="kz-tile min-h-[64px] items-center gap-2.5 p-3"
                                                >
                                                    <span className="kz-icon-badge h-8 w-8">
                                                        <Icon className="h-4 w-4" />
                                                    </span>
                                                    <span className="min-w-0">
                                                        <span className="block truncate text-xs font-bold text-white/88">{shortcut.title}</span>
                                                        <span className="mt-0.5 block truncate text-[11px] text-white/42">{shortcut.desc}</span>
                                                    </span>
                                                </ServiceLink>
                                            );
                                        })}
                                    </div>
                                </section>
                            )}

                            {/* ── All sections, collapsed by default ── */}
                            <section className="space-y-3">
                                <SectionHeading
                                    title="Все разделы"
                                    count={totalServices}
                                    action={(
                                        <button
                                            type="button"
                                            onClick={toggleAll}
                                            className="text-[13px] font-semibold text-[var(--teal-300)] transition hover:text-[var(--teal-200)]"
                                        >
                                            {allOpen ? 'Свернуть всё' : 'Развернуть всё'}
                                        </button>
                                    )}
                                />
                                <div className="space-y-2.5">
                                    {sections.map((section) => (
                                        <CatalogSection
                                            key={section.title}
                                            section={section}
                                            isOpen={openSections.has(section.title)}
                                            onToggle={() => toggleSection(section.title)}
                                            favorites={favorites}
                                            onToggleFavorite={toggleFavorite}
                                            onOpen={recordRecent}
                                        />
                                    ))}
                                </div>
                            </section>
                        </>
                    )}
                </div>

            </main>
        </>
    );
}

Catalog.layout = (page) => <PublicLayout>{page}</PublicLayout>;
export default Catalog;
