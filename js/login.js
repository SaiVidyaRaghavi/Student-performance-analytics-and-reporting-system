// login.js (ES module)

async function findTeacher(idOrEmail) {
  const res = await fetch('/data/teachers.json');
  const list = await res.json();
  return list.find(
    t =>
      t.id === idOrEmail ||
      t.email === idOrEmail ||
      t.name.toLowerCase() === idOrEmail.toLowerCase()
  );
}

async function findStudentByRollOrId(id) {
  const res = await fetch('/data/students.json');
  const list = await res.json();
  return list.find(
    s =>
      s.roll === id ||
      s.id === id ||
      s.name.toLowerCase() === id.toLowerCase()
  );
}

const form = document.getElementById('loginForm');
const msg = document.getElementById('msg');
const roleSelect = document.getElementById('role');
const identInput = document.getElementById('identifier');
const passwordInput = document.getElementById('password');
const signInBtn = form.querySelector('button[type="submit"]');

// Enable/disable button based on input
function updateButtonState() {
  const filled = identInput.value.trim() && passwordInput.value.trim();
  signInBtn.disabled = !filled;
  signInBtn.style.opacity = filled ? '1' : '0.6';
  signInBtn.style.cursor = filled ? 'pointer' : 'not-allowed';
}

identInput.addEventListener('input', updateButtonState);
passwordInput.addEventListener('input', updateButtonState);
roleSelect.addEventListener('change', updateButtonState);

form.addEventListener('submit', async e => {
  e.preventDefault();
  msg.textContent = '';
  const role = roleSelect.value;
  const ident = identInput.value.trim();

  try {
    if (role === 'teacher') {
      const t = await findTeacher(ident);
      if (!t)
        throw new Error(
          'Teacher not found. Use teacher id or email from /data/teachers.json'
        );
      sessionStorage.setItem('role', 'teacher');
      sessionStorage.setItem('teacherId', t.id);
      sessionStorage.setItem('teacherName', t.name);
      location.href = '/pages/teacher-dashboard.html';
    } else {
      const s = await findStudentByRollOrId(ident);
      if (!s)
        throw new Error(
          'Student not found. Use student roll or id from /data/students.json'
        );
      sessionStorage.setItem('role', 'student');
      sessionStorage.setItem('studentId', s.id);
      sessionStorage.setItem('studentName', s.name);
      location.href = '/pages/student-dashboard.html';
    }
  } catch (err) {
    msg.textContent = err.message;
    msg.style.color = 'crimson';
    // shake animation
    form.classList.remove('shake');
    void form.offsetWidth; // trigger reflow
    form.classList.add('shake');
  }
});