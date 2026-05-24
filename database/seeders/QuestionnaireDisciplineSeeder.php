<?php

namespace Database\Seeders;

use App\Models\Questionnaire\Discipline;
use Illuminate\Database\Seeder;

class QuestionnaireDisciplineSeeder extends Seeder
{
    public function run(): void
    {
        $disciplines = [
            ['code' => 'QD-IS-101', 'name' => 'Введение в специальность', 'status' => 'active'],
            ['code' => 'QD-IS-102', 'name' => 'Алгоритмы и структуры данных', 'status' => 'active'],
            ['code' => 'QD-IS-103', 'name' => 'Объектно-ориентированное программирование', 'status' => 'active'],
            ['code' => 'QD-IS-104', 'name' => 'Базы данных', 'status' => 'active'],
            ['code' => 'QD-IS-105', 'name' => 'Операционные системы', 'status' => 'active'],
            ['code' => 'QD-IS-106', 'name' => 'Компьютерные сети', 'status' => 'active'],
            ['code' => 'QD-IS-107', 'name' => 'Инженерия программного обеспечения', 'status' => 'active'],
            ['code' => 'QD-IS-108', 'name' => 'Веб-программирование', 'status' => 'active'],
            ['code' => 'QD-IS-109', 'name' => 'Мобильная разработка', 'status' => 'active'],
            ['code' => 'QD-IS-110', 'name' => 'Информационная безопасность', 'status' => 'active'],
            ['code' => 'QD-IS-111', 'name' => 'Системный анализ', 'status' => 'active'],
            ['code' => 'QD-IS-112', 'name' => 'Проектирование информационных систем', 'status' => 'active'],
            ['code' => 'QD-IS-113', 'name' => 'Искусственный интеллект', 'status' => 'active'],
            ['code' => 'QD-IS-114', 'name' => 'Тестирование программного обеспечения', 'status' => 'active'],
            ['code' => 'QD-IS-115', 'name' => 'Управление ИТ-проектами', 'status' => 'active'],
        ];

        foreach ($disciplines as $discipline) {
            Discipline::query()->updateOrCreate(
                ['code' => $discipline['code']],
                [
                    'name' => $discipline['name'],
                    'status' => $discipline['status'],
                ]
            );
        }
    }
}
