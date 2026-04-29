<?php

namespace App\Http\Controllers;

use Inertia\Inertia;
use Inertia\Response;

class KpiController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('Kpi/Index');
    }
}
