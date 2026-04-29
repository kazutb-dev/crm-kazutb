<?php

namespace App\Http\Controllers;

use App\Models\CalendarEmployeeExclusion;
use App\Models\CalendarEmployeeGrant;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CalendarEmployeesController extends Controller
{
    // Паттерны руководящих должностей из АД (substring, case-insensitive)
    public const LEADERSHIP_PATTERNS = [
        'ректор',    // Ректор, Проректор по ...
        'декан',     // Декан, Зам.декана по ...
        'директор',  // Директор
        'заведующ',  // Заведующий кафедрой
    ];

    // Порядок сортировки по важности
    private const TITLE_ORDER = [
        'ректор'    => 0,
        'проректор' => 1,
        'директор'  => 2,
        'декан'     => 3,
        'зам.декан' => 4,
        'заведующ'  => 5,
    ];

    public function __invoke(Request $request): Response
    {
        $excludedIds = CalendarEmployeeExclusion::pluck('user_id')->all();
        $grantedIds  = CalendarEmployeeGrant::pluck('user_id')->all();

        $query = User::select('id', 'name', 'display_name', 'first_name', 'last_name', 'email', 'phone', 'ad_title', 'ad_department', 'room', 'ad_division', 'calendar_status')
            ->whereNotIn('id', $excludedIds)
            ->where(function ($q) use ($grantedIds) {
                $q->where(function ($inner) {
                    $inner->whereNotNull('ad_title')
                        ->where('ad_title', '<>', '')
                        ->where(function ($pat) {
                            foreach (self::LEADERSHIP_PATTERNS as $pattern) {
                                $pat->orWhereRaw('LOWER(ad_title) LIKE ?', ['%' . $pattern . '%']);
                            }
                        });
                });
                if (!empty($grantedIds)) {
                    $q->orWhereIn('id', $grantedIds);
                }
            })
            ->orderBy('name');

        $employees = $query->get()
            ->map(fn ($u) => [
                'id'              => $u->id,
                'name'            => $u->display_name ?? $u->name,
                'email'           => $u->email,
                'phone'           => $u->phone,
                'title'           => $u->ad_title,
                'department'      => $u->ad_department,
                'division'        => $u->ad_division,
                'room'            => $u->room,
                'calendar_status' => $u->calendar_status ?? 'available',
            ])
            ->sortBy(function ($emp) {
                $title = mb_strtolower(trim($emp['title'] ?? ''));
                foreach (self::TITLE_ORDER as $keyword => $order) {
                    if (str_contains($title, $keyword)) {
                        return $order;
                    }
                }
                return 99;
            })
            ->values();

        return Inertia::render('Calendar/Employees', [
            'employees' => $employees,
        ]);
    }
}
