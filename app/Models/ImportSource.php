<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ImportSource extends Model
{
    public const SOURCE_CSV = 'csv';
    public const SOURCE_EXCEL = 'excel';
    public const SOURCE_AD = 'ad';
    public const SOURCE_PLATONUS = 'platonus';
    public const SOURCE_API = 'api';
    public const SOURCE_MANUAL = 'manual_entry';

    public const SOURCE_LABELS = [
        self::SOURCE_CSV => 'CSV',
        self::SOURCE_EXCEL => 'Excel',
        self::SOURCE_AD => 'AD',
        self::SOURCE_PLATONUS => 'Platonus',
        self::SOURCE_API => 'API',
        self::SOURCE_MANUAL => 'Manual Entry',
    ];

    protected $fillable = [
        'key',
        'label',
        'source_type',
        'is_active',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'metadata' => 'array',
        ];
    }
}
