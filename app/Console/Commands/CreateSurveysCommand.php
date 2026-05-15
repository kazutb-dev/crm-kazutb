<?php

namespace App\Console\Commands;

use App\Models\Discipline;
use App\Models\Group;
use App\Services\SurveyService;
use Illuminate\Console\Command;

class CreateSurveysCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'survey:create-bulk 
                            {group_id : ID группы}
                            {discipline_id : ID дисциплины}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Массово создать анкеты для группы и дисциплины';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $groupId = $this->argument('group_id');
        $disciplineId = $this->argument('discipline_id');

        try {
            $group = Group::findOrFail($groupId);
            $discipline = Discipline::findOrFail($disciplineId);

            $this->info("Создание анкет для группы '{$group->name}' и дисциплины '{$discipline->name}'...");

            $surveyService = app(SurveyService::class);
            $createdCount = $surveyService->createBulkSurveys($groupId, $disciplineId);

            $this->info("✓ Успешно создано $createdCount анкет");

            return Command::SUCCESS;
        } catch (\Exception $e) {
            $this->error("Ошибка: {$e->getMessage()}");
            return Command::FAILURE;
        }
    }
}
