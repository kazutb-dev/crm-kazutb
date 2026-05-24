<?php

namespace App\Models\Questionnaire;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class GroupCourse extends Model
{
    use HasFactory;

    protected $table = 'questionnaire_group_courses';

    protected $fillable = [
        'name',
        'sort_order',
        'status',
    ];

    public function groups(): HasMany
    {
        return $this->hasMany(Group::class, 'group_course_id');
    }
}
