<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AcademicMobilityApplication extends Model
{
    protected $fillable = [
        'user_id',
        'full_name',
        'phone',
        'student_group',
        'document_types',
        'document_files',
        'status',
        'notes',
        'review_notes',
        'reviewed_at',
        'reviewed_by',
    ];

    protected function casts(): array
    {
        return [
            'document_types' => 'array',
            'document_files' => 'array',
            'reviewed_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
