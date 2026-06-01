# CRM KazUTB — Phase 2 UI/UX & Code Quality Audit
**Date:** June 2025  
**Scope:** `/var/www/laravel-react-dev/resources/js/` — all Pages, Layouts, Components  
**Type:** Read-only deep audit; no changes applied  

---

## Executive Summary

The CRM frontend has a solid design system foundation (shadcn/ui, Tailwind, custom `admin-*` utilities, Sonner toast, Manrope/Literata fonts). However, adoption of the design system is inconsistent — the majority of pages were authored before the system was fully defined and have not been migrated to it. There are also several security/deployment blockers (hardcoded IPs, hardcoded email gate) and 8+ stale draft files that should be removed.

**Critical (blockers):** 2  
**High (significant inconsistency):** 4  
**Medium (quality/maintainability):** 5  
**Low (polish/cleanup):** 4  

---

## Issue Catalogue

---

### 🔴 CRITICAL-1 — Hardcoded Intranet IPs in Source Code

**Files:**
- `resources/js/Layouts/AuthenticatedLayout.jsx` line 206 — `href="http://10.0.1.47/"` ("Главная" link in topbar)
- `resources/js/Pages/Catalog.jsx` line 29 — `href: 'http://10.0.1.8/'` (library link in service catalog)

**Impact:** Application is environment-specific. Broken in staging, production domain, or any other deployment. `10.0.1.47` is also hardcoded in `vite.config.js` as the HMR host (acceptable for local dev config; the `AuthenticatedLayout` use is NOT acceptable).

**Fix:**
1. Add `VITE_HOME_URL` and `VITE_LIBRARY_URL` to `.env` / `.env.example`
2. Replace hardcoded strings with `import.meta.env.VITE_HOME_URL ?? '/'` and `import.meta.env.VITE_LIBRARY_URL ?? '#'`

```bash
# .env
VITE_HOME_URL=http://10.0.1.47/
VITE_LIBRARY_URL=http://10.0.1.8/
```

---

### 🔴 CRITICAL-2 — Hardcoded Email Feature Gate in Sidebar

**File:** `resources/js/components/app-sidebar.jsx` line 138

```js
const hasTemplatesEmailAccess = 
    String(user?.email ?? '').toLowerCase() === 'a.khastayeva@kaztbu.edu.kz';
```

**Impact:**
- Templates module access is controlled by a hardcoded personal email. If this person changes email, leaves, or the feature should expand, a code deploy is required.
- Any email comparison like this is fundamentally a permission-system bypass. The backend already has a role/permission system.
- If this person's account is compromised, it looks legitimate to the UI.

**Fix:** Add `templates_email_access` or `manage_templates` permission to the backend permission system and pass `$user->can('manage_templates')` as a prop (e.g., via `$props['can']['manageTemplates']`). Remove this email check entirely from the sidebar.

---

### 🟠 HIGH-1 — Layout Wrapper Inconsistency (52 of ~69 pages)

**Standard pattern (17 pages):**
```jsx
<div className="admin-page-wrap">
  {/* page content */}
</div>
```
This provides: `w-full space-y-5 p-4 sm:p-6` + `fade-slide-up 420ms` entrance animation.

**Non-standard patterns found (52 pages):**
| Pattern | Count |
|---|---|
| `p-4 sm:p-6 lg:p-8` | ~24 pages |
| `p-4 sm:p-6` | ~15 pages |
| `admin-shell-container space-y-6 px-3 pb-5 pt-2 sm:px-4` | Certificates |
| `p-4 sm:p-6 lg:p-8 space-y-6` | ~8 pages |
| No wrapper at all | Calendar/Index |

**Pages NOT using `admin-page-wrap` include:**
All Calendar pages, all HR pages (`Dashboard`, `Perco*`, `DivisionLatePeople`), all Library pages, all Questionnaire pages, all Templates pages, Announcements, Diplomas, Certificates, Departments (Create/Edit), Tickets, Survey/Surveys modules.

**Impact:** Inconsistent spacing across the app; most pages lack the 420ms fade-slide-up entrance animation; padding varies (some pages have `lg:p-8` extra padding that `admin-page-wrap` omits); `space-y-5` vs `space-y-6` creates minor vertical rhythm differences.

**Fix:** Migrate to `<div className="admin-page-wrap">` (drop `lg:p-8` to match standard). Low risk — pure CSS class swap. Can be batched.

**Note:** `admin-shell-container` (`max-w-[1560px] mx-auto`) should wrap the page interior when the viewport needs a max-width constraint on top of `admin-page-wrap`. Only needed for very-wide-content pages.

---

### 🟠 HIGH-2 — Tables Not Using Design System Classes (21 files)

**Standard pattern:**
```jsx
<div className="admin-table-wrap">
  <table className="admin-data-table">
    ...
  </table>
</div>
```
This provides: `overflow-x-auto rounded-xl border border-border/75 bg-white/85 shadow` + consistent thead/td/tr hover styling.

**Non-standard pattern (21 files):**
```jsx
<div className="overflow-x-auto">
  <table className="w-full min-w-[980px] text-sm">
    ...
  </table>
</div>
```

**Files affected (selection):**
`HR/Perco*.jsx` (7 files), `Library/IssueBook.jsx`, `Library/ReservationsAdmin.jsx`, `Library/Dashboard.jsx`, `Diplomas/Index.jsx`, `Announcements/Index.jsx`, `Divisions/Index.jsx`, `Kpi/TeacherDashboard.jsx` (reference indicator table), `Kpi/Partials/KpiIndicatorsManager.jsx`, `Kpi/Partials/KpiPeriodsManager.jsx`, `Kpi/Settings.jsx`, `Kpi/TeacherForm.jsx`, `Kpi/DivisionTables.jsx`, `Kpi/StructuralDivisionDashboard.jsx`

**Impact:** Tables have inconsistent visual appearance — missing rounded border, box shadow, and consistent hover/border color treatment. `thead` styling differs between pages (some have explicit bg-slate-100 overrides, others rely on muted-foreground text only).

**Note:** `Tickets/AdminIndex.jsx` correctly uses `admin-data-table` but overrides with inline `[&_th]:` utilities. This is acceptable as a page-specific style override on top of the standard.

---

### 🟠 HIGH-3 — `window.confirm()` Used for Destructive Actions (31 pages, 33 calls)

**Files (selection):** `Calendar/Conferences.jsx`, `AcademicYears/Index.jsx`, `Nav/AdminRoutes.jsx`, `Positions/Index.jsx`, `Faculties/Index.jsx`, `EducationalPrograms/Index.jsx`, `Questionnaire/Admin/Groups.jsx`, and 24 more.

**Impact:**
- `window.confirm()` is a browser native dialog — cannot be styled, does not match the design system
- Blocked by some browser policies in certain contexts
- Not accessible to screen readers in a predictable way
- Inconsistent with pages that use shadcn `Dialog` for confirmations (e.g., KPI TeacherDashboard uses a full Delete confirmation Dialog)

**Fix:** Replace with a reusable `ConfirmDialog` component (shadcn Dialog with a `variant="destructive"` confirm button). One shared component handles all delete confirmations consistently. 

**Example pattern (already done correctly in TeacherDashboard):**
```jsx
<Dialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
  <DialogContent className="max-w-sm">
    <DialogHeader>
      <DialogTitle>Удалить запись?</DialogTitle>
      <DialogDescription>Это действие необратимо.</DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant="outline" onClick={() => setDeleteConfirm(false)}>Отмена</Button>
      <Button variant="destructive" onClick={handleDelete}>Удалить</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

### 🟠 HIGH-4 — Dialog Size Inconsistency (21 bare `<DialogContent>`)

**Default shadcn Dialog size:** `max-w-lg` (512px)

**Bare usages (no className):**
| File | Dialogs |
|---|---|
| `Faculties/Index.jsx` | 5 |
| `Certificates/Index.jsx` | 2 (Revoke, QR) |
| `Positions/Index.jsx` | 2 |
| `EducationalPrograms/Index.jsx` | 2 |
| `Divisions/Index.jsx` | 2 |
| `Departments/Index.jsx` | 2 |
| `AcademicYears/Index.jsx` | 1 |
| `Kpi/StructuralUnitsManager.jsx` | 1 |
| `Announcements/Index.jsx` | 2 |
| `PositionRequests/AdminIndex.jsx` | 1 |

**Inconsistency context:** Other pages explicitly set `max-w-2xl`, `max-w-3xl`, `sm:max-w-3xl max-h-[90vh] overflow-y-auto`, or `max-w-sm`. The default 512px is fine for simple confirm/single-field dialogs but may be too narrow for forms with multiple fields (e.g., the Faculties create/edit dialog has department + faculty type + accreditation fields).

**Fix:** Audit each bare dialog's form field count. Apply `className="max-w-md"` for simple forms, `className="sm:max-w-xl"` for medium forms, `className="sm:max-w-2xl"` for forms with 5+ fields.

---

### 🟡 MEDIUM-1 — Dual Component Directory (Components/ vs components/)

**Structure:**
```
resources/js/
  Components/          ← PascalCase (legacy Breeze scaffolding)
    ApplicationLogo.jsx
    ChatBot.jsx
    PrimaryButton.jsx, DangerButton.jsx, SecondaryButton.jsx
    InputError.jsx, InputLabel.jsx, TextInput.jsx
    Modal.jsx, Dropdown.jsx
    SiteHeader.jsx
    Surveys/
  components/          ← lowercase (shadcn/ui)
    app-sidebar.jsx
    ReminderProfileModal.jsx
    ui/
```

**Usage:**
- 82 page files import from `@/components/` (shadcn)
- 8 files import from `@/Components/` (legacy Breeze): Auth pages, Profile partials, `Tickets/Index.jsx` (SiteHeader), `GuestLayout.jsx`

**Impact:** Conceptual confusion, potential case-sensitivity issues across OS. The legacy `PrimaryButton`, `DangerButton`, `SecondaryButton` should be replaced by shadcn `Button variant="default"/"destructive"/"secondary"`. The legacy `Modal` and `Dropdown` are unused in main pages.

**Fix (long-term):** Migrate Auth and Profile pages to shadcn inputs/buttons. Move `SiteHeader` and `ChatBot` to `components/`. Delete `Components/` once all references are migrated. Low urgency.

---

### 🟡 MEDIUM-2 — Stale Draft Files (_new.jsx, .new.jsx)

**Files:**
```
resources/js/Pages/Calendar/
  Analytics_new.jsx       (608 lines)
  Conferences_new.jsx
  EmployeeProfile_new.jsx
  Employees_new.jsx
  Index_new.jsx           (608 lines)
  Settings_new.jsx
  Shared_new.jsx

resources/js/Pages/Templates/
  Index.new.jsx
```

**Confirmed:** None of these are referenced in any Laravel controller or route. They are undeployed drafts left in the codebase.

**Impact:** Build bundle includes them (Vite scans all JSX). Adds confusion for developers. Vite may warn on unreferenced files in strict mode.

**Fix:** Delete all 8 files after confirming they have no useful code not yet merged into the active version.

---

### 🟡 MEDIUM-3 — Low ARIA/Accessibility Coverage

**ARIA attribute count across all Pages:** 17 total across 69 pages (~0.25 per page)

**Observations:**
- Buttons using icon-only (e.g., `<Button variant="ghost" size="icon"><Trash2 /></Button>`) have no `aria-label` in most pages — screen readers would announce no meaningful action
- Table `<th>` cells have no `scope="col"` attributes
- Dialog focus trap is handled by Radix (shadcn) correctly, but dialog descriptions (`<DialogDescription>`) are often absent — dialogs announce title only
- No skip-to-content link found in `AuthenticatedLayout`
- The sidebar collapse/expand `SidebarTrigger` inherits Radix ARIA, but custom group toggles in `app-sidebar.jsx` have no `aria-expanded` on the trigger

**Impact:** App is not screen-reader friendly. WCAG 2.1 AA is not met. As an internal university app this may be lower priority, but staff with visual impairments cannot use it.

---

### 🟡 MEDIUM-4 — `window.alert()` Used for Success/Error Feedback (5 calls)

Similar to `window.confirm` but for notifications. 5 `window.alert()` calls found across pages.

The project already uses **Sonner** (imported in `app.jsx` as `<Toaster />` and in `AuthenticatedLayout` as `import { toast } from 'sonner'`), but Sonner is only actively called in `Certificates/Index.jsx` and `AuthenticatedLayout` (flash message handling).

**Impact:** Inconsistent feedback UX. `window.alert()` blocks the UI thread and cannot be styled.

**Fix:** Replace all `window.alert()` calls with `toast.success()` / `toast.error()`. Extend `AuthenticatedLayout`'s flash-message → Sonner bridge to cover more feedback types.

---

### 🟡 MEDIUM-5 — Raw Database Field Name Exposed in UI

**File:** `resources/js/Pages/Diplomas/Index.jsx`
**Field:** `external_student_code` used as a visible column label

**Impact:** Exposes internal data model naming to end users. Should be a localized human-readable label ("Внешний код студента" or equivalent).

---

### 🔵 LOW-1 — Calendar Event Creation Dialog Oversized (`max-w-5xl`)

**File:** `resources/js/Pages/Calendar/Index.jsx`  
The CreateEventDialog uses `max-w-5xl` (~1024px). This is very wide for a creation form. On 1280px screens it takes ~80% viewport width.

`EventDetailDialog` correctly uses `max-w-md`.

**Fix:** Reduce to `sm:max-w-3xl` or `sm:max-w-2xl` unless there's a specific multi-column layout requirement.

---

### 🔵 LOW-2 — `dangerouslySetInnerHTML` on Pagination Link Labels

**Files:** `Positions/Index.jsx`, `Divisions/Index.jsx`, `Announcements/Index.jsx`, `Departments/Index.jsx`

**Context:** All uses are on `link.label` from Laravel's pagination response (generates `«`, `»`, numeric labels as HTML entities). This is a common Inertia.js pattern.

**Risk:** Low — labels are framework-generated (not user input). However, if the backend changes the label source, this becomes an XSS vector.

**Fix (optional):** Use `link.label.replace(/&laquo;|&raquo;|&lt;|&gt;/g, ...)` or a DOMParser to safely decode entities without `dangerouslySetInnerHTML`. The Breeze/Inertia community pattern uses this — acceptable as-is for now.

---

### 🔵 LOW-3 — Catalog.jsx Has No HTTPS for Library Link

**File:** `resources/js/Pages/Catalog.jsx` line 29  
Library service URL uses `http://` — unencrypted. If the main app is on HTTPS, browsers will warn on mixed content (though this URL would open a new tab, so it's a navigation not a fetch, which avoids most mixed-content blocking).

Fix is part of CRITICAL-1: move to env var and update URL scheme.

---

### 🔵 LOW-4 — Deprecated / Unused Legacy Components

**Files with no imports outside Auth/Breeze pages:**
- `Components/PrimaryButton.jsx` — replaced by shadcn `<Button>`
- `Components/DangerButton.jsx` — replaced by `<Button variant="destructive">`
- `Components/SecondaryButton.jsx` — replaced by `<Button variant="secondary">`
- `Components/Modal.jsx` — replaced by shadcn `<Dialog>`
- `Components/Dropdown.jsx` — replaced by shadcn `<DropdownMenu>` (if needed)

These are only referenced by Auth scaffolding pages. They can remain until Auth pages are migrated, then deleted.

---

## Design System Coverage Summary

| Layer | Defined | Adopted | Gap |
|---|---|---|---|
| Design tokens (CSS vars) | ✅ Full | ✅ via Tailwind | None |
| Layout wrapper (`admin-page-wrap`) | ✅ | 17/69 pages (25%) | 52 pages need migration |
| Tables (`admin-data-table` + `admin-table-wrap`) | ✅ | ~48 files | 21 files not using it |
| Dialogs (shadcn Dialog + explicit size) | ✅ | ~60% | 21 bare dialogs |
| Toast notifications (Sonner) | ✅ | 2 pages | 5 still use `window.alert`, 33 use `window.confirm` |
| Fonts (Manrope + Literata) | ✅ | ✅ globally | None |
| Button variants (shadcn) | ✅ | ✅ mostly | Legacy `PrimaryButton` in 8 files |
| ARIA / Accessibility | ❌ Minimal | 17 aria attrs total | Major gaps |

---

## Hardcoded Values Inventory

| Value | File | Line | Type | Risk |
|---|---|---|---|---|
| `http://10.0.1.47/` | `AuthenticatedLayout.jsx` | 206 | Intranet URL | 🔴 Critical |
| `http://10.0.1.8/` | `Catalog.jsx` | 29 | Library IP | 🔴 Critical |
| `a.khastayeva@kaztbu.edu.kz` | `app-sidebar.jsx` | 138 | Access gate email | 🔴 Critical |
| `10.0.1.47` | `vite.config.js` | HMR host | Dev config | ✅ Acceptable |

---

## Stale Files for Deletion

```
resources/js/Pages/Calendar/Analytics_new.jsx
resources/js/Pages/Calendar/Conferences_new.jsx
resources/js/Pages/Calendar/EmployeeProfile_new.jsx
resources/js/Pages/Calendar/Employees_new.jsx
resources/js/Pages/Calendar/Index_new.jsx
resources/js/Pages/Calendar/Settings_new.jsx
resources/js/Pages/Calendar/Shared_new.jsx
resources/js/Pages/Templates/Index.new.jsx
```

None are referenced in routes or controllers. Confirm and delete.

---

## Recommended Fix Priority

| Priority | Issue | Effort | Impact |
|---|---|---|---|
| 1 | CRITICAL-1: Replace hardcoded IPs with VITE_ env vars | S (30 min) | Enables multi-env deploy |
| 2 | CRITICAL-2: Replace email gate with backend permission | M (2h) | Security + maintainability |
| 3 | HIGH-3: Replace `window.confirm` with ConfirmDialog component | M (4h) | 33 call sites, 31 files |
| 4 | HIGH-1: Migrate 52 pages to `admin-page-wrap` | L (4h) | Consistent spacing + animation |
| 5 | HIGH-2: Migrate 21 table files to `admin-data-table` pattern | L (3h) | Consistent table appearance |
| 6 | MEDIUM-2: Delete 8 stale _new.jsx files | S (5 min) | Clean codebase |
| 7 | HIGH-4: Audit and size 21 bare dialogs | M (2h) | Consistent dialog UX |
| 8 | MEDIUM-4: Replace `window.alert` with Sonner toast | S (1h) | Consistent feedback |
| 9 | MEDIUM-3: Add aria-labels to icon buttons | M (3h) | Accessibility |
| 10 | MEDIUM-1: Consolidate Components/ into components/ | L (6h) | Long-term cleanup |

---

## Page Coverage Map

| Module | Pages Audited | Pattern |
|---|---|---|
| Layout | `AuthenticatedLayout.jsx` | ✅ Fully read |
| Sidebar | `app-sidebar.jsx` | ✅ Fully read |
| Dashboard | `Dashboard.jsx` | ✅ uses admin-page-wrap |
| KPI | `TeacherDashboard`, `Summary`, `EntryShow`... | ✅ Partially read |
| Calendar | `Index.jsx` | ✅ Partially read |
| Certificates | `Index.jsx` | ✅ Partially read |
| Diplomas | `Index.jsx` | ✅ Partially read |
| Catalog | `Catalog.jsx` | ✅ Fully read |
| HR | All files | 📊 Census only (grep) |
| Library | All files | 📊 Census only |
| Questionnaire | All files | 📊 Census only |
| Templates | `Index.jsx` | 📊 Census only |
| Tickets | `AdminIndex.jsx` | 📊 Census only |
| Announcements | `Index.jsx` | ✅ Partially read |
| Users | `Index.jsx`, `AdminAccess.jsx` | 📊 Census only |
| Nav | `AdminRoutes.jsx` | 📊 Census only |
| Auth pages | Multiple | 📊 Census only |

*"Census only" = covered by grep scans for all pattern checks but not line-by-line read.*

---

*Report generated by GitHub Copilot audit pass — June 2025*
