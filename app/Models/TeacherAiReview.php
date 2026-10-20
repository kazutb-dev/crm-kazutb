<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TeacherAiReview extends Model
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_PROCESSING = 'processing';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_FAILED = 'failed';

    public const SOURCE_FILE = 'file';
    public const SOURCE_TEXT = 'text';

    /**
     * A review still pending/processing after this many minutes is treated
     * as stuck (worker restarted, job lost) and may be retried.
     */
    public const STALE_AFTER_MINUTES = 15;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'user_id',
        'document_type',
        'title',
        'source',
        'original_name',
        'focus',
        'content_text',
        'content_chars',
        'is_partial',
        'status',
        'summary',
        'key_points',
        'findings',
        'overall',
        'model',
        'prompt_tokens',
        'completion_tokens',
        'error_message',
        'completed_at',
    ];

    protected $casts = [
        'key_points' => 'array',
        'findings' => 'array',
        'is_partial' => 'boolean',
        'content_chars' => 'integer',
        'prompt_tokens' => 'integer',
        'completion_tokens' => 'integer',
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
}
