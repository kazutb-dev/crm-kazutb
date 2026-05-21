<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\UserActivitySnapshot;
use App\Support\AdminEventCatalog;
use Illuminate\Support\Collection;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Activitylog\Models\Activity;

class AdminMonitoringController extends Controller
{
    public function index(Request $request): Response
    {
        $this->abortUnlessAdmin($request);

        $onlineWindowMinutes = 5;
        $recentWindowMinutes = 30;
        $eventsWindowHours = 24;

        $recentUsers = UserActivitySnapshot::query()
            ->with(['user:id,name,email,role,display_name,ad_department,ad_title'])
            ->where('last_seen_at', '>=', now()->subMinutes($recentWindowMinutes))
            ->orderByDesc('last_seen_at')
            ->limit(30)
            ->get()
            ->map(static function (UserActivitySnapshot $snapshot) use ($onlineWindowMinutes): array {
                $user = $snapshot->user;
                $isOnline = $snapshot->last_seen_at !== null
                    && $snapshot->last_seen_at->greaterThanOrEqualTo(now()->subMinutes($onlineWindowMinutes));

                return [
                    'user_id' => $snapshot->user_id,
                    'name' => $user?->display_name ?: $user?->name ?: 'Неизвестно',
                    'email' => $user?->email,
                    'role' => $user?->resolvedRoleSlug(),
                    'role_label' => AdminEventCatalog::subjectLabel($user?->role),
                    'last_seen_at' => $snapshot->last_seen_at?->toIso8601String(),
                    'last_ip_address' => $snapshot->last_ip_address,
                    'last_route_name' => $snapshot->last_route_name,
                    'last_path' => $snapshot->last_path,
                    'last_user_agent' => $snapshot->last_user_agent,
                    'status' => $isOnline ? 'online' : 'recent',
                ];
            })
            ->values();

        $recentAuditLogs = AuditLog::query()
            ->with('user:id,name,email')
            ->latest('id')
            ->limit(20)
            ->get()
            ->map(static fn (AuditLog $log): array => [
                'id' => 'audit-' . $log->id,
                'source' => 'audit',
                'created_at' => $log->created_at?->toIso8601String(),
                'user_name' => $log->actor_name ?: $log->user?->name ?: 'Неизвестно',
                'user_email' => $log->actor_email ?: $log->user?->email,
                'event_type' => $log->event_type,
                'event_label' => AdminEventCatalog::eventLabel($log->event_type),
                'module' => AdminEventCatalog::eventModule($log->event_type),
                'module_label' => AdminEventCatalog::eventModuleLabel($log->event_type),
                'severity' => AdminEventCatalog::eventSeverity($log->event_type),
                'severity_label' => AdminEventCatalog::eventSeverityLabel($log->event_type),
                'subject_type' => $log->subject_type,
                'subject_label' => $log->subject_label,
                'subject_name' => AdminEventCatalog::subjectLabel($log->subject_type),
                'description' => $log->description,
                'ip_address' => $log->ip_address,
                'path' => data_get($log->metadata, 'path'),
                'route' => data_get($log->metadata, 'route'),
                'method' => data_get($log->metadata, 'method'),
                'details' => $log->metadata ?? [],
            ])
            ->values();

        $recentActivityLogs = Activity::query()
            ->with('causer:id,name,email')
            ->latest('id')
            ->limit(20)
            ->get()
            ->map(static function (Activity $activity): array {
                $properties = $activity->properties?->toArray() ?? [];

                return [
                    'id' => 'activity-' . $activity->id,
                    'source' => 'activity',
                    'created_at' => $activity->created_at?->toIso8601String(),
                    'causer_name' => $activity->causer?->name ?: 'Система',
                    'causer_email' => $activity->causer?->email,
                    'log_name' => $activity->log_name,
                    'event' => $activity->event,
                    'event_label' => AdminEventCatalog::eventLabel($activity->event),
                    'module' => AdminEventCatalog::eventModule($activity->event),
                    'module_label' => AdminEventCatalog::eventModuleLabel($activity->event),
                    'severity' => AdminEventCatalog::eventSeverity($activity->event),
                    'severity_label' => AdminEventCatalog::eventSeverityLabel($activity->event),
                    'description' => $activity->description,
                    'subject_type' => $activity->subject_type,
                    'subject_name' => AdminEventCatalog::subjectLabel($activity->subject_type),
                    'subject_id' => $activity->subject_id,
                    'ip_address' => data_get($properties, 'ip'),
                    'path' => data_get($properties, 'path'),
                    'route' => data_get($properties, 'route'),
                    'method' => data_get($properties, 'method'),
                    'properties' => $properties,
                ];
            })
            ->values();

        $eventsFeed = $recentAuditLogs
            ->map(static fn (array $row): array => [
                'id' => $row['id'],
                'source' => $row['source'],
                'created_at' => $row['created_at'],
                'actor_name' => $row['user_name'],
                'actor_email' => $row['user_email'],
                'event_key' => $row['event_type'],
                'event_label' => $row['event_label'],
                'module' => $row['module'],
                'module_label' => $row['module_label'],
                'severity' => $row['severity'],
                'severity_label' => $row['severity_label'],
                'subject_name' => $row['subject_name'],
                'subject_label' => $row['subject_label'],
                'description' => $row['description'],
                'ip_address' => $row['ip_address'],
                'path' => $row['path'],
            ])
            ->concat(
                $recentActivityLogs->map(static fn (array $row): array => [
                    'id' => $row['id'],
                    'source' => $row['source'],
                    'created_at' => $row['created_at'],
                    'actor_name' => $row['causer_name'],
                    'actor_email' => $row['causer_email'],
                    'event_key' => $row['event'],
                    'event_label' => $row['event_label'],
                    'module' => $row['module'],
                    'module_label' => $row['module_label'],
                    'severity' => $row['severity'],
                    'severity_label' => $row['severity_label'],
                    'subject_name' => $row['subject_name'],
                    'subject_label' => $row['subject_id'] ? ('#' . $row['subject_id']) : null,
                    'description' => $row['description'],
                    'ip_address' => $row['ip_address'],
                    'path' => $row['path'],
                ])
            )
            ->sortByDesc(static fn (array $row): int => strtotime((string) ($row['created_at'] ?? '1970-01-01 00:00:00')))
            ->values()
            ->take(25)
            ->values();

        $activeUsersRanking = UserActivitySnapshot::query()
            ->selectRaw('user_id, COUNT(*) as score')
            ->where('last_seen_at', '>=', now()->subHours(6))
            ->groupBy('user_id')
            ->orderByDesc('score')
            ->limit(10)
            ->get();

        $rankingUsers = $activeUsersRanking->pluck('user_id')->values();
        $rankingProfiles = \App\Models\User::query()
            ->whereIn('id', $rankingUsers)
            ->get(['id', 'name', 'display_name', 'email'])
            ->keyBy('id');

        $topUsers = $activeUsersRanking->map(static function ($row) use ($rankingProfiles): array {
            $profile = $rankingProfiles->get($row->user_id);

            return [
                'user_id' => (int) $row->user_id,
                'name' => $profile?->display_name ?: $profile?->name ?: 'Неизвестно',
                'email' => $profile?->email,
                'score' => (int) ($row->score ?? 0),
            ];
        })->values();

        $eventsByType = Activity::query()
            ->selectRaw('event, COUNT(*) as total')
            ->where('created_at', '>=', now()->subHours($eventsWindowHours))
            ->groupBy('event')
            ->orderByDesc('total')
            ->limit(10)
            ->get()
            ->map(static fn ($row): array => [
                'event' => $row->event,
                'label' => AdminEventCatalog::eventLabel($row->event),
                'total' => (int) $row->total,
            ])
            ->values();

        $ipHotspots = $eventsFeed
            ->filter(static fn (array $row): bool => (string) ($row['ip_address'] ?? '') !== '')
            ->groupBy(static fn (array $row): string => (string) $row['ip_address'])
            ->map(static fn (Collection $rows, string $ip): array => [
                'ip' => $ip,
                'events' => $rows->count(),
            ])
            ->sortByDesc('events')
            ->values()
            ->take(10)
            ->values();

        $eventsByModule = $eventsFeed
            ->groupBy(static fn (array $row): string => (string) ($row['module'] ?? 'system'))
            ->map(static fn (Collection $rows, string $module): array => [
                'module' => $module,
                'module_label' => AdminEventCatalog::moduleLabel($module),
                'count' => $rows->count(),
            ])
            ->sortByDesc('count')
            ->values();

        $topRoutes = UserActivitySnapshot::query()
            ->selectRaw('last_route_name, COUNT(*) as cnt')
            ->where('last_seen_at', '>=', now()->subHours($eventsWindowHours))
            ->whereNotNull('last_route_name')
            ->groupBy('last_route_name')
            ->orderByDesc('cnt')
            ->limit(8)
            ->get()
            ->map(static fn ($row): array => [
                'route' => $row->last_route_name,
                'count' => (int) $row->cnt,
            ])
            ->values();

        return Inertia::render('Admin/Monitoring', [
            'summary' => [
                'online_users' => UserActivitySnapshot::query()
                    ->where('last_seen_at', '>=', now()->subMinutes($onlineWindowMinutes))
                    ->count(),
                'recent_users' => UserActivitySnapshot::query()
                    ->where('last_seen_at', '>=', now()->subMinutes($recentWindowMinutes))
                    ->count(),
                'audit_today' => AuditLog::query()->whereDate('created_at', today())->count(),
                'activity_today' => Activity::query()->whereDate('created_at', today())->count(),
                'events_24h' => Activity::query()->where('created_at', '>=', now()->subHours($eventsWindowHours))->count(),
            ],
            'windows' => [
                'online_minutes' => $onlineWindowMinutes,
                'recent_minutes' => $recentWindowMinutes,
                'events_hours' => $eventsWindowHours,
            ],
            'links' => [
                'pulse' => url('/' . ltrim((string) config('pulse.path', 'pulse'), '/')),
                'telescope' => app()->environment('production') ? null : url('/telescope'),
                'audit' => route('admin.audit-logs.index'),
            ],
            'recentUsers' => $recentUsers,
            'recentAuditLogs' => $recentAuditLogs,
            'recentActivityLogs' => $recentActivityLogs,
            'eventsFeed' => $eventsFeed,
            'topUsers' => $topUsers,
            'eventsByType' => $eventsByType,
            'eventsByModule' => $eventsByModule,
            'topRoutes' => $topRoutes,
            'ipHotspots' => $ipHotspots,
        ]);
    }

    private function abortUnlessAdmin(Request $request): void
    {
        abort_unless(in_array($request->user()?->resolvedRoleSlug(), ['admin', 'superadmin'], true), 403);
    }
}