<?php

namespace App\Services\Hr;

/**
 * Rule-based Russian declension for the hiring documents. There is no maintained morphology library
 * for PHP, so these rules only cover the common shapes; everything they produce is a suggestion that
 * the HR specialist can correct (case forms filled by rules are stored as "not verified").
 */
final class RussianInflector
{
    private const CONSONANT = '/[бвгджзклмнпрстфхцчшщ]$/u';

    /** Head nouns written in lower case inside a position phrase, with the proper name quoted. */
    private const QUOTED_NAME_HEADS = ['кафедра', 'факультет'];

    /**
     * Full name in the accusative case («кого?») for the order: «Иванова Мария Петровна» → «Иванову Марию Петровну».
     * Kazakh patronymics on -улы/-ұлы/-кызы/-қызы and names without a matching rule stay as they are.
     */
    public static function fullNameAccusative(?string $last, ?string $first, ?string $middle, ?string $gender): string
    {
        $parts = ['last' => trim((string) $last), 'first' => trim((string) $first), 'middle' => trim((string) $middle)];

        if (! in_array($gender, [Iin::GENDER_MALE, Iin::GENDER_FEMALE], true)) {
            return implode(' ', array_filter($parts));
        }

        $declined = [];
        foreach ($parts as $part => $word) {
            if ($word !== '') {
                $declined[] = implode('-', array_map(
                    static fn (string $piece): string => self::accusativeWord($piece, $gender, $part),
                    explode('-', $word),
                ));
            }
        }

        return implode(' ', $declined);
    }

    /**
     * Genitive of an org unit or position name: «Кафедра Информационные технологии» → «кафедры «Информационные
     * технологии»», «Старший преподаватель» → «старшего преподавателя». Leading adjectives and the head noun are
     * declined, the rest of the phrase is already in the right form and is kept.
     */
    public static function genitive(string $phrase): string
    {
        $phrase = trim(preg_replace('/\s+/u', ' ', $phrase));
        if ($phrase === '' || ! preg_match('/^\p{Cyrillic}/u', $phrase)) {
            return $phrase;
        }

        $words = explode(' ', $phrase);
        $index = 0;

        while ($index < count($words) - 1 && self::isAdjective($words[$index])) {
            // «Заведующий кафедрой»: the participle is the head itself, the next word is already in an oblique case.
            if (self::isOblique($words[$index + 1])) {
                $words[$index] = self::genitiveAdjective($words[$index]);
                $index = count($words);

                break;
            }
            $words[$index] = self::genitiveAdjective($words[$index]);
            $index++;
        }

        if ($index < count($words)) {
            $head = $words[$index];
            $words[$index] = implode('-', array_map([self::class, 'genitiveNoun'], explode('-', $head)));

            if (in_array(mb_strtolower($head), self::QUOTED_NAME_HEADS, true)) {
                $words[$index] = mb_strtolower($words[$index]);
                $rest = implode(' ', array_slice($words, $index + 1));
                if ($rest !== '' && preg_match('/^\p{Lu}/u', $rest)) {
                    return implode(' ', array_merge(array_slice($words, 0, $index + 1), ['«'.$rest.'»']));
                }
            }
        }

        return implode(' ', $words);
    }

    /** Genitive of a position title, in lower case as it follows «на должность …». */
    public static function positionGenitive(string $title): string
    {
        $genitive = self::genitive($title);

        return mb_strtolower(mb_substr($genitive, 0, 1)).mb_substr($genitive, 1);
    }

    private static function accusativeWord(string $word, string $gender, string $part): string
    {
        $lower = mb_strtolower($word);
        $result = $lower;

        if (preg_match('/(улы|ұлы|кызы|қызы)$/u', $lower)) {
            return $word;
        }

        if ($gender === Iin::GENDER_MALE) {
            $result = match ($part) {
                'last' => match (true) {
                    (bool) preg_match('/(ов|ев|ёв|ин|ын)$/u', $lower) => $lower.'а',
                    (bool) preg_match('/(ий|ой|ый)$/u', $lower) => mb_substr($lower, 0, -2).'ого',
                    (bool) preg_match(self::CONSONANT, $lower) => $lower.'а',
                    default => $lower,
                },
                'middle' => preg_match('/ич$/u', $lower) ? $lower.'а' : $lower,
                default => match (true) {
                    (bool) preg_match('/[йь]$/u', $lower) => mb_substr($lower, 0, -1).'я',
                    str_ends_with($lower, 'я') => mb_substr($lower, 0, -1).'ю',
                    str_ends_with($lower, 'а') => mb_substr($lower, 0, -1).'у',
                    (bool) preg_match(self::CONSONANT, $lower) => $lower.'а',
                    default => $lower,
                },
            };
        } else {
            $result = match ($part) {
                'last' => match (true) {
                    (bool) preg_match('/(ова|ева|ёва|ина|ына)$/u', $lower) => mb_substr($lower, 0, -1).'у',
                    str_ends_with($lower, 'ая') => mb_substr($lower, 0, -2).'ую',
                    default => $lower,
                },
                'middle' => str_ends_with($lower, 'на') ? mb_substr($lower, 0, -1).'у' : $lower,
                default => match (true) {
                    str_ends_with($lower, 'я') => mb_substr($lower, 0, -1).'ю',
                    str_ends_with($lower, 'а') => mb_substr($lower, 0, -1).'у',
                    default => $lower,
                },
            };
        }

        return self::matchCase($word, $result);
    }

    private static function isAdjective(string $word): bool
    {
        return mb_strlen($word) > 3 && (bool) preg_match('/(ый|ий|ой|ая|яя|ое|ее)$/u', mb_strtolower($word));
    }

    private static function isOblique(string $word): bool
    {
        return (bool) preg_match('/^\p{Ll}.*(ой|ей|ом|ем|ами|ями)$/u', $word);
    }

    private static function genitiveAdjective(string $word): string
    {
        $lower = mb_strtolower($word);
        $stem = mb_substr($lower, 0, -2);
        $last = mb_substr($stem, -1);

        $result = match (mb_substr($lower, -2)) {
            'ый', 'ой', 'ое' => $stem.'ого',
            'ий' => $stem.(in_array($last, ['г', 'к', 'х'], true) ? 'ого' : 'его'),
            'ее' => $stem.'его',
            'ая' => $stem.(in_array($last, ['ж', 'ш', 'ч', 'щ'], true) ? 'ей' : 'ой'),
            'яя' => $stem.'ей',
            default => $lower,
        };

        return self::matchCase($word, $result);
    }

    private static function genitiveNoun(string $word): string
    {
        $lower = mb_strtolower($word);

        $result = match (true) {
            str_ends_with($lower, 'ия') => mb_substr($lower, 0, -1).'и',
            str_ends_with($lower, 'ие') => mb_substr($lower, 0, -1).'я',
            str_ends_with($lower, 'а') => mb_substr($lower, 0, -1).(preg_match('/[гкхжшщч]а$/u', $lower) ? 'и' : 'ы'),
            str_ends_with($lower, 'я') => mb_substr($lower, 0, -1).'и',
            (bool) preg_match('/(тель|арь)$/u', $lower) => mb_substr($lower, 0, -1).'я',
            str_ends_with($lower, 'ь') => mb_substr($lower, 0, -1).'и',
            str_ends_with($lower, 'й') => mb_substr($lower, 0, -1).'я',
            (bool) preg_match(self::CONSONANT, $lower) => $lower.'а',
            default => $lower,
        };

        return self::matchCase($word, $result);
    }

    /** Keeps the source capitalisation: «Иванова» → «Иванову», «ИВАНОВА» stays upper case. */
    private static function matchCase(string $source, string $lower): string
    {
        if ($source === mb_strtoupper($source) && mb_strlen($source) > 1) {
            return mb_strtoupper($lower);
        }

        $first = mb_substr($source, 0, 1);
        if ($first === mb_strtoupper($first)) {
            return mb_strtoupper(mb_substr($lower, 0, 1)).mb_substr($lower, 1);
        }

        return $lower;
    }
}
