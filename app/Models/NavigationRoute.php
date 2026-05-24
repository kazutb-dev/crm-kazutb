<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
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
        'map_polyline',
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
            'map_polyline' => 'array',
            'is_active' => 'boolean',
            'floor' => 'integer',
            'sort_order' => 'integer',
        ];
    }

    public function attachedUsers(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'navigation_route_user')
            ->withTimestamps();
    }
}
