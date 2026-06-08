<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StudentProfile extends Model
{
    protected $fillable = [
        'user_id',
        'legacy_student_id',
        'student_code',
        'educational_program_id',
        'group_id',
        'course_number',
        'stream_code',
        'entry_year',
        'expected_graduation_year',
        'academic_status',
        'source_system',
        'source_external_id',
        'platonus_person_uid',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'legacy_student_id' => 'integer',
            'educational_program_id' => 'integer',
            'group_id' => 'integer',
            'course_number' => 'integer',
            'entry_year' => 'integer',
            'expected_graduation_year' => 'integer',
            'metadata' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function legacyStudent(): BelongsTo
    {
        return $this->belongsTo(Student::class, 'legacy_student_id');
    }

    public function educationalProgram(): BelongsTo
    {
        return $this->belongsTo(EducationalProgram::class, 'educational_program_id');
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(Group::class, 'group_id');
    }
}
