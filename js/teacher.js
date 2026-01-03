// teacher.js — updated remark sync
import { renderBarChart } from './charts.js';
import { csvEscape, downloadCsv } from './exporter.js';

if (sessionStorage.getItem('role') !== 'teacher') location.href = '/pages/login.html';
const teacherId = sessionStorage.getItem('teacherId');
if (!teacherId) location.href = '/pages/login.html';

document.getElementById('teacherName').textContent = sessionStorage.getItem('teacherName') || 'Teacher';
document.getElementById('logoutBtn').addEventListener('click', () => {
  sessionStorage.clear();
  location.href = '/pages/login.html';
});

let data = null;
let me = null;
let studentsYouTeach = [];

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

async function init() {
  data = await loadData();
  me = data.teachers.find(t => t.id === teacherId);
  if (!me) { sessionStorage.clear(); location.href = '/pages/login.html'; return; }

  renderClassesAndSubjects();
  studentsYouTeach = data.students.filter(s => s.subjects.some(sub => me.subjects.includes(sub)));
  renderTeacherTable();
  setupSubjectFilter();
  renderChart();
  setupExportAll();
}

function renderClassesAndSubjects() {
  const classInfoEl = document.getElementById('classInfo');
  if (!classInfoEl) return;
  const subjectsHtml = `<h4>Subjects You Teach</h4><ul class="pill-list">${me.subjects.map(s => `<li>${s}</li>`).join('')}</ul>`;
  const departments = [...new Set(data.students.filter(s => s.subjects.some(sub => me.subjects.includes(sub))).map(s => s.department))];
  const departmentsHtml = `<h4>Associated Departments</h4>${departments.length ? `<ul class="pill-list">${departments.map(d => `<li>${d}</li>`).join('')}</ul>` : `<p class="muted">No departments detected.</p>`}`;
  classInfoEl.innerHTML = subjectsHtml + departmentsHtml;
  document.getElementById('teacherMeta').textContent = `Subjects: ${me.subjects.join(', ')}`;
}

function renderTeacherTable(filterSubject = '') {
  const tbody = document.querySelector('#studentsTable tbody');
  tbody.innerHTML = '';

  studentsYouTeach.forEach(st => {
    const studentScores = data.scores.filter(r =>
      r.studentId === st.id &&
      me.subjects.includes(r.subject) &&
      (!filterSubject || r.subject === filterSubject)
    );
    if (!studentScores.length) return;

    studentScores.forEach(s => {
      const a = data.assessments.find(a => a.id === s.assessmentId) || {};
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${st.roll}</td>
        <td>${st.name}</td>
        <td>${st.department}</td>
        <td>${s.subject}</td>
        <td>${s.marksObtained}</td>
        <td>${s.maxMarks || a.maxMarks || 0}</td>
        <td>
          <input type="text" value="${s.remarks || ''}" 
                 data-student="${st.id}" data-assessment="${s.assessmentId}" 
                 class="remark-input">
        </td>
        <td>
          <button class="btn small submit-remark" 
                  data-student="${st.id}" data-assessment="${s.assessmentId}">Submit</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  });

  tbody.querySelectorAll('.submit-remark').forEach(btn => {
    btn.addEventListener('click', e => {
      const stId = e.target.dataset.student;
      const aId = e.target.dataset.assessment;
      const input = tbody.querySelector(`.remark-input[data-student="${stId}"][data-assessment="${aId}"]`);
      const newRemark = input.value;

      // Update in-memory
      const score = data.scores.find(s => s.studentId === stId && s.assessmentId === aId);
      if (score) score.remarks = newRemark;

      // Sync to sessionStorage for student page if open
      const syncKey = `score_remark_${stId}_${aId}`;
      sessionStorage.setItem(syncKey, newRemark);

      // Optional feedback
      input.style.borderColor = '#22c55e';
      setTimeout(() => input.style.borderColor = '', 1200);
    });
  });
}

function setupSubjectFilter() {
  const sel = document.getElementById('teacherSubjectFilter');
  me.subjects.forEach(s => { const opt = document.createElement('option'); opt.value = s; opt.textContent = s; sel.appendChild(opt); });
  sel.addEventListener('change', () => renderTeacherTable(sel.value));
}

function renderChart() {
  const counts = {};
  data.assessments.forEach(a => { counts[a.subject] = (counts[a.subject] || 0) + 1; });
  const labels = Object.keys(counts).filter(s => me.subjects.includes(s));
  const dataVals = labels.map(l => counts[l] || 0);
  renderBarChart('assessChart', labels, dataVals, 'Assessments per Subject');
}

function setupExportAll() {
  document.getElementById('exportTeacherCsv').addEventListener('click', () => {
    const rows = [];
    const amap = new Map(data.assessments.map(a => [a.id, a]));
    const teacherMap = new Map(data.teachers.map(t => [t.id, t.name]));

    studentsYouTeach.forEach(st => {
      const scores = data.scores.filter(s => s.studentId === st.id && me.subjects.includes(s.subject));
      scores.forEach(s => {
        const a = amap.get(s.assessmentId) || {};
        rows.push([
          csvEscape(st.roll),
          csvEscape(st.name),
          csvEscape(a.name || ''),
          csvEscape(a.date || ''),
          csvEscape(s.subject || a.subject || ''),
          s.marksObtained || 0,
          s.maxMarks || a.maxMarks || 0,
          csvEscape(teacherMap.get(s.teacherId) || ''),
          csvEscape(s.remarks || '')
        ]);
      });
    });

    const header = ['Roll','Name','Assessment','Date','Subject','Marks','Max','Teacher','Remark'];
    downloadCsv(`${teacherId}_students_report.csv`, header, rows);
  });
}

init();
