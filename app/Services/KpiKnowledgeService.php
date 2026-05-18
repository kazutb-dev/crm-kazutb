<?php

namespace App\Services;

use Illuminate\Support\Facades\Storage;

class KpiKnowledgeService
{
    private array $knowledge = [];

    public function __construct()
    {
        $this->loadKnowledgeBase();
    }

    /**
     * Load KPI knowledge base from JSON file
     */
    private function loadKnowledgeBase(): void
    {
        try {
            $path = storage_path('kpi_knowledge_base.json');
            if (file_exists($path)) {
                $content = file_get_contents($path);
                $this->knowledge = json_decode($content, true) ?? [];
            }
        } catch (\Exception $e) {
            \Log::warning('Failed to load KPI knowledge base: ' . $e->getMessage());
            $this->knowledge = [];
        }
    }

    /**
     * Check if query is about KPI system
     */
    public function isKpiQuestion(string $query): bool
    {
        $kpiKeywords = [
            'кпи', 'kpi',
            'показател', // показатели
            'проверк', // проверка
            'статус', 'статусы',
            'утверджд', // утверждение
            'отклонен', // отклонено
            'черновик',
            'подано',
            'возвращено',
            'декан', 'заведующ', // заведующий
            'кафедр', // кафедра
            'структурное подразделение', 'подразделение',
            'пп[сс]', // ППС
        ];

        $lowerQuery = mb_strtolower($query);

        foreach ($kpiKeywords as $keyword) {
            if (mb_strpos($lowerQuery, $keyword) !== false) {
                return true;
            }
        }

        return false;
    }

    /**
     * Detect user role from query or context
     */
    public function detectUserRole(string $query): string
    {
        $lowerQuery = mb_strtolower($query);

        $roleKeywords = [
            'декан' => ['декан', 'дека[нн]ы'],
            'head' => ['заведующ', 'зав кафедр', 'заведующий кафедр'],
            'pps' => ['пп[сс]', 'преподавател', 'лектор', 'ассистент'],
            'sp' => ['структурное подразделение', 'подразделение', 'отдел', 'отделение'],
        ];

        foreach ($roleKeywords as $role => $keywords) {
            foreach ($keywords as $keyword) {
                if (preg_match("/$keyword/i", $query)) {
                    return $role;
                }
            }
        }

        return 'general'; // No specific role detected
    }

    /**
     * Get KPI knowledge for a specific role or general
     */
    public function getKpiContext(string $query = '', string $role = 'general'): string
    {
        if (empty($this->knowledge)) {
            return '';
        }

        // If role is specified, use that role's documentation
        if ($role !== 'general' && isset($this->knowledge[$role])) {
            return $this->knowledge[$role];
        }

        // Try to detect role from query
        $detectedRole = $this->detectUserRole($query);
        if ($detectedRole !== 'general' && isset($this->knowledge[$detectedRole])) {
            return $this->knowledge[$detectedRole];
        }

        // Return combined knowledge from all roles
        $combined = [];
        foreach ($this->knowledge as $roleData) {
            if (!empty($roleData)) {
                $combined[] = $roleData;
            }
        }

        return implode("\n\n" . str_repeat('=', 50) . "\n\n", $combined);
    }

    /**
     * Get specific role documentation
     */
    public function getRoleDocumentation(string $role): string
    {
        if ($role === 'dean') {
            return $this->knowledge['dean'] ?? '';
        } elseif ($role === 'head') {
            return $this->knowledge['head'] ?? '';
        } elseif ($role === 'pps') {
            return $this->knowledge['pps'] ?? '';
        } elseif ($role === 'sp') {
            return $this->knowledge['sp'] ?? '';
        }

        return '';
    }

    /**
     * Get summary of KPI process
     */
    public function getKpiProcessSummary(): string
    {
        return <<<SUMMARY
=== ОБЩЕЕ ОПИСАНИЕ СИСТЕМЫ KPI ===

Система KPI работает по цепочке одобрений:
1. ППС создает KPI-запись в разделе "KPI — Мои показатели"
2. ППС нажимает "Отправить на проверку"
3. Заведующий кафедрой проверяет запись ППС
4. Декан проверяет записи ППС и зав. кафедрами
5. Структурное подразделение принимает финальное решение

=== ОСНОВНЫЕ СТАТУСЫ ЗАПИСИ ===
- Черновик: запись еще не отправлена
- Подано: запись отправлена на проверку
- Возвращено: запись нужно исправить
- На проверке: запись проверяется
- На утверждении: запись дошла до финального этапа
- Утверждено: запись окончательно принята
- Отклонено: запись окончательно отклонена

=== РОЛИ И ОТВЕТСТВЕННОСТЬ ===
• ППС (Профессорско-преподавательский состав): создание и отправка KPI-записей
• Заведующий кафедрой: проверка записей ППС, может вернуть на исправление или отправить декану
• Декан: проверка записей ППС и заведующих, может вернуть на исправление или отправить в структурное подразделение
• Структурное подразделение: принимает финальное решение - утверждает или отклоняет запись

После утверждения запись попадает в сводку и рейтинги.
SUMMARY;
    }
}
