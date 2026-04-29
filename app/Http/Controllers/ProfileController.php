<?php

namespace App\Http\Controllers;

use App\Http\Requests\ProfileUpdateRequest;
use App\Services\GreenApiWhatsAppNotifier;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Redirect;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    /**
     * Display the user's profile form.
     */
    public function edit(Request $request): Response
    {
        return Inertia::render('Profile/Edit', [
            'mustVerifyEmail' => $request->user() instanceof MustVerifyEmail,
            'status' => session('status'),
        ]);
    }

    /**
     * Update the user's profile information.
     */
    public function update(ProfileUpdateRequest $request, GreenApiWhatsAppNotifier $whatsAppNotifier): RedirectResponse
    {
        $user = $request->user();
        $validated = $request->validated();

        $newPhone = trim((string) ($validated['phone'] ?? ''));
        $currentPhone = trim((string) ($user->phone ?? ''));
        $isPhoneChanged = $newPhone !== '' && $newPhone !== $currentPhone;

        if ($isPhoneChanged) {
            $isValidWhatsApp = $whatsAppNotifier->verifyWhatsAppPhone($newPhone, [
                'user_id' => $user->id,
                'flow' => 'profile_phone_verification',
            ]);

            if (! $isValidWhatsApp) {
                return Redirect::route('profile.edit')
                    ->withErrors([
                        'phone' => 'Указанный номер не найден в WhatsApp или недоступен для проверки. Проверьте номер и повторите попытку.',
                    ])
                    ->withInput();
            }

            $welcomeMessage = "Здравствуйте! Это проверочное сообщение WhatsApp для вашего профиля. Если вы получили это сообщение, номер подтвержден.";

            $sent = $whatsAppNotifier->sendMessageToPhone($newPhone, $welcomeMessage, [
                'user_id' => $user->id,
                'flow' => 'profile_phone_verification',
            ]);

            if (! $sent) {
                return Redirect::route('profile.edit')
                    ->withErrors([
                        'phone' => 'Не удалось отправить проверочное сообщение в WhatsApp. Проверьте номер и повторите попытку.',
                    ])
                    ->withInput();
            }
        }

        $user->fill($validated);

        if ($user->isDirty('email')) {
            $user->email_verified_at = null;
        }

        $user->save();

        return Redirect::route('profile.edit');
    }

    /**
     * Delete the user's account.
     */
    public function destroy(Request $request): RedirectResponse
    {
        $request->validate([
            'password' => ['required', 'current_password'],
        ]);

        $user = $request->user();

        Auth::logout();

        $user->delete();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return Redirect::to('/');
    }
}
