<?php

namespace App\Http\Requests\Auth;

use App\Models\User;
use App\Services\ActiveDirectoryAuthenticator;
use Illuminate\Auth\Events\Lockout;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class LoginRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'email' => ['required', 'string'],
            'password' => ['required', 'string'],
        ];
    }

    /**
     * Attempt to authenticate the request's credentials.
     *
     * @throws \Illuminate\Validation\ValidationException
     */
    public function authenticate(): void
    {
        $this->ensureIsNotRateLimited();

        $login = (string) $this->input('email');
        $password = (string) $this->input('password');
        $remember = $this->boolean('remember');

        $authenticated = false;
        $trackedByAd = false;

        /** @var ActiveDirectoryAuthenticator $adAuthenticator */
        $adAuthenticator = app(ActiveDirectoryAuthenticator::class);
        $adUser = $adAuthenticator->authenticateAndSync($login, $password);

        if ($adUser !== null) {
            Auth::login($adUser, $remember);
            $authenticated = true;
            $trackedByAd = true;
        }

        if (! $authenticated) {
            $authenticated = Auth::attempt(['email' => $login, 'password' => $password], $remember);

            if (! $authenticated && Schema::hasColumn('users', 'ad_login')) {
                $localUser = User::query()
                    ->whereRaw('LOWER(ad_login) = ?', [Str::lower($login)])
                    ->first();

                if ($localUser !== null) {
                    $authenticated = Auth::attempt(['email' => $localUser->email, 'password' => $password], $remember);
                }
            }
        }

        if (! $authenticated) {
            RateLimiter::hit($this->throttleKey());

            throw ValidationException::withMessages([
                'email' => trans('auth.failed'),
            ]);
        }

        $userId = Auth::id();

        if (! $trackedByAd && $userId !== null) {
            $updates = [];

            if (Schema::hasColumn('users', 'last_login_at')) {
                $updates['last_login_at'] = now();
            }

            if (Schema::hasColumn('users', 'login_count')) {
                $updates['login_count'] = DB::raw('COALESCE(login_count, 0) + 1');
            }

            if ($updates !== []) {
                DB::table('users')
                    ->where('id', $userId)
                    ->update($updates);
            }
        }

        $this->session()->put('login_tracked', true);

        RateLimiter::clear($this->throttleKey());
    }

    /**
     * Ensure the login request is not rate limited.
     *
     * @throws \Illuminate\Validation\ValidationException
     */
    public function ensureIsNotRateLimited(): void
    {
        if (! RateLimiter::tooManyAttempts($this->throttleKey(), 5)) {
            return;
        }

        event(new Lockout($this));

        $seconds = RateLimiter::availableIn($this->throttleKey());

        throw ValidationException::withMessages([
            'email' => trans('auth.throttle', [
                'seconds' => $seconds,
                'minutes' => ceil($seconds / 60),
            ]),
        ]);
    }

    /**
     * Get the rate limiting throttle key for the request.
     */
    public function throttleKey(): string
    {
        return Str::transliterate(Str::lower($this->string('email')).'|'.$this->ip());
    }
}
