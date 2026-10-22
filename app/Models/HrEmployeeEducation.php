<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HrEmployeeEducation extends Model
{
    public const LEVELS = [
        'secondary_special' => 'Среднее специальное',
        'bachelor' => 'Бакалавриат',
        'master' => 'Магистратура',
        'phd' => 'Докторантура (PhD)',
        'specialist' => 'Высшее (специалитет)',
    ];

    /** "education" is uncountable for the pluralizer. */
    protected $table = 'hr_employee_educations';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'employee_id',
        'level',
        'institution',
        'graduation_year',
        'specialty',
        'diploma_number',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'graduation_year' => 'integer',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(HrEmployee::class, 'employee_id');
    }

    public function levelLabel(): string
    {
        return self::LEVELS[$this->level] ?? (string) $this->level;
    }
}
