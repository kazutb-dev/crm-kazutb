<?php

namespace App\Models\Questionnaire;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TeacherDiscipline extends Model
{
    use HasFactory;

    protected $table = 'questionnaire_teacher_disciplines';

    protected $fillable = [
        'teacher_id',
        'discipline_id',
        'academic_year',
        'semester',
        'status',
    ];

    public function teacher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'teacher_id');
    }

    public function discipline(): BelongsTo
    {
        return $this->belongsTo(Discipline::class, 'discipline_id');
    }

    public function groupDisciplines(): HasMany
    {
        return $this->hasMany(GroupDiscipline::class, 'teacher_discipline_id');
    }
}
