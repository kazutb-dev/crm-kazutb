<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class NavigationRoute extends Model
{
    use HasFactory;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'badge',
        'title',
        'meta',
        'kind',
        'building',
        'floor',
        'room',
        'steps',
        'map_image_path',
        'is_active',
        'sort_order',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'steps' => 'array',
            'is_active' => 'boolean',
            'floor' => 'integer',
            'sort_order' => 'integer',
        ];
    }
}
