<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class AnnouncementController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 15), 1), 100);
        $onlyActive = filter_var($request->query('only_active', false), FILTER_VALIDATE_BOOLEAN);

        $query = Announcement::query()
            ->with('author:id,name')
            ->orderByDesc('event_date')
            ->orderByDesc('created_at');

        if ($onlyActive) {
            $query->where('is_active', true);
        }

        $announcements = $query
            ->paginate($perPage)
            ->appends($request->query());

        $announcements->setCollection(
            $announcements->getCollection()->map(
                fn (Announcement $announcement): array => $this->serializeAnnouncement($announcement)
            )
        );

        return response()->json($announcements);
    }

    public function show(Announcement $announcement): JsonResponse
    {
        $announcement->loadMissing('author:id,name');

        return response()->json([
            'data' => $this->serializeAnnouncement($announcement),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', Announcement::class);

        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'content' => ['required', 'string', 'max:5000'],
            'is_active' => ['sometimes', 'boolean'],
            'is_important' => ['sometimes', 'boolean'],
            'event_date' => ['nullable', 'date'],
            'image' => ['nullable', 'image', 'max:5120'],
        ]);

        $data['created_by'] = $request->user()?->id;
        $data['is_active'] = (bool) ($data['is_active'] ?? true);
        $data['is_important'] = (bool) ($data['is_important'] ?? false);

        if ($request->hasFile('image')) {
            $data['image_path'] = $request->file('image')->store('announcements', 'public');
        }

        unset($data['image']);

        $announcement = Announcement::query()->create($data);
        $announcement->loadMissing('author:id,name');

        return response()->json([
            'message' => 'Объявление создано.',
            'data' => $this->serializeAnnouncement($announcement),
        ], 201);
    }

    public function update(Request $request, Announcement $announcement): JsonResponse
    {
        $this->authorize('update', $announcement);

        $data = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'content' => ['sometimes', 'required', 'string', 'max:5000'],
            'is_active' => ['sometimes', 'boolean'],
            'is_important' => ['sometimes', 'boolean'],
            'event_date' => ['nullable', 'date'],
            'image' => ['nullable', 'image', 'max:5120'],
        ]);

        if ($request->hasFile('image')) {
            if ($announcement->image_path) {
                Storage::disk('public')->delete($announcement->image_path);
            }

            $data['image_path'] = $request->file('image')->store('announcements', 'public');
        }

        unset($data['image']);

        $announcement->update($data);
        $announcement->loadMissing('author:id,name');

        return response()->json([
            'message' => 'Объявление обновлено.',
            'data' => $this->serializeAnnouncement($announcement->fresh(['author:id,name'])),
        ]);
    }

    public function destroy(Announcement $announcement): JsonResponse
    {
        $this->authorize('delete', $announcement);

        if ($announcement->image_path) {
            Storage::disk('public')->delete($announcement->image_path);
        }

        $announcement->delete();

        return response()->json([
            'message' => 'Объявление удалено.',
        ]);
    }

    private function serializeAnnouncement(Announcement $announcement): array
    {
        return [
            'id' => $announcement->id,
            'title' => $announcement->title,
            'content' => $announcement->content,
            'is_active' => (bool) $announcement->is_active,
            'is_important' => (bool) $announcement->is_important,
            'event_date' => optional($announcement->event_date)?->toIso8601String(),
            'image_url' => $announcement->image_path
                ? url('/storage/' . ltrim($announcement->image_path, '/'))
                : null,
            'created_at' => optional($announcement->created_at)?->toIso8601String(),
            'updated_at' => optional($announcement->updated_at)?->toIso8601String(),
            'author' => [
                'id' => $announcement->author?->id,
                'name' => $announcement->author?->name,
            ],
        ];
    }

}
