<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $divisions = [
            ['name' => 'Учебно-операционное подразделение (УОП)', 'code' => 'UOP'],
            ['name' => 'Центр компетенций', 'code' => 'CC'],
            ['name' => 'Учебно-научное и воспитательное подразделение (УНиВС)', 'code' => 'UNIVS'],
            ['name' => 'Отдел международного образования и академической мобильности (ОМОиАМ)', 'code' => 'OMOAM'],
            ['name' => 'Управление культурой и физической культурой (УМиФК)', 'code' => 'UMIFK'],
            ['name' => 'Центр компетентности (ЦК)', 'code' => 'CK'],
            ['name' => 'Отдел мониторинга качества образования (ОМКО)', 'code' => 'OMKO'],
            ['name' => 'Отдел рейтингов и аккредитации (ОРиА)', 'code' => 'ORIA'],
            ['name' => 'Эндаумент фонд', 'code' => 'EF'],
            ['name' => 'Центр карьеры', 'code' => 'CCM'],
            ['name' => 'Отдел кадров', 'code' => 'OK'],
        ];

        foreach ($divisions as $div) {
            DB::table('divisions')->updateOrInsert(
                ['code' => $div['code']],
                ['name' => $div['name'], 'created_at' => now(), 'updated_at' => now()]
            );
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('divisions')->whereIn('code', ['UOP', 'CC', 'UNIVS', 'OMOAM', 'UMIFK', 'CK', 'OMKO', 'ORIA', 'EF', 'CCM', 'OK'])->delete();
    }
};
