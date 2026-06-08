<?php

namespace App\Http\Controllers;

use App\Models\Department;
use App\Models\DepartmentRequestDepartment;
use App\Models\DepartmentRequest;
use App\Models\DepartmentRequestHandler;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class DepartmentRequestController extends Controller
{
    // ─── User-facing ─────────────────────────────────────────────────────────

    public function index(Request $request): Response
    {
        $user = $request->user();

        $myRequests = DepartmentRequest::query()
            ->where('submitted_by', $user->id)
            ->with([
                'department:id,name',
                'closedBy:id,name,display_name',
            ])
            ->latest('id')
            ->get()
            ->map(fn (DepartmentRequest $r) => [
                'id'         => $r->id,
                'title'      => $r->title,
                'department' => $r->department?->name,
                'room'       => $r->room,
                'status'     => $r->status,
                'note'       => $r->note,
                'created_at' => $r->created_at?->format('d.m.Y H:i'),
                'closed_by'  => $r->closedBy?->display_name ?: $r->closedBy?->name,
                'closed_at'  => $r->closed_at?->format('d.m.Y H:i'),
            ]);

        $departments = $this->requestRecipientDepartments();

        return Inertia::render('DepartmentRequests/Index', [
            'myRequests'  => $myRequests,
            'departments' => $departments,
        ]);
    }

    public function departmentsPage(Request $request): Response
    {
        $user = $request->user();
        $role = $user?->resolvedRoleSlug();
        $isAdmin = in_array($role, ['admin', 'superadmin', 'super_admin'], true);

        $recipientDepartments = DepartmentRequestDepartment::query()
            ->with('department:id,name')
            ->where('is_active', true)
            ->get()
            ->map(fn (DepartmentRequestDepartment $item): array => [
                'id' => $item->id,
                'department_id' => $item->department_id,
                'name' => $item->department?->name,
                'hint' => (string) ($item->hint ?? ''),
            ])
            ->values();

        $payload = [
            'departments' => $recipientDepartments,
            'isAdmin' => $isAdmin,
        ];

        if ($isAdmin) {
            $linkedDepartmentIds = $recipientDepartments->pluck('department_id')->all();

            $payload['availableDepartments'] = Department::query()
                ->whereNotIn('id', $linkedDepartmentIds)
                ->orderBy('name')
                ->get(['id', 'name']);

            $payload['handlers'] = DepartmentRequestHandler::query()
                ->with([
                    'department:id,name',
                    'user:id,name,email,display_name',
                ])
                ->whereIn('department_id', $recipientDepartments->pluck('department_id')->all())
                ->get()
                ->map(fn (DepartmentRequestHandler $handler): array => [
                    'id' => $handler->id,
                    'department_id' => $handler->department_id,
                    'department' => $handler->department?->name,
                    'user' => $handler->user?->display_name ?: $handler->user?->name,
                    'email' => $handler->user?->email,
                ])
                ->values();

            $payload['users'] = User::query()
                ->orderBy('name')
                ->get(['id', 'name', 'email', 'display_name'])
                ->map(fn (User $u): array => [
                    'id' => $u->id,
                    'name' => $u->display_name ?: $u->name,
                    'email' => $u->email,
                ])
                ->values();
        }

        return Inertia::render('DepartmentRequests/Departments', $payload);
    }

    public function storeRecipientDepartment(Request $request): RedirectResponse
    {
        $this->ensureAdmin($request);

        $data = $request->validate([
            'department_id' => ['required', 'integer', 'exists:departments,id'],
            'hint' => ['nullable', 'string', 'max:1000'],
        ]);

        $exists = DepartmentRequestDepartment::query()
            ->where('department_id', $data['department_id'])
            ->exists();

        if ($exists) {
            return back()->with('error', 'Этот отдел уже добавлен в список получателей заявок.');
        }

        DepartmentRequestDepartment::query()->create([
            'department_id' => $data['department_id'],
            'hint' => $data['hint'] ?? null,
            'is_active' => true,
        ]);

        return back()->with('success', 'Отдел добавлен в список получателей заявок.');
    }

    public function storeNewRecipientDepartment(Request $request): RedirectResponse
    {
        $this->ensureAdmin($request);

        $data = $request->validate([
            'department_name' => ['required', 'string', 'max:255', 'unique:departments,name'],
            'department_description' => ['nullable', 'string', 'max:2000'],
            'hint' => ['nullable', 'string', 'max:1000'],
        ]);

        $department = Department::query()->create([
            'name' => trim((string) $data['department_name']),
            'code' => null,
            'description' => $data['department_description'] ?? null,
            'faculty_id' => null,
        ]);

        DepartmentRequestDepartment::query()->create([
            'department_id' => $department->id,
            'hint' => $data['hint'] ?? null,
            'is_active' => true,
        ]);

        return back()->with('success', 'Новый отдел создан и добавлен в список получателей заявок.');
    }

    public function destroyRecipientDepartment(Request $request, DepartmentRequestDepartment $recipientDepartment): RedirectResponse
    {
        $this->ensureAdmin($request);

        DepartmentRequestHandler::query()
            ->where('department_id', $recipientDepartment->department_id)
            ->delete();

        $recipientDepartment->delete();

        return back()->with('success', 'Отдел удалён из списка получателей заявок.');
    }

    public function store(Request $request): RedirectResponse
    {
        $recipientDepartments = $this->requestRecipientDepartments();
        $allowedDepartmentIds = $recipientDepartments->pluck('id')->all();

        $data = $request->validate([
            'title'         => ['required', 'string', 'max:255'],
            'description'   => ['required', 'string', 'max:5000'],
            'room'          => ['nullable', 'string', 'max:50'],
            'department_id' => ['required', 'integer', Rule::in($allowedDepartmentIds)],
        ]);

        $selectedDepartment = $recipientDepartments->firstWhere('id', (int) $data['department_id']);
        $isCitDepartment = is_array($selectedDepartment)
            && (
                (($selectedDepartment['code'] ?? null) === 'CIT')
                || str_contains(mb_strtolower((string) ($selectedDepartment['name'] ?? '')), 'центр информационных технологий')
                || str_contains(mb_strtolower((string) ($selectedDepartment['name'] ?? '')), 'цит')
            );

        DepartmentRequest::query()->create([
            'title'         => $data['title'],
            'description'   => $data['description'],
            'room'          => $isCitDepartment ? ($data['room'] ?? null) : null,
            'department_id' => $data['department_id'],
            'submitted_by'  => $request->user()->id,
            'status'        => 'new',
        ]);

        return back()->with('success', 'Заявка успешно отправлена.');
    }

    // ─── Admin: requests list ─────────────────────────────────────────────────

    public function adminIndex(Request $request): Response
    {
        $user = $request->user();
        $role = $user?->resolvedRoleSlug();
        $isAdmin = in_array($role, ['admin', 'superadmin', 'super_admin'], true);

        // Determine which department IDs this user can see
        $allowedDeptIds = null; // null = all

        if (! $isAdmin) {
            $allowedDeptIds = DepartmentRequestHandler::query()
                ->where('user_id', $user->id)
                ->pluck('department_id')
                ->all();

            // If handler has no departments assigned, show nothing
            if (empty($allowedDeptIds)) {
                abort(403, 'Нет доступа ни к одному отделу.');
            }
        }

        $statusFilter = (string) $request->query('status', '');
        $deptFilter   = (int) $request->query('department_id', 0);
        $search       = (string) $request->query('search', '');

        $query = DepartmentRequest::query()
            ->with([
                'department:id,name',
                'submittedBy:id,name,email,display_name,first_name,last_name',
                'closedBy:id,name,display_name',
            ])
            ->when($allowedDeptIds !== null, fn ($q) => $q->whereIn('department_id', $allowedDeptIds))
            ->when($statusFilter !== '', fn ($q) => $q->where('status', $statusFilter))
            ->when($deptFilter > 0, fn ($q) => $q->where('department_id', $deptFilter))
            ->when($search !== '', fn ($q) => $q->where(function ($sq) use ($search): void {
                $sq->where('title', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            }))
            ->latest('id');

        $requests = $query->paginate(20)->withQueryString();

        // Departments available for filter (only allowed ones)
        $deptQuery = Department::query()->orderBy('name');
        if ($allowedDeptIds !== null) {
            $deptQuery->whereIn('id', $allowedDeptIds);
        }
        $departments = $deptQuery->get(['id', 'name']);

        return Inertia::render('DepartmentRequests/Admin/Index', [
            'requests'    => $requests,
            'departments' => $departments,
            'isAdmin'     => $isAdmin,
            'filters'     => [
                'status'        => $statusFilter,
                'department_id' => $deptFilter,
                'search'        => $search,
            ],
        ]);
    }

    public function updateStatus(Request $request, DepartmentRequest $departmentRequest): RedirectResponse
    {
        $user = $request->user();
        $role = $user?->resolvedRoleSlug();
        $isAdmin = in_array($role, ['admin', 'superadmin', 'super_admin'], true);

        if (! $isAdmin) {
            $isHandler = DepartmentRequestHandler::query()
                ->where('user_id', $user->id)
                ->where('department_id', $departmentRequest->department_id)
                ->exists();
            abort_unless($isHandler, 403);
        }

        $data = $request->validate([
            'status' => ['required', 'in:new,in_progress,resolved,rejected'],
            'note'   => ['nullable', 'string', 'max:2000'],
        ]);

        $updateData = ['status' => $data['status']];

        if (array_key_exists('note', $data)) {
            $updateData['note'] = $data['note'];
        }

        if (in_array($data['status'], ['resolved', 'rejected'], true)) {
            $updateData['closed_by'] = $user->id;
            $updateData['closed_at'] = now();
        }

        $departmentRequest->update($updateData);

        return back()->with('success', 'Статус заявки обновлён.');
    }

    // ─── Admin: handlers management ───────────────────────────────────────────

    public function storeHandler(Request $request): RedirectResponse
    {
        $this->ensureAdmin($request);

        $allowedDepartmentIds = DepartmentRequestDepartment::query()
            ->where('is_active', true)
            ->pluck('department_id')
            ->all();

        $data = $request->validate([
            'department_id' => ['required', 'integer', Rule::in($allowedDepartmentIds)],
            'user_id'       => ['required', 'integer', 'exists:users,id'],
        ]);

        $exists = DepartmentRequestHandler::query()
            ->where('department_id', $data['department_id'])
            ->where('user_id', $data['user_id'])
            ->exists();

        if ($exists) {
            return back()->with('error', 'Этот сотрудник уже назначен на данный отдел.');
        }

        DepartmentRequestHandler::query()->create($data);

        return back()->with('success', 'Ответственный назначен.');
    }

    public function destroyHandler(Request $request, DepartmentRequestHandler $handler): RedirectResponse
    {
        $this->ensureAdmin($request);

        $handler->delete();

        return back()->with('success', 'Назначение удалено.');
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private function ensureAdmin(Request $request): void
    {
        $role = $request->user()?->resolvedRoleSlug();
        abort_unless(in_array($role, ['admin', 'superadmin', 'super_admin'], true), 403);
    }

    private function requestRecipientDepartments()
    {
        return DepartmentRequestDepartment::query()
            ->with('department:id,name')
            ->where('is_active', true)
            ->get()
            ->map(fn (DepartmentRequestDepartment $item): array => [
                'id' => $item->department_id,
                'name' => $item->department?->name,
                'code' => $item->department?->code,
            ])
            ->values();
    }
}
