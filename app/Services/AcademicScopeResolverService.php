<?php

namespace App\Services;

use App\Contracts\AcademicContextProvider;
use App\Models\AcademicScopeAssignment;
use App\Models\GovernanceAccessRequest;
use App\Models\Student;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Schema;

class AcademicScopeResolverService implements AcademicContextProvider
{
    public function sourceSystem(): string
    {
        return (string) config('academic.contract_layer.primary_source', 'crm');
    }

    public function sourceLabel(): string
    {
        return match ($this->sourceSystem()) {
            'crm' => 'CRM academic context',
            'platonus' => 'Platonus academic context',
            default => 'Academic context provider',
        };
    }

    public function supportedSources(): array
    {
        $supportedSources = config('academic.contract_layer.supported_sources', []);

        if (! is_array($supportedSources)) {
            return ['crm', 'platonus', 'future_api', 'future_tunnel', 'future_readonly_connection'];
        }

        return array_values(array_filter(array_map(
            static fn($source): string => (string) $source,
            $supportedSources,
        )));
    }

    /**
     * @param Collection<int, User> $users
     * @return array<int, array<string, mixed>>
     */
    public function resolveForUsers(Collection $users): array
    {
        $userIds = $users->pluck('id')->map(fn($id): int => (int) $id)->values();

        $employeeProfiles = $users->mapWithKeys(function (User $user): array {
            return [(int) $user->id => $user->employeeProfile];
        });

        $studentProfiles = $users->mapWithKeys(function (User $user): array {
            return [(int) $user->id => $user->studentProfile];
        });

        $assignmentsByUser = collect();
        if (Schema::hasTable('academic_scope_assignments') && $userIds->isNotEmpty()) {
            $assignmentsByUser = AcademicScopeAssignment::query()
                ->with(['educationalProgram:id,name,code', 'group:id,name,code'])
                ->whereIn('user_id', $userIds->all())
                ->orderByDesc('id')
                ->get()
                ->groupBy('user_id');
        }

        $pendingAcademicRequestsByUser = collect();
        if (Schema::hasTable('governance_access_requests') && $userIds->isNotEmpty()) {
            $pendingAcademicRequestsByUser = GovernanceAccessRequest::query()
                ->whereIn('subject_user_id', $userIds->all())
                ->whereIn('request_type', [
                    GovernanceAccessRequest::TYPE_ACADEMIC,
                    GovernanceAccessRequest::TYPE_ACADEMIC_SCOPE,
                ])
                ->where('status', GovernanceAccessRequest::STATUS_PENDING)
                ->select(['id', 'subject_user_id'])
                ->get()
                ->groupBy('subject_user_id');
        }

        $legacyStudentsByEmail = collect();
        if (Schema::hasTable('students')) {
            $emails = $users->pluck('email')
                ->filter(fn($email): bool => is_string($email) && trim($email) !== '')
                ->map(fn($email): string => mb_strtolower(trim((string) $email)))
                ->unique()
                ->values();

            if ($emails->isNotEmpty()) {
                $legacyStudentsByEmail = Student::query()
                    ->with('group:id,name,code,department_id')
                    ->whereIn('email', $emails->all())
                    ->get()
                    ->keyBy(fn(Student $student): string => mb_strtolower((string) $student->email));
            }
        }

        $resolved = [];

        foreach ($users as $user) {
            $resolved[(int) $user->id] = $this->resolveForUser(
                $user,
                $employeeProfiles->get((int) $user->id),
                $studentProfiles->get((int) $user->id),
                $assignmentsByUser->get((int) $user->id, collect()),
                $pendingAcademicRequestsByUser->get((int) $user->id, collect())->count(),
                $legacyStudentsByEmail
            );
        }

        return $resolved;
    }

    /**
     * @param Collection<int, Student> $legacyStudentsByEmail
     * @return array<string, mixed>
     */
    public function resolveForUser(
        User $user,
        mixed $employeeProfile = null,
        mixed $studentProfile = null,
        ?Collection $assignments = null,
        int $pendingAcademicRequests = 0,
        ?Collection $legacyStudentsByEmail = null,
    ): array {
        $assignments ??= collect();
        $legacyStudentsByEmail ??= collect();

        $emailKey = is_string($user->email) ? mb_strtolower(trim($user->email)) : '';
        $legacyStudent = $emailKey !== '' ? $legacyStudentsByEmail->get($emailKey) : null;

        $activeAssignments = $assignments
            ->filter(fn(AcademicScopeAssignment $assignment): bool => $assignment->isActiveNow())
            ->values();

        $activeAssignmentRows = $activeAssignments->map(function (AcademicScopeAssignment $assignment): array {
            return [
                'id' => $assignment->id,
                'assignment_type' => $assignment->assignment_type,
                'assignment_type_label' => AcademicScopeAssignment::TYPE_LABELS[$assignment->assignment_type] ?? $assignment->assignment_type,
                'scope_status' => $assignment->scope_status,
                'faculty_id' => $assignment->faculty_id,
                'department_id' => $assignment->department_id,
                'educational_program_id' => $assignment->educational_program_id,
                'educational_program_name' => $assignment->educationalProgram?->name,
                'group_id' => $assignment->group_id,
                'group_name' => $assignment->group?->name,
                'course_number' => $assignment->course_number,
                'stream_code' => $assignment->stream_code,
                'source_system' => $assignment->source_system,
                'source_external_id' => $assignment->source_external_id,
                'starts_at' => $assignment->starts_at?->toIso8601String(),
                'ends_at' => $assignment->ends_at?->toIso8601String(),
            ];
        })->values();

        $hasEmployeeProfile = $employeeProfile !== null;
        $hasStudentProfile = $studentProfile !== null || $legacyStudent !== null;
        $dualContext = $hasEmployeeProfile && $hasStudentProfile;

        $status = 'missing';
        if ($hasStudentProfile && $activeAssignmentRows->isNotEmpty()) {
            $status = 'ready';
        } elseif ($hasStudentProfile || $pendingAcademicRequests > 0) {
            $status = 'partial';
        }

        $riskFlags = collect();

        if ($hasStudentProfile && $activeAssignmentRows->isEmpty() && $pendingAcademicRequests === 0) {
            $riskFlags->push([
                'code' => 'student_profile_without_academic_scope',
                'label' => 'Есть student context, но нет активного academic scope',
                'severity' => 'high',
            ]);
        }

        if (! $hasStudentProfile && $pendingAcademicRequests > 0) {
            $riskFlags->push([
                'code' => 'pending_academic_request_without_profile',
                'label' => 'Есть pending academic request без student profile',
                'severity' => 'medium',
            ]);
        }

        if ($dualContext) {
            $riskFlags->push([
                'code' => 'dual_identity_context',
                'label' => 'Пользователь имеет одновременно employee и student context',
                'severity' => 'low',
            ]);
        }

        $assignmentTypes = $activeAssignmentRows->pluck('assignment_type')->unique()->values();

        return [
            'status' => $status,
            'status_label' => match ($status) {
                'ready' => 'Academic scope ready',
                'partial' => 'Academic scope partial',
                default => 'Academic scope missing',
            },
            'employee_profile' => [
                'exists' => $hasEmployeeProfile,
                'source_system' => $employeeProfile?->source_system,
                'source_external_id' => $employeeProfile?->source_external_id,
                'employment_status' => $employeeProfile?->employment_status,
            ],
            'student_profile' => [
                'exists' => $hasStudentProfile,
                'source_system' => $studentProfile?->source_system ?? ($legacyStudent ? 'legacy_students_table' : null),
                'source_external_id' => $studentProfile?->source_external_id,
                'student_code' => $studentProfile?->student_code ?? $legacyStudent?->student_id,
                'legacy_student_id' => $studentProfile?->legacy_student_id ?? $legacyStudent?->id,
                'group_id' => $studentProfile?->group_id ?? $legacyStudent?->group_id,
                'group_name' => $studentProfile?->group?->name ?? $legacyStudent?->group?->name,
                'educational_program_id' => $studentProfile?->educational_program_id,
                'educational_program_name' => $studentProfile?->educationalProgram?->name,
                'course_number' => $studentProfile?->course_number,
                'stream_code' => $studentProfile?->stream_code,
            ],
            'dual_context' => $dualContext,
            'pending_academic_requests' => $pendingAcademicRequests,
            'active_scope_assignments' => $activeAssignmentRows->all(),
            'assignment_types' => $assignmentTypes->all(),
            'curator_scope_exists' => $assignmentTypes->contains(AcademicScopeAssignment::TYPE_CURATOR),
            'registrar_scope_exists' => $assignmentTypes->contains(AcademicScopeAssignment::TYPE_REGISTRAR),
            'academic_admin_scope_exists' => $assignmentTypes->contains(AcademicScopeAssignment::TYPE_ACADEMIC_ADMIN)
                || $assignmentTypes->contains(AcademicScopeAssignment::TYPE_FACULTY_ADMIN),
            'platonus_readiness' => [
                'upstream_source' => (string) config('academic.upstream_source', 'platonus_read_only'),
                'profile_source_system' => $studentProfile?->source_system,
                'has_upstream_external_id' => ! empty($studentProfile?->source_external_id) || ! empty($studentProfile?->platonus_person_uid),
                'source_external_id' => $studentProfile?->source_external_id,
                'platonus_person_uid' => $studentProfile?->platonus_person_uid,
                'direct_authority_allowed' => (bool) config('academic.allow_upstream_direct_authority', false),
            ],
            'mobile_access_summary' => [
                'has_employee_context' => $hasEmployeeProfile,
                'has_student_context' => $hasStudentProfile,
                'dual_context' => $dualContext,
                'assignment_types' => $assignmentTypes->all(),
                'scopes_count' => $activeAssignmentRows->count(),
                'status' => $status,
            ],
            'risk_flags' => $riskFlags->values()->all(),
        ];
    }

    public function contractState(): array
    {
        return [
            'provider' => $this->sourceSystem(),
            'provider_label' => $this->sourceLabel(),
            'source_of_truth' => 'crm',
            'supported_sources' => $this->supportedSources(),
            'upstream_source' => (string) config('academic.upstream_source', 'platonus_read_only'),
            'allow_upstream_direct_authority' => (bool) config('academic.allow_upstream_direct_authority', false),
            'current_authority_domain' => [
                'student_context' => 'CRM',
                'employee_context' => 'CRM',
                'academic_context' => 'Platonus-future',
            ],
            'future_contract_entities' => [
                'student',
                'program',
                'group',
                'course',
                'stream',
                'faculty',
                'department',
                'enrollment_status',
            ],
            'future_payload_fields' => [
                'student_code',
                'program_code',
                'group_code',
                'course_number',
                'stream_code',
                'faculty_id',
                'department_id',
                'enrollment_status',
            ],
        ];
    }
}
