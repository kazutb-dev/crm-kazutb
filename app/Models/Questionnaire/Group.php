<?php

namespace App\Models\Questionnaire;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Group extends Model
{
    use HasFactory;

    protected $table = 'questionnaire_groups';

    protected $fillable = [
        'name',
        'group_course_id',
        'group_speciality_id',
        'group_educational_program_id',
        'course',
        'speciality',
        'educational_program',
        'status',
    ];

    public function courseRef(): BelongsTo
    {
        return $this->belongsTo(GroupCourse::class, 'group_course_id');
    }

    public function specialityRef(): BelongsTo
    {
        return $this->belongsTo(GroupSpeciality::class, 'group_speciality_id');
    }

    public function educationalProgramRef(): BelongsTo
    {
        return $this->belongsTo(GroupEducationalProgram::class, 'group_educational_program_id');
    }

    public function students(): HasMany
    {
        return $this->hasMany(Student::class, 'group_id');
    }

    public function groupDisciplines(): HasMany
    {
        return $this->hasMany(GroupDiscipline::class, 'group_id');
    }
}
