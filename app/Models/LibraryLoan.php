<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LibraryLoan extends Model
{
    use HasFactory;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'book_id',
        'book_legacy_doc_id',
        'book_title',
        'book_author',
        'book_isbn',
        'user_id',
        'issued_by',
        'issued_at',
        'due_at',
        'notes',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'book_legacy_doc_id' => 'integer',
            'user_id' => 'integer',
            'issued_by' => 'integer',
            'issued_at' => 'date',
            'due_at' => 'date',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function issuer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'issued_by');
    }
}