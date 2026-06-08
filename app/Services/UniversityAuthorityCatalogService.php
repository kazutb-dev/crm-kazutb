<?php

namespace App\Services;

use App\Contracts\AcademicContextProvider;
use App\Models\AcademicScopeAssignment;
use App\Models\Delegation;
use App\Models\ImportAudit;
use App\Models\ImportJob;
use App\Models\ImportMapping;
use App\Models\ImportSource;
use App\Models\ImportValidation;
use App\Models\GovernanceAccessRequest;
use App\Models\KpiAccessGrant;
use App\Models\ModuleAssignment;
use App\Models\OrgUnit;
use App\Models\OrgUnitMapping;
use App\Models\Position;
use App\Models\ScopedGrant;
use Illuminate\Support\Facades\Schema;

class UniversityAuthorityCatalogService
{
    /**
     * @return array<string, mixed>
     */
    public function auditReport(): array
    {
        return [
            'org_unit_readiness' => $this->orgUnitReadiness(),
            'position_catalog_readiness' => $this->positionCatalogReadiness(),
            'authority_chain_readiness' => $this->authorityChainReadiness(),
            'module_governance_readiness' => $this->moduleGovernanceReadiness(),
            'import_governance_readiness' => $this->importReadiness(),
            'platonus_contract_readiness' => app(AcademicContextProvider::class)->contractState(),
            'readiness_table' => $this->readinessTable(),
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function orgUnitTypes(): array
    {
        $required = [
            OrgUnit::TYPE_UNIVERSITY,
            OrgUnit::TYPE_FACULTY,
            OrgUnit::TYPE_DEPARTMENT,
            OrgUnit::TYPE_VICE_RECTORATE,
            OrgUnit::TYPE_RECTORATE,
            OrgUnit::TYPE_CENTER,
            OrgUnit::TYPE_OFFICE,
            OrgUnit::TYPE_COLLEGE,
            OrgUnit::TYPE_MILITARY,
            OrgUnit::TYPE_COMMITTEE,
            OrgUnit::TYPE_LABORATORY,
            OrgUnit::TYPE_LIBRARY,
            OrgUnit::TYPE_ENDOWMENT,
            OrgUnit::TYPE_PROJECT_OFFICE,
            OrgUnit::TYPE_OTHER,
        ];

        return collect($required)
            ->map(function (string $type): array {
                return [
                    'value' => $type,
                    'label' => OrgUnit::TYPE_LABELS[$type] ?? $type,
                    'exists_in_model' => array_key_exists($type, OrgUnit::TYPE_LABELS),
                    'catalog_status' => array_key_exists($type, OrgUnit::TYPE_LABELS) ? 'supported' : 'missing',
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function positionCatalog(): array
    {
        return Position::authorityBlueprints();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function authorityChains(): array
    {
        return [
            [
                'slug' => 'teacher_to_superadmin',
                'label' => 'Teacher -> Head of Department -> Dean -> HR -> Super Admin',
                'steps' => [
                    'Teacher',
                    'Head Of Department',
                    'Dean',
                    'HR Specialist',
                    'Super Admin',
                ],
                'request_types' => [
                    GovernanceAccessRequest::TYPE_POSITION_CHANGE,
                    GovernanceAccessRequest::TYPE_DEPARTMENT_CHANGE,
                    GovernanceAccessRequest::TYPE_FACULTY_CHANGE,
                ],
            ],
            [
                'slug' => 'position_change',
                'label' => 'Position Change -> HR -> Effective',
                'steps' => [
                    'Requester',
                    'HR',
                    'Effective',
                ],
                'request_types' => [
                    GovernanceAccessRequest::TYPE_POSITION_CHANGE,
                ],
            ],
            [
                'slug' => 'faculty_change',
                'label' => 'Faculty Change -> Head -> Dean -> Effective',
                'steps' => [
                    'Head',
                    'Dean',
                    'Effective',
                ],
                'request_types' => [
                    GovernanceAccessRequest::TYPE_FACULTY_CHANGE,
                ],
            ],
            [
                'slug' => 'department_change',
                'label' => 'Department Change -> Head -> Effective',
                'steps' => [
                    'Head of Department',
                    'Effective',
                ],
                'request_types' => [
                    GovernanceAccessRequest::TYPE_DEPARTMENT_CHANGE,
                ],
            ],
            [
                'slug' => 'division_change',
                'label' => 'Division Change -> Division Head -> Effective',
                'steps' => [
                    'Division Head',
                    'Effective',
                ],
                'request_types' => [
                    GovernanceAccessRequest::TYPE_DIVISION_CHANGE,
                ],
            ],
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function moduleGovernance(): array
    {
        return ModuleAssignment::supportedModules();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function importGovernance(): array
    {
        return [
            [
                'source' => 'CSV',
                'source_type' => ImportSource::SOURCE_CSV,
                'target_entities' => $this->orgImportBlueprint(),
            ],
            [
                'source' => 'Excel',
                'source_type' => ImportSource::SOURCE_EXCEL,
                'target_entities' => $this->orgImportBlueprint(),
            ],
            [
                'source' => 'AD',
                'source_type' => ImportSource::SOURCE_AD,
                'target_entities' => [
                    'users',
                    'identity_fields',
                    'sync_only_identity',
                ],
            ],
            [
                'source' => 'Platonus',
                'source_type' => ImportSource::SOURCE_PLATONUS,
                'target_entities' => [
                    'student',
                    'program',
                    'group',
                    'course',
                    'stream',
                    'faculty',
                    'department',
                    'enrollment_status',
                ],
            ],
            [
                'source' => 'API',
                'source_type' => ImportSource::SOURCE_API,
                'target_entities' => $this->orgImportBlueprint(),
            ],
            [
                'source' => 'Manual Entry',
                'source_type' => ImportSource::SOURCE_MANUAL,
                'target_entities' => [
                    'org_unit',
                    'position',
                    'authority_chain',
                    'module_assignment',
                ],
            ],
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function importReadiness(): array
    {
        return $this->importReadinessBlueprint();
    }

    /**
     * @return array<string, mixed>
     */
    private function orgUnitReadiness(): array
    {
        return [
            'schema_ready' => Schema::hasTable('org_units') && Schema::hasTable('org_unit_mappings'),
            'catalog_ready' => true,
            'supported_types' => $this->orgUnitTypes(),
            'legacy_aliases' => [
                'administration' => OrgUnit::TYPE_OFFICE,
                'service' => OrgUnit::TYPE_OFFICE,
                'governance' => OrgUnit::TYPE_RECTORATE,
            ],
            'mapping_ready' => Schema::hasTable('org_unit_mappings'),
            'notes' => 'Target catalog is defined; existing legacy types remain readable.',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function positionCatalogReadiness(): array
    {
        $expected = $this->positionCatalog();

        return [
            'schema_ready' => Schema::hasTable('positions'),
            'catalog_ready' => ! empty($expected),
            'flag_set' => [
                Position::AUTHORITY_FLAG_MANAGERIAL,
                Position::AUTHORITY_FLAG_REVIEW,
                Position::AUTHORITY_FLAG_APPROVAL,
                Position::AUTHORITY_FLAG_WORKFLOW,
                Position::AUTHORITY_FLAG_KPI,
            ],
            'positions' => $expected,
            'notes' => 'Blueprint only; no real position data imported.',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function authorityChainReadiness(): array
    {
        return [
            'schema_ready' => Schema::hasTable('governance_access_requests')
                && Schema::hasTable('scoped_grants')
                && Schema::hasTable('delegations'),
            'catalog_ready' => true,
            'chains' => $this->authorityChains(),
            'request_types_supported' => [
                GovernanceAccessRequest::TYPE_POSITION_CHANGE,
                GovernanceAccessRequest::TYPE_FACULTY_CHANGE,
                GovernanceAccessRequest::TYPE_DEPARTMENT_CHANGE,
                GovernanceAccessRequest::TYPE_DIVISION_CHANGE,
                GovernanceAccessRequest::TYPE_DEGREE_CHANGE,
                GovernanceAccessRequest::TYPE_TITLE_CHANGE,
            ],
            'notes' => 'Universal chain model is defined; persistence remains in existing governance tables.',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function moduleGovernanceReadiness(): array
    {
        return [
            'schema_ready' => Schema::hasTable('module_assignments'),
            'catalog_ready' => true,
            'module_roles' => ['admin', 'reviewer', 'operator', 'viewer'],
            'assignment_kinds' => [
                ModuleAssignment::KIND_STANDARD,
                ModuleAssignment::KIND_TEMPORARY,
                ModuleAssignment::KIND_DELEGATION,
                ModuleAssignment::KIND_OVERRIDE,
            ],
            'modules' => $this->moduleGovernance(),
            'notes' => 'Module governance is backed by module_assignments foundation; no real assignments imported.',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function importReadinessBlueprint(): array
    {
        return [
            'schema_ready' => Schema::hasTable('import_sources')
                && Schema::hasTable('import_jobs')
                && Schema::hasTable('import_mappings')
                && Schema::hasTable('import_validations')
                && Schema::hasTable('import_audits'),
            'catalog_ready' => true,
            'supported_sources' => [
                'CSV',
                'Excel',
                'Manual Entry',
                'Future AD',
                'Future Platonus',
                'Future API',
            ],
            'pipeline_ready' => false,
            'sources' => [
                ImportSource::SOURCE_CSV,
                ImportSource::SOURCE_EXCEL,
                ImportSource::SOURCE_AD,
                ImportSource::SOURCE_PLATONUS,
                ImportSource::SOURCE_API,
                ImportSource::SOURCE_MANUAL,
            ],
            'blueprint' => [
                'import_source' => 'import_sources',
                'import_job' => 'import_jobs',
                'import_mapping' => 'import_mappings',
                'import_validation' => 'import_validations',
                'import_audit' => 'import_audits',
            ],
            'notes' => 'Import governance foundation is ready; execution pipeline and data loading remain intentionally disabled.',
        ];
    }

    /**
     * @return array<int, string>
     */
    private function orgImportBlueprint(): array
    {
        return [
            'Faculty',
            'Department',
            'Division',
            'Center',
            'Office',
            'Position',
            'Authority Chain',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function readinessTable(): array
    {
        return [
            [
                'area' => 'Source Of Truth',
                'readiness' => 'Ready',
            ],
            [
                'area' => 'RBAC',
                'readiness' => 'Transitional',
            ],
            [
                'area' => 'Org Scope',
                'readiness' => 'Ready',
            ],
            [
                'area' => 'Governance',
                'readiness' => 'Ready',
            ],
            [
                'area' => 'Module Governance',
                'readiness' => 'Ready',
            ],
            [
                'area' => 'Import Governance',
                'readiness' => 'Ready',
            ],
            [
                'area' => 'Profiles',
                'readiness' => 'Ready',
            ],
            [
                'area' => 'Delegations',
                'readiness' => 'Ready',
            ],
            [
                'area' => 'KPI',
                'readiness' => 'Ready',
            ],
            [
                'area' => 'Platonus Contract',
                'readiness' => 'Ready',
            ],
        ];
    }
}
