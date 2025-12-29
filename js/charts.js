// charts.js (ES module)
export function renderBarChart(canvasId, labels, dataVals, title){
  const el = document.getElementById(canvasId);
  if(!el) return;
  const ctx = el.getContext('2d');
  if(el._chart) el._chart.destroy();
  el._chart = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label: title, data: dataVals, backgroundColor: labels.map(()=> '#0b6efd') }] },
    options: { responsive:true, plugins:{legend:{display:false}} }
  });
}

export function renderLineChart(canvasId, labels, marksData, maxData, title){
  const el = document.getElementById(canvasId);
  if(!el) return;
  const ctx = el.getContext('2d');
  if(el._chart) el._chart.destroy();
  el._chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Marks', data: marksData, borderColor: '#0b6efd', backgroundColor: 'rgba(11,110,253,0.08)', tension:0.2, fill:true },
        { label: 'Max', data: maxData, borderColor: '#999', borderDash:[6,4], tension:0.2, fill:false }
      ]
    },
    options: { responsive:true, plugins:{legend:{position:'top'}} }
  });
}