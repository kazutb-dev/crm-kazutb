<?php

namespace App\Http\Controllers;

use App\Models\NavigationRoute;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class NavigationRouteController extends Controller
{
    public function index(Request $request): Response
    {
        $this->ensureAdmin($request);

        $routes = NavigationRoute::query()
            ->with(['attachedUsers:id,name,ad_login,room'])
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

        Log::info('nav-route.store.request', [
            'user_id' => $request->user()?->id,
            'has_map_image' => $request->hasFile('map_image'),
            'payload' => $request->except(['map_image']),
        ]);

        $data = $this->validated($request);
        $attachedUserIds = $data['attached_user_ids'] ?? [];
        unset($data['attached_user_ids']);

        $route = NavigationRoute::query()->create($data);
        $this->syncAttachedUsers($route, $attachedUserIds, (string) ($data['kind'] ?? 'cabinet'));

        Log::info('nav-route.store.saved', [
            'route_id' => $route->id,
            'saved' => $route->fresh()?->only([
                'badge',
                'title',
                'meta',
                'kind',
                'building',
                'floor',
                'room',
                'map_image_path',
                'map_polyline',
                'is_active',
                'sort_order',
            ]),
            'attached_user_ids' => $route->attachedUsers()->pluck('users.id')->all(),
        ]);

        return back()->with('success', 'Маршрут создан.');
    }

    public function update(Request $request, NavigationRoute $navigationRoute): RedirectResponse
    {
        $this->ensureAdmin($request);

        Log::info('nav-route.update.request', [
            'route_id' => $navigationRoute->id,
            'user_id' => $request->user()?->id,
            'has_map_image' => $request->hasFile('map_image'),
            'payload' => $request->except(['map_image']),
        ]);

        $data = $this->validated($request, true, $navigationRoute);
        $attachedUserIds = $data['attached_user_ids'] ?? [];
        unset($data['attached_user_ids']);

        $navigationRoute->update($data);
        $this->syncAttachedUsers($navigationRoute, $attachedUserIds, (string) ($data['kind'] ?? $navigationRoute->kind));

        Log::info('nav-route.update.saved', [
            'route_id' => $navigationRoute->id,
            'saved' => $navigationRoute->fresh()?->only([
                'badge',
                'title',
                'meta',
                'kind',
                'building',
                'floor',
                'room',
                'map_image_path',
                'map_polyline',
                'is_active',
                'sort_order',
            ]),
            'attached_user_ids' => $navigationRoute->attachedUsers()->pluck('users.id')->all(),
        ]);

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
    private function validated(Request $request, bool $isUpdate = false, ?NavigationRoute $existingRoute = null): array
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
            'map_polyline_text' => ['nullable', 'string', 'max:10000'],
            'attached_user_ids' => ['nullable', 'array', 'max:50'],
            'attached_user_ids.*' => ['integer', 'distinct', 'exists:users,id'],
            'map_image' => ['nullable', 'file', 'image', 'max:10240'],
            'map_image_path' => ['nullable', 'string', 'max:255'],
            'is_active' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:1000000'],
        ]);

        $stepsText = (string) ($data['steps_text'] ?? '');
        $polylineText = (string) ($data['map_polyline_text'] ?? '');
        unset($data['steps_text']);
        unset($data['map_polyline_text']);
        unset($data['map_image']);

        $data['steps'] = collect(preg_split('/\r\n|\r|\n/', $stepsText) ?: [])
            ->map(fn (string $line): string => trim($line))
            ->filter(fn (string $line): bool => $line !== '')
            ->values()
            ->all();

        $data['map_polyline'] = $this->parsePolylineText($polylineText);

        $uploadedPath = $this->storeMapImageIfUploaded($request);
        if ($uploadedPath !== null) {
            $data['map_image_path'] = $uploadedPath;
        } elseif ($isUpdate && $existingRoute !== null) {
            $currentPath = array_key_exists('map_image_path', $data)
                ? trim((string) ($data['map_image_path'] ?? ''))
                : '';

            if ($currentPath === '') {
                $data['map_image_path'] = $existingRoute->map_image_path;
            }
        }

        if (!array_key_exists('is_active', $data)) {
            $data['is_active'] = false;
        }

        $data['attached_user_ids'] = collect($data['attached_user_ids'] ?? [])
            ->map(fn ($id): int => (int) $id)
            ->unique()
            ->values()
            ->all();

        return $data;
    }

    private function storeMapImageIfUploaded(Request $request): ?string
    {
        if (!$request->hasFile('map_image')) {
            return null;
        }

        $stored = $request->file('map_image')->store('nav', 'public');

        if ($stored === false || trim((string) $stored) === '') {
            throw ValidationException::withMessages([
                'map_image' => 'Не удалось сохранить картинку плана. Проверьте права на storage/app/public и повторите попытку.',
            ]);
        }

        return '/storage/' . ltrim($stored, '/');
    }

    /**
     * @return list<array{x: float, y: float}>
     */
    private function parsePolylineText(string $polylineText): array
    {
        return collect(preg_split('/\r\n|\r|\n/', $polylineText) ?: [])
            ->map(function (string $line): ?array {
                $parts = array_map('trim', explode(',', $line));
                if (count($parts) < 2 || $parts[0] === '' || $parts[1] === '') {
                    return null;
                }

                if (!is_numeric($parts[0]) || !is_numeric($parts[1])) {
                    return null;
                }

                $x = (float) $parts[0];
                $y = (float) $parts[1];

                if ($x < 0 || $x > 100 || $y < 0 || $y > 100) {
                    return null;
                }

                return [
                    'x' => $x,
                    'y' => $y,
                ];
            })
            ->filter(fn (?array $point): bool => $point !== null)
            ->values()
            ->all();
    }

    /**
     * @param list<int> $attachedUserIds
     */
    private function syncAttachedUsers(NavigationRoute $route, array $attachedUserIds, string $kind): void
    {
        if ($kind !== 'cabinet') {
            $route->attachedUsers()->sync([]);
            return;
        }

        $route->attachedUsers()->sync($attachedUserIds);
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
