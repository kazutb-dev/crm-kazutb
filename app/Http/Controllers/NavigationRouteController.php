<?php

namespace App\Http\Controllers;

use App\Models\NavigationRoute;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class NavigationRouteController extends Controller
{
    public function index(Request $request): Response
    {
        $this->ensureAdmin($request);

        $routes = NavigationRoute::query()
            ->orderBy('sort_order')
            ->orderBy('id')
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('Nav/AdminRoutes', [
            'navigationRoutes' => $routes,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $this->ensureAdmin($request);

        $data = $this->validated($request);

        NavigationRoute::query()->create($data);

        return back()->with('success', 'Маршрут создан.');
    }

    public function update(Request $request, NavigationRoute $navigationRoute): RedirectResponse
    {
        $this->ensureAdmin($request);

        $data = $this->validated($request, true);

        $navigationRoute->update($data);

        return back()->with('success', 'Маршрут обновлен.');
    }

    public function destroy(Request $request, NavigationRoute $navigationRoute): RedirectResponse
    {
        $this->ensureAdmin($request);

        $navigationRoute->delete();

        return back()->with('success', 'Маршрут удален.');
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, bool $isUpdate = false): array
    {
        $this->autofillMetaFromLocation($request);

        $required = $isUpdate ? 'sometimes' : 'required';

        $data = $request->validate([
            'badge' => [$required, 'string', 'max:30'],
            'title' => [$required, 'string', 'max:190'],
            'meta' => [$required, 'string', 'max:190'],
            'kind' => [$required, 'in:cabinet,staff,department'],
            'building' => ['nullable', 'string', 'max:120'],
            'floor' => ['nullable', 'integer', 'min:0', 'max:100'],
            'room' => [
                Rule::requiredIf(function () use ($request): bool {
                    return in_array((string) $request->input('kind'), ['cabinet', 'staff'], true);
                }),
                'nullable',
                'string',
                'max:40',
            ],
            'steps_text' => ['nullable', 'string', 'max:5000'],
            'map_image_path' => ['nullable', 'string', 'max:255'],
            'is_active' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:1000000'],
        ]);

        $stepsText = (string) ($data['steps_text'] ?? '');
        unset($data['steps_text']);

        $data['steps'] = collect(preg_split('/\r\n|\r|\n/', $stepsText) ?: [])
            ->map(fn (string $line): string => trim($line))
            ->filter(fn (string $line): bool => $line !== '')
            ->values()
            ->all();

        if (!array_key_exists('is_active', $data)) {
            $data['is_active'] = false;
        }

        return $data;
    }

    private function autofillMetaFromLocation(Request $request): void
    {
        $meta = trim((string) $request->input('meta', ''));
        if ($meta !== '') {
            return;
        }

        $building = trim((string) $request->input('building', ''));
        $floor = $request->input('floor');
        $parts = [];

        if ($building !== '') {
            $parts[] = $building;
        }

        if ($floor !== null && $floor !== '') {
            $parts[] = ((int) $floor) . ' этаж';
        }

        if ($parts !== []) {
            $request->merge([
                'meta' => implode(' • ', $parts),
            ]);
        }
    }

    private function ensureAdmin(Request $request): void
    {
        $role = $request->user()?->resolvedRoleSlug();

        abort_unless(in_array($role, ['admin', 'superadmin'], true), 403);
    }
}
