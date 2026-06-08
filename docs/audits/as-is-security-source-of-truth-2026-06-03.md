# As-Is Audit и Source-of-Truth Inventory

Дата: 2026-06-03
Репозиторий: crm-kazutb (branch dev)
Область: учетные данные пользователей, ownership полей, контроль доступа (KPI, panel, calendar, certificates)

## 2.1 Карта текущих security-relevant данных

| Атрибут | Где хранится | Кто меняет (по коду) | Влияет на доступ | Trusted source сейчас | Комментарий по риску |
| --- | --- | --- | --- | --- | --- |
| ad_guid | users.ad_guid | AD sync через ActiveDirectoryAuthenticator::upsertLocalUser | Да, поиск и связка AD->локальный user | AD (высокий trust) | Корректно как sync-only идентификатор; локально меняется только сервисом синка |
| ad_login | users.ad_login | AD sync; локальное создание/редактирование в DirectoryUserController | Да, login fallback, поиск пользователей, API login fallback | Смешанный: AD + локальное админ-редактирование | Не полностью sync-only: админ может создавать/править локально |
| email | users.email | AD sync, Profile update, DirectoryUserController, manual user create | Да, login, allowlist в ряде модулей | Смешанный: AD + local | Есть hardcoded email allowlist-решения, что повышает риск drift |
| position_title | users.position_title | PositionChangeRequest approve; Profile flow (ограниченно); DirectoryUserController через position assignment | Косвенно (через UI/оценку KPI и pending request flows) | CRM + approval workflow | Нельзя менять напрямую в ProfileRequest, но есть несколько административных путей изменения |
| position_id | users.position_id | PositionChangeRequest approve; DirectoryUserController | Да, через косвенную роль и орг-привязки | CRM | Центральный связующий атрибут для назначения должности |
| faculty_id | users.faculty_id | Profile (для teacher/без роли), DirectoryUserController, binding endpoints, AD-adjacent admin flows | Да, dean scope, KPI queue visibility, policy scoping | CRM + approval/admin | Используется как org-bound фильтр в policy/queue; важно единое authority |
| department_id | users.department_id | Profile (для teacher/без роли), DirectoryUserController, binding endpoints, AD-adjacent admin flows | Да, hod scope, KPI queue visibility, policy scoping | CRM + approval/admin | Аналогично faculty_id; участвует в authorize в KPI policy |
| division_id (users) | users.division_id | В коде почти не используется как authority; основной механизм через pivot user_division и kpi_structural_unit_user | Ограниченно | CRM (исторический/вспомогательный) | Текущий доступ structural в основном не на users.division_id, а на grants/pivot |
| role_id | users.role_id (+ users.role legacy) | DirectoryUserController (grant/revoke admin, role update), User::booted normalize role<->role_id, login defaulting teacher | Да, базовая модель role-based доступа | CRM only | Есть dual-source role и role_id; normalization в модели снижает, но не устраняет риск рассинхрона |
| grants (KPI) | kpi_access_grants (permission, is_active, division_id, granted_by) | KpiAccessController, KpiSettingsController, DirectoryUserController helper methods | Да, явный bypass/расширение доступов к KPI routes/queues/settings | CRM only | Критичный источник прав; используется и в middleware, и в policy |
| structural assignment | kpi_structural_unit_user pivot (+ user_division legacy, grants.division_id legacy) | DirectoryUserController sync divisions; KpiStructuralUnitController attach/detach | Да, structural queue scope/visibility | CRM only | Есть legacy mapping division_id -> structural units; риск сложного поведения |
| student group/program | questionnaire_students + questionnaire_groups/speciality/program | Заполняется модулем questionnaire; читается в Profile payload | Сейчас нет прямого влияния на ACL | Будущий authority (Platonus), сейчас локальный/частично derived | На сегодня не участвует в authorize/policy; только отображение/контекст |

Ключевые факты по trust:

- AD-поля ad_guid/ad_login заполняются через AD authenticator, но ad_login может также появляться через локальные админ-флоу.
- Орг-привязки faculty_id/department_id имеют несколько writers (profile self-service + admin-directory).
- Права KPI (kpi_access_grants) являются фактическим расширителем прав поверх роли.

## 2.2 Таблица ownership по полям

| Поле | Owner (authority) | Режим владения | Фактические writers в системе |
| --- | --- | --- | --- |
| ad_guid | AD | sync-only | ActiveDirectoryAuthenticator |
| ad_login | AD (целевой), фактически mixed | sync-preferred, но local-writable | ActiveDirectoryAuthenticator, DirectoryUserController/manual flows |
| email | AD или локальный CRM | mixed | ActiveDirectoryAuthenticator, ProfileController, DirectoryUserController |
| position | CRM + approval | approval-controlled | PositionChangeRequestController (approve), DirectoryUserController |
| faculty_id | CRM + approval/admin | controlled local | ProfileController (ограниченно), DirectoryUserController |
| department_id | CRM + approval/admin | controlled local | ProfileController (ограниченно), DirectoryUserController |
| division_id | CRM (исторически), фактически secondary | secondary | Ограниченно; вместо этого pivot/grants |
| role_id | CRM only | local-only | DirectoryUserController, User::booted normalization |
| grants | CRM only | local-only | KpiAccessController, KpiSettingsController, DirectoryUserController helpers |
| student group/program | future Platonus authority | future-external | Локально хранится в questionnaire-таблицах, без ACL authority |

## 2.3 Карта текущих access checks

### A. Middleware

- panel.role.access (EnsurePanelRoleAccess)

- Основной RBAC gateway для web panel маршрутов.
- Разрешения по role slug + отдельные route prefix allowlists.
- KPI grant-based bypass для kpi.* маршрутов (permission map).
- Отдельные ветки для teacher/hod/dean/structural/department.
- Встроенные hardcoded исключения для сертификатного модуля по email allowlist.

- calendar.access (EnsureCalendarLeadershipAccess)

- Доступ к calendar для admin/superadmin, leadership patterns по ad_title, explicit grants, secretary access.
- Исключения через таблицу exclusions.

- auth/verified/track.last-seen

- Базовые non-authorization middleware (сессия/верификация/метрика активности).

### B. Policies / Gates

- KpiEntryPolicy

- authorize для view/create/update/submit/review/approve/reject/return.
- Role-aware + grant-aware модель.
- Org-bound проверки: hod по department_id, dean по faculty_id.
- Разрешает unlinked entries (faculty_id null и department_id null) в ряде проверок.

- KpiPeriodPolicy

- Управление периодами: admin/superadmin или grant periods.

- Gate wiring

- Gate::policy(KpiEntry, KpiEntryPolicy), Gate::policy(KpiPeriod, KpiPeriodPolicy).
- Доп. gates для pulse/telescope/api docs только admin/superadmin.

### C. Model-level checks и derived role logic

- User::resolvedRoleSlug()

- Сводит role + roleRef + special mapping (department/structural -> teacher/structural по факту доступа).
- Существенно влияет на все middleware/policy, где вызывается resolvedRoleSlug.

- User::booted()

- Нормализация role <-> role_id перед сохранением.
- Триггер hydration KPI entry structure при изменении faculty_id/department_id.

### D. Scattered role/access logic в контроллерах

- KpiEntryController

- Queue endpoints требуют policy + abortIfNotQueueAccess(grant for teacher).
- visibleEntriesQuery применяет org-scope (department/faculty) и structural scoping.
- buildModerationQueuePayload добавляет tab scope/unlinked и динамические границы видимости.

- KpiSummaryController

- showTeacher: teacher self-only, кроме KPI admin.
- exportRating*: admin/superadmin или KPI admin grant.
- Сильная role+grant зависимость в summary aggregation.

- PositionChangeRequestController

- isAdmin для approve/reject включает не только admin/superadmin, но и structural/dean/hod + KPI admin grant.

- DirectoryUserController

- Явные операции изменения role_id/role, org bindings, structural links.
- Скрытая эскалация через helper syncKpiAdminRoleAccess (выдает весь bundle permissions).

### E. Org-bound rules

- HOD scope: department_id.
- Dean scope: faculty_id.
- Structural scope: kpi_structural_unit_user и/или grants PERM_STRUCTURAL_QUEUE (+ legacy division mapping).
- KPI policy допускает unlinked entries и fallback к user.faculty_id/user.department_id.

### F. KPI review logic

- Review queue: submitted (PERM_REVIEW_QUEUE).
- Approval queue: pending_dean (PERM_APPROVAL_QUEUE).
- Structural queue: pending_structural (PERM_STRUCTURAL_QUEUE).
- approve/reject/return переходы зависят от комбинации role + grant + status.

### G. Hardcoded exceptions

- Email allowlist

- Templates/certificates: a.khastayeva (at) kaztbu.edu.kz через controller checks и middleware.
- Templates visibility также через config templates_allowed_emails (transition mode).

- Special login-image route

- Жестко привязан к user id=66 и ad_login=a.ulykpan1.

- Учитель без grant ограничен, но teacher с grant получает расширенный доступ к очередям.

## Риски As-Is (консолидировано)

Высокий приоритет:

1. Dual authority для ad_login/email (AD и local admin flows) без явного флага immutable-on-sync.
2. Role model split (role + role_id + roleRef + resolvedRoleSlug) создает риск рассинхрона и неоднозначных проверок.
3. Hardcoded email allowlist и точечные исключения усложняют формальную модель доступа.

Средний приоритет:

1. Structural scope использует mix из kpi_structural_unit_user, grants.division_id (legacy), и ad_division fallback.
2. Unlinked entries в KPI policy/queue могут вести к неочевидному расширению видимости.

Низкий/архитектурный долг:

1. users.division_id не является основным authority для ACL, но остается в модели.
2. Student group/program пока не участвует в ACL, требуется формальный перенос authority в будущем (Platonus).

## Source-of-truth (основные файлы)

- app/Models/User.php
- app/Models/KpiAccessGrant.php
- app/Policies/KpiEntryPolicy.php
- app/Policies/KpiPeriodPolicy.php
- app/Http/Middleware/EnsurePanelRoleAccess.php
- app/Http/Middleware/EnsureCalendarLeadershipAccess.php
- app/Http/Middleware/HandleInertiaRequests.php
- app/Http/Controllers/DirectoryUserController.php
- app/Http/Controllers/ProfileController.php
- app/Http/Controllers/PositionChangeRequestController.php
- app/Http/Controllers/KpiEntryController.php
- app/Http/Controllers/KpiSummaryController.php
- app/Http/Controllers/KpiSettingsController.php
- app/Http/Controllers/KpiAccessController.php
- app/Services/ActiveDirectoryAuthenticator.php
- routes/web.php
