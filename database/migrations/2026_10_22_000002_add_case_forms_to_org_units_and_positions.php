<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Case forms the hiring documents need (RU genitive, KZ genitive / possessive) and the HR check mark:
     * forms filled by rules stay "not verified" until the HR department confirms them.
     */
    public function up(): void
    {
        Schema::table('org_units', function (Blueprint $table): void {
            $table->string('name_ru_gen')->nullable()->after('name');
            $table->string('name_kz')->nullable()->after('name_ru_gen');
            $table->string('name_kz_gen')->nullable()->after('name_kz');
            $table->timestamp('case_forms_verified_at')->nullable()->after('name_kz_gen');
            $table->foreignId('case_forms_verified_by')->nullable()->after('case_forms_verified_at')->constrained('users')->nullOnDelete();
        });

        Schema::table('positions', function (Blueprint $table): void {
            $table->string('staff_category', 5)->nullable()->after('name');
            $table->string('name_ru_gen')->nullable()->after('staff_category');
            $table->string('name_kz')->nullable()->after('name_ru_gen');
            $table->string('name_kz_poss')->nullable()->after('name_kz');
            $table->timestamp('case_forms_verified_at')->nullable()->after('name_kz_poss');
            $table->foreignId('case_forms_verified_by')->nullable()->after('case_forms_verified_at')->constrained('users')->nullOnDelete();

            $table->index('staff_category');
        });
    }

    public function down(): void
    {
        Schema::table('positions', function (Blueprint $table): void {
            $table->dropIndex(['staff_category']);
            $table->dropConstrainedForeignId('case_forms_verified_by');
            $table->dropColumn(['staff_category', 'name_ru_gen', 'name_kz', 'name_kz_poss', 'case_forms_verified_at']);
        });

        Schema::table('org_units', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('case_forms_verified_by');
            $table->dropColumn(['name_ru_gen', 'name_kz', 'name_kz_gen', 'case_forms_verified_at']);
        });
    }
};
