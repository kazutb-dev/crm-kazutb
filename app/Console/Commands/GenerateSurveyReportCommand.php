<?php

namespace App\Console\Commands;

use App\Models\Discipline;
use App\Services\SurveyAnalyticsService;
use Illuminate\Console\Command;

class GenerateSurveyReportCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'survey:generate-report 
                            {discipline_id : ID дисциплины}
                            {--format=json : Формат вывода (json|csv|table)}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Сгенерировать отчет по дисциплине';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $disciplineId = $this->argument('discipline_id');
        $format = $this->option('format');

        try {
            $discipline = Discipline::findOrFail($disciplineId);

            $this->info("Генерирование отчета по дисциплине '{$discipline->name}'...\n");

            $analyticsService = app(SurveyAnalyticsService::class);
            
            // Получить статистику по вопросам
            $statistics = $analyticsService->getDisciplineQuestionStatistics($discipline);
            $progress = $analyticsService->getSurveyCompletionProgress($discipline);

            if ($format === 'json') {
                $this->outputJson($discipline, $statistics, $progress);
            } elseif ($format === 'csv') {
                $this->outputCsv($discipline, $statistics, $progress);
            } else {
                $this->outputTable($discipline, $statistics, $progress);
            }

            return Command::SUCCESS;
        } catch (\Exception $e) {
            $this->error("Ошибка: {$e->getMessage()}");
            return Command::FAILURE;
        }
    }

    protected function outputTable(Discipline $discipline, $statistics, $progress): void
    {
        $this->line("Дисциплина: {$discipline->name}");
        $this->line("Преподаватель: {$discipline->teacher->first_name} {$discipline->teacher->last_name}");
        $this->line("─────────────────────────────────────────────────────────");
        
        $this->info("Прогресс заполнения:");
        $this->table(
            ['Параметр', 'Значение'],
            [
                ['Всего анкет', $progress['total']],
                ['Выполнено', $progress['completed']],
                ['В процессе', $progress['in_progress']],
                ['Черновики', $progress['draft']],
                ['% Выполнения', $progress['completion_percentage'] . '%'],
            ]
        );

        if (!empty($statistics)) {
            $this->info("\nСтатистика по вопросам:");
            $rows = [];
            foreach ($statistics as $stat) {
                $rows[] = [
                    $stat['question_text'],
                    $stat['average_rating'],
                    $stat['response_count'],
                ];
            }
            $this->table(['Вопрос', 'Средняя оценка', 'Ответов'], $rows);
        }
    }

    protected function outputJson(Discipline $discipline, $statistics, $progress): void
    {
        $data = [
            'discipline' => [
                'id' => $discipline->id,
                'name' => $discipline->name,
                'teacher' => "{$discipline->teacher->first_name} {$discipline->teacher->last_name}",
            ],
            'progress' => $progress,
            'statistics' => $statistics,
        ];

        $this->line(json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }

    protected function outputCsv(Discipline $discipline, $statistics, $progress): void
    {
        $this->line("Дисциплина,Преподаватель,Всего,Выполнено,% Выполнения");
        $this->line("{$discipline->name},{$discipline->teacher->first_name} {$discipline->teacher->last_name},{$progress['total']},{$progress['completed']},{$progress['completion_percentage']}");
        
        $this->line("\nВопрос,Средняя оценка,Ответов");
        foreach ($statistics as $stat) {
            $this->line("{$stat['question_text']},{$stat['average_rating']},{$stat['response_count']}");
        }
    }
}
