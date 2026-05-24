<?php

namespace App\Models\Questionnaire;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Discipline extends Model
{
    use HasFactory;

    protected $table = 'questionnaire_disciplines';

    protected $fillable = [
        'name',
        'code',
        'status',
    ];

    public function teacherDisciplines(): HasMany
    {
        return $this->hasMany(TeacherDiscipline::class, 'discipline_id');
    }
}
