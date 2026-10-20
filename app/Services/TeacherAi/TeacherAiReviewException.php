<?php

namespace App\Services\TeacherAi;

use RuntimeException;

/**
 * Failure whose message is safe to show to the teacher as is.
 */
class TeacherAiReviewException extends RuntimeException
{
}
