<?php

namespace App\Models\Questionnaire;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class GroupEducationalProgram extends Model
{
    use HasFactory;

    protected $table = 'questionnaire_group_educational_programs';

    protected $fillable = [
        'name',
        'group_speciality_id',
        'sort_order',
        'status',
    ];

    public function speciality(): BelongsTo
    {
        return $this->belongsTo(GroupSpeciality::class, 'group_speciality_id');
    }

    public function groups(): HasMany
    {
        return $this->hasMany(Group::class, 'group_educational_program_id');
    }
}
