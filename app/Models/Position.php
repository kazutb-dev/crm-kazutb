<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Position extends Model
{
    use HasFactory;

    public const AUTHORITY_FLAG_MANAGERIAL = 'managerial';
    public const AUTHORITY_FLAG_REVIEW = 'review_authority';
    public const AUTHORITY_FLAG_APPROVAL = 'approval_authority';
    public const AUTHORITY_FLAG_WORKFLOW = 'workflow_authority';
    public const AUTHORITY_FLAG_KPI = 'kpi_authority';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'division_id',
        'name',
        'code',
        'description',
    ];

    public function division(): BelongsTo
    {
        return $this->belongsTo(Division::class);
    }

    /**
     * Blueprint only: no real data, just the catalog shape for future imports.
     *
     * @return array<int, array<string, mixed>>
     */
    public static function authorityBlueprints(): array
    {
        return [
            [
                'slug' => 'teacher',
                'label' => 'Teacher',
                'managerial' => false,
                'review_authority' => false,
                'approval_authority' => false,
                'workflow_authority' => false,
                'kpi_authority' => true,
                'recommended_scope' => 'academic',
            ],
            [
                'slug' => 'senior_lecturer',
                'label' => 'Senior Lecturer',
                'managerial' => false,
                'review_authority' => false,
                'approval_authority' => false,
                'workflow_authority' => false,
                'kpi_authority' => true,
                'recommended_scope' => 'academic',
            ],
            [
                'slug' => 'associate_professor',
                'label' => 'Associate Professor',
                'managerial' => false,
                'review_authority' => false,
                'approval_authority' => false,
                'workflow_authority' => false,
                'kpi_authority' => true,
                'recommended_scope' => 'academic',
            ],
            [
                'slug' => 'professor',
                'label' => 'Professor',
                'managerial' => false,
                'review_authority' => true,
                'approval_authority' => false,
                'workflow_authority' => false,
                'kpi_authority' => true,
                'recommended_scope' => 'academic',
            ],
            [
                'slug' => 'head_of_department',
                'label' => 'Head Of Department',
                'managerial' => true,
                'review_authority' => true,
                'approval_authority' => true,
                'workflow_authority' => true,
                'kpi_authority' => true,
                'recommended_scope' => 'department',
            ],
            [
                'slug' => 'dean',
                'label' => 'Dean',
                'managerial' => true,
                'review_authority' => true,
                'approval_authority' => true,
                'workflow_authority' => true,
                'kpi_authority' => true,
                'recommended_scope' => 'faculty',
            ],
            [
                'slug' => 'vice_rector',
                'label' => 'Vice Rector',
                'managerial' => true,
                'review_authority' => true,
                'approval_authority' => true,
                'workflow_authority' => true,
                'kpi_authority' => true,
                'recommended_scope' => 'university',
            ],
            [
                'slug' => 'director',
                'label' => 'Director',
                'managerial' => true,
                'review_authority' => true,
                'approval_authority' => true,
                'workflow_authority' => true,
                'kpi_authority' => true,
                'recommended_scope' => 'division',
            ],
            [
                'slug' => 'hr_specialist',
                'label' => 'HR Specialist',
                'managerial' => false,
                'review_authority' => true,
                'approval_authority' => true,
                'workflow_authority' => true,
                'kpi_authority' => false,
                'recommended_scope' => 'rectorate',
            ],
            [
                'slug' => 'registrar',
                'label' => 'Registrar',
                'managerial' => false,
                'review_authority' => true,
                'approval_authority' => true,
                'workflow_authority' => true,
                'kpi_authority' => false,
                'recommended_scope' => 'academic',
            ],
            [
                'slug' => 'methodist',
                'label' => 'Methodist',
                'managerial' => false,
                'review_authority' => true,
                'approval_authority' => false,
                'workflow_authority' => true,
                'kpi_authority' => false,
                'recommended_scope' => 'academic',
            ],
            [
                'slug' => 'administrator',
                'label' => 'Administrator',
                'managerial' => true,
                'review_authority' => true,
                'approval_authority' => true,
                'workflow_authority' => true,
                'kpi_authority' => true,
                'recommended_scope' => 'university',
            ],
        ];
    }
}
