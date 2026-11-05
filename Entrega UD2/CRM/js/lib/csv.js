// Descarga de CSV para Excel. En español: separador ';' y coma decimal; BOM para que respete las tildes.
// Las celdas de texto que empiezan por = + - @ se neutralizan para que Excel no las ejecute. Sin dependencias.
export function downloadCsv(rows, filename, { locale = 'es-ES', separator = locale.startsWith('es') ? ';' : ',' } = {}) {
  const number = new Intl.NumberFormat(locale, { useGrouping: false, maximumFractionDigits: 2 });
  const cell = value => {
    if (typeof value === 'number') return number.format(value);
    const text = /^\s*[=+\-@]/.test(value) ? `'${value}` : String(value ?? '');
    return `"${text.replaceAll('"', '""')}"`;
  };
  const csv = rows.map(row => row.map(cell).join(separator)).join('\r\n');
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
