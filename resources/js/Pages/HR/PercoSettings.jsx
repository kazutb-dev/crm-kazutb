import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { exportToExcelCsv } from '@/lib/exportCsv';
import { Head, useForm } from '@inertiajs/react';
import { ChevronDown, ChevronRight, Download, Search, Settings2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

function TreeCheckbox({ checked, indeterminate, onChange }) {
    const ref = useRef(null);

    useEffect(() => {
        if (ref.current) {
            ref.current.indeterminate = indeterminate;
        }
    }, [indeterminate]);

    return <input ref={ref} type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4" />;
}

function DivisionNode({
    node,
    depth,
    visibleSet,
    descendantMap,
    expandedSet,
    onToggleExpand,
    onToggleVisibility,
    searchActive,
}) {
    const descendantIds = descendantMap.get(node.id) ?? [node.id];
    const selectedCount = descendantIds.filter((id) => visibleSet.has(id)).length;
    const checked = selectedCount === descendantIds.length && descendantIds.length > 0;
    const indeterminate = selectedCount > 0 && selectedCount < descendantIds.length;
    const hasChildren = node.children.length > 0;
    const isExpanded = searchActive || expandedSet.has(node.id);

    return (
        <div>
            <div
                className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/40"
                style={{ paddingLeft: `${depth * 20 + 8}px` }}
            >
                <button
                    type="button"
                    onClick={() => hasChildren && onToggleExpand(node.id)}
                    className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted"
                    disabled={!hasChildren}
                >
                    {hasChildren ? (
                        isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                    ) : (
                        <span className="h-4 w-4" />
                    )}
                </button>

                <TreeCheckbox
                    checked={checked}
                    indeterminate={indeterminate}
                    onChange={(e) => onToggleVisibility(node.id, e.target.checked)}
                />

                <span className="text-sm">{node.name}</span>
            </div>

            {hasChildren && isExpanded && (
                <div>
                    {node.children.map((child) => (
                        <DivisionNode
                            key={child.id}
                            node={child}
                            depth={depth + 1}
                            visibleSet={visibleSet}
                            descendantMap={descendantMap}
                            expandedSet={expandedSet}
                            onToggleExpand={onToggleExpand}
                            onToggleVisibility={onToggleVisibility}
                            searchActive={searchActive}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function buildTree(divisions) {
    const byParent = new Map();

    for (const division of divisions) {
        const key = division.parent_id ?? 'root';
        const list = byParent.get(key) ?? [];
        list.push({ ...division, children: [] });
        byParent.set(key, list);
    }

    const attach = (parentKey) => {
        const nodes = byParent.get(parentKey) ?? [];

        return nodes.map((node) => ({
            ...node,
            children: attach(node.id),
        }));
    };

    return attach('root');
}

function filterTree(nodes, query) {
    if (query === '') {
        return nodes;
    }

    return nodes
        .map((node) => {
            const children = filterTree(node.children, query);
            const matched = node.name.toLowerCase().includes(query);

            if (!matched && children.length === 0) {
                return null;
            }

            return {
                ...node,
                children,
            };
        })
        .filter(Boolean);
}

function collectDescendants(nodes, map = new Map()) {
    const walk = (node) => {
        const childIds = node.children.flatMap((child) => walk(child));
        const ids = [node.id, ...childIds];
        map.set(node.id, ids);
        return ids;
    };

    nodes.forEach(walk);
    return map;
}

function flattenNodes(nodes) {
    return nodes.flatMap((node) => [node, ...flattenNodes(node.children)]);
}

export default function PercoSettings({ divisions = [], setting = { visible_division_ids: [] } }) {
    const allDivisionIds = useMemo(() => divisions.map((division) => Number(division.id)), [divisions]);
    const tree = useMemo(() => buildTree(divisions), [divisions]);
    const descendantMap = useMemo(() => collectDescendants(tree), [tree]);
    const [divisionSearch, setDivisionSearch] = useState('');
    const [expandedIds, setExpandedIds] = useState(() => new Set(allDivisionIds));

    const { data, setData, post, processing, recentlySuccessful } = useForm({
        visible_division_ids: Array.isArray(setting.visible_division_ids)
            ? setting.visible_division_ids.map((id) => Number(id))
            : allDivisionIds,
    });

    useEffect(() => {
        setExpandedIds(new Set(allDivisionIds));
    }, [allDivisionIds]);

    const visibleSet = useMemo(() => new Set(data.visible_division_ids), [data.visible_division_ids]);
    const query = divisionSearch.trim().toLowerCase();
    const filteredTree = useMemo(() => filterTree(tree, query), [tree, query]);
    const foundCount = useMemo(() => flattenNodes(filteredTree).length, [filteredTree]);

    const toggleExpand = (id) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);

            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }

            return next;
        });
    };

    const toggleVisibility = (id, isVisible) => {
        const ids = descendantMap.get(id) ?? [id];
        const currentSet = new Set(data.visible_division_ids);

        if (isVisible) {
            ids.forEach((item) => currentSet.add(item));
        } else {
            ids.forEach((item) => currentSet.delete(item));
        }

        setData('visible_division_ids', Array.from(currentSet).sort((a, b) => a - b));
    };

    const submit = (e) => {
        e.preventDefault();
        post(route('hr.perco.settings.update'));
    };

    const showAll = () => setData('visible_division_ids', allDivisionIds);
    const hideAll = () => setData('visible_division_ids', []);
    const expandAll = () => setExpandedIds(new Set(allDivisionIds));
    const collapseAll = () => setExpandedIds(new Set());

    const handleExport = () => {
        const rows = divisions.map((division) => ({
            ...division,
            visible: visibleSet.has(Number(division.id)) ? 'Да' : 'Нет',
        }));

        exportToExcelCsv({
            fileName: 'hr_perco_settings_divisions.csv',
            columns: [
                { header: 'ID', key: 'id' },
                { header: 'Подразделение', key: 'name' },
                { header: 'Родительский ID', getValue: (row) => row.parent_id ?? '' },
                { header: 'Видимо в HR', key: 'visible' },
            ],
            rows,
        });
    };

    return (
        <AuthenticatedLayout>
            <Head title="HR / Настройки Perco" />

            <div className="space-y-4 p-4 sm:p-6 lg:p-8">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Settings2 className="h-4 w-4" />
                            Настройка видимости подразделений HR
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form className="space-y-4" onSubmit={submit}>
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                                <Button type="button" variant="outline" size="sm" onClick={showAll}>
                                    Показать все
                                </Button>
                                <Button type="button" variant="outline" size="sm" onClick={hideAll}>
                                    Скрыть все
                                </Button>
                                <Button type="button" variant="outline" size="sm" onClick={expandAll}>
                                    Развернуть все
                                </Button>
                                <Button type="button" variant="outline" size="sm" onClick={collapseAll}>
                                    Свернуть все
                                </Button>
                                <Button type="button" variant="outline" size="sm" onClick={handleExport}>
                                    <Download className="mr-1 h-4 w-4" />
                                    Экспорт в Excel
                                </Button>
                                <span className="ml-auto text-xs text-muted-foreground">
                                    Видно подразделений: <strong>{data.visible_division_ids.length}</strong>
                                </span>
                            </div>

                            <div className="rounded-md border">
                                <div className="border-b bg-muted/40 px-4 py-2 text-sm font-medium">
                                    Дерево подразделений
                                </div>
                                <div className="space-y-2 border-b px-3 py-2">
                                    <div className="relative">
                                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                            value={divisionSearch}
                                            onChange={(e) => setDivisionSearch(e.target.value)}
                                            placeholder="Поиск подразделения..."
                                            className="h-9 pl-9"
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Найдено узлов: <strong>{foundCount}</strong>
                                    </p>
                                </div>
                                <div className="max-h-[560px] overflow-auto p-2">
                                    {filteredTree.length === 0 ? (
                                        <p className="p-2 text-sm text-muted-foreground">Подразделения не найдены.</p>
                                    ) : (
                                        <div className="space-y-1">
                                            {filteredTree.map((node) => (
                                                <DivisionNode
                                                    key={node.id}
                                                    node={node}
                                                    depth={0}
                                                    visibleSet={visibleSet}
                                                    descendantMap={descendantMap}
                                                    expandedSet={expandedIds}
                                                    onToggleExpand={toggleExpand}
                                                    onToggleVisibility={toggleVisibility}
                                                    searchActive={query !== ''}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <Button type="submit" disabled={processing}>
                                    {processing ? 'Сохранение...' : 'Сохранить настройки'}
                                </Button>
                                {recentlySuccessful && (
                                    <span className="text-sm text-green-700">Настройки сохранены.</span>
                                )}
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}
