<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\NavigationRoute;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class NavigationRouteController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $kind = trim((string) $request->query('kind', ''));
        $query = trim((string) $request->query('q', ''));
        $activeOnly = filter_var($request->query('active', '1'), FILTER_VALIDATE_BOOL);

        $routes = NavigationRoute::query()
            ->with(['attachedUsers:id,name,ad_login,room'])
            ->when($activeOnly, fn ($q) => $q->where('is_active', true))
            ->when($kind !== '', fn ($q) => $q->where('kind', $kind))
            ->when($query !== '', function ($q) use ($query) {
                $q->where(function ($nested) use ($query): void {
                    $nested
                        ->where('title', 'like', "%{$query}%")
                        ->orWhere('meta', 'like', "%{$query}%")
                        ->orWhere('badge', 'like', "%{$query}%")
                        ->orWhereHas('attachedUsers', function ($users) use ($query): void {
                            $users
                                ->where('name', 'like', "%{$query}%")
                                ->orWhere('ad_login', 'like', "%{$query}%")
                                ->orWhere('room', 'like', "%{$query}%");
                        });
                });
            })
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        return response()->json([
            'data' => $routes->map(fn (NavigationRoute $route): array => $this->serializeRoute($route))->values(),
        ]);
    }

    public function show(NavigationRoute $navigationRoute): JsonResponse
    {
        abort_unless($navigationRoute->is_active, 404);

        return response()->json([
            'data' => $this->serializeRoute($navigationRoute),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $data = $this->validated($request);
        $attachedUserIds = $data['attached_user_ids'] ?? [];
        unset($data['attached_user_ids']);

        $route = NavigationRoute::query()->create($data);
        $this->syncAttachedUsers($route, $attachedUserIds, (string) ($data['kind'] ?? 'cabinet'));

        return response()->json([
            'message' => 'Маршрут создан.',
            'data' => $this->serializeRoute($route->fresh('attachedUsers')),
        ], 201);
    }

    public function update(Request $request, NavigationRoute $navigationRoute): JsonResponse
    {
        $this->ensureAdmin($request);

        $data = $this->validated($request, true);
        $attachedUserIds = $data['attached_user_ids'] ?? [];
        unset($data['attached_user_ids']);

        $navigationRoute->update($data);
        $this->syncAttachedUsers($navigationRoute, $attachedUserIds, (string) ($data['kind'] ?? $navigationRoute->kind));

        return response()->json([
            'message' => 'Маршрут обновлен.',
            'data' => $this->serializeRoute($navigationRoute->fresh('attachedUsers')),
        ]);
    }

    public function destroy(Request $request, NavigationRoute $navigationRoute): JsonResponse
    {
        $this->ensureAdmin($request);

        $navigationRoute->delete();

        return response()->json([
            'message' => 'Маршрут удален.',
        ]);
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
            'steps' => ['nullable', 'array'],
            'steps.*' => ['string', 'max:500'],
            'map_polyline' => ['nullable', 'array', 'max:300'],
            'map_polyline.*.x' => ['required_with:map_polyline', 'numeric', 'min:0', 'max:100'],
            'map_polyline.*.y' => ['required_with:map_polyline', 'numeric', 'min:0', 'max:100'],
            'map_polyline_text' => ['nullable', 'string', 'max:10000'],
            'attached_user_ids' => ['nullable', 'array', 'max:50'],
            'attached_user_ids.*' => ['integer', 'distinct', 'exists:users,id'],
            'map_image_path' => ['nullable', 'string', 'max:255'],
            'is_active' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:1000000'],
        ]);

        $polylineText = trim((string) ($data['map_polyline_text'] ?? ''));
        unset($data['map_polyline_text']);

        if ($polylineText !== '') {
            $data['map_polyline'] = $this->parsePolylineText($polylineText);
        }

        return $data;
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

        $route->attachedUsers()->sync(
            collect($attachedUserIds)
                ->map(fn ($id): int => (int) $id)
                ->unique()
                ->values()
                ->all(),
        );
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
        $user = $request->user();
        $role = $user?->resolvedRoleSlug();

        abort_unless(in_array($role, ['admin', 'superadmin'], true), 403, 'Недостаточно прав.');
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeRoute(NavigationRoute $route): array
    {
        return [
            'id' => $route->id,
            'badge' => $route->badge,
            'title' => $route->title,
            'meta' => $route->meta,
            'kind' => $route->kind,
            'building' => $route->building,
            'floor' => $route->floor,
            'room' => $route->room,
            'steps' => $route->steps ?? [],
            'map_image_path' => $route->map_image_path,
            'map_image_url' => $route->map_image_path ? url($route->map_image_path) : null,
            'map_polyline' => collect($route->map_polyline ?? [])
                ->map(fn ($point): array => [
                    'x' => (float) data_get($point, 'x', 0),
                    'y' => (float) data_get($point, 'y', 0),
                ])
                ->values()
                ->all(),
            'is_active' => (bool) $route->is_active,
            'sort_order' => (int) $route->sort_order,
            'attached_users' => $route->attachedUsers
                ->map(fn ($user): array => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'ad_login' => $user->ad_login,
                    'room' => $user->room,
                ])
                ->values()
                ->all(),
            'created_at' => optional($route->created_at)?->toIso8601String(),
            'updated_at' => optional($route->updated_at)?->toIso8601String(),
        ];
    }
}
