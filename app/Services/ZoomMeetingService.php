<?php

namespace App\Services;

use Carbon\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class ZoomMeetingService
{
    private ?string $lastError = null;

    public function createMeeting(string $topic, Carbon $startsAt, Carbon $endsAt, ?string $agenda = null): ?array
    {
        $this->lastError = null;

        if (! config('services.zoom.enabled', false)) {
            $this->lastError = 'Zoom интеграция отключена. Установите ZOOM_ENABLED=true.';
            return null;
        }

        $accountId = (string) config('services.zoom.account_id', '');
        $clientId = (string) config('services.zoom.client_id', '');
        $clientSecret = (string) config('services.zoom.client_secret', '');
        $userId = (string) config('services.zoom.user_id', 'me');
        $oauthBaseUrl = rtrim((string) config('services.zoom.oauth_base_url', 'https://zoom.us'), '/');
        $apiBaseUrl = rtrim((string) config('services.zoom.base_url', 'https://api.zoom.us'), '/');

        if ($accountId === '' || $clientId === '' || $clientSecret === '') {
            $this->lastError = 'Не заполнены Zoom credentials (account_id/client_id/client_secret).';
            return null;
        }

        try {
            $tokenResponse = Http::asForm()
                ->withBasicAuth($clientId, $clientSecret)
                ->timeout(12)
                ->post($oauthBaseUrl.'/oauth/token?'.http_build_query([
                    'grant_type' => 'account_credentials',
                    'account_id' => $accountId,
                ]));

            if (! $tokenResponse->successful()) {
                $errorPayload = $tokenResponse->json();
                $reason = (string) ($errorPayload['reason'] ?? '');
                $error = (string) ($errorPayload['error'] ?? '');
                $details = trim($reason.' '.$error);

                $this->lastError = 'Не удалось получить Zoom access token.'
                    . ($details !== '' ? (' Причина: '.$details) : '');
                Log::warning('[Zoom] token request failed', [
                    'status' => $tokenResponse->status(),
                    'response' => $tokenResponse->body(),
                ]);
                return null;
            }

            $accessToken = (string) ($tokenResponse->json()['access_token'] ?? '');
            if ($accessToken === '') {
                $this->lastError = 'Zoom access token пустой.';
                return null;
            }

            $duration = max(15, min(720, (int) ceil($startsAt->diffInMinutes($endsAt))));

            $meetingResponse = Http::withToken($accessToken)
                ->timeout(15)
                ->post($apiBaseUrl.'/v2/users/'.$userId.'/meetings', [
                    'topic' => $topic,
                    'type' => 2,
                    'start_time' => $startsAt->copy()->utc()->format('Y-m-d\TH:i:s\Z'),
                    'duration' => $duration,
                    'timezone' => config('app.timezone', 'Asia/Almaty'),
                    'agenda' => $agenda,
                    'settings' => [
                        'join_before_host' => true,
                        'waiting_room' => false,
                        'participant_video' => true,
                        'host_video' => true,
                    ],
                ]);

            if (! $meetingResponse->successful()) {
                $errorPayload = $meetingResponse->json();
                $message = (string) ($errorPayload['message'] ?? '');
                $code = (string) ($errorPayload['code'] ?? '');
                $details = trim(($code !== '' ? ('code '.$code.': ') : '').$message);

                $this->lastError = 'Не удалось создать Zoom конференцию.'
                    . ($details !== '' ? (' Причина: '.$details) : '');
                Log::warning('[Zoom] create meeting failed', [
                    'status' => $meetingResponse->status(),
                    'response' => $meetingResponse->body(),
                ]);
                return null;
            }

            $payload = $meetingResponse->json();

            return [
                'meeting_id' => (string) ($payload['id'] ?? ''),
                'join_url' => (string) ($payload['join_url'] ?? ''),
                'start_url' => (string) ($payload['start_url'] ?? ''),
                'password' => (string) ($payload['password'] ?? ''),
            ];
        } catch (Throwable $e) {
            $this->lastError = 'Ошибка связи с Zoom API: '.$e->getMessage();
            Log::warning('[Zoom] create meeting exception', [
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    public function cancelMeeting(string $meetingId): bool
    {
        $this->lastError = null;

        if ($meetingId === '') {
            $this->lastError = 'Zoom meeting id пустой.';
            return false;
        }

        if (! config('services.zoom.enabled', false)) {
            $this->lastError = 'Zoom интеграция отключена. Установите ZOOM_ENABLED=true.';
            return false;
        }

        $accessToken = $this->accessToken();
        if ($accessToken === null) {
            return false;
        }

        $apiBaseUrl = rtrim((string) config('services.zoom.base_url', 'https://api.zoom.us'), '/');

        try {
            $response = Http::withToken($accessToken)
                ->timeout(15)
                ->delete($apiBaseUrl.'/v2/meetings/'.rawurlencode($meetingId));

            if ($response->successful() || $response->status() === 204 || $response->status() === 404) {
                return true;
            }

            $this->lastError = 'Не удалось отменить Zoom конференцию.';
            Log::warning('[Zoom] cancel meeting failed', [
                'meeting_id' => $meetingId,
                'status' => $response->status(),
                'response' => $response->body(),
            ]);

            return false;
        } catch (Throwable $e) {
            $this->lastError = 'Ошибка связи с Zoom API: '.$e->getMessage();
            Log::warning('[Zoom] cancel meeting exception', [
                'meeting_id' => $meetingId,
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }

    public function updateMeeting(string $meetingId, string $topic, Carbon $startsAt, Carbon $endsAt, ?string $agenda = null): bool
    {
        $this->lastError = null;

        if ($meetingId === '') {
            $this->lastError = 'Zoom meeting id пустой.';
            return false;
        }

        if (! config('services.zoom.enabled', false)) {
            $this->lastError = 'Zoom интеграция отключена. Установите ZOOM_ENABLED=true.';
            return false;
        }

        $accessToken = $this->accessToken();
        if ($accessToken === null) {
            return false;
        }

        $apiBaseUrl = rtrim((string) config('services.zoom.base_url', 'https://api.zoom.us'), '/');
        $duration = max(15, min(720, (int) ceil($startsAt->diffInMinutes($endsAt))));

        try {
            $response = Http::withToken($accessToken)
                ->timeout(15)
                ->patch($apiBaseUrl.'/v2/meetings/'.rawurlencode($meetingId), [
                    'topic' => $topic,
                    'start_time' => $startsAt->copy()->utc()->format('Y-m-d\TH:i:s\Z'),
                    'duration' => $duration,
                    'timezone' => config('app.timezone', 'Asia/Almaty'),
                    'agenda' => $agenda,
                ]);

            if ($response->successful() || $response->status() === 204) {
                return true;
            }

            $this->lastError = 'Не удалось обновить Zoom конференцию.';
            Log::warning('[Zoom] update meeting failed', [
                'meeting_id' => $meetingId,
                'status' => $response->status(),
                'response' => $response->body(),
            ]);

            return false;
        } catch (Throwable $e) {
            $this->lastError = 'Ошибка связи с Zoom API: '.$e->getMessage();
            Log::warning('[Zoom] update meeting exception', [
                'meeting_id' => $meetingId,
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }

    public function getLastError(): ?string
    {
        return $this->lastError;
    }

    private function accessToken(): ?string
    {
        $accountId = (string) config('services.zoom.account_id', '');
        $clientId = (string) config('services.zoom.client_id', '');
        $clientSecret = (string) config('services.zoom.client_secret', '');
        $oauthBaseUrl = rtrim((string) config('services.zoom.oauth_base_url', 'https://zoom.us'), '/');

        if ($accountId === '' || $clientId === '' || $clientSecret === '') {
            $this->lastError = 'Не заполнены Zoom credentials (account_id/client_id/client_secret).';
            return null;
        }

        $tokenResponse = Http::asForm()
            ->withBasicAuth($clientId, $clientSecret)
            ->timeout(12)
            ->post($oauthBaseUrl.'/oauth/token?'.http_build_query([
                'grant_type' => 'account_credentials',
                'account_id' => $accountId,
            ]));

        if (! $tokenResponse->successful()) {
            $this->lastError = 'Не удалось получить Zoom access token.';
            Log::warning('[Zoom] token request failed', [
                'status' => $tokenResponse->status(),
                'response' => $tokenResponse->body(),
            ]);
            return null;
        }

        $accessToken = (string) ($tokenResponse->json()['access_token'] ?? '');
        if ($accessToken === '') {
            $this->lastError = 'Zoom access token пустой.';
            return null;
        }

        return $accessToken;
    }
}
