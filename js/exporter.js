// exporter.js (ES module) - shared CSV export helpers
export function csvEscape(v){ return `"${String(v ?? '').replace(/"/g,'""')}"`; }

export function downloadCsv(filename, headerArray, rowsArray){
  const header = headerArray.join(',');
  const lines = [header].concat(rowsArray.map(r => r.join(',')));
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}