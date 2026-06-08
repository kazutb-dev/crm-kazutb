<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $this->hardenAcademicScopeAssignments();
        $this->hardenStudentProfiles();
        $this->hardenOrgUnitMappings();
    }

    public function down(): void
    {
        $this->dropCheckIfExists('org_unit_mappings', 'org_unit_mappings_source_locator_chk');
        $this->dropCheckIfExists('org_unit_mappings', 'org_unit_mappings_confidence_chk');
        $this->dropCheckIfExists('org_unit_mappings', 'org_unit_mappings_mapping_kind_chk');
        $this->dropCheckIfExists('org_unit_mappings', 'org_unit_mappings_source_type_chk');

        if (Schema::hasTable('org_unit_mappings')) {
            Schema::table('org_unit_mappings', function (Blueprint $table): void {
                if ($this->indexExists('org_unit_mappings', 'org_unit_mappings_source_id_unique')) {
                    $table->dropUnique('org_unit_mappings_source_id_unique');
                }

                if ($this->indexExists('org_unit_mappings', 'org_unit_mappings_source_code_unique')) {
                    $table->dropUnique('org_unit_mappings_source_code_unique');
                }
            });
        }

        $this->dropCheckIfExists('student_profiles', 'student_profiles_years_chk');

        if (Schema::hasTable('student_profiles')) {
            Schema::table('student_profiles', function (Blueprint $table): void {
                if ($this->indexExists('student_profiles', 'student_profiles_legacy_student_id_unique')) {
                    $table->dropUnique('student_profiles_legacy_student_id_unique');
                }

                if ($this->indexExists('student_profiles', 'student_profiles_source_system_external_id_unique')) {
                    $table->dropUnique('student_profiles_source_system_external_id_unique');
                }

                if ($this->indexExists('student_profiles', 'student_profiles_source_system_platonus_uid_unique')) {
                    $table->dropUnique('student_profiles_source_system_platonus_uid_unique');
                }

                if ($this->foreignKeyExists('student_profiles', 'student_profiles_educational_program_id_fk')) {
                    $table->dropForeign('student_profiles_educational_program_id_fk');
                }

                if ($this->foreignKeyExists('student_profiles', 'student_profiles_group_id_fk')) {
                    $table->dropForeign('student_profiles_group_id_fk');
                }
            });
        }

        $this->dropCheckIfExists('academic_scope_assignments', 'academic_scope_assignments_dates_chk');
        $this->dropCheckIfExists('academic_scope_assignments', 'academic_scope_assignments_scope_status_chk');
        $this->dropCheckIfExists('academic_scope_assignments', 'academic_scope_assignments_assignment_type_chk');

        if (Schema::hasTable('academic_scope_assignments')) {
            Schema::table('academic_scope_assignments', function (Blueprint $table): void {
                if ($this->indexExists('academic_scope_assignments', 'academic_scope_assignments_governance_request_id_unique')) {
                    $table->dropUnique('academic_scope_assignments_governance_request_id_unique');
                }

                if ($this->foreignKeyExists('academic_scope_assignments', 'academic_scope_assignments_faculty_id_fk')) {
                    $table->dropForeign('academic_scope_assignments_faculty_id_fk');
                }

                if ($this->foreignKeyExists('academic_scope_assignments', 'academic_scope_assignments_department_id_fk')) {
                    $table->dropForeign('academic_scope_assignments_department_id_fk');
                }

                if ($this->foreignKeyExists('academic_scope_assignments', 'academic_scope_assignments_educational_program_id_fk')) {
                    $table->dropForeign('academic_scope_assignments_educational_program_id_fk');
                }

                if ($this->foreignKeyExists('academic_scope_assignments', 'academic_scope_assignments_group_id_fk')) {
                    $table->dropForeign('academic_scope_assignments_group_id_fk');
                }

                if ($this->foreignKeyExists('academic_scope_assignments', 'academic_scope_assignments_governance_request_id_fk')) {
                    $table->dropForeign('academic_scope_assignments_governance_request_id_fk');
                }

                if ($this->foreignKeyExists('academic_scope_assignments', 'academic_scope_assignments_approved_by_fk')) {
                    $table->dropForeign('academic_scope_assignments_approved_by_fk');
                }
            });
        }
    }

    private function hardenAcademicScopeAssignments(): void
    {
        if (! Schema::hasTable('academic_scope_assignments')) {
            return;
        }

        Schema::table('academic_scope_assignments', function (Blueprint $table): void {
            if (! $this->foreignKeyExists('academic_scope_assignments', 'academic_scope_assignments_faculty_id_fk')) {
                $table->foreign('faculty_id', 'academic_scope_assignments_faculty_id_fk')
                    ->references('id')
                    ->on('faculties')
                    ->nullOnDelete();
            }

            if (! $this->foreignKeyExists('academic_scope_assignments', 'academic_scope_assignments_department_id_fk')) {
                $table->foreign('department_id', 'academic_scope_assignments_department_id_fk')
                    ->references('id')
                    ->on('departments')
                    ->nullOnDelete();
            }

            if (! $this->foreignKeyExists('academic_scope_assignments', 'academic_scope_assignments_educational_program_id_fk')) {
                $table->foreign('educational_program_id', 'academic_scope_assignments_educational_program_id_fk')
                    ->references('id')
                    ->on('educational_programs')
                    ->nullOnDelete();
            }

            if (! $this->foreignKeyExists('academic_scope_assignments', 'academic_scope_assignments_group_id_fk')) {
                $table->foreign('group_id', 'academic_scope_assignments_group_id_fk')
                    ->references('id')
                    ->on('groups')
                    ->nullOnDelete();
            }

            if (! $this->foreignKeyExists('academic_scope_assignments', 'academic_scope_assignments_governance_request_id_fk')) {
                $table->foreign('governance_request_id', 'academic_scope_assignments_governance_request_id_fk')
                    ->references('id')
                    ->on('governance_access_requests')
                    ->nullOnDelete();
            }

            if (! $this->foreignKeyExists('academic_scope_assignments', 'academic_scope_assignments_approved_by_fk')) {
                $table->foreign('approved_by', 'academic_scope_assignments_approved_by_fk')
                    ->references('id')
                    ->on('users')
                    ->nullOnDelete();
            }

            if (! $this->indexExists('academic_scope_assignments', 'academic_scope_assignments_governance_request_id_unique')) {
                $table->unique('governance_request_id', 'academic_scope_assignments_governance_request_id_unique');
            }
        });

        $this->addCheckIfMissing(
            'academic_scope_assignments',
            'academic_scope_assignments_assignment_type_chk',
            "assignment_type in ('student', 'curator', 'registrar', 'academic_admin', 'faculty_admin')"
        );
        $this->addCheckIfMissing(
            'academic_scope_assignments',
            'academic_scope_assignments_scope_status_chk',
            "scope_status in ('pending', 'active', 'inactive', 'revoked')"
        );
        $this->addCheckIfMissing(
            'academic_scope_assignments',
            'academic_scope_assignments_dates_chk',
            '(starts_at is null or ends_at is null or starts_at <= ends_at)'
        );
    }

    private function hardenStudentProfiles(): void
    {
        if (! Schema::hasTable('student_profiles')) {
            return;
        }

        Schema::table('student_profiles', function (Blueprint $table): void {
            if (! $this->foreignKeyExists('student_profiles', 'student_profiles_educational_program_id_fk')) {
                $table->foreign('educational_program_id', 'student_profiles_educational_program_id_fk')
                    ->references('id')
                    ->on('educational_programs')
                    ->nullOnDelete();
            }

            if (! $this->foreignKeyExists('student_profiles', 'student_profiles_group_id_fk')) {
                $table->foreign('group_id', 'student_profiles_group_id_fk')
                    ->references('id')
                    ->on('groups')
                    ->nullOnDelete();
            }

            if (! $this->indexExists('student_profiles', 'student_profiles_legacy_student_id_unique')) {
                $table->unique('legacy_student_id', 'student_profiles_legacy_student_id_unique');
            }

            if (! $this->indexExists('student_profiles', 'student_profiles_source_system_external_id_unique')) {
                $table->unique(['source_system', 'source_external_id'], 'student_profiles_source_system_external_id_unique');
            }

            if (! $this->indexExists('student_profiles', 'student_profiles_source_system_platonus_uid_unique')) {
                $table->unique(['source_system', 'platonus_person_uid'], 'student_profiles_source_system_platonus_uid_unique');
            }
        });

        $this->addCheckIfMissing(
            'student_profiles',
            'student_profiles_years_chk',
            '(entry_year is null or expected_graduation_year is null or entry_year <= expected_graduation_year)'
        );
    }

    private function hardenOrgUnitMappings(): void
    {
        if (! Schema::hasTable('org_unit_mappings')) {
            return;
        }

        Schema::table('org_unit_mappings', function (Blueprint $table): void {
            if (! $this->indexExists('org_unit_mappings', 'org_unit_mappings_source_id_unique')) {
                $table->unique(['source_type', 'source_id'], 'org_unit_mappings_source_id_unique');
            }

            if (! $this->indexExists('org_unit_mappings', 'org_unit_mappings_source_code_unique')) {
                $table->unique(['source_type', 'source_code'], 'org_unit_mappings_source_code_unique');
            }
        });

        $this->addCheckIfMissing(
            'org_unit_mappings',
            'org_unit_mappings_source_type_chk',
            "source_type in ('faculty', 'department', 'division', 'kpi_structural_unit')"
        );
        $this->addCheckIfMissing(
            'org_unit_mappings',
            'org_unit_mappings_mapping_kind_chk',
            "mapping_kind in ('exact', 'transitional', 'approximate', 'unmapped')"
        );
        $this->addCheckIfMissing(
            'org_unit_mappings',
            'org_unit_mappings_confidence_chk',
            '(confidence >= 0 and confidence <= 100)'
        );
        $this->addCheckIfMissing(
            'org_unit_mappings',
            'org_unit_mappings_source_locator_chk',
            "(source_id is not null or (source_code is not null and trim(source_code) <> ''))"
        );
    }

    private function addCheckIfMissing(string $table, string $constraint, string $expression): void
    {
        if ($this->checkConstraintExists($table, $constraint)) {
            return;
        }

        DB::statement(sprintf(
            'ALTER TABLE `%s` ADD CONSTRAINT `%s` CHECK (%s)',
            $table,
            $constraint,
            $expression
        ));
    }

    private function dropCheckIfExists(string $table, string $constraint): void
    {
        if (! Schema::hasTable($table) || ! $this->checkConstraintExists($table, $constraint)) {
            return;
        }

        DB::statement(sprintf(
            'ALTER TABLE `%s` DROP CHECK `%s`',
            $table,
            $constraint
        ));
    }

    private function foreignKeyExists(string $table, string $constraint): bool
    {
        return DB::table('information_schema.TABLE_CONSTRAINTS')
            ->where('TABLE_SCHEMA', DB::getDatabaseName())
            ->where('TABLE_NAME', $table)
            ->where('CONSTRAINT_NAME', $constraint)
            ->where('CONSTRAINT_TYPE', 'FOREIGN KEY')
            ->exists();
    }

    private function indexExists(string $table, string $index): bool
    {
        return DB::table('information_schema.STATISTICS')
            ->where('TABLE_SCHEMA', DB::getDatabaseName())
            ->where('TABLE_NAME', $table)
            ->where('INDEX_NAME', $index)
            ->exists();
    }

    private function checkConstraintExists(string $table, string $constraint): bool
    {
        return DB::table('information_schema.TABLE_CONSTRAINTS')
            ->where('TABLE_SCHEMA', DB::getDatabaseName())
            ->where('TABLE_NAME', $table)
            ->where('CONSTRAINT_NAME', $constraint)
            ->where('CONSTRAINT_TYPE', 'CHECK')
            ->exists();
    }
};
