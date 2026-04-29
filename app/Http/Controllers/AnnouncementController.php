<?php

namespace App\Http\Controllers;

use App\Models\Announcement;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class AnnouncementController extends Controller
{
    public function index(): Response
    {
        $announcements = Announcement::query()
            ->with('author:id,name')
            ->orderByDesc('event_date')
            ->orderByDesc('created_at')
            ->paginate(10)
            ->through(fn (Announcement $announcement): array => [
                'id' => $announcement->id,
                'title' => $announcement->title,
                'content' => $announcement->content,
                'is_active' => (bool) $announcement->is_active,
                'is_important' => (bool) $announcement->is_important,
                'event_date' => optional($announcement->event_date)?->format('Y-m-d\TH:i'),
                'event_date_human' => optional($announcement->event_date)?->format('d.m.Y H:i'),
                'image_url' => $announcement->image_path
                    ? '/storage/' . ltrim($announcement->image_path, '/')
                    : null,
                'created_at_human' => optional($announcement->created_at)?->format('d.m.Y H:i'),
                'author_name' => $announcement->author?->name ?? 'Система',
            ])
            ->withQueryString();

        return Inertia::render('Announcements/Index', [
            'announcements' => $announcements,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'content' => ['required', 'string', 'max:5000'],
            'is_active' => ['required', 'boolean'],
            'is_important' => ['required', 'boolean'],
            'event_date' => ['nullable', 'date'],
            'image' => ['nullable', 'image', 'max:5120'],
        ]);

        if ($request->hasFile('image')) {
            $data['image_path'] = $request->file('image')->store('announcements', 'public');
        }

        unset($data['image']);

        $data['created_by'] = $request->user()?->id;

        Announcement::create($data);

        return redirect()
            ->route('announcements.index')
            ->with('success', 'Объявление создано.');
    }

    public function update(Request $request, Announcement $announcement): RedirectResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'content' => ['required', 'string', 'max:5000'],
            'is_active' => ['required', 'boolean'],
            'is_important' => ['required', 'boolean'],
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

        return redirect()
            ->route('announcements.index')
            ->with('success', 'Объявление обновлено.');
    }

    public function destroy(Announcement $announcement): RedirectResponse
    {
        if ($announcement->image_path) {
            Storage::disk('public')->delete($announcement->image_path);
        }

        $announcement->delete();

        return redirect()
            ->route('announcements.index')
            ->with('success', 'Объявление удалено.');
    }
}
