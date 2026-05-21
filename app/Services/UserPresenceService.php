<?php

namespace App\Services;

use App\Models\User;
use App\Models\UserActivitySnapshot;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class UserPresenceService
{
    public function record(User $user, Request $request, bool $force = false): void
    {
        if (! Schema::hasTable('user_activity_snapshots')) {
            return;
        }

        $cacheKey = 'user-presence:last-write:' . $user->id;
        if (! $force && ! Cache::add($cacheKey, now()->timestamp, now()->addMinutes(2))) {
            return;
        }

        UserActivitySnapshot::query()->updateOrCreate(
            ['user_id' => $user->id],
            [
                'last_seen_at' => now(),
                'last_ip_address' => $request->ip(),
                'last_route_name' => $request->route()?->getName(),
                'last_path' => $request->path(),
                'last_user_agent' => $this->summarizeUserAgent($request->userAgent()),
                'last_activity_source' => $force ? 'login' : 'request',
            ],
        );
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