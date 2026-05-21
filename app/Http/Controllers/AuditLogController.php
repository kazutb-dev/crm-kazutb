<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Support\AdminEventCatalog;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Activitylog\Models\Activity;

class AuditLogController extends Controller
{
    public function index(Request $request): Response
    {
        $this->abortUnlessCanView($request);

        $eventType = trim((string) $request->query('event_type', ''));
        $subjectType = trim((string) $request->query('subject_type', ''));
        $search = trim((string) $request->query('search', ''));
        $source = trim((string) $request->query('source', 'all'));
        $source = in_array($source, ['all', 'audit', 'activity'], true) ? $source : 'all';
        $module = trim((string) $request->query('module', ''));
        $severity = trim((string) $request->query('severity', ''));
        $perPage = 30;
        $page = max(1, (int) $request->query('page', 1));

        $customLogs = AuditLog::query()
            ->with('user:id,name,email')
            ->latest('id')
            ->limit(500)
            ->get();

        $activityLogs = Activity::query()
            ->with('causer:id,name,email')
            ->latest('id')
            ->limit(500)
            ->get();

        $records = collect();

        if ($source !== 'activity') {
            $records = $records->concat(
                $customLogs->map(static function (AuditLog $log): array {
                    $subjectType = $log->subject_type;
                    $eventType = $log->event_type;

                    return [
                        'id' => 'audit-' . $log->id,
                        'source' => 'audit',
                        'source_label' => 'Аудит CRM',
                        'created_at' => $log->created_at?->toIso8601String(),
                        'actor_name' => $log->actor_name ?: $log->user?->name ?: 'Неизвестно',
                        'actor_email' => $log->actor_email ?: $log->user?->email,
                        'event_key' => $eventType,
                        'event_label' => AdminEventCatalog::eventLabel($eventType),
                        'module' => AdminEventCatalog::eventModule($eventType),
                        'module_label' => AdminEventCatalog::eventModuleLabel($eventType),
                        'severity' => AdminEventCatalog::eventSeverity($eventType),
                        'severity_label' => AdminEventCatalog::eventSeverityLabel($eventType),
                        'subject_type' => $subjectType,
                        'subject_label' => $log->subject_label,
                        'subject_name' => AdminEventCatalog::subjectLabel($subjectType),
                        'description' => $log->description,
                        'ip_address' => $log->ip_address,
                        'path' => data_get($log->metadata, 'path'),
                        'route' => data_get($log->metadata, 'route'),
                        'method' => data_get($log->metadata, 'method'),
                        'details' => $log->metadata ?? [],
                    ];
                })
            );
        }

        if ($source !== 'audit') {
            $records = $records->concat(
                $activityLogs->map(static function (Activity $activity): array {
                    $subjectType = $activity->subject_type;
                    $eventType = (string) ($activity->event ?? 'unknown');
                    $properties = $activity->properties?->toArray() ?? [];

                    return [
                        'id' => 'activity-' . $activity->id,
                        'source' => 'activity',
                        'source_label' => 'Активность',
                        'created_at' => $activity->created_at?->toIso8601String(),
                        'actor_name' => $activity->causer?->name ?: 'Система',
                        'actor_email' => $activity->causer?->email,
                        'event_key' => $eventType,
                        'event_label' => AdminEventCatalog::eventLabel($eventType),
                        'module' => AdminEventCatalog::eventModule($eventType),
                        'module_label' => AdminEventCatalog::eventModuleLabel($eventType),
                        'severity' => AdminEventCatalog::eventSeverity($eventType),
                        'severity_label' => AdminEventCatalog::eventSeverityLabel($eventType),
                        'subject_type' => $subjectType,
                        'subject_label' => $subjectType && $activity->subject_id ? ('#' . $activity->subject_id) : null,
                        'subject_name' => AdminEventCatalog::subjectLabel($subjectType),
                        'description' => $activity->description,
                        'ip_address' => data_get($properties, 'ip'),
                        'path' => data_get($properties, 'path'),
                        'route' => data_get($properties, 'route'),
                        'method' => data_get($properties, 'method'),
                        'details' => $properties,
                    ];
                })
            );
        }

        $records = $records
            ->when($eventType !== '', static fn (Collection $items): Collection =>
                $items->filter(static fn (array $row): bool => $row['event_key'] === $eventType)
            )
            ->when($subjectType !== '', static fn (Collection $items): Collection =>
                $items->filter(static fn (array $row): bool => (string) ($row['subject_type'] ?? '') === $subjectType)
            )
            ->when($module !== '', static fn (Collection $items): Collection =>
                $items->filter(static fn (array $row): bool => (string) ($row['module'] ?? '') === $module)
            )
            ->when($severity !== '', static fn (Collection $items): Collection =>
                $items->filter(static fn (array $row): bool => (string) ($row['severity'] ?? '') === $severity)
            )
            ->when($search !== '', static function (Collection $items) use ($search): Collection {
                $needle = mb_strtolower($search);

                return $items->filter(static function (array $row) use ($needle): bool {
                    $haystack = mb_strtolower(implode(' ', array_filter([
                        (string) ($row['actor_name'] ?? ''),
                        (string) ($row['actor_email'] ?? ''),
                        (string) ($row['event_label'] ?? ''),
                        (string) ($row['module_label'] ?? ''),
                        (string) ($row['subject_name'] ?? ''),
                        (string) ($row['subject_label'] ?? ''),
                        (string) ($row['description'] ?? ''),
                        (string) ($row['ip_address'] ?? ''),
                        (string) ($row['path'] ?? ''),
                    ])));

                    return str_contains($haystack, $needle);
                });
            })
            ->sortByDesc(static fn (array $row): int => strtotime((string) ($row['created_at'] ?? '1970-01-01 00:00:00')))
            ->values();

        $slice = $records->forPage($page, $perPage)->values();

        $logs = new LengthAwarePaginator(
            $slice,
            $records->count(),
            $perPage,
            $page,
            ['path' => $request->url(), 'query' => $request->query()]
        );
        $logs->withQueryString();

        $subjectTypes = $records
            ->map(static fn (array $row): string => (string) ($row['subject_type'] ?? ''))
            ->filter(static fn (string $value): bool => $value !== '')
            ->unique()
            ->sort()
            ->values()
            ->map(static fn (string $key): array => [
                'key' => $key,
                'label' => AdminEventCatalog::subjectLabel($key),
            ])
            ->values();

        $eventTypes = $records
            ->map(static fn (array $row): string => (string) ($row['event_key'] ?? ''))
            ->filter(static fn (string $value): bool => $value !== '')
            ->unique()
            ->sort()
            ->values()
            ->map(static fn (string $key): array => [
                'key' => $key,
                'label' => AdminEventCatalog::eventLabel($key),
            ])
            ->values();

        $modules = collect(AdminEventCatalog::allModules())
            ->map(static fn (string $label, string $key): array => ['key' => $key, 'label' => $label])
            ->values();

        $severities = collect(AdminEventCatalog::allSeverities())
            ->map(static fn (string $label, string $key): array => ['key' => $key, 'label' => $label])
            ->values();

        $summary = [
            'total' => $records->count(),
            'audit_count' => $records->where('source', 'audit')->count(),
            'activity_count' => $records->where('source', 'activity')->count(),
            'today_count' => $records->filter(static function (array $row): bool {
                $value = (string) ($row['created_at'] ?? '');

                return $value !== '' && str_starts_with($value, now()->format('Y-m-d'));
            })->count(),
        ];

        return Inertia::render('Admin/AuditLogs', [
            'logs' => $logs,
            'summary' => $summary,
            'filters' => [
                'event_type' => $eventType !== '' ? $eventType : null,
                'subject_type' => $subjectType !== '' ? $subjectType : null,
                'search' => $search !== '' ? $search : null,
                'source' => $source,
                'module' => $module !== '' ? $module : null,
                'severity' => $severity !== '' ? $severity : null,
            ],
            'options' => [
                'sources' => ['all', 'audit', 'activity'],
                'eventTypes' => $eventTypes,
                'subjectTypes' => $subjectTypes,
                'modules' => $modules,
                'severities' => $severities,
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