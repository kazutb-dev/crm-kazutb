<?php

namespace App\Http\Controllers;

use App\Models\CalendarHoliday;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CalendarSettingsController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $holidays = CalendarHoliday::orderBy('date')->get();

        return Inertia::render('Calendar/Settings', [
            'holidays' => $holidays,
        ]);
    }
}
