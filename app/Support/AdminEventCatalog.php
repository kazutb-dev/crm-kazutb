<?php

namespace App\Support;

class AdminEventCatalog
{
    // ── Business module keys ──────────────────────────────────────────────
    public const MODULE_AUTH         = 'auth';
    public const MODULE_KPI          = 'kpi';
    public const MODULE_KPI_SETTINGS = 'kpi_settings';
    public const MODULE_USERS        = 'users';
    public const MODULE_POSITIONS    = 'positions';
    public const MODULE_TICKETS      = 'tickets';
    public const MODULE_ANNOUNCEMENTS = 'announcements';
    public const MODULE_CALENDAR     = 'calendar';
    public const MODULE_LIBRARY      = 'library';
    public const MODULE_CERTIFICATES = 'certificates';
    public const MODULE_NAVIGATION   = 'navigation';
    public const MODULE_DIRECTORY    = 'directory';
    public const MODULE_SYSTEM       = 'system';

    // ── Severity levels ───────────────────────────────────────────────────
    public const SEV_LOW      = 'low';
    public const SEV_MEDIUM   = 'medium';
    public const SEV_HIGH     = 'high';
    public const SEV_CRITICAL = 'critical';

    // ── Human-readable event labels ───────────────────────────────────────
    private const EVENT_LABELS = [
        // Authentication
        'login'   => 'Вход в систему',
        'logout'  => 'Выход из системы',

        // Profile / Identity
        'profile_updated' => 'Обновление профиля',
        'profile_deleted' => 'Удаление профиля',

        // Generic CRUD (Spatie fallback)
        'created' => 'Создание записи',
        'updated' => 'Обновление записи',
        'deleted' => 'Удаление записи',

        // KPI Workflow
        'kpi_entry_created'    => 'Создание KPI-записи',
        'kpi_entry_updated'    => 'Обновление KPI-записи',
        'kpi_entry_submitted'  => 'Отправка KPI на проверку',
        'kpi_entry_reviewed'   => 'Проверка KPI-записи',
        'kpi_entry_returned'   => 'Возврат KPI на доработку',
        'kpi_entry_approved'   => 'Одобрение KPI-записи',
        'kpi_entry_rejected'   => 'Отклонение KPI-записи',
        'kpi_period_submitted' => 'Отправка KPI-пакета за период',

        // KPI Settings
        'kpi_settings_updated'     => 'Изменение настроек KPI',
        'kpi_admin_access_granted' => 'Назначение доступа к KPI',
        'kpi_admin_access_revoked' => 'Отзыв доступа к KPI',

        // User Access & Roles
        'admin_access_granted'  => 'Назначение admin-доступа',
        'admin_access_revoked'  => 'Отзыв admin-доступа',
        'user_created_manual'   => 'Ручное создание пользователя',
        'user_role_updated'     => 'Изменение роли пользователя',
        'user_position_updated' => 'Изменение должности пользователя',
        'user_binding_updated'  => 'Обновление привязки пользователя',

        // Position Requests
        'position_request_created'  => 'Создание заявки на должность',
        'position_request_approved' => 'Одобрение заявки на должность',
        'position_request_rejected' => 'Отклонение заявки на должность',

        // Tickets
        'ticket_created'  => 'Создание тикета',
        'ticket_updated'  => 'Обновление тикета',
        'ticket_resolved' => 'Тикет решён',
        'ticket_closed'   => 'Тикет закрыт',

        // Announcements
        'announcement_created'   => 'Создание объявления',
        'announcement_published' => 'Публикация объявления',
        'announcement_deleted'   => 'Удаление объявления',

        // Calendar
        'calendar_event_created' => 'Создание события в календаре',
        'calendar_event_updated' => 'Обновление события календаря',
        'calendar_event_deleted' => 'Удаление события календаря',

        // Library
        'library_reservation_created'  => 'Создание брони книги',
        'library_reservation_approved' => 'Подтверждение брони книги',
        'library_loan_issued'          => 'Выдача книги',
        'library_loan_returned'        => 'Возврат книги',

        // Certificates
        'certificate_issued'  => 'Выдача сертификата',
        'certificate_revoked' => 'Отзыв сертификата',

        // Navigation
        'navigation_route_created' => 'Создание маршрута навигации',
        'navigation_route_updated' => 'Обновление маршрута навигации',
        'navigation_route_deleted' => 'Удаление маршрута навигации',

        // Directory / Reference data
        'department_created' => 'Создание кафедры',
        'department_updated' => 'Обновление кафедры',
        'faculty_created'    => 'Создание факультета',
        'faculty_updated'    => 'Обновление факультета',
        'division_created'   => 'Создание подразделения',
        'division_updated'   => 'Обновление подразделения',
    ];

    // ── Business module per event ─────────────────────────────────────────
    private const EVENT_MODULE = [
        'login'   => self::MODULE_AUTH,
        'logout'  => self::MODULE_AUTH,

        'profile_updated' => self::MODULE_USERS,
        'profile_deleted' => self::MODULE_USERS,

        'created' => self::MODULE_SYSTEM,
        'updated' => self::MODULE_SYSTEM,
        'deleted' => self::MODULE_SYSTEM,

        'kpi_entry_created'    => self::MODULE_KPI,
        'kpi_entry_updated'    => self::MODULE_KPI,
        'kpi_entry_submitted'  => self::MODULE_KPI,
        'kpi_entry_reviewed'   => self::MODULE_KPI,
        'kpi_entry_returned'   => self::MODULE_KPI,
        'kpi_entry_approved'   => self::MODULE_KPI,
        'kpi_entry_rejected'   => self::MODULE_KPI,
        'kpi_period_submitted' => self::MODULE_KPI,

        'kpi_settings_updated'     => self::MODULE_KPI_SETTINGS,
        'kpi_admin_access_granted' => self::MODULE_KPI_SETTINGS,
        'kpi_admin_access_revoked' => self::MODULE_KPI_SETTINGS,

        'admin_access_granted'  => self::MODULE_USERS,
        'admin_access_revoked'  => self::MODULE_USERS,
        'user_created_manual'   => self::MODULE_USERS,
        'user_role_updated'     => self::MODULE_USERS,
        'user_position_updated' => self::MODULE_USERS,
        'user_binding_updated'  => self::MODULE_USERS,

        'position_request_created'  => self::MODULE_POSITIONS,
        'position_request_approved' => self::MODULE_POSITIONS,
        'position_request_rejected' => self::MODULE_POSITIONS,

        'ticket_created'  => self::MODULE_TICKETS,
        'ticket_updated'  => self::MODULE_TICKETS,
        'ticket_resolved' => self::MODULE_TICKETS,
        'ticket_closed'   => self::MODULE_TICKETS,

        'announcement_created'   => self::MODULE_ANNOUNCEMENTS,
        'announcement_published' => self::MODULE_ANNOUNCEMENTS,
        'announcement_deleted'   => self::MODULE_ANNOUNCEMENTS,

        'calendar_event_created' => self::MODULE_CALENDAR,
        'calendar_event_updated' => self::MODULE_CALENDAR,
        'calendar_event_deleted' => self::MODULE_CALENDAR,

        'library_reservation_created'  => self::MODULE_LIBRARY,
        'library_reservation_approved' => self::MODULE_LIBRARY,
        'library_loan_issued'          => self::MODULE_LIBRARY,
        'library_loan_returned'        => self::MODULE_LIBRARY,

        'certificate_issued'  => self::MODULE_CERTIFICATES,
        'certificate_revoked' => self::MODULE_CERTIFICATES,

        'navigation_route_created' => self::MODULE_NAVIGATION,
        'navigation_route_updated' => self::MODULE_NAVIGATION,
        'navigation_route_deleted' => self::MODULE_NAVIGATION,

        'department_created' => self::MODULE_DIRECTORY,
        'department_updated' => self::MODULE_DIRECTORY,
        'faculty_created'    => self::MODULE_DIRECTORY,
        'faculty_updated'    => self::MODULE_DIRECTORY,
        'division_created'   => self::MODULE_DIRECTORY,
        'division_updated'   => self::MODULE_DIRECTORY,
    ];

    // ── Severity per event ────────────────────────────────────────────────
    private const EVENT_SEVERITY = [
        'login'   => self::SEV_LOW,
        'logout'  => self::SEV_LOW,

        'profile_updated' => self::SEV_LOW,
        'profile_deleted' => self::SEV_HIGH,

        'created' => self::SEV_LOW,
        'updated' => self::SEV_LOW,
        'deleted' => self::SEV_MEDIUM,

        'kpi_entry_created'    => self::SEV_LOW,
        'kpi_entry_updated'    => self::SEV_LOW,
        'kpi_entry_submitted'  => self::SEV_MEDIUM,
        'kpi_entry_reviewed'   => self::SEV_MEDIUM,
        'kpi_entry_returned'   => self::SEV_MEDIUM,
        'kpi_entry_approved'   => self::SEV_MEDIUM,
        'kpi_entry_rejected'   => self::SEV_MEDIUM,
        'kpi_period_submitted' => self::SEV_HIGH,

        'kpi_settings_updated'     => self::SEV_HIGH,
        'kpi_admin_access_granted' => self::SEV_CRITICAL,
        'kpi_admin_access_revoked' => self::SEV_CRITICAL,

        'admin_access_granted'  => self::SEV_CRITICAL,
        'admin_access_revoked'  => self::SEV_CRITICAL,
        'user_created_manual'   => self::SEV_HIGH,
        'user_role_updated'     => self::SEV_CRITICAL,
        'user_position_updated' => self::SEV_HIGH,
        'user_binding_updated'  => self::SEV_MEDIUM,

        'position_request_created'  => self::SEV_MEDIUM,
        'position_request_approved' => self::SEV_HIGH,
        'position_request_rejected' => self::SEV_HIGH,

        'ticket_created'  => self::SEV_LOW,
        'ticket_updated'  => self::SEV_LOW,
        'ticket_resolved' => self::SEV_LOW,
        'ticket_closed'   => self::SEV_LOW,

        'announcement_created'   => self::SEV_LOW,
        'announcement_published' => self::SEV_LOW,
        'announcement_deleted'   => self::SEV_MEDIUM,

        'calendar_event_created' => self::SEV_LOW,
        'calendar_event_updated' => self::SEV_LOW,
        'calendar_event_deleted' => self::SEV_MEDIUM,

        'library_reservation_created'  => self::SEV_LOW,
        'library_reservation_approved' => self::SEV_LOW,
        'library_loan_issued'          => self::SEV_LOW,
        'library_loan_returned'        => self::SEV_LOW,

        'certificate_issued'  => self::SEV_LOW,
        'certificate_revoked' => self::SEV_HIGH,

        'navigation_route_created' => self::SEV_MEDIUM,
        'navigation_route_updated' => self::SEV_MEDIUM,
        'navigation_route_deleted' => self::SEV_HIGH,

        'department_created' => self::SEV_MEDIUM,
        'department_updated' => self::SEV_MEDIUM,
        'faculty_created'    => self::SEV_MEDIUM,
        'faculty_updated'    => self::SEV_MEDIUM,
        'division_created'   => self::SEV_MEDIUM,
        'division_updated'   => self::SEV_MEDIUM,
    ];

    // ── Entity / subject display labels ───────────────────────────────────
    private const SUBJECT_LABELS = [
        'auth'  => 'Аутентификация',
        'User'  => 'Пользователь',
        'App\\Models\\User' => 'Пользователь',

        'KpiEntry'              => 'KPI-запись',
        'App\\Models\\KpiEntry' => 'KPI-запись',
        'KpiPeriod'             => 'Период KPI',
        'App\\Models\\KpiPeriod' => 'Период KPI',
        'KpiIndicator'          => 'KPI-индикатор',
        'App\\Models\\KpiIndicator' => 'KPI-индикатор',
        'KpiSettings'           => 'Настройки KPI',

        'PositionChangeRequest'             => 'Заявка на должность',
        'App\\Models\\PositionChangeRequest' => 'Заявка на должность',

        'Ticket'             => 'Тикет',
        'App\\Models\\Ticket' => 'Тикет',

        'Announcement'             => 'Объявление',
        'App\\Models\\Announcement' => 'Объявление',

        'Division'             => 'Подразделение',
        'App\\Models\\Division' => 'Подразделение',
        'Department'             => 'Кафедра',
        'App\\Models\\Department' => 'Кафедра',
        'Faculty'             => 'Факультет',
        'App\\Models\\Faculty' => 'Факультет',

        'NavigationRoute'             => 'Маршрут навигации',
        'App\\Models\\NavigationRoute' => 'Маршрут навигации',

        'Certificate'             => 'Сертификат',
        'App\\Models\\Certificate' => 'Сертификат',

        'LibraryReservation'             => 'Бронирование книги',
        'App\\Models\\LibraryReservation' => 'Бронирование книги',
        'LibraryLoan'             => 'Выдача книги',
        'App\\Models\\LibraryLoan' => 'Выдача книги',

        'CalendarEvent'             => 'Событие календаря',
        'App\\Models\\CalendarEvent' => 'Событие календаря',

        'AcademicYear'             => 'Учебный год',
        'App\\Models\\AcademicYear' => 'Учебный год',
        'EducationalProgram'             => 'Образовательная программа',
        'App\\Models\\EducationalProgram' => 'Образовательная программа',
        'Diploma'             => 'Дипломная работа',
        'App\\Models\\Diploma' => 'Дипломная работа',

        // Role slugs
        'admin'          => 'Администратор',
        'superadmin'     => 'Суперадминистратор',
        'teacher'        => 'Преподаватель',
        'student'        => 'Студент',
        'dean'           => 'Декан',
        'hod'            => 'Зав. кафедрой',
        'department_head' => 'Зав. кафедрой',
        'department'     => 'Структурное подразделение',
        'structural'     => 'Структурное подразделение',
    ];

    // ── Module display labels ─────────────────────────────────────────────
    private const MODULE_LABELS = [
        self::MODULE_AUTH         => 'Аутентификация',
        self::MODULE_KPI          => 'KPI',
        self::MODULE_KPI_SETTINGS => 'Настройки KPI',
        self::MODULE_USERS        => 'Пользователи',
        self::MODULE_POSITIONS    => 'Заявки на должность',
        self::MODULE_TICKETS      => 'Тикеты',
        self::MODULE_ANNOUNCEMENTS => 'Объявления',
        self::MODULE_CALENDAR     => 'Календарь',
        self::MODULE_LIBRARY      => 'Библиотека',
        self::MODULE_CERTIFICATES => 'Сертификаты',
        self::MODULE_NAVIGATION   => 'Навигация',
        self::MODULE_DIRECTORY    => 'Справочники',
        self::MODULE_SYSTEM       => 'Система',
    ];

    // ── Severity display labels ───────────────────────────────────────────
    private const SEVERITY_LABELS = [
        self::SEV_LOW      => 'Обычное',
        self::SEV_MEDIUM   => 'Рабочее',
        self::SEV_HIGH     => 'Важное',
        self::SEV_CRITICAL => 'Критичное',
    ];

    // ── Public API ────────────────────────────────────────────────────────

    /** @return array<int, string> */
    public static function availableEvents(): array
    {
        return array_keys(self::EVENT_LABELS);
    }

    /** Human-readable display name for an event key */
    public static function eventLabel(?string $event): string
    {
        $event = trim((string) $event);

        return $event !== '' ? (self::EVENT_LABELS[$event] ?? $event) : 'Событие не указано';
    }

    /** Business module key for an event */
    public static function eventModule(?string $event): string
    {
        $event = trim((string) $event);

        return $event !== '' ? (self::EVENT_MODULE[$event] ?? self::MODULE_SYSTEM) : self::MODULE_SYSTEM;
    }

    /** Module display label for an event */
    public static function eventModuleLabel(?string $event): string
    {
        return self::moduleLabel(self::eventModule($event));
    }

    /** Severity key for an event */
    public static function eventSeverity(?string $event): string
    {
        $event = trim((string) $event);

        return $event !== '' ? (self::EVENT_SEVERITY[$event] ?? self::SEV_LOW) : self::SEV_LOW;
    }

    /** Severity display label for an event */
    public static function eventSeverityLabel(?string $event): string
    {
        return self::severityLabel(self::eventSeverity($event));
    }

    /**
     * Return all enriched metadata for an event in one call.
     *
     * @return array{label: string, module: string, module_label: string, severity: string, severity_label: string}
     */
    public static function eventMeta(?string $event): array
    {
        return [
            'label'          => self::eventLabel($event),
            'module'         => self::eventModule($event),
            'module_label'   => self::eventModuleLabel($event),
            'severity'       => self::eventSeverity($event),
            'severity_label' => self::eventSeverityLabel($event),
        ];
    }

    /** Human-readable entity/subject display name */
    public static function subjectLabel(?string $subjectType): string
    {
        $subjectType = trim((string) $subjectType);

        if ($subjectType === '') {
            return 'Сущность не указана';
        }

        if (isset(self::SUBJECT_LABELS[$subjectType])) {
            return self::SUBJECT_LABELS[$subjectType];
        }

        if (str_starts_with($subjectType, 'App\\Models\\')) {
            $short = substr($subjectType, strlen('App\\Models\\'));

            return self::SUBJECT_LABELS[$short] ?? $short;
        }

        return $subjectType;
    }

    /** Human-readable module display label from module key */
    public static function moduleLabel(?string $module): string
    {
        $module = trim((string) $module);

        return $module !== '' ? (self::MODULE_LABELS[$module] ?? $module) : '—';
    }

    /** Human-readable severity label from severity key */
    public static function severityLabel(?string $severity): string
    {
        $severity = trim((string) $severity);

        return $severity !== '' ? (self::SEVERITY_LABELS[$severity] ?? $severity) : '—';
    }

    /**
     * All modules as key → label map, for use in filter dropdowns.
     *
     * @return array<string, string>
     */
    public static function allModules(): array
    {
        return self::MODULE_LABELS;
    }

    /**
     * All severity levels as key → label map.
     *
     * @return array<string, string>
     */
    public static function allSeverities(): array
    {
        return self::SEVERITY_LABELS;
    }

    /**
     * Event options for filter dropdowns: [['key' => ..., 'label' => ...], ...].
     *
     * @return array<int, array{key: string, label: string}>
     */
    public static function eventOptions(): array
    {
        return array_map(
            static fn (string $key): array => ['key' => $key, 'label' => self::EVENT_LABELS[$key]],
            array_keys(self::EVENT_LABELS)
        );
    }
}
