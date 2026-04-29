export function exportToExcelCsv({ fileName, columns, rows }) {
    const safeColumns = Array.isArray(columns) ? columns : [];
    const safeRows = Array.isArray(rows) ? rows : [];

    if (safeColumns.length === 0) {
        return;
    }

    const normalize = (value) => {
        if (value === null || value === undefined) return '';
        return String(value)
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n');
    };

    const escapeCell = (value) => {
        const text = normalize(value).replace(/"/g, '""');
        return `"${text}"`;
    };

    const header = safeColumns.map((c) => escapeCell(c.header ?? '')).join(';');
    const body = safeRows.map((row) => {
        return safeColumns
            .map((column) => {
                if (typeof column.getValue === 'function') {
                    return escapeCell(column.getValue(row));
                }

                return escapeCell(row?.[column.key]);
            })
            .join(';');
    });

    const csv = `\uFEFF${[header, ...body].join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.setAttribute('download', fileName || 'export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
