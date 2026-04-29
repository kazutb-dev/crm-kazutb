<?php

namespace App\Services;

use App\Models\AppSetting;
use App\Models\Diploma;
use Illuminate\Support\Collection;

class TopicSimilarityService
{
    public function __construct(
        private readonly AiTopicReviewService $aiTopicReviewService,
    ) {
    }

    /**
     * @return array{normalized:string,items:list<array{diploma_id:int,original_title_ru:string,score:float,match_type:string,risk_level:string}>}
     */
    public function findTopMatches(string $titleRu, ?int $excludeDiplomaId = null, int $limit = 10): array
    {
        $normalizedInput = $this->normalize($titleRu);

        if ($normalizedInput === '') {
            return [
                'normalized' => '',
                'items' => [],
            ];
        }

        $query = Diploma::query()
            ->select(['id', 'title_ru', 'normalized_title'])
            ->whereIn('status', [
                Diploma::STATUS_DRAFT,
                Diploma::STATUS_SUBMITTED,
                Diploma::STATUS_IN_REVIEW,
                Diploma::STATUS_APPROVED,
                Diploma::STATUS_ARCHIVED,
            ]);

        if ($excludeDiplomaId !== null) {
            $query->where('id', '!=', $excludeDiplomaId);
        }

        /** @var Collection<int, Diploma> $candidates */
        $candidates = $query->get();

        $inputTokens = $this->tokenizeNormalized($normalizedInput);
        $inputStemmedTokens = $this->stemTokens($inputTokens);
        $inputNgrams = $this->characterNgrams($normalizedInput, 3);

        $exactMatches = [];
        $similarMatches = [];

        foreach ($candidates as $candidate) {
            $candidateNormalized = $candidate->normalized_title ?: $this->normalize($candidate->title_ru);

            if ($candidateNormalized === '') {
                continue;
            }

            if ($candidateNormalized === $normalizedInput) {
                $exactMatches[] = [
                    'diploma_id' => $candidate->id,
                    'original_title_ru' => $candidate->title_ru,
                    'score' => 1.0,
                    'match_type' => 'exact',
                    'risk_level' => $this->riskByScore(1.0),
                ];

                continue;
            }

            $candidateTokens = $this->tokenizeNormalized($candidateNormalized);
            $candidateStemmedTokens = $this->stemTokens($candidateTokens);
            $candidateNgrams = $this->characterNgrams($candidateNormalized, 3);

            $tokenScore = $this->jaccardSimilarity($inputTokens, $candidateTokens);
            $stemmedTokenScore = $this->jaccardSimilarity($inputStemmedTokens, $candidateStemmedTokens);
            $ngramJaccardScore = $this->jaccardSimilarity($inputNgrams, $candidateNgrams);
            $ngramDiceScore = $this->diceCoefficient($inputNgrams, $candidateNgrams);

            // Blend lexical and character similarity to better catch close paraphrases.
            $score = max(
                (0.6 * $tokenScore) + (0.4 * $ngramJaccardScore),
                (0.55 * $stemmedTokenScore) + (0.45 * $ngramDiceScore),
                $ngramDiceScore,
            );

            $score = min(1.0, max(0.0, $score));

            $similarMatches[] = [
                'diploma_id' => $candidate->id,
                'original_title_ru' => $candidate->title_ru,
                'score' => round($score, 4),
                'match_type' => 'similar',
                'risk_level' => $this->riskByScore($score),
            ];
        }

        $similarMatches = $this->applyAiReranking($titleRu, $similarMatches);

        $similarMatches = array_values(array_filter(
            $similarMatches,
            static fn (array $match): bool => $match['score'] >= 0.20,
        ));

        usort($similarMatches, static fn (array $a, array $b): int => $b['score'] <=> $a['score']);

        $items = array_slice(array_merge($exactMatches, $similarMatches), 0, $limit);

        return [
            'normalized' => $normalizedInput,
            'items' => $items,
        ];
    }

    public function normalize(string $text): string
    {
        $text = mb_strtolower(trim($text));

        if ($text === '') {
            return '';
        }

        $text = str_replace('ё', 'е', $text);
        $text = preg_replace('/[^\\p{L}\\p{N}\\s]+/u', ' ', $text) ?? $text;
        $text = preg_replace('/\\s+/u', ' ', $text) ?? $text;

        $tokens = explode(' ', trim($text));
        $stopWords = $this->stopWords();

        $filtered = [];

        foreach ($tokens as $token) {
            if ($token === '' || in_array($token, $stopWords, true)) {
                continue;
            }

            $filtered[] = $token;
        }

        return implode(' ', $filtered);
    }

    /**
     * @param list<string> $a
     * @param list<string> $b
     */
    public function jaccardSimilarity(array $a, array $b): float
    {
        $setA = array_values(array_unique($a));
        $setB = array_values(array_unique($b));

        if ($setA === [] || $setB === []) {
            return 0.0;
        }

        $intersection = count(array_intersect($setA, $setB));
        $union = count(array_unique(array_merge($setA, $setB)));

        if ($union === 0) {
            return 0.0;
        }

        return $intersection / $union;
    }

    /**
     * @return list<string>
     */
    public function tokenizeNormalized(string $normalized): array
    {
        if ($normalized === '') {
            return [];
        }

        return array_values(array_filter(explode(' ', $normalized), static fn (string $token): bool => $token !== ''));
    }

    /**
     * @return list<string>
     */
    public function characterNgrams(string $text, int $n = 3): array
    {
        $text = str_replace(' ', '', $text);

        if ($text === '') {
            return [];
        }

        $length = mb_strlen($text);

        if ($length <= $n) {
            return [$text];
        }

        $grams = [];

        for ($i = 0; $i <= $length - $n; $i++) {
            $grams[] = mb_substr($text, $i, $n);
        }

        return $grams;
    }

    public function riskByScore(float $score): string
    {
        if ($score >= 0.85) {
            return 'high';
        }

        if ($score >= 0.70) {
            return 'medium';
        }

        return 'low';
    }

    /**
     * @param list<string> $a
     * @param list<string> $b
     */
    public function diceCoefficient(array $a, array $b): float
    {
        if ($a === [] || $b === []) {
            return 0.0;
        }

        $freqA = $this->frequencies($a);
        $freqB = $this->frequencies($b);

        $intersection = 0;

        foreach ($freqA as $token => $countA) {
            $intersection += min($countA, $freqB[$token] ?? 0);
        }

        return (2 * $intersection) / (count($a) + count($b));
    }

    /**
     * @param list<string> $tokens
     * @return list<string>
     */
    public function stemTokens(array $tokens): array
    {
        return array_map(fn (string $token): string => $this->stemToken($token), $tokens);
    }

    public function stemToken(string $token): string
    {
        // Lightweight Russian stemming to reduce inflection impact in topic matching.
        $patterns = [
            '/(иями|ями|ами|его|ого|ему|ому|ыми|ими|иях|ах|ях|ов|ев|ом|ем|ам|ям|ию|ью|ия|ья|ий|ый|ой|ая|ое|ые|ую|юю|а|я|ы|и|е|о|у|ю)$/u',
        ];

        $stem = $token;

        foreach ($patterns as $pattern) {
            $stem = preg_replace($pattern, '', $stem) ?? $stem;
        }

        return mb_strlen($stem) >= 3 ? $stem : $token;
    }

    /**
     * @param list<string> $tokens
     * @return array<string,int>
     */
    private function frequencies(array $tokens): array
    {
        $freq = [];

        foreach ($tokens as $token) {
            $freq[$token] = ($freq[$token] ?? 0) + 1;
        }

        return $freq;
    }

    /**
     * @return list<string>
     */
    private function stopWords(): array
    {
        $setting = AppSetting::query()
            ->where('key', 'topic_normalization_stop_words')
            ->first();

        $words = is_array($setting?->value) ? $setting->value : [];

        return array_values(array_filter(array_map(static fn ($item): string => mb_strtolower(trim((string) $item)), $words)));
    }

    /**
     * @param list<array{diploma_id:int,original_title_ru:string,score:float,match_type:string,risk_level:string}> $similarMatches
     * @return list<array{diploma_id:int,original_title_ru:string,score:float,match_type:string,risk_level:string}>
     */
    private function applyAiReranking(string $inputTitle, array $similarMatches): array
    {
        if ($similarMatches === []) {
            return $similarMatches;
        }

        usort($similarMatches, static fn (array $a, array $b): int => $b['score'] <=> $a['score']);

        $candidates = [];

        foreach (array_slice($similarMatches, 0, 30) as $match) {
            $candidates[$match['diploma_id']] = $match['original_title_ru'];
        }

        $aiScores = $this->aiTopicReviewService->scoreCandidates($inputTitle, $candidates);

        if ($aiScores === []) {
            return $similarMatches;
        }

        foreach ($similarMatches as &$match) {
            $aiScore = $aiScores[$match['diploma_id']] ?? null;

            if (!is_float($aiScore)) {
                continue;
            }

            $combinedScore = $this->combineHeuristicAndAiScore($match['score'], $aiScore);
            $match['score'] = round($combinedScore, 4);
            $match['risk_level'] = $this->riskByScore($combinedScore);

            if ($aiScore >= 0.70 && $match['match_type'] === 'similar') {
                $match['match_type'] = 'ai_similar';
            }
        }
        unset($match);

        return $similarMatches;
    }

    public function combineHeuristicAndAiScore(float $heuristicScore, float $aiScore): float
    {
        $heuristicScore = min(1.0, max(0.0, $heuristicScore));
        $aiScore = min(1.0, max(0.0, $aiScore));

        return min(1.0, max($heuristicScore, (0.45 * $heuristicScore) + (0.55 * $aiScore)));
    }
}
