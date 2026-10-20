<?php

namespace App\Jobs;

use App\Models\TeacherAiLesson;
use App\Services\TeacherAi\TeacherAiException;
use App\Services\TeacherAi\TeacherAiLessonService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Runs ONE generation step (or one batch of it) of a lesson and re-dispatches
 * itself while work remains, so that every job run stays well below the
 * worker timeout. After a rate limit the next run is delayed.
 */
class GenerateTeacherAiLesson implements ShouldQueue
{
    use Queueable;

    /**
     * A failed step is retried by the teacher from the UI (resuming at that
     * step), not by the queue. The timeout stays below the cron worker's 120s.
     */
    public int $tries = 1;

    public int $timeout = 110;

    public function __construct(public int $lessonId) {}

    public function handle(TeacherAiLessonService $service): void
    {
        $lesson = TeacherAiLesson::query()->find($this->lessonId);

        if (! $lesson || in_array($lesson->status, [TeacherAiLesson::STATUS_COMPLETED, TeacherAiLesson::STATUS_FAILED], true)) {
            return;
        }

        try {
            $delay = $service->runNextStep($lesson);
        } catch (TeacherAiException $e) {
            $service->markFailed($lesson, $e->getMessage());

            return;
        } catch (Throwable $e) {
            Log::error('Teacher AI lesson generation crashed', [
                'lesson_id' => $lesson->id,
                'step' => $lesson->step,
                'error' => $e->getMessage(),
            ]);
            $service->markFailed($lesson, 'Не удалось сгенерировать материалы. Попробуйте ещё раз позже.');

            return;
        }

        if ($delay === null) {
            return;
        }

        $delay > 0
            ? self::dispatch($lesson->id)->delay(now()->addSeconds($delay))
            : self::dispatch($lesson->id);
    }

    /**
     * Called by the worker when the job is killed (e.g. timeout). The step
     * that was running is kept in `step`, so a retry resumes there.
     */
    public function failed(?Throwable $exception): void
    {
        TeacherAiLesson::query()
            ->whereKey($this->lessonId)
            ->where('status', '!=', TeacherAiLesson::STATUS_COMPLETED)
            ->update([
                'status' => TeacherAiLesson::STATUS_FAILED,
                'error_message' => 'Генерация заняла слишком много времени. Нажмите «Повторить» — работа продолжится с места остановки.',
                'updated_at' => now(),
            ]);
    }
}
