<?php

namespace App\Services;

use App\Models\CalendarNotificationLog;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class GreenApiWhatsAppNotifier
{
    public function sendMessageToUser(User $user, string $message, array $context = []): bool
    {
        Log::info('[GreenAPI] sendMessageToUser called', ['user_id' => $user->id, 'user_name' => $user->name]);

        return $this->sendMessageToPhone((string) ($user->phone ?? ''), $message, [
            'user_id' => $user->id,
            'user_name' => $user->name,
            'notification_user_id' => $user->id,
            ...$context,
        ]);
    }

    public function sendMessageToPhone(string $phone, string $message, array $context = []): bool
    {
        if (! config('services.green_api.enabled')) {
            Log::info('[GreenAPI] disabled via GREEN_API_ENABLED=false');
            $this->writeNotificationLog($context, 'failed', ['message' => $message], 'Green API disabled');
            return false;
        }

        $instanceId = (string) config('services.green_api.instance_id', '');
        $token = (string) config('services.green_api.api_token_instance', '');

        if ($instanceId === '' || $token === '') {
            Log::warning('[GreenAPI] missing credentials', [
                'instance_id_empty' => $instanceId === '',
                'token_empty' => $token === '',
            ] + $context);
            $this->writeNotificationLog($context, 'failed', ['message' => $message], 'Green API credentials missing');
            return false;
        }

        $chatId = $this->resolveChatIdFromPhone($phone);

        if ($chatId === null) {
            Log::warning('[GreenAPI] could not resolve chatId for phone', [
                'phone' => $phone,
            ] + $context);
            $this->writeNotificationLog($context, 'failed', ['message' => $message, 'phone' => $phone], 'Could not resolve WhatsApp chat ID');
            return false;
        }

        $baseUrl = rtrim((string) config('services.green_api.base_url', 'https://api.green-api.com'), '/');
        $url = "{$baseUrl}/waInstance{$instanceId}/sendMessage/{$token}";

        Log::info('[GreenAPI] sending message', [
            'chat_id' => $chatId,
            'url' => $baseUrl.'/waInstance'.$instanceId.'/sendMessage/***',
        ] + $context);

        try {
            $response = Http::timeout(10)->post($url, [
                'chatId' => $chatId,
                'message' => $message,
            ]);

            if ($response->successful()) {
                Log::info('[GreenAPI] message sent successfully', [
                    'chat_id' => $chatId,
                    'response' => $response->json(),
                ] + $context);
                $this->writeNotificationLog($context, 'sent', [
                    'message' => $message,
                    'chat_id' => $chatId,
                    'response' => $response->json(),
                ]);
                return true;
            }

            Log::warning('[GreenAPI] sendMessage failed', [
                'chat_id' => $chatId,
                'status' => $response->status(),
                'response' => $response->body(),
            ] + $context);
            $this->writeNotificationLog($context, 'failed', [
                'message' => $message,
                'chat_id' => $chatId,
                'status' => $response->status(),
            ], $response->body());

            return false;
        } catch (Throwable $e) {
            Log::warning('[GreenAPI] sendMessage exception', [
                'error' => $e->getMessage(),
            ] + $context);
            $this->writeNotificationLog($context, 'failed', ['message' => $message], $e->getMessage());

            return false;
        }
    }

    private function writeNotificationLog(array $context, string $status, array $payload = [], ?string $error = null): void
    {
        $eventId = $context['notification_event_id'] ?? $context['event_id'] ?? null;
        $userId = $context['notification_user_id'] ?? $context['user_id'] ?? null;
        $type = $context['notification_type'] ?? 'new_request';

        if (!$eventId || !$userId) {
            return;
        }

        try {
            CalendarNotificationLog::create([
                'event_id' => (int) $eventId,
                'user_id' => (int) $userId,
                'channel' => 'whatsapp',
                'type' => $type,
                'status' => $status,
                'sent_at' => $status === 'sent' ? now() : null,
                'payload' => $payload + ['context' => $context],
                'error' => $error,
            ]);
        } catch (Throwable $e) {
            report($e);
        }
    }

    public function verifyWhatsAppPhone(string $phone, array $context = []): bool
    {
        if (! config('services.green_api.enabled')) {
            Log::info('[GreenAPI] disabled via GREEN_API_ENABLED=false');
            return false;
        }

        $instanceId = (string) config('services.green_api.instance_id', '');
        $token = (string) config('services.green_api.api_token_instance', '');

        if ($instanceId === '' || $token === '') {
            Log::warning('[GreenAPI] missing credentials', [
                'instance_id_empty' => $instanceId === '',
                'token_empty' => $token === '',
            ] + $context);
            return false;
        }

        $phoneNumber = $this->extractDigits($phone);

        if ($phoneNumber === '') {
            Log::warning('[GreenAPI] invalid phone for checkWhatsapp', [
                'phone' => $phone,
            ] + $context);
            return false;
        }

        $baseUrl = rtrim((string) config('services.green_api.base_url', 'https://api.green-api.com'), '/');
        $url = "{$baseUrl}/waInstance{$instanceId}/checkWhatsapp/{$token}";

        try {
            $response = Http::timeout(10)->post($url, [
                'phoneNumber' => $phoneNumber,
            ]);

            if (! $response->successful()) {
                Log::warning('[GreenAPI] checkWhatsapp failed', [
                    'status' => $response->status(),
                    'response' => $response->body(),
                ] + $context);
                return false;
            }

            $data = $response->json();
            $exists = (bool) ($data['existsWhatsapp'] ?? false);

            if (! $exists) {
                Log::warning('[GreenAPI] phone is not registered in WhatsApp', [
                    'phone_number' => $phoneNumber,
                    'response' => $data,
                ] + $context);
            }

            return $exists;
        } catch (Throwable $e) {
            Log::warning('[GreenAPI] checkWhatsapp exception', [
                'error' => $e->getMessage(),
            ] + $context);

            return false;
        }
    }

    private function resolveChatIdFromPhone(string $phone): ?string
    {
        $phone = trim($phone);

        if ($phone === '') {
            return null;
        }

        if (str_ends_with($phone, '@c.us')) {
            return $phone;
        }

        $digits = $this->extractDigits($phone);

        if ($digits === '') {
            return null;
        }

        return $digits.'@c.us';
    }

    private function extractDigits(string $phone): string
    {
        return preg_replace('/\D+/', '', $phone) ?? '';
    }
}
