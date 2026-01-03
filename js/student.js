// student.js — updated to reflect teacher remarks in real-time and exports
import { renderLineChart } from './charts.js';
import { csvEscape, downloadCsv } from './exporter.js';

// --- Session & Role Checks ---
const role = sessionStorage.getItem('role');
const studentId = sessionStorage.getItem('studentId');
if (!role || !studentId) location.href = '/pages/login.html';

// --- UI Setup ---
document.getElementById('studentName').textContent = sessionStorage.getItem('studentName') || 'Student';
document.getElementById('logoutBtn').addEventListener('click', () => {
  sessionStorage.clear();
  location.href = '/pages/login.html';
});

// --- Data Loading ---
async function loadData() {
  const [studentsRes, scoresRes, teachersRes] = await Promise.all([
    fetch('/data/students.json'),
    fetch('/data/scores.json'),
    fetch('/data/teachers.json')
  ]);
  const students = await studentsRes.json();
  const scoresJson = await scoresRes.json();
  const teachers = await teachersRes.json();
  return { students, assessments: scoresJson.assessments, scores: scoresJson.scores, teachers };
}

// --- Helpers ---
function calcTotals(rows) {
  const total = rows.reduce((t, r) => t + r.marksObtained, 0);
  const maxTotal = rows.reduce((t, r) => t + (r.maxMarks || 0), 0);
  const perc = maxTotal ? (total / maxTotal * 100) : 0;
  return { total, maxTotal, perc: perc.toFixed(2) };
}

// --- State ---
let appData = null;
let studentScores = [];
let currentTableRows = [];

// --- Init ---
async function init() {
  appData = await loadData();
  const student = appData.students.find(s => s.id === studentId);
  if (!student) { sessionStorage.clear(); location.href = '/pages/login.html'; return; }

  // Always show all subjects the student is registered in
  const allowedSubjects = [...student.subjects];

  // Metadata (teacher view)
  const viewedByTeacher = sessionStorage.getItem('viewedByTeacher');
  if (viewedByTeacher) {
    const teacherObj = appData.teachers.find(t => t.id === viewedByTeacher);
    if (teacherObj) document.getElementById('studentMeta').textContent =
      `${student.roll} • ${student.department} • Section ${student.section} • Viewed by ${teacherObj.name}`;
  } else {
    document.getElementById('studentMeta').textContent =
      `${student.roll} • ${student.department} • Section ${student.section}`;
  }

  document.getElementById('studentName').textContent = sessionStorage.getItem('studentName') || student.name;

  // --- Scores (include teacher name and assessment details) ---
  studentScores = appData.scores
    .filter(s => s.studentId === studentId && allowedSubjects.includes(s.subject))
    .map(r => {
      const a = appData.assessments.find(x => x.id === r.assessmentId) || {};
      const teacher = appData.teachers.find(t => t.id === r.teacherId) || {};

      // --- Override remarks if teacher updated in sessionStorage ---
      const remarkKey = `score_remark_${r.studentId}_${r.assessmentId}`;
      const updatedRemark = sessionStorage.getItem(remarkKey) ?? r.remarks ?? '';

      return {
        ...r,
        date: a.date || '',
        assessment: a.name || '',
        maxMarks: a.maxMarks || r.maxMarks || 0,
        teacherName: teacher.name || '',
        remarks: updatedRemark
      };
    })
    .sort((a, b) => (new Date(a.date || 0)) - (new Date(b.date || 0)));

  // --- Summary ---
  const totals = calcTotals(studentScores);
  document.getElementById('summary').innerHTML = `
    <p><strong>Total:</strong> ${totals.total} / ${totals.maxTotal}</p>
    <p><strong>Percentage:</strong> ${totals.perc}%</p>
    <p><strong>Subjects shown:</strong> ${allowedSubjects.join(', ')}</p>
  `;

  // --- Chart ---
  const labels = studentScores.map(s => s.assessment);
  const marks = studentScores.map(s => s.marksObtained);
  const maxMarks = studentScores.map(s => s.maxMarks);
  renderLineChart('progressChart', labels, marks, maxMarks, 'Marks over Assessments');

  // --- Table + Exports ---
  renderTable();
  setupExports(role);

  console.log('Loaded student:', studentId, student.name);
  console.log('Scores found:', studentScores.length);
}

// --- Table Rendering ---
function renderTable() {
  const tbody = document.querySelector('#studentTable tbody');
  const rows = studentScores;
  currentTableRows = rows;

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="muted">No assessments found.</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map(r => {
    const remarkCell = (role === 'teacher')
      ? `<input type="text" data-scoreid="${r.id}" value="${csvEscape(r.remarks || '')}" class="remark-input" />`
      : (r.remarks && r.remarks.trim() ? csvEscape(r.remarks) : '-');

    return `<tr>
      <td>${r.date}</td>
      <td>${r.assessment}</td>
      <td>${r.subject}</td>
      <td>${r.marksObtained}</td>
      <td>${r.maxMarks}</td>
      <td>${remarkCell}</td>
    </tr>`;
  }).join('');

  // Teacher can edit remarks inline
  if (role === 'teacher') {
    document.querySelectorAll('.remark-input').forEach(input => {
      input.addEventListener('change', e => updateRemark(e.target.dataset.scoreid, e.target.value));
      input.addEventListener('blur', e => updateRemark(e.target.dataset.scoreid, e.target.value));
      input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } });
    });
  }
}

// --- Update Remark (in-memory + sessionStorage) ---
function updateRemark(scoreId, newRemark) {
  const score = appData.scores.find(s => s.id === scoreId);
  if (score) score.remarks = newRemark;

  const localScore = studentScores.find(s => s.id === scoreId);
  if (localScore) localScore.remarks = newRemark;

  // Save for teacher-student sync
  const syncKey = `score_remark_${studentId}_${scoreId}`;
  sessionStorage.setItem(syncKey, newRemark);

  console.log(`Remark updated for ${scoreId}: ${newRemark}`);
}

// --- Export Buttons Setup ---
function setupExports(currentRole) {
  const exportCurrentBtn = document.getElementById('exportCsv');
  if (exportCurrentBtn) exportCurrentBtn.addEventListener('click', exportCurrentViewCsv);

  const canExportAll = currentRole === 'student' || currentRole === 'teacher';
  if (canExportAll) {
    const targetHeader = document.querySelector('.card h3');
    if (targetHeader) {
      const exportAllBtn = document.createElement('button');
      exportAllBtn.className = 'btn small';
      exportAllBtn.textContent = 'Export All (CSV)';
      exportAllBtn.addEventListener('click', exportAllStudentsReport);
      targetHeader.insertAdjacentElement('afterend', exportAllBtn);
    }
  }
}

// --- Export Functions ---
function exportCurrentViewCsv() {
  if (!currentTableRows.length) return alert('No rows to export');
  const header = ['Date','Assessment','Subject','Marks','Max','Teacher','Remarks'];
  const rows = currentTableRows.map(r => [
    csvEscape(r.date), csvEscape(r.assessment), csvEscape(r.subject),
    r.marksObtained, r.maxMarks, csvEscape(r.teacherName || ''), csvEscape(r.remarks || '')
  ]);
  downloadCsv(`${studentId}_view.csv`, header, rows);
}

function exportAllStudentsReport() {
  const amap = new Map(appData.assessments.map(a => [a.id, a]));
  const teacherMap = new Map(appData.teachers.map(t => [t.id, t.name]));
  const rows = [];

  if (role === 'teacher') {
    // Teacher sees all students
    appData.students.forEach(st => {
      const scores = appData.scores.filter(r => r.studentId === st.id);
      scores.forEach(s => {
        const a = amap.get(s.assessmentId) || {};
        rows.push([
          csvEscape(st.roll), csvEscape(st.name),
          csvEscape(a.name || ''), csvEscape(a.date || ''),
          csvEscape(s.subject || a.subject || ''), s.marksObtained || 0,
          s.maxMarks || a.maxMarks || 0, csvEscape(teacherMap.get(s.teacherId) || ''),
          csvEscape(s.remarks || '')
        ]);
      });
    });
    if (!rows.length) return alert('No student scores available to export');
    downloadCsv('ALL_students_report.csv', ['Roll','Name','Assessment','Date','Subject','Marks','Max','Teacher','Remarks'], rows);
  } else {
    // Student sees only their scores
    const scores = appData.scores.filter(r => r.studentId === studentId);
    scores.forEach(s => {
      const a = amap.get(s.assessmentId) || {};
      rows.push([
        csvEscape(studentId), csvEscape(sessionStorage.getItem('studentName') || ''),
        csvEscape(a.name || ''), csvEscape(a.date || ''),
        csvEscape(s.subject || a.subject || ''), s.marksObtained || 0,
        s.maxMarks || a.maxMarks || 0, csvEscape(teacherMap.get(s.teacherId) || ''),
        csvEscape(s.remarks || '')
      ]);
    });
    if (!rows.length) return alert('No scores available to export');
    downloadCsv(`${studentId}_ALL.csv`, ['Roll','Name','Assessment','Date','Subject','Marks','Max','Teacher','Remarks'], rows);
  }
}

// --- Run ---
init();
