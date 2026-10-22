<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Scanned document (PDF) of the personal file, kept on the private HR disk.
 */
class HrEmployeeAttachment extends Model
{
    public const DOC_TYPES = [
        'id_card' => 'Удостоверение личности',
        'diploma' => 'Диплом',
        'diploma_supplement' => 'Приложение к диплому',
        'no_criminal_record' => 'Справка о несудимости',
        'medical' => 'Медицинская справка',
        'military_id' => 'Военный билет',
        'child_birth_certificate' => 'Свидетельство о рождении ребёнка',
        'other' => 'Иное',
    ];

    /**
     * @var list<string>
     */
    protected $fillable = [
        'employee_id',
        'doc_type',
        'original_name',
        'file_path',
        'size',
        'sha256',
        'uploaded_by',
    ];

    protected function casts(): array
    {
        return [
            'size' => 'integer',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(HrEmployee::class, 'employee_id');
    }

    public function docTypeLabel(): string
    {
        return self::DOC_TYPES[$this->doc_type] ?? (string) $this->doc_type;
    }
}
