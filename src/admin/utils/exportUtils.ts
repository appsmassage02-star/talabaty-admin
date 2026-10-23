/**
 * Safe Administrative Data Export Utility (CSV Export)
 */

export function exportToCSV(filename: string, rows: Record<string, any>[]): void {
  if (!rows || !rows.length) {
    alert('لا توجد بيانات متاحة للتصدير');
    return;
  }

  const separator = ',';
  const keys = Object.keys(rows[0]);

  const header = keys.map((key) => `"${key.replace(/"/g, '""')}"`).join(separator);

  const csvContent =
    '\uFEFF' + // UTF-8 BOM for proper Arabic Excel rendering
    header +
    '\n' +
    rows
      .map((row) =>
        keys
          .map((key) => {
            let val = row[key];
            if (val === null || val === undefined) val = '';
            if (typeof val === 'object') {
              val = JSON.stringify(val);
            }
            val = String(val).replace(/"/g, '""');
            return `"${val}"`;
          })
          .join(separator)
      )
      .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
