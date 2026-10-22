<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

/**
 * A version of a .docx template. Version 1 of each type is the built-in file shipped with the code
 * (file_path = null); the HR department can upload newer versions and switch the active one.
 */
class HrDocumentTemplate extends Model
{
    public const TYPE_CONTRACT = 'contract';

    public const TYPE_ORDER = 'order';

    public const TYPE_CARD = 'card';

    public const TYPE_LABELS = [
        self::TYPE_CONTRACT => 'Трудовой договор',
        self::TYPE_ORDER => 'Приказ о приёме',
        self::TYPE_CARD => 'Личная карточка',
    ];

    /**
     * @var list<string>
     */
    protected $fillable = [
        'type',
        'version',
        'file_path',
        'original_name',
        'sha256',
        'is_active',
        'comment',
        'uploaded_by',
    ];

    protected function casts(): array
    {
        return [
            'version' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public static function active(string $type): self
    {
        return self::query()->where('type', $type)->where('is_active', true)->orderByDesc('version')->firstOrFail();
    }

    public static function builtInPath(string $type): string
    {
        return resource_path("hr/templates/{$type}.docx");
    }

    public function absolutePath(): string
    {
        return $this->file_path === null
            ? self::builtInPath($this->type)
            : Storage::disk(config('hr.disk'))->path($this->file_path);
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
