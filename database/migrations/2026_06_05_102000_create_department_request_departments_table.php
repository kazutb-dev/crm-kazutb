<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('department_request_departments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('department_id')->constrained('departments')->cascadeOnDelete();
            $table->text('hint')->nullable();
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();

            $table->unique('department_id');
        });

        $seed = DB::table('departments')
            ->whereIn('code', ['CIT', 'AI_ANALYTICS'])
            ->get(['id', 'code'])
            ->map(function ($row): array {
                $hint = $row->code === 'CIT'
                    ? 'Технические вопросы: нерабочее оборудование, принтеры, сеть, компьютеры, рабочие места.'
                    : 'Вопросы разработки: баги на сайте, ошибки в бизнес-логике, доработки цифровых сервисов.';

                return [
                    'department_id' => $row->id,
                    'hint' => $hint,
                    'is_active' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            })
            ->values()
            ->all();

        if (! empty($seed)) {
            DB::table('department_request_departments')->insert($seed);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('department_request_departments');
    }
};
