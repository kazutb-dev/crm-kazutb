<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\ActiveDirectoryAuthenticator;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    /**
     * Display dashboard with real-time application metrics.
     */
    public function __invoke(ActiveDirectoryAuthenticator $adAuthenticator): Response
    {
        $now = now();
        $startOfCurrentMonth = $now->copy()->startOfMonth();
        $startOfPreviousMonth = $startOfCurrentMonth->copy()->subMonth();

        $totalUsers = User::count();
        $verifiedUsers = User::whereNotNull('email_verified_at')->count();
        $adLinkedUsers = User::whereNotNull('ad_guid')->count();

        $newUsersCurrentMonth = User::where('created_at', '>=', $startOfCurrentMonth)->count();
        $newUsersPreviousMonth = User::whereBetween('created_at', [$startOfPreviousMonth, $startOfCurrentMonth])->count();

        $activeSessionsNow = DB::table('sessions')
            ->where('last_activity', '>=', $now->copy()->subMinutes(15)->timestamp)
            ->count();

        $activeSessionsPreviousWindow = DB::table('sessions')
            ->whereBetween('last_activity', [
                $now->copy()->subMinutes(30)->timestamp,
                $now->copy()->subMinutes(15)->timestamp,
            ])
            ->count();

        $months = collect(range(11, 0))->map(
            fn (int $offset) => $now->copy()->subMonths($offset)->startOfMonth()
        );

        $registrations = User::query()
            ->selectRaw("DATE_FORMAT(created_at, '%Y-%m') as month_key, COUNT(*) as total")
            ->where('created_at', '>=', $months->first())
            ->groupBy('month_key')
            ->pluck('total', 'month_key');

        $monthlyLabels = $months
            ->map(fn (Carbon $month) => $month->locale('ru')->isoFormat('MMMM'))
            ->all();

        $monthlySeries = $months
            ->map(fn (Carbon $month) => (int) ($registrations[$month->format('Y-m')] ?? 0))
            ->all();

        $latestUsers = User::query()
            ->latest('created_at')
            ->limit(5)
            ->get(['name', 'email', 'ad_login', 'created_at']);

        $activity = $latestUsers->map(function (User $user): array {
            return [
                'title' => 'Создан новый аккаунт',
                'subtitle' => sprintf('%s (%s)', $user->name, $user->email),
                'time' => $user->created_at?->locale('ru')->diffForHumans() ?? 'только что',
            ];
        })->all();

        $verificationRate = $totalUsers > 0 ? round(($verifiedUsers / $totalUsers) * 100, 1) : 0;
        $adLinkedRate = $totalUsers > 0 ? round(($adLinkedUsers / $totalUsers) * 100, 1) : 0;
        $adDirectoryUsers = $adAuthenticator->countDirectoryUsersByCategory();
        $newUsersDelta = $this->percentageDelta($newUsersCurrentMonth, $newUsersPreviousMonth);
        $sessionsDelta = $this->percentageDelta($activeSessionsNow, $activeSessionsPreviousWindow);

        return Inertia::render('Dashboard', [
            'dashboard' => [
                'kpis' => [
                    [
                        'title' => 'Пользователей всего',
                        'value' => number_format($totalUsers),
                        'delta' => sprintf('+%d за месяц', $newUsersCurrentMonth),
                        'trend' => 'up',
                    ],
                    [
                        'title' => 'Новых за месяц',
                        'value' => number_format($newUsersCurrentMonth),
                        'delta' => $newUsersDelta,
                        'trend' => str_starts_with($newUsersDelta, '-') ? 'down' : 'up',
                    ],
                    [
                        'title' => 'Студенты AD (каталог)',
                        'value' => $adDirectoryUsers !== null ? number_format($adDirectoryUsers['students']) : 'N/A',
                        'delta' => $adDirectoryUsers !== null
                            ? 'Прямой подсчет LDAP'
                            : 'AD недоступен',
                        'trend' => $adDirectoryUsers !== null ? 'up' : 'neutral',
                    ],
                    [
                        'title' => 'Сотрудники AD (каталог)',
                        'value' => $adDirectoryUsers !== null ? number_format($adDirectoryUsers['staff']) : 'N/A',
                        'delta' => $adDirectoryUsers !== null
                            ? 'Прямой подсчет LDAP'
                            : 'AD недоступен',
                        'trend' => $adDirectoryUsers !== null ? 'up' : 'neutral',
                    ],
                    [
                        'title' => 'Подтвержденные аккаунты',
                        'value' => sprintf('%s%%', $verificationRate),
                        'delta' => sprintf('%d / %d пользователей', $verifiedUsers, $totalUsers),
                        'trend' => 'up',
                    ],
                    [
                        'title' => 'Активные сессии (15м)',
                        'value' => number_format($activeSessionsNow),
                        'delta' => $sessionsDelta,
                        'trend' => str_starts_with($sessionsDelta, '-') ? 'down' : 'up',
                    ],
                ],
                'monthlyLabels' => $monthlyLabels,
                'monthlySeries' => $monthlySeries,
                'activity' => $activity,
                'health' => [
                    [
                        'name' => 'Покрытие верификации email',
                        'owner' => 'Авторизация',
                        'progress' => $verificationRate,
                    ],
                    [
                        'name' => 'Аккаунты, связанные с AD',
                        'owner' => 'Каталог',
                        'progress' => $adLinkedRate,
                    ],
                    [
                        'name' => 'Осталось неподтвержденных',
                        'owner' => 'Онбординг',
                        'progress' => $totalUsers > 0
                            ? round((($totalUsers - $verifiedUsers) / $totalUsers) * 100, 1)
                            : 0,
                    ],
                ],
                'highlights' => [
                    [
                        'title' => 'Последний зарегистрированный пользователь',
                        'meta' => $latestUsers->first()
                            ? sprintf(
                                '%s · %s',
                                $latestUsers->first()->name,
                                $latestUsers->first()->created_at?->locale('ru')->diffForHumans()
                            )
                            : 'Пока нет пользователей',
                    ],
                    [
                        'title' => 'Аккаунты без AD',
                        'meta' => sprintf('%d пользователей', max(0, $totalUsers - $adLinkedUsers)),
                    ],
                    [
                        'title' => 'Аккаунты без верификации email',
                        'meta' => sprintf('%d пользователей', max(0, $totalUsers - $verifiedUsers)),
                    ],
                ],
            ],
        ]);
    }

    private function percentageDelta(int $current, int $previous): string
    {
        if ($previous === 0 && $current === 0) {
            return '0.0% к предыдущему периоду';
        }

        if ($previous === 0) {
            return '+100.0% к предыдущему периоду';
        }

        $delta = (($current - $previous) / $previous) * 100;

        return sprintf('%+.1f%% к предыдущему периоду', $delta);
    }
}
