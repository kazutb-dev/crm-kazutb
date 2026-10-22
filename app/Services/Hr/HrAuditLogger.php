<?php

namespace App\Services\Hr;

use App\Models\HrDocument;
use App\Models\HrDocumentTemplate;
use App\Models\HrHiring;
use App\Models\User;
use App\Services\AuditLogService;

/**
 * HR module events in the common audit log. Only ids, document types and versions are written — no names,
 * IINs or other personal data (they stay in the HR tables behind the access check).
 */
class HrAuditLogger
{
    public const DOCUMENT_GENERATED = 'hr.document.generated';

    public const DOCUMENT_DOWNLOADED = 'hr.document.downloaded';

    public const DOCUMENT_SIGNED = 'hr.document.signed';

    public const PREVIEW_REQUESTED = 'hr.preview.requested';

    public function __construct(private readonly AuditLogService $auditLog) {}

    public function document(string $event, HrDocument $document, ?User $actor = null): void
    {
        $label = HrDocumentTemplate::TYPE_LABELS[$document->type].' v'.$document->version.', приём #'.$document->hiring_id;

        $this->auditLog->logEvent($event, 'HrDocument', $document->id, $label, match ($event) {
            self::DOCUMENT_GENERATED => 'Сформирован документ: '.$label,
            self::DOCUMENT_DOWNLOADED => 'Скачан документ: '.$label,
            self::DOCUMENT_SIGNED => 'Документ отмечен подписанным: '.$label,
            default => $label,
        }, [
            'hiring_id' => $document->hiring_id,
            'type' => $document->type,
            'version' => $document->version,
            'template_id' => $document->template_id,
        ], $actor);
    }

    public function preview(HrHiring $hiring, string $type, ?User $actor = null): void
    {
        $label = HrDocumentTemplate::TYPE_LABELS[$type].', приём #'.$hiring->id;

        $this->auditLog->logEvent(self::PREVIEW_REQUESTED, 'HrHiring', $hiring->id, $label, 'Предпросмотр: '.$label, ['type' => $type], $actor);
    }
}
