<?php

namespace App\Services\Hr;

use App\Models\AuditLog;
use App\Models\HrDocument;
use App\Models\HrDocumentTemplate;
use App\Models\HrHiring;
use App\Models\User;
use App\Services\AuditLogService;
use Illuminate\Database\Eloquent\Builder;

/**
 * HR module events in the common audit log. Only ids, document types, versions and field names are
 * written — no names, IINs or other personal data (they stay in the HR tables behind the access check).
 * Every hiring-related event carries `hiring_id` in its metadata, which the hiring's history reads.
 */
class HrAuditLogger
{
    public const HIRING_CREATED = 'hr.hiring.created';

    public const HIRING_VIEWED = 'hr.hiring.viewed';

    public const HIRING_UPDATED = 'hr.hiring.updated';

    public const HIRING_DELETED = 'hr.hiring.deleted';

    public const DOCUMENT_GENERATED = 'hr.document.generated';

    public const DOCUMENT_DOWNLOADED = 'hr.document.downloaded';

    public const DOCUMENT_SIGNED = 'hr.document.signed';

    public const DOCUMENT_SCAN_OPENED = 'hr.document.scan_opened';

    public const PREVIEW_REQUESTED = 'hr.preview.requested';

    public const PREVIEW_OPENED = 'hr.preview.opened';

    public const PHOTO_UPLOADED = 'hr.photo.uploaded';

    public const PHOTO_DELETED = 'hr.photo.deleted';

    public const ATTACHMENT_UPLOADED = 'hr.attachment.uploaded';

    public const ATTACHMENT_OPENED = 'hr.attachment.opened';

    public const ATTACHMENT_DELETED = 'hr.attachment.deleted';

    public const SETTINGS_UPDATED = 'hr.settings.updated';

    public const TEMPLATE_UPLOADED = 'hr.template.uploaded';

    public const TEMPLATE_ACTIVATED = 'hr.template.activated';

    public const CATALOG_UPDATED = 'hr.catalog.updated';

    public const RIGHTS_CHANGED = 'hr.rights.changed';

    public function __construct(private readonly AuditLogService $auditLog) {}

    public function document(string $event, HrDocument $document, ?User $actor = null): void
    {
        $label = HrDocumentTemplate::TYPE_LABELS[$document->type].' v'.$document->version.', приём #'.$document->hiring_id;

        $this->auditLog->logEvent($event, 'HrDocument', $document->id, $label, match ($event) {
            self::DOCUMENT_GENERATED => 'Сформирован документ: '.$label,
            self::DOCUMENT_DOWNLOADED => 'Скачан документ: '.$label,
            self::DOCUMENT_SIGNED => 'Документ отмечен подписанным: '.$label,
            self::DOCUMENT_SCAN_OPENED => 'Открыт скан подписанного документа: '.$label,
            default => $label,
        }, [
            'hiring_id' => $document->hiring_id,
            'type' => $document->type,
            'version' => $document->version,
            'template_id' => $document->template_id,
        ], $actor);
    }

    public function preview(HrHiring $hiring, string $type, ?User $actor = null, string $event = self::PREVIEW_REQUESTED): void
    {
        $label = HrDocumentTemplate::TYPE_LABELS[$type].', приём #'.$hiring->id;
        $description = $event === self::PREVIEW_OPENED ? 'Открыт PDF-предпросмотр: '.$label : 'Предпросмотр: '.$label;

        $this->auditLog->logEvent($event, 'HrHiring', $hiring->id, $label, $description, ['hiring_id' => $hiring->id, 'type' => $type], $actor);
    }

    /**
     * @param  array<string, mixed>  $metadata  ids and field names only
     */
    public function hiring(string $event, HrHiring $hiring, string $description, array $metadata = [], ?User $actor = null): void
    {
        $this->auditLog->logEvent($event, 'HrHiring', $hiring->id, 'Приём #'.$hiring->id, $description, ['hiring_id' => $hiring->id] + $metadata, $actor);
    }

    /**
     * Module settings, templates, catalog and rights.
     *
     * @param  array<string, mixed>  $metadata
     */
    public function module(string $event, string $subjectType, ?int $subjectId, string $description, array $metadata = [], ?User $actor = null): void
    {
        $this->auditLog->logEvent($event, $subjectType, $subjectId, $description, $description, $metadata, $actor);
    }

    /**
     * Events of one hiring for its history tab, newest first.
     *
     * @return list<array{at: string, actor: string, description: string}>
     */
    public function history(HrHiring $hiring, int $limit = 200): array
    {
        return AuditLog::query()
            ->where(function (Builder $query) use ($hiring): void {
                $query->where(fn (Builder $q) => $q->where('subject_type', 'HrHiring')->where('subject_id', $hiring->id))
                    ->orWhere(fn (Builder $q) => $q->where('event_type', 'like', 'hr.%')->where('metadata->hiring_id', $hiring->id));
            })
            ->orderByDesc('id')
            ->limit($limit)
            ->get(['created_at', 'actor_name', 'description'])
            ->map(fn (AuditLog $log): array => [
                'at' => $log->created_at?->format('d.m.Y H:i') ?? '',
                'actor' => (string) $log->actor_name,
                'description' => (string) $log->description,
            ])
            ->all();
    }
}
