<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class TeacherAiLesson extends Model
{
    public const STATUS_PENDING = 'pending';

    public const STATUS_PROCESSING = 'processing';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_FAILED = 'failed';

    /**
     * Generation runs in steps, one queue job run per step. `step` holds the
     * next step to run; `done` means everything is generated.
     */
    public const STEP_OUTLINE = 'outline';

    public const STEP_SECTIONS = 'sections';

    public const STEP_SLIDES = 'slides';

    public const STEP_IMAGES = 'images';

    public const STEP_DONE = 'done';

    /**
     * A lesson still pending/processing after this many minutes is treated
     * as stuck (worker restarted, job lost) and may be retried.
     */
    public const STALE_AFTER_MINUTES = 20;

    /**
     * Presentation JSON format produced by the current generator (KazUTB template
     * layouts, cover slide, image slots). Older rows are treated as not generated.
     */
    public const PRESENTATION_VERSION = 2;

    public const IMAGE_READY = 'ready';

    public const IMAGE_FAILED = 'failed';

    /**
     * Disk (local, private) and directory for generated slide images.
     */
    public const IMAGE_DISK = 'local';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'user_id',
        'subject',
        'topic',
        'language',
        'audience',
        'duration_minutes',
        'slides_count',
        'lecture_number',
        'faculty_name',
        'department_name',
        'notes',
        'status',
        'step',
        'step_attempts',
        'outline',
        'sections',
        'presentation',
        'images',
        'model',
        'prompt_tokens',
        'completion_tokens',
        'error_message',
        'started_at',
        'completed_at',
    ];

    protected $casts = [
        'outline' => 'array',
        'sections' => 'array',
        'presentation' => 'array',
        'images' => 'array',
        'duration_minutes' => 'integer',
        'lecture_number' => 'integer',
        'slides_count' => 'integer',
        'step_attempts' => 'integer',
        'prompt_tokens' => 'integer',
        'completion_tokens' => 'integer',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isInProgress(): bool
    {
        return in_array($this->status, [self::STATUS_PENDING, self::STATUS_PROCESSING], true);
    }

    public function isStale(): bool
    {
        return $this->isInProgress()
            && $this->updated_at !== null
            && $this->updated_at->lt(now()->subMinutes(self::STALE_AFTER_MINUTES));
    }

    public function canRetry(): bool
    {
        return $this->status === self::STATUS_FAILED || $this->isStale();
    }

    public function sectionsTotal(): int
    {
        return count($this->outline['sections'] ?? []);
    }

    public function sectionsDone(): int
    {
        return count(array_filter($this->sections ?? [], static fn ($section): bool => is_array($section)));
    }

    /**
     * @return list<int>
     */
    public function missingSectionIndexes(): array
    {
        $missing = [];

        for ($index = 0; $index < $this->sectionsTotal(); $index++) {
            if (! is_array($this->sections[$index] ?? null)) {
                $missing[] = $index;
            }
        }

        return $missing;
    }

    public function hasLecture(): bool
    {
        return $this->outline !== null
            && $this->sectionsTotal() > 0
            && $this->sectionsDone() === $this->sectionsTotal();
    }

    public function hasPresentation(): bool
    {
        return (int) ($this->presentation['version'] ?? 1) >= self::PRESENTATION_VERSION
            && ! empty($this->presentation['slides']);
    }

    /**
     * Indexes of the slides that have an image slot.
     *
     * @return list<int>
     */
    public function imageSlots(): array
    {
        if (! $this->hasPresentation()) {
            return [];
        }

        $slots = [];

        foreach ((array) $this->presentation['slides'] as $index => $slide) {
            if (is_array($slide) && ($slide['image'] ?? false) === true) {
                $slots[] = (int) $index;
            }
        }

        return $slots;
    }

    /**
     * Stored state of one slide image: ['status' => ready|failed, 'file' => ?, 'attempts' => int].
     *
     * @return array<string, mixed>|null
     */
    public function imageEntry(int $slideIndex): ?array
    {
        $entry = $this->images[(string) $slideIndex] ?? null;

        return is_array($entry) ? $entry : null;
    }

    /**
     * Absolute path of a ready image of the slide, or null.
     */
    public function imagePath(int $slideIndex): ?string
    {
        $entry = $this->imageEntry($slideIndex);
        $file = $entry['file'] ?? null;

        if (($entry['status'] ?? null) !== self::IMAGE_READY || ! is_string($file) || $file === '') {
            return null;
        }

        $disk = Storage::disk(self::IMAGE_DISK);

        return $disk->exists($file) ? $disk->path($file) : null;
    }

    public function imagesDone(): int
    {
        return count(array_filter(
            $this->imageSlots(),
            fn (int $index): bool => ($this->imageEntry($index)['status'] ?? null) === self::IMAGE_READY,
        ));
    }

    /**
     * Directory (on IMAGE_DISK) holding this lesson's images.
     */
    public function imageDirectory(): string
    {
        return 'teacher-ai/lessons/'.$this->getKey();
    }
}
