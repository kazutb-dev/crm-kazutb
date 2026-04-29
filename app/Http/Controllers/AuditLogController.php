<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AuditLogController extends Controller
{
    public function index(Request $request): Response
    {
        $this->abortUnlessCanView($request);

        $eventType = trim((string) $request->query('event_type', ''));
        $subjectType = trim((string) $request->query('subject_type', ''));
        $search = trim((string) $request->query('search', ''));

        $query = AuditLog::query()
            ->with('user:id,name,email')
            ->latest('id');

        if ($eventType !== '') {
            $query->where('event_type', $eventType);
        }

        if ($subjectType !== '') {
            $query->where('subject_type', $subjectType);
        }

        if ($search !== '') {
            $query->where(function ($builder) use ($search): void {
                $builder
                    ->where('actor_name', 'like', "%{$search}%")
                    ->orWhere('actor_email', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%")
                    ->orWhere('subject_label', 'like', "%{$search}%");
            });
        }

        $logs = $query
            ->paginate(30)
            ->withQueryString();

        return Inertia::render('Admin/AuditLogs', [
            'logs' => $logs,
            'filters' => [
                'event_type' => $eventType !== '' ? $eventType : null,
                'subject_type' => $subjectType !== '' ? $subjectType : null,
                'search' => $search !== '' ? $search : null,
            ],
            'options' => [
                'eventTypes' => ['login', 'created'],
                'subjectTypes' => AuditLog::query()
                    ->select('subject_type')
                    ->whereNotNull('subject_type')
                    ->distinct()
                    ->orderBy('subject_type')
                    ->pluck('subject_type')
                    ->values(),
            ],
        ]);
    }

    private function abortUnlessCanView(Request $request): void
    {
        $role = $request->user()?->resolvedRoleSlug();

        if (!in_array($role, ['admin', 'superadmin'], true)) {
            abort(403);
        }
    }
}