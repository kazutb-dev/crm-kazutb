<?php

namespace App\Modules\LanguageTestingModule\DTO;

class LanguageTestingSubmissionData
{
    /**
     * @param  array<int, array{question_id:int, answer_id:int|null}>  $answers
     */
    public function __construct(
        public readonly string $sessionId,
        public readonly ?string $studentId,
        public readonly ?string $iin,
        public readonly string $firstName,
        public readonly ?string $middleName,
        public readonly string $lastName,
        public readonly string $email,
        public readonly ?string $phone,
        public readonly array $answers,
    ) {
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    public static function fromValidated(array $validated): self
    {
        $answers = collect($validated['answers'] ?? [])
            ->map(fn (array $answer): array => [
                'question_id' => (int) $answer['question_id'],
                'answer_id' => isset($answer['answer_id']) ? (int) $answer['answer_id'] : null,
            ])
            ->values()
            ->all();

        return new self(
            sessionId: (string) $validated['session_id'],
            studentId: isset($validated['student_id']) ? (string) $validated['student_id'] : null,
            iin: isset($validated['iin']) ? (string) $validated['iin'] : null,
            firstName: (string) $validated['first_name'],
            middleName: isset($validated['middle_name']) ? (string) $validated['middle_name'] : null,
            lastName: (string) $validated['last_name'],
            email: (string) $validated['email'],
            phone: isset($validated['phone']) ? (string) $validated['phone'] : null,
            answers: $answers,
        );
    }
}