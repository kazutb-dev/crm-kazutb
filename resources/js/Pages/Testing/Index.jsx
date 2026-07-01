import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { BarChart3, BookOpenText, Link2, Plus, Trash2, Search, X, Download } from 'lucide-react';
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

    // Filter subjects that aren't bound yet
    const availableSubjects = subjects.filter(s => !s.has_binding);

    // Apply client-side search inside the modal
    const filteredAvailable = availableSubjects.filter(s =>
        s.name.toLowerCase().includes(modalSearch.toLowerCase()) ||
        (s.code && s.code.toLowerCase().includes(modalSearch.toLowerCase()))
    );

    return (
        <AuthenticatedLayout>
            <Head title="Тестирование" />

            <div className="admin-page-wrap space-y-6">
                {/* ── Hero banner ── */}
                <Card className="overflow-hidden border-0 bg-gradient-to-br from-[#123153] via-[#1b4d74] to-[#139AA4] text-white shadow-[0_20px_50px_-20px_rgba(12,45,78,0.55)] rounded-3xl">
                    <CardContent className="relative flex flex-col gap-5 p-6 sm:p-8 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-3xl space-y-3">
                            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-white/90 backdrop-blur-sm">
                                <BookOpenText className="h-3.5 w-3.5" />
                                Модуль тестирования
                            </div>
                            <h1 className="text-3xl font-semibold leading-tight text-white tracking-tight">
                                Создавайте тесты по своим предметам и отслеживайте результаты прохождения.
                            </h1>
                            <p className="max-w-2xl text-sm leading-6 text-white/80">
                                Привязка предмета выступает контейнером для тестов. После ее создания можно наполнять предмет вопросами, публиковать тесты и анализировать прохождения.
                            </p>
                            <div className="flex flex-wrap items-center gap-3 mt-4 pt-1">
                                <Button onClick={() => setBindOpen(true)} className="bg-white text-[#132844] hover:bg-white/95 gap-2 rounded-xl transition-all font-semibold shadow-md border-0 h-10 px-5">
                                    <Plus className="h-4 w-4 text-[#132844]" />
                                    Привязать предмет
                                </Button>
                                {bindings.length > 0 && (
                                    <Button onClick={exportToExcel} variant="outline" className="gap-2 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white rounded-xl transition-all shadow-md h-10 px-5">
                                        <Download className="h-4 w-4 text-white" />
                                        Экспорт в Excel
                                    </Button>
                                )}
                            </div>
                        </div>

                        <div className="grid min-w-[240px] grid-cols-2 gap-3 shrink-0">
                            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]">
                                <div className="text-xs uppercase tracking-[0.15em] text-white/70">Мои привязки</div>
                                <div className="mt-2 text-3xl font-bold tracking-tight">{bindings.length}</div>
                            </div>
                            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]">
                                <div className="text-xs uppercase tracking-[0.15em] text-white/70">Привязано студентов</div>
                                <div className="mt-2 text-3xl font-bold tracking-tight">{total_students_count}</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* ── Main content: List of teacher's bindings ── */}
                <Card className="border border-slate-200/60 shadow-[0_4px_20px_rgba(15,23,42,0.02)] rounded-2xl">
                    <CardHeader className="pb-3 flex flex-row items-center justify-between border-b border-slate-100">
                        <CardTitle className="text-xl font-bold text-[#132844] font-sans">Мои привязанные предметы</CardTitle>
                        <Badge className="bg-[#139AA4]/10 text-[#139AA4] border-0 px-2.5 py-0.5 rounded-lg font-semibold hover:bg-[#139AA4]/10">
                            Всего: {bindings.length}
                        </Badge>
                    </CardHeader>
                    <CardContent className="pt-6">
                        {bindings.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-12 text-center max-w-lg mx-auto my-6">
                                <Link2 className="mx-auto mb-4 h-12 w-12 text-slate-300 stroke-1" />
                                <h3 className="text-[16px] font-bold text-slate-700">У вас пока нет привязанных предметов</h3>
                                <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                                    Чтобы начать создавать тесты и проводить опросы, привяжите учебный предмет к своему личному кабинету.
                                </p>
                                <Button onClick={() => setBindOpen(true)} className="mt-6 gap-2 bg-gradient-to-r from-[#1b4d74] to-[#139AA4] hover:opacity-90">
                                    <Plus className="h-4 w-4" />
                                    Привязать предмет
                                </Button>
                            </div>
                        ) : (
                            <div className="grid gap-6 md:grid-cols-2">
                                {bindings.map((binding) => (
                                    <div key={binding.id} className="group relative rounded-3xl border border-slate-200/60 bg-white p-5 shadow-[0_4px_20px_rgba(15,23,42,0.02)] hover:shadow-[0_12px_30px_-10px_rgba(15,23,42,0.08)] transition-all duration-300 flex flex-col justify-between min-h-[220px]">
                                        <div className="space-y-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <h3 className="text-lg font-bold text-[#132844] leading-snug group-hover:text-[#139AA4] transition-colors">{binding.subject?.name}</h3>
                                                    {binding.subject?.code && (
                                                        <span className="mt-1.5 font-mono text-[11px] tracking-wider text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md inline-block">
                                                            {binding.subject.code}
                                                        </span>
                                                    )}
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg shrink-0 transition-colors"
                                                    onClick={() => removeBinding(binding.id, binding.subject?.name || 'предмету')}
                                                    title="Удалить привязку"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>

                                            {/* Statistics indicators */}
                                            <div className="grid grid-cols-3 gap-3">
                                                <div className="rounded-2xl bg-slate-50/70 p-3 border border-slate-100/50">
                                                    <div className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">Студентов</div>
                                                    <div className="mt-1 text-lg font-bold text-[#132844] tracking-tight">{binding.students_count || 0}</div>
                                                </div>
                                                <div className="rounded-2xl bg-slate-50/70 p-3 border border-slate-100/50">
                                                    <div className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">Тестов</div>
                                                    <div className="mt-1 text-lg font-bold text-[#132844] tracking-tight">{binding.tests_count || 0}</div>
                                                </div>
                                                <div className="rounded-2xl bg-slate-50/70 p-3 border border-slate-100/50">
                                                    <div className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">Попыток</div>
                                                    <div className="mt-1 text-lg font-bold text-[#132844] tracking-tight">{binding.attempts_count || 0}</div>
                                                </div>
                                                <div className="rounded-2xl bg-slate-50/70 p-3 border border-slate-100/50">
                                                    <div className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">Ср. балл</div>
                                                    <div className="mt-1 text-lg font-bold text-[#132844] tracking-tight">{binding.average_score || 0}</div>
                                                </div>
                                                <div className="rounded-2xl bg-slate-50/70 p-3 border border-slate-100/50">
                                                    <div className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">Макс. балл</div>
                                                    <div className="mt-1 text-lg font-bold text-[#132844] tracking-tight">{binding.max_score || 0}</div>
                                                </div>
                                                <div className="rounded-2xl bg-emerald-50/40 p-3 border border-emerald-100/30">
                                                    <div className="text-[10px] uppercase font-semibold tracking-wider text-emerald-600">Успешность</div>
                                                    <div className="mt-1 text-lg font-bold text-emerald-700 tracking-tight">{binding.success_rate || 0}%</div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                                            <p className="text-[11px] text-slate-400">Привязан: {formatDate(binding.created_at)}</p>
                                            <div className="flex items-center gap-2">
                                                <Link href={route('testing.bindings.analytics', binding.id)}>
                                                    <Button type="button" variant="outline" className="h-9 px-3 gap-2 rounded-xl text-xs hover:bg-slate-50 border-slate-200">
                                                        <BarChart3 className="h-3.5 w-3.5 text-slate-500" />
                                                        Аналитика
                                                    </Button>
                                                </Link>
                                                <Link href={route('testing.bindings.show', binding.id)}>
                                                    <Button type="button" className="h-9 px-4 rounded-xl text-xs bg-gradient-to-r from-[#1b4d74] to-[#139AA4] hover:opacity-90 shadow-sm">
                                                        Открыть тесты
                                                    </Button>
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* ── Modal Dialog: Bind New Subject ── */}
            <Dialog open={bindOpen} onOpenChange={(open) => {
                setBindOpen(open);
                if (!open) {
                    setModalSearch('');
                }
            }}>
                <DialogContent className="max-w-2xl border-slate-200/50 shadow-2xl rounded-2xl p-6">
                    <DialogHeader className="pb-3 border-b border-slate-100">
                        <DialogTitle className="text-xl font-bold text-[#132844] font-sans">Привязать новый предмет</DialogTitle>
                        <DialogDescription className="text-slate-500 text-sm mt-1 leading-normal">
                            Выберите необходимый предмет из каталога, чтобы добавить его в свой список для создания тестов.
                        </DialogDescription>
                    </DialogHeader>

                    {/* Search inside modal */}
                    <div className="relative mt-4">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                            value={modalSearch}
                            onChange={(e) => setModalSearch(e.target.value)}
                            placeholder="Поиск предмета по названию или коду…"
                            className="pl-9 pr-8 h-10 border-slate-200 focus-visible:ring-2 focus-visible:ring-[#139AA4]/20 focus-visible:border-[#139AA4] rounded-lg"
                        />
                        {modalSearch && (
                            <button
                                onClick={() => setModalSearch('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Subjects list in modal */}
                    <div className="mt-4 max-h-[350px] overflow-y-auto pr-1 space-y-2">
                        {filteredAvailable.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 text-sm italic bg-slate-50/50 rounded-xl">
                                {modalSearch ? 'Предметы не найдены по вашему запросу.' : 'Все предметы уже привязаны!'}
                            </div>
                        ) : (
                            filteredAvailable.map((subject) => (
                                <div key={subject.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-white p-3.5 shadow-sm hover:bg-slate-50/40 transition-colors">
                                    <div className="space-y-1">
                                        <h4 className="text-sm font-semibold text-slate-800 leading-snug">{subject.name}</h4>
                                        <div className="flex flex-wrap gap-2 items-center">
                                            {subject.code && (
                                                <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                                    {subject.code}
                                                </span>
                                            )}
                                            {subject.department_name && (
                                                <span className="text-[10px] text-slate-400">
                                                    {subject.department_name}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <Button
                                        size="sm"
                                        disabled={creatingSubjectId !== null}
                                        onClick={() => createBinding(subject.id)}
                                        className="h-9 px-3 gap-1 bg-[#139AA4] hover:bg-[#139AA4]/95 text-white rounded-lg text-xs"
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
