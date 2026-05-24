<?php

namespace App\Models\Questionnaire;

use App\Models\Department;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class GroupSpeciality extends Model
{
    use HasFactory;

    protected $table = 'questionnaire_group_specialities';

    protected $fillable = [
        'name',
        'department_id',
        'sort_order',
        'status',
    ];

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class, 'department_id');
    }

    public function groups(): HasMany
    {
        return $this->hasMany(Group::class, 'group_speciality_id');
    }

    public function educationalPrograms(): HasMany
    {
        return $this->hasMany(GroupEducationalProgram::class, 'group_speciality_id');
    }
}
