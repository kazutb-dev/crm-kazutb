<?php

namespace App\Services\TeacherAi;

use RuntimeException;

/**
 * Base failure of the teacher AI module whose message is safe to show to the
 * teacher as is (no technical details, no secrets, Russian wording).
 */
class TeacherAiException extends RuntimeException {}
