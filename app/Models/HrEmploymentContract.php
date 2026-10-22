<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HrEmploymentContract extends Model
{
    public const TERM_INDEFINITE = 'indefinite';

    public const TERM_REPLACEMENT = 'replacement';

    /** Fixed terms in years. */
    public const TERM_YEARS = [
        '1y' => 1,
        '2y' => 2,
        '3y' => 3,
    ];

    public const TERM_LABELS = [
        '1y' => '1 год',
        '2y' => '2 года',
        '3y' => '3 года',
        self::TERM_INDEFINITE => 'Неопределённый срок',
        self::TERM_REPLACEMENT => 'На время замещения',
    ];

    public const SCHEDULE_PPS = 'pps';

    public const SCHEDULE_AUP = 'aup';

    public const SCHEDULE_SHIFT = 'shift';

    public const SCHEDULE_LABELS = [
        self::SCHEDULE_PPS => 'Пятидневка, 8 часов (ППС)',
        self::SCHEDULE_AUP => '08:30–17:30 (АУП)',
        self::SCHEDULE_SHIFT => 'По графику',
    ];

    public const EMPLOYMENT_MAIN = 'main';

    public const EMPLOYMENT_SECONDARY = 'secondary';

    public const EMPLOYMENT_LABELS = [
        self::EMPLOYMENT_MAIN => 'Основная работа',
        self::EMPLOYMENT_SECONDARY => 'Совместительство',
    ];

    /**
     * @var list<string>
     */
    protected $fillable = [
        'hiring_id',
        'number',
        'date',
        'term',
        'salary',
        'schedule',
        'employment',
        'vacation_days',
    ];

    protected function casts(): array
    {
        return [
            'date' => 'date',
            'salary' => 'integer',
            'vacation_days' => 'integer',
        ];
    }

    public function hiring(): BelongsTo
    {
        return $this->belongsTo(HrHiring::class, 'hiring_id');
    }

    public function termYears(): ?int
    {
        return self::TERM_YEARS[$this->term] ?? null;
    }
}
