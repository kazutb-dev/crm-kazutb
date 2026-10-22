<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * PDF preview of a hiring document, rendered by LibreOffice in the queue. Short-lived: pruned by the scheduler.
 */
class HrDocumentPreview extends Model
{
    use HasUuids;

    public const STATUS_PENDING = 'pending';

    public const STATUS_READY = 'ready';

    public const STATUS_FAILED = 'failed';

    /** LibreOffice is not configured on this server: the UI says "preview unavailable", .docx download still works. */
    public const STATUS_UNAVAILABLE = 'unavailable';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'hiring_id',
        'user_id',
        'type',
        'status',
        'docx_path',
        'pdf_path',
        'error',
    ];

    public function hiring(): BelongsTo
    {
        return $this->belongsTo(HrHiring::class, 'hiring_id');
    }
}
