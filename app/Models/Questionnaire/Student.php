<?php

namespace App\Models\Questionnaire;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Student extends Model
{
    use HasFactory;

    protected $table = 'questionnaire_students';

    protected $fillable = [
        'full_name',
        'user_id',
        'login',
        'group_id',
        'status',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(Group::class, 'group_id');
    }

    public function responses(): HasMany
    {
        return $this->hasMany(SurveyResponse::class, 'student_id');
    }
}
