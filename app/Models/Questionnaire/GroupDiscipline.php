<?php

namespace App\Models\Questionnaire;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GroupDiscipline extends Model
{
    use HasFactory;

    protected $table = 'questionnaire_group_disciplines';

    protected $fillable = [
        'group_id',
        'teacher_discipline_id',
        'academic_year',
        'semester',
        'status',
    ];

    public function group(): BelongsTo
    {
        return $this->belongsTo(Group::class, 'group_id');
    }

    public function teacherDiscipline(): BelongsTo
    {
        return $this->belongsTo(TeacherDiscipline::class, 'teacher_discipline_id');
    }
}
