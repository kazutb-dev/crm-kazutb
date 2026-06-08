<?php

use App\Models\OrgUnitMapping;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('org_unit_mappings', function (Blueprint $table): void {
            $table->id();
            $table->string('source_type', 60);
            $table->unsignedBigInteger('source_id')->nullable();
            $table->string('source_code', 120)->nullable();
            $table->string('source_name')->nullable();
            $table->foreignId('org_unit_id')->nullable()->constrained('org_units')->nullOnDelete();
            $table->string('mapping_kind', 40)->default(OrgUnitMapping::KIND_TRANSITIONAL);
            $table->unsignedTinyInteger('confidence')->default(70);
            $table->boolean('is_active')->default(true);
            $table->text('notes')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['source_type', 'source_id'], 'org_unit_mappings_source_idx');
            $table->index(['source_type', 'source_code'], 'org_unit_mappings_source_code_idx');
            $table->index('org_unit_id');
            $table->index('mapping_kind');
        });

        $this->seedMappings();
    }

    public function down(): void
    {
        Schema::dropIfExists('org_unit_mappings');
    }

    private function seedMappings(): void
    {
        $now = now();

        $orgUnitIds = DB::table('org_units')->pluck('id', 'code');

        if (Schema::hasTable('faculties')) {
            $faculties = DB::table('faculties')->select(['id', 'code', 'name'])->get();

            $facultyCodeMap = [
                'TF' => 'FAC_TECH_ENG',
                'FEB' => 'FAC_ECON_BUS',
                'FEIT' => 'FAC_ENG_IT',
            ];

            foreach ($faculties as $faculty) {
                $sourceCode = is_string($faculty->code) ? trim($faculty->code) : null;
                $targetCode = $sourceCode !== null ? ($facultyCodeMap[$sourceCode] ?? null) : null;
                $orgUnitId = $targetCode !== null ? ($orgUnitIds[$targetCode] ?? null) : null;

                DB::table('org_unit_mappings')->insert([
                    'source_type' => OrgUnitMapping::SOURCE_FACULTY,
                    'source_id' => (int) $faculty->id,
                    'source_code' => $sourceCode,
                    'source_name' => $faculty->name,
                    'org_unit_id' => $orgUnitId,
                    'mapping_kind' => $orgUnitId ? OrgUnitMapping::KIND_EXACT : OrgUnitMapping::KIND_UNMAPPED,
                    'confidence' => $orgUnitId ? 98 : 10,
                    'is_active' => true,
                    'notes' => $orgUnitId ? 'Mapped by faculty code.' : 'No org_units mapping by faculty code.',
                    'metadata' => json_encode(['seeded' => true], JSON_UNESCAPED_UNICODE),
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }

        if (Schema::hasTable('departments')) {
            $departments = DB::table('departments')->select(['id', 'code', 'name'])->get();

            $departmentCodeMap = [
                'TST' => 'CHAIR_TST',
                'TLPD' => 'CHAIR_TLPD',
                'KIA' => 'CHAIR_AIS',
                'PE' => 'CHAIR_PE',
                'TS' => 'CHAIR_TOURISM_SERVICE',
                'EU' => 'CHAIR_MANAGEMENT',
                'FA' => 'CHAIR_ECON_FIN',
                'GIY' => 'CHAIR_STATE_LOCAL',
                'IT' => 'CHAIR_IT',
                'HHTE' => 'CHAIR_CHEM_ENV',
                'SHD' => 'CHAIR_SOC_HUM',
            ];

            foreach ($departments as $department) {
                $sourceCode = is_string($department->code) ? trim($department->code) : null;
                $targetCode = $sourceCode !== null ? ($departmentCodeMap[$sourceCode] ?? null) : null;
                $orgUnitId = $targetCode !== null ? ($orgUnitIds[$targetCode] ?? null) : null;

                DB::table('org_unit_mappings')->insert([
                    'source_type' => OrgUnitMapping::SOURCE_DEPARTMENT,
                    'source_id' => (int) $department->id,
                    'source_code' => $sourceCode,
                    'source_name' => $department->name,
                    'org_unit_id' => $orgUnitId,
                    'mapping_kind' => $orgUnitId ? OrgUnitMapping::KIND_TRANSITIONAL : OrgUnitMapping::KIND_UNMAPPED,
                    'confidence' => $orgUnitId ? 85 : 10,
                    'is_active' => true,
                    'notes' => $orgUnitId ? 'Mapped by legacy department code with transitional naming drift.' : 'No org_units mapping by department code.',
                    'metadata' => json_encode(['seeded' => true], JSON_UNESCAPED_UNICODE),
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }

        if (Schema::hasTable('kpi_structural_units')) {
            $units = DB::table('kpi_structural_units')->select(['id', 'code', 'name'])->get();

            $kpiUnitCodeMap = [
                'УОП' => 'UOP',
                'ЦК' => 'CK',
                'УНиВС' => 'UNIVS',
                'ОМОиАМ' => 'OMOAM',
                'ВиСР' => 'VISR',
                'ЭФ' => 'EF',
                'ОРиА' => 'ORIA',
                'ЦКАР' => 'CKAR',
                'ОУП' => 'OUP',
                'УОКиА' => 'UOKIA',
                'ОР' => 'OR',
                'УМиФК' => 'OMIPR',
                'ОМиPR' => 'OMIPR',
                'ОМКО' => 'OMKO',
                'ОП' => 'OP',
            ];

            foreach ($units as $unit) {
                $sourceCode = is_string($unit->code) ? trim($unit->code) : null;
                $targetCode = $sourceCode !== null ? ($kpiUnitCodeMap[$sourceCode] ?? null) : null;
                $orgUnitId = $targetCode !== null ? ($orgUnitIds[$targetCode] ?? null) : null;

                DB::table('org_unit_mappings')->insert([
                    'source_type' => OrgUnitMapping::SOURCE_KPI_STRUCTURAL_UNIT,
                    'source_id' => (int) $unit->id,
                    'source_code' => $sourceCode,
                    'source_name' => $unit->name,
                    'org_unit_id' => $orgUnitId,
                    'mapping_kind' => $orgUnitId ? OrgUnitMapping::KIND_TRANSITIONAL : OrgUnitMapping::KIND_UNMAPPED,
                    'confidence' => $orgUnitId ? 90 : 10,
                    'is_active' => true,
                    'notes' => $orgUnitId ? 'Mapped from KPI structural unit to org unit by known code aliases.' : 'No org_units mapping for this KPI structural unit.',
                    'metadata' => json_encode(['seeded' => true], JSON_UNESCAPED_UNICODE),
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }

        if (Schema::hasTable('divisions')) {
            $divisions = DB::table('divisions')->select(['id', 'code', 'name'])->get();

            $divisionCodeMap = [
                'UOP' => 'UOP',
                'CK' => 'CK',
                'UNIVS' => 'UNIVS',
                'OMOAM' => 'OMOAM',
                'VISR' => 'VISR',
                'EF' => 'EF',
                'ORIA' => 'ORIA',
                'CKAR' => 'CKAR',
                'OUP' => 'OUP',
                'UOKIA' => 'UOKIA',
                'OR' => 'OR',
                'OMIPR' => 'OMIPR',
                'OMKO' => 'OMKO',
                'OP' => 'OP',
            ];

            foreach ($divisions as $division) {
                $sourceCode = is_string($division->code) ? trim($division->code) : null;
                $targetCode = $sourceCode !== null ? ($divisionCodeMap[$sourceCode] ?? null) : null;
                $orgUnitId = $targetCode !== null ? ($orgUnitIds[$targetCode] ?? null) : null;

                DB::table('org_unit_mappings')->insert([
                    'source_type' => OrgUnitMapping::SOURCE_DIVISION,
                    'source_id' => (int) $division->id,
                    'source_code' => $sourceCode,
                    'source_name' => $division->name,
                    'org_unit_id' => $orgUnitId,
                    'mapping_kind' => $orgUnitId ? OrgUnitMapping::KIND_APPROXIMATE : OrgUnitMapping::KIND_UNMAPPED,
                    'confidence' => $orgUnitId ? 75 : 10,
                    'is_active' => true,
                    'notes' => $orgUnitId ? 'Mapped from legacy division code (approximate transitional mapping).' : 'No org_units mapping for legacy division.',
                    'metadata' => json_encode(['seeded' => true], JSON_UNESCAPED_UNICODE),
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }
    }
};
