<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class BusinessActivityLogger
{
    /**
     * @param array<string, mixed> $properties
     */
    public function log(
        string $event,
        string $description,
        ?Model $subject = null,
        array $properties = [],
        ?User $causer = null,
        ?Request $request = null,
        string $logName = 'crm'
    ): void {
        if (! Schema::hasTable(config('activitylog.table_name', 'activity_log'))) {
            return;
        }

        $request ??= request();
        $causer ??= $request?->user();

        $baseProperties = array_filter([
            'ip' => $request?->ip(),
            'method' => $request?->method(),
            'path' => $request?->path(),
            'route' => $request?->route()?->getName(),
            'user_agent' => $this->summarizeUserAgent($request?->userAgent()),
        ], static fn ($value): bool => $value !== null && $value !== '');

        $payload = array_filter(
            array_merge($baseProperties, $properties),
            static fn ($value): bool => $value !== null && $value !== ''
        );

        $activity = activity($logName)
            ->event($event)
            ->withProperties($payload);

        if ($subject !== null) {
            $activity->performedOn($subject);
        }

        if ($causer !== null) {
            $activity->causedBy($causer);
        }

        $activity->log($description);
    }

    private function summarizeUserAgent(?string $userAgent): ?string
    {
        if (! is_string($userAgent) || trim($userAgent) === '') {
            return null;
        }

        $normalized = preg_replace('/\s+/', ' ', trim($userAgent)) ?: trim($userAgent);

        return Str::limit($normalized, 180);
    }
}