import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DarkPanel, PageHeader, StatGrid, StatTile } from '@/components/platform';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { BarChart3, BookOpen, ClipboardList, Download, Link2, Plus, Search, Target, Trash2, Users, X } from 'lucide-react';
import { useState } from 'react';

function formatDate(value) {
    if (!value) {
        return '—';
    }

    return new Intl.DateTimeFormat('ru-RU', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}

export default function TestingIndex({ subjects = [], bindings = [], total_students_count = 0 }) {
    const [creatingSubjectId, setCreatingSubjectId] = useState(null);
    const [confirmState, setConfirmState] = useState({ open: false, description: '', onConfirm: null });
    const [bindOpen, setBindOpen] = useState(false);
    const [modalSearch, setModalSearch] = useState('');

    const { auth } = usePage().props;
    const isAdmin = ['admin', 'superadmin'].includes(auth?.roleSlug);

    const exportToExcel = () => {
        let xml = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
            <meta charset="utf-8" />
            <!--[if gte mso 9]>
            <xml>
                <x:ExcelWorkbook>
                    <x:ExcelWorksheets>
                        <x:ExcelWorksheet>
                            <x:Name>Тестирование</x:Name>
                            <x:WorksheetOptions>
                                <x:DisplayGridlines/>
                            </x:WorksheetOptions>
                        </x:ExcelWorksheet>
                    </x:ExcelWorksheets>
                </x:ExcelWorkbook>
            </xml>
            <![endif]-->
            <style>
                table {
                    border-collapse: collapse;
                }
                th, td {
                    border: 0.5pt solid #cccccc;
                    font-family: 'Times New Roman', Times, serif;
                    font-size: 11pt;
                    padding: 6px;
                }
                th {
                    background-color: #f3f4f6;
                    font-weight: bold;
                    text-align: center;
                }
                .title {
                    font-size: 16pt;
                    font-weight: bold;
                    text-align: center;
                    border: none;
                }
                .meta {
                    font-size: 11pt;
                    font-style: italic;
                    border: none;
                }
            </style>
        </head>
        <body>
            <table>
                <tr>
                    <td colspan="8" class="title">Отчет: Модуль тестирования - Мои предметы</td>
                </tr>
                <tr>
                    <td colspan="8" class="meta">Преподаватель: ${auth?.user?.display_name || auth?.user?.name || ''}</td>
                </tr>
                <tr>
                    <td colspan="8" class="meta">Дата экспорта: ${new Date().toLocaleDateString('ru-RU')}</td>
                </tr>
                <tr>
                    <td colspan="8" class="meta">Всего привязок: ${bindings.length}</td>
                </tr>
                <tr>
                    <td colspan="8" class="meta">Всего привязанных студентов: ${total_students_count}</td>
                </tr>
                <tr><td colspan="8" style="border:none;"></td></tr>
                
                <tr>
                    <th>Код предмета</th>
                    <th>Название предмета</th>
                    <th>Студентов</th>
                    <th>Тестов</th>
                    <th>Попыток</th>
                    <th>Средний балл</th>
                    <th>Макс. балл</th>
                    <th>Успешность</th>
                </tr>
        `;

        bindings.forEach((b) => {
            xml += `
                <tr>
                    <td style="text-align: center;">${b.subject?.code || '—'}</td>
                    <td>${b.subject?.name || '—'}</td>
                    <td style="text-align: center;">${b.students_count || 0}</td>
                    <td style="text-align: center;">${b.tests_count || 0}</td>
                    <td style="text-align: center;">${b.attempts_count || 0}</td>
                    <td style="text-align: center;">${b.average_score || 0}</td>
                    <td style="text-align: center;">${b.max_score || 0}</td>
                    <td style="text-align: center;">${b.success_rate || 0}%</td>
                </tr>
            `;
        });

        xml += `
            </table>
        </body>
        </html>
        `;

        const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `testing_report_${new Date().toISOString().slice(0, 10)}.xls`;
        link.click();
    };

    const createBinding = (subjectId) => {
        setCreatingSubjectId(subjectId);
        router.post(route('testing.bindings.store'), {
            subject_id: subjectId,
        }, {
            preserveScroll: true,
            onFinish: () => {
                setCreatingSubjectId(null);
                setBindOpen(false);
                setModalSearch('');
            },
        });
    };

    const removeBinding = (bindingId, subjectName) => {
        setConfirmState({
            open: true,
            description: `Удалить привязку по предмету «${subjectName}»? Все тесты и накопленные результаты будут удалены.`,
            onConfirm: () => router.delete(route('testing.bindings.destroy', bindingId), { preserveScroll: true }),
        });
    };

    const withAttempts = bindings.filter((b) => Number(b.attempts_count) > 0);
    const totals = {
        tests: bindings.reduce((sum, b) => sum + (Number(b.tests_count) || 0), 0),
        attempts: bindings.reduce((sum, b) => sum + (Number(b.attempts_count) || 0), 0),
        success: withAttempts.length
            ? Math.round(withAttempts.reduce((sum, b) => sum + (Number(b.success_rate) || 0), 0) / withAttempts.length)
            : null,
    };

    // Filter subjects that aren't bound yet
    const availableSubjects = subjects.filter(s => !s.has_binding);

    // Apply client-side search inside the modal
    const filteredAvailable = availableSubjects.filter(s =>
        s.name.toLowerCase().includes(modalSearch.toLowerCase()) ||
        (s.code && s.code.toLowerCase().includes(modalSearch.toLowerCase()))
    );

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="Модуль тестирования"
                    title="Тестирование"
                    description="Тесты по своим предметам и результаты прохождения. Привязка предмета — контейнер для тестов: наполняйте его вопросами, публикуйте тесты и анализируйте прохождения."
                    actions={(
                        <>
                            {bindings.length > 0 && (
                                <Button onClick={exportToExcel} variant="outline" className="gap-2">
                                    <Download className="h-4 w-4" />
                                    Экспорт в Excel
                                </Button>
                            )}
                            <Button onClick={() => setBindOpen(true)} className="gap-2">
                                <Plus className="h-4 w-4" />
                                Привязать предмет
                            </Button>
                        </>
                    )}
                />
            )}
        >
            <Head title="Тестирование" />

            <div className="admin-page-wrap space-y-6">
                <StatGrid>
                    <StatTile label="Мои привязки" value={bindings.length} tone="teal" icon={Link2} hint="Предметы, по которым вы ведёте тесты" />
                    <StatTile label="Привязано студентов" value={total_students_count} tone="navy" icon={Users} hint="По всем привязанным предметам" />
                    <StatTile label="Тестов" value={totals.tests} tone="info" icon={ClipboardList} hint={`Попыток: ${totals.attempts}`} />
                    <StatTile label="Средняя успешность" value={totals.success === null ? '—' : `${totals.success}%`} tone="success" icon={Target} hint="по привязкам с попытками" />
                    <StatTile label="Свободных предметов" value={availableSubjects.length} tone="gold" icon={BookOpen} hint={`из ${subjects.length} в каталоге`} />
                </StatGrid>

                {bindings.length === 0 ? (
                    <DarkPanel
                        kicker="Начните отсюда"
                        title="У вас пока нет привязанных предметов"
                        actions={(
                            <Button onClick={() => setBindOpen(true)} className="gap-2">
                                <Plus className="h-4 w-4" />
                                Привязать предмет
                            </Button>
                        )}
                    >
                        Чтобы начать создавать тесты и проводить опросы, привяжите учебный предмет к своему личному кабинету.
                    </DarkPanel>
                ) : (
                    <Card className="overflow-hidden">
                        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                            <CardTitle className="flex items-center gap-2"><Link2 className="h-4 w-4" />Мои привязанные предметы</CardTitle>
                            <Badge variant="default" className="tabular-nums">Всего: {bindings.length}</Badge>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[1040px] text-sm">
                                    <thead>
                                        <tr>
                                            <th>Предмет</th>
                                            <th className="text-right">Студентов</th>
                                            <th className="text-right">Тестов</th>
                                            <th className="text-right">Попыток</th>
                                            <th className="text-right">Ср. балл</th>
                                            <th className="text-right">Макс. балл</th>
                                            <th className="text-right">Успешность</th>
                                            <th>Привязан</th>
                                            <th className="text-right">Действия</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {bindings.map((binding) => (
                                            <tr key={binding.id} className="hover:bg-slate-50">
                                                <td>
                                                    <Link href={route('testing.bindings.show', binding.id)} className="font-medium text-slate-900 hover:text-teal-700">
                                                        {binding.subject?.name}
                                                    </Link>
                                                    {binding.subject?.code && (
                                                        <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600">{binding.subject.code}</span>
                                                    )}
                                                </td>
                                                <td className="text-right tabular-nums">{binding.students_count || 0}</td>
                                                <td className="text-right tabular-nums">{binding.tests_count || 0}</td>
                                                <td className="text-right tabular-nums">{binding.attempts_count || 0}</td>
                                                <td className="text-right tabular-nums">{binding.average_score || 0}</td>
                                                <td className="text-right tabular-nums">{binding.max_score || 0}</td>
                                                <td className="text-right">
                                                    <div className="ml-auto flex w-28 items-center justify-end gap-2">
                                                        <div className="h-1.5 flex-1 rounded-full bg-slate-100">
                                                            <div className="h-1.5 rounded-full bg-emerald-600" style={{ width: `${Math.min(100, Number(binding.success_rate) || 0)}%` }} />
                                                        </div>
                                                        <span className="font-semibold tabular-nums text-emerald-700">{binding.success_rate || 0}%</span>
                                                    </div>
                                                </td>
                                                <td className="whitespace-nowrap text-xs tabular-nums text-slate-500">{formatDate(binding.created_at)}</td>
                                                <td className="text-right">
                                                    <div className="flex flex-wrap justify-end gap-2">
                                                        <Button asChild size="sm" variant="outline" className="gap-2">
                                                            <Link href={route('testing.bindings.analytics', binding.id)}>
                                                                <BarChart3 className="h-3.5 w-3.5" />
                                                                Аналитика
                                                            </Link>
                                                        </Button>
                                                        <Button asChild size="sm">
                                                            <Link href={route('testing.bindings.show', binding.id)}>
                                                                Открыть тесты
                                                            </Link>
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-red-700 hover:bg-red-50 hover:text-red-800"
                                                            onClick={() => removeBinding(binding.id, binding.subject?.name || 'предмету')}
                                                            title="Удалить привязку"
                                                            aria-label="Удалить привязку"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* ── Modal Dialog: Bind New Subject ── */}
            <Dialog open={bindOpen} onOpenChange={(open) => {
                setBindOpen(open);
                if (!open) {
                    setModalSearch('');
                }
            }}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Привязать новый предмет</DialogTitle>
                        <DialogDescription>
                            Выберите необходимый предмет из каталога, чтобы добавить его в свой список для создания тестов.
                        </DialogDescription>
                    </DialogHeader>

                    {/* Search inside modal */}
                    <label className="mt-2 block space-y-2">
                        <span className="qd-field-label block">Поиск</span>
                        <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                            value={modalSearch}
                            onChange={(e) => setModalSearch(e.target.value)}
                            placeholder="Поиск предмета по названию или коду…"
                            className="pl-9 pr-8"
                        />
                        {modalSearch && (
                            <button
                                type="button"
                                aria-label="Очистить поиск"
                                onClick={() => setModalSearch('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                        </div>
                    </label>

                    {/* Subjects list in modal */}
                    <div className="mt-2 max-h-[350px] overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-200">
                        {filteredAvailable.length === 0 ? (
                            <div className="p-8 text-center text-sm text-slate-500">
                                {modalSearch ? 'Предметы не найдены по вашему запросу.' : 'Все предметы уже привязаны!'}
                            </div>
                        ) : (
                            filteredAvailable.map((subject) => (
                                <div key={subject.id} className="flex items-center justify-between gap-3 bg-white px-4 py-3 transition-colors hover:bg-slate-50">
                                    <div className="space-y-1">
                                        <h4 className="text-sm font-medium leading-snug text-slate-900">{subject.name}</h4>
                                        <div className="flex flex-wrap gap-2 items-center">
                                            {subject.code && (
                                                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600">
                                                    {subject.code}
                                                </span>
                                            )}
                                            {subject.department_name && (
                                                <span className="text-xs text-slate-500">
                                                    {subject.department_name}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <Button
                                        size="sm"
                                        disabled={creatingSubjectId !== null}
                                        onClick={() => createBinding(subject.id)}
                                        className="shrink-0 gap-1"
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                        {creatingSubjectId === subject.id ? '...' : 'Привязать'}
                                    </Button>
                                </div>
                            ))
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={confirmState.open}
                description={confirmState.description}
                onOpenChange={(open) => setConfirmState((prev) => ({ ...prev, open }))}
                onConfirm={confirmState.onConfirm}
            />
        </AuthenticatedLayout>
    );
}
