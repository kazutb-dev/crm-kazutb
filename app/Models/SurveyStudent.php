<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SurveyStudent extends Model
{
    use HasFactory;

    protected $fillable = [
        'student_id',
        'group_id',
        'survey_id',
    ];
}
