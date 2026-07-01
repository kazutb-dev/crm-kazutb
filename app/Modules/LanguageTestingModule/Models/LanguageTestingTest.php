<?php

namespace App\Modules\LanguageTestingModule\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LanguageTestingTest extends Model
{
    use HasFactory;

    public const STATUS_ACTIVE = 'active';

    public const STATUS_INACTIVE = 'inactive';

    protected $table = 'language_testing_tests';

    protected $fillable = [
        'name',
        'language',
        'description',
        'passing_score',
        'total_questions',
        'status',
    ];

    protected $casts = [
        'passing_score' => 'integer',
        'total_questions' => 'integer',
    ];

    public function questions(): HasMany
    {
        return $this->hasMany(LanguageTestingQuestion::class, 'language_testing_test_id')->orderBy('sort_order')->orderBy('id');
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(LanguageTestingSession::class, 'language_testing_test_id');
    }

    public function results(): HasMany
    {
        return $this->hasMany(LanguageTestingResult::class, 'language_testing_test_id');
    }
}