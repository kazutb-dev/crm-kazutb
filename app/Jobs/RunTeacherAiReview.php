<?php

namespace App\Jobs;

use App\Models\TeacherAiReview;
use App\Services\TeacherAi\TeacherAiReviewException;
use App\Services\TeacherAi\TeacherAiReviewService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use Throwable;

class RunTeacherAiReview implements ShouldQueue
{
    use Queueable;

    /**
     * A failed AI call is retried by the teacher from the UI, not by the queue,
     * so one attempt is enough. The timeout stays below the cron worker's 120s.
     */
    public int $tries = 1;

    public int $timeout = 110;

    public function __construct(public int $reviewId)
    {
    }

    public function handle(TeacherAiReviewService $service): void
    {
        $review = TeacherAiReview::query()->find($this->reviewId);

        if (! $review || $review->status === TeacherAiReview::STATUS_COMPLETED) {
            return;
        }

        $review->update([
            'status' => TeacherAiReview::STATUS_PROCESSING,
            'error_message' => null,
        ]);

        try {
            $result = $service->analyze(
                $review->document_type,
                $review->content_text,
                $review->focus,
                $review->is_truncated,
            );
        } catch (TeacherAiReviewException $e) {
            $this->markFailed($review, $e->getMessage());

            return;
        } catch (Throwable $e) {
            Log::error('Teacher AI review crashed', ['review_id' => $review->id, 'error' => $e->getMessage()]);
            $this->markFailed($review, 'Не удалось выполнить проверку. Попробуйте ещё раз позже.');

            return;
        }

        $review->update([
            'status' => TeacherAiReview::STATUS_COMPLETED,
            'summary' => $result['summary'],
            'key_points' => $result['key_points'],
            'findings' => $result['findings'],
            'overall' => $result['overall'],
            'model' => $result['model'],
            'prompt_tokens' => $result['prompt_tokens'],
            'completion_tokens' => $result['completion_tokens'],
            'error_message' => null,
            'completed_at' => now(),
        ]);
    }

    /**
     * Called by the worker when the job is killed (e.g. timeout).
     */
    public function failed(?Throwable $exception): void
    {
        TeacherAiReview::query()
            ->whereKey($this->reviewId)
            ->where('status', '!=', TeacherAiReview::STATUS_COMPLETED)
            ->update([
                'status' => TeacherAiReview::STATUS_FAILED,
                'error_message' => 'Проверка заняла слишком много времени. Попробуйте ещё раз или сократите документ.',
                'updated_at' => now(),
            ]);
    }

    private function markFailed(TeacherAiReview $review, string $message): void
    {
        $review->update([
            'status' => TeacherAiReview::STATUS_FAILED,
            'error_message' => $message,
        ]);
    }
}
