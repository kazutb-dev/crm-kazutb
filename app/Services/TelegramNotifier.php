<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class TelegramNotifier
{
    public function notifyUserAboutCalendarRequest(User $user, string $message): bool
    {
        if (! config('services.telegram.enabled')) {
            return false;
        }

        $botToken = (string) config('services.telegram.bot_token', '');

        if ($botToken === '') {
            return false;
        }

        $chatId = $this->resolveChatId($user);

        if ($chatId === null) {
            return false;
        }

        try {
            $response = Http::timeout(8)
                ->asForm()
                ->post("https://api.telegram.org/bot{$botToken}/sendMessage", [
                    'chat_id' => $chatId,
                    'text' => $message,
                    'disable_web_page_preview' => true,
                ]);

            return $response->successful();
        } catch (Throwable $e) {
            Log::warning('Telegram notification send failed', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }

    private function resolveChatId(User $user): string|int|null
    {
        $directChatId = $user->telegram_chat_id;

        if (! empty($directChatId)) {
            return $directChatId;
        }

        $phone = (string) ($user->phone ?? '');

        if ($phone === '') {
            return config('services.telegram.default_chat_id');
        }

        $normalizedPhone = $this->normalizePhone($phone);
        $phoneMap = config('services.telegram.phone_chat_map', []);

        if (! is_array($phoneMap)) {
            $phoneMap = [];
        }

        if ($normalizedPhone !== '' && isset($phoneMap[$normalizedPhone])) {
            return $phoneMap[$normalizedPhone];
        }

        if (isset($phoneMap[$phone])) {
            return $phoneMap[$phone];
        }

        return config('services.telegram.default_chat_id');
    }

    private function normalizePhone(string $phone): string
    {
        return preg_replace('/\D+/', '', $phone) ?? '';
    }
}