<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TopicCheckItem extends Model
{
    use HasFactory;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'topic_check_id',
        'matched_diploma_id',
        'original_title_ru',
        'score',
        'match_type',
        'risk_level',
    ];

    protected $casts = [
        'score' => 'float',
    ];

    public function topicCheck(): BelongsTo
    {
        return $this->belongsTo(TopicCheck::class);
    }

    public function matchedDiploma(): BelongsTo
    {
        return $this->belongsTo(Diploma::class, 'matched_diploma_id');
    }
}
