<?php

namespace App\Models;

use App\Services\Hr\Iin;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Personal file of an employee hired through the HR module (personal data — see the HR access rules).
 * IIN and ID card number are encrypted with APP_KEY, so a database copy without that key cannot read them.
 */
class HrEmployee extends Model
{
    use SoftDeletes;

    public const CITIZENSHIP_KZ = 'kz';

    public const CITIZENSHIP_OTHER = 'other';

    public const ISSUER_MVD = 'mvd';

    public const ISSUER_MJU = 'mju';

    /** [RU nominative, RU after «выданного …», KZ] */
    public const ISSUERS = [
        self::ISSUER_MVD => ['МВД РК', 'МВД РК', 'ҚР ІІМ'],
        self::ISSUER_MJU => ['Министерство юстиции РК', 'Министерством юстиции РК', 'ҚР Әділет министрлігі'],
    ];

    /** Marital status labels depend on gender: [male, female]. */
    public const MARITAL_STATUSES = [
        'married' => ['Женат', 'Замужем'],
        'single' => ['Холост', 'Не замужем'],
        'divorced' => ['Разведён', 'Разведена'],
        'widowed' => ['Вдовец', 'Вдова'],
    ];

    public const MILITARY_STATUSES = [
        'liable' => 'Военнообязанный',
        'not_liable' => 'Невоеннообязанный',
        'conscript' => 'Призывник',
        'deregistered' => 'Снят с учёта',
    ];

    public const DISABILITIES = [
        'none' => 'Нет',
        '1' => 'I группа',
        '2' => 'II группа',
        '3' => 'III группа',
    ];

    /**
     * @var list<string>
     */
    protected $fillable = [
        'user_id',
        'last_name',
        'first_name',
        'middle_name',
        'iin',
        'birth_date',
        'gender',
        'citizenship',
        'citizenship_ru',
        'citizenship_kz',
        'photo_path',
        'id_card_number',
        'id_card_issued_at',
        'id_card_issuer',
        'city',
        'street',
        'house',
        'apartment',
        'phone',
        'marital_status',
        'military_status',
        'is_pensioner',
        'disability',
        'is_student',
        'is_large_family',
        'created_by',
        'updated_by',
    ];

    /**
     * Never serialised: the UI gets masked values or reads them explicitly where allowed.
     *
     * @var list<string>
     */
    protected $hidden = [
        'iin',
        'iin_hash',
        'id_card_number',
    ];

    protected function casts(): array
    {
        return [
            'iin' => 'encrypted',
            'id_card_number' => 'encrypted',
            'birth_date' => 'date',
            'id_card_issued_at' => 'date',
            'is_pensioner' => 'boolean',
            'is_student' => 'boolean',
            'is_large_family' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::saving(function (HrEmployee $employee): void {
            if ($employee->isDirty('iin')) {
                $employee->iin_hash = self::hashIin($employee->iin);
            }
        });
    }

    /**
     * Keyed hash used for the unique index and the "search by full IIN" lookup.
     */
    public static function hashIin(?string $iin): ?string
    {
        $iin = trim((string) $iin);

        return $iin === '' ? null : hash_hmac('sha256', $iin, (string) config('app.key'));
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function children(): HasMany
    {
        return $this->hasMany(HrEmployeeChild::class, 'employee_id')->orderBy('sort_order')->orderBy('id');
    }

    public function educations(): HasMany
    {
        return $this->hasMany(HrEmployeeEducation::class, 'employee_id')->orderBy('sort_order')->orderBy('id');
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(HrEmployeeAttachment::class, 'employee_id')->orderBy('id');
    }

    public function hirings(): HasMany
    {
        return $this->hasMany(HrHiring::class, 'employee_id');
    }

    /** «Айтмаганбетов Асет Лайыкович» */
    public function fullName(): string
    {
        return trim(implode(' ', array_filter([trim((string) $this->last_name), trim((string) $this->first_name), trim((string) $this->middle_name)])));
    }

    /** «Айтмаганбетов А.Л.» */
    public function shortName(): string
    {
        $initials = implode('', array_map(
            static fn (string $part): string => mb_substr($part, 0, 1).'.',
            array_filter([trim((string) $this->first_name), trim((string) $this->middle_name)]),
        ));

        return trim(trim((string) $this->last_name).' '.$initials);
    }

    public function maskedIin(): string
    {
        return Iin::mask($this->iin);
    }

    /** «052345678» → «******678» */
    public function maskedIdCardNumber(): string
    {
        $number = (string) $this->id_card_number;

        return $number === '' ? '' : str_repeat('*', max(0, mb_strlen($number) - 3)).mb_substr($number, -3);
    }

    public function maritalStatusLabel(): string
    {
        $labels = self::MARITAL_STATUSES[$this->marital_status] ?? null;

        return $labels ? $labels[$this->gender === Iin::GENDER_FEMALE ? 1 : 0] : '';
    }
}
