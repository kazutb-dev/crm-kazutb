<?php

namespace App\Http\Controllers\Hr;

use App\Http\Controllers\Controller;
use App\Http\Requests\Hr\UpdateHiringRequest;
use App\Models\HrDocument;
use App\Models\HrHiring;
use App\Services\Hr\DocxToPdfConverter;
use App\Services\Hr\EmployerSettings;
use App\Services\Hr\HiringOptions;
use App\Services\Hr\HiringService;
use App\Services\Hr\HrAccess;
use App\Services\Hr\HrAuditLogger;
use App\Services\Hr\HrDates;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * «Приём на работу»: list, wizard (3 steps) and the hiring card. Access: role hr and administrators
 * (route middleware); every hiring is visible to every module user.
 */
class HiringController extends Controller
{
    public function __construct(
        private readonly HiringService $hirings,
        private readonly HrAccess $access,
        private readonly HrAuditLogger $audit,
    ) {}

    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::in(array_keys(HrHiring::STATUS_LABELS))],
            'unit' => ['nullable', 'integer'],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
            'q' => ['nullable', 'string', 'max:100'],
        ]);

        return Inertia::render('Hr/Hiring/Index', [
            'hirings' => $this->hirings->listing($filters),
            'filters' => $filters + ['status' => null, 'unit' => null, 'date_from' => null, 'date_to' => null, 'q' => null],
            'units' => $this->hirings->unitFilterOptions(),
            'statuses' => HiringOptions::all()['statuses'],
            'abilities' => $this->access->abilities($request->user()),
        ]);
    }

    /** «Новый приём»: a draft is created at once, so photos and scans can be attached from the first step. */
    public function store(Request $request): RedirectResponse
    {
        $hiring = $this->hirings->createDraft($request->user());

        return Redirect::route('hr.hiring.edit', $hiring);
    }

    /** A new hiring of an employee who already has a personal file. */
    public function rehire(Request $request, HrHiring $hiring): RedirectResponse
    {
        $new = $this->hirings->createDraft($request->user(), $hiring->employee);

        return Redirect::route('hr.hiring.edit', $new)->with('success', 'Создан новый приём для этого сотрудника.');
    }

    public function edit(Request $request, HrHiring $hiring, EmployerSettings $employer, DocxToPdfConverter $converter): Response
    {
        $this->audit->hiring(HrAuditLogger::HIRING_VIEWED, $hiring, 'Открыт приём #'.$hiring->id.' (мастер)', [], $request->user());

        $settings = $employer->all();

        return Inertia::render('Hr/Hiring/Wizard', [
            'hiring' => $this->hirings->present($hiring, $request->user()),
            'options' => HiringOptions::all(),
            'abilities' => $this->access->abilities($request->user()),
            'previewAvailable' => $converter->isAvailable(),
            'defaults' => [
                'break_start' => HrDates::normalizeTime($settings['break_start']),
                'break_end' => HrDates::normalizeTime($settings['break_end']),
            ],
        ]);
    }

    public function update(UpdateHiringRequest $request, HrHiring $hiring): JsonResponse
    {
        $hiring = $this->hirings->update($hiring, $request->validated(), $request->user());

        return response()->json(['hiring' => $this->hirings->present($hiring, $request->user())]);
    }

    public function show(Request $request, HrHiring $hiring, DocxToPdfConverter $converter): Response
    {
        $this->audit->hiring(HrAuditLogger::HIRING_VIEWED, $hiring, 'Открыта карточка приёма #'.$hiring->id, [], $request->user());

        return Inertia::render('Hr/Hiring/Show', [
            'hiring' => $this->hirings->present($hiring, $request->user()),
            'history' => $this->audit->history($hiring),
            'options' => HiringOptions::all(),
            'abilities' => $this->access->abilities($request->user()),
            'previewAvailable' => $converter->isAvailable(),
        ]);
    }

    /** Only a draft without signed documents can be deleted. */
    public function destroy(Request $request, HrHiring $hiring): RedirectResponse
    {
        if ($hiring->status !== HrHiring::STATUS_DRAFT || $hiring->documents()->where('status', HrDocument::STATUS_SIGNED)->exists()) {
            return Redirect::back()->with('error', 'Удалить можно только черновик без подписанных документов.');
        }

        $hiring->delete();
        $this->audit->hiring(HrAuditLogger::HIRING_DELETED, $hiring, 'Удалён черновик приёма #'.$hiring->id, [], $request->user());

        return Redirect::route('hr.hiring.index')->with('success', 'Черновик удалён.');
    }
}
