<?php

namespace App\Services\Hr;

use App\Models\HrDocumentPreview;
use App\Models\HrDocumentTemplate;
use App\Models\HrEmployee;
use App\Models\HrEmployeeAttachment;
use App\Models\HrEmployeeEducation;
use App\Models\HrEmploymentContract;
use App\Models\HrHiring;
use App\Models\Position;

/**
 * Lists and labels the hiring screens need (one source with the server-side enums).
 */
final class HiringOptions
{
    /**
     * @return array<string, mixed>
     */
    public static function all(): array
    {
        $pairs = static fn (array $labels): array => array_map(
            static fn (string $value, string $label): array => ['value' => $value, 'label' => $label],
            array_map('strval', array_keys($labels)),
            array_values($labels),
        );

        return [
            'categories' => array_map(static fn (string $value, string $label): array => [
                'value' => $value,
                'label' => $label,
                'name' => HrHiring::STAFF_CATEGORY_NAMES[$value],
                'defaults' => HrHiring::CATEGORY_DEFAULTS[$value],
            ], array_keys(Position::CATEGORY_LABELS), array_values(Position::CATEGORY_LABELS)),
            'probation' => [
                ['value' => 0, 'label' => 'Без испытательного срока'],
                ['value' => 1, 'label' => '1 месяц'],
                ['value' => 2, 'label' => '2 месяца'],
                ['value' => 3, 'label' => '3 месяца'],
            ],
            'terms' => $pairs(HrEmploymentContract::TERM_LABELS),
            'schedules' => $pairs(HrEmploymentContract::SCHEDULE_LABELS),
            'employments' => $pairs(HrEmploymentContract::EMPLOYMENT_LABELS),
            'issuers' => array_map(static fn (string $value, array $forms): array => ['value' => $value, 'label' => $forms[0]], array_keys(HrEmployee::ISSUERS), array_values(HrEmployee::ISSUERS)),
            'marital' => array_map(static fn (string $value, array $labels): array => ['value' => $value, 'male' => $labels[0], 'female' => $labels[1]], array_keys(HrEmployee::MARITAL_STATUSES), array_values(HrEmployee::MARITAL_STATUSES)),
            'military' => $pairs(HrEmployee::MILITARY_STATUSES),
            'disabilities' => $pairs(HrEmployee::DISABILITIES),
            'education_levels' => $pairs(HrEmployeeEducation::LEVELS),
            'attachment_types' => $pairs(HrEmployeeAttachment::DOC_TYPES),
            'document_types' => $pairs(HrDocumentTemplate::TYPE_LABELS),
            'statuses' => $pairs(HrHiring::STATUS_LABELS),
            'preview_statuses' => [
                HrDocumentPreview::STATUS_PENDING,
                HrDocumentPreview::STATUS_READY,
                HrDocumentPreview::STATUS_FAILED,
                HrDocumentPreview::STATUS_UNAVAILABLE,
            ],
        ];
    }
}
