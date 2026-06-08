<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PlatonusStudent extends Model
{
    protected $table = 'platonus_students';

    protected $fillable = [
        'user_id',
        'platonus_id',
        'full_name',
        'iin',
        'student_id_number',
        'course',
        'educational_program',
        'faculty',
        'group_name',
        'gpa',
        'status',
        'study_form',
        'enrollment_date',
        'expected_graduation',
        'raw_data',
        'synced_at',
    ];

    protected $casts = [
        'gpa'                 => 'decimal:2',
        'raw_data'            => 'array',
        'synced_at'           => 'datetime',
        'enrollment_date'     => 'date',
        'expected_graduation' => 'date',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
