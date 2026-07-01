<?php

namespace App\Models\Testing;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TestingStudentBinding extends Model
{
    protected $table = 'testing_student_bindings';

    protected $fillable = [
        'student_id',
        'teacher_binding_id',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function teacherBinding(): BelongsTo
    {
        return $this->belongsTo(TestingBinding::class, 'teacher_binding_id');
    }
}
