// home.js -- Dashboard de Inicio: rutina sugerida, reanudar sesion, resumen
import { getRoutines } from './routines.js';
import { getActiveSession } from './session.js';
import { all } from './db.js';
import { fmtWeight, fmtDuration, icons, emptyState } from './ui.js';

const DAY_NAMES = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

export function renderHomeView(container, ctx) {
  Promise.all([getRoutines(), getActiveSession(), all('sessions')]).then(([routines, active, sessions]) => {
    const todayName = DAY_NAMES[new Date().getDay()];
    const todayRoutine = routines.find(r => r.day === todayName);
    const weekSessions = sessions.filter(s => isThisWeek(s.date));
    const weekVolume = weekSessions.reduce((acc,s) => acc + (s.volume||0), 0);

    container.innerHTML = `
      <div class="home-header">
        <h1>Hola 👋</h1>
        <p class="muted">${todayName}, ${new Date().toLocaleDateString('es-ES', { day:'numeric', month:'long' })}</p>
      </div>

      ${active ? `
        <div class="card active-session-banner">
          <div>
            <strong>Tienes una sesión en curso</strong>
            <p class="muted small">${active.routineName}</p>
          </div>
          <button class="btn btn-primary" id="resume-session-btn">Reanudar</button>
        </div>
      ` : todayRoutine ? `
        <div class="card today-routine-card">
          <span class="chip">Hoy toca</span>
          <h2>${todayRoutine.name}</h2>
          ${todayRoutine.exercises.length === 0
            ? `<p class="muted small">${todayRoutine.isRestDay ? 'Día de descanso. Movilidad, paseo o recuperación activa.' : 'Sin ejercicios configurados todavía.'}</p>`
            : `<p class="muted small">${todayRoutine.exercises.length} ejercicios</p><button class="btn btn-primary btn-block" id="start-today-btn">Entrenar ahora</button>`
          }
        </div>
      ` : ''}

      <div class="home-stats-grid">
        <div class="stat-card"><span class="stat-value">${weekSessions.length}</span><span class="stat-label">Entrenos esta semana</span></div>
        <div class="stat-card"><span class="stat-value">${fmtWeight(weekVolume)}</span><span class="stat-label">Volumen semanal</span></div>
      </div>

      <div class="section-header"><h3>Últimos entrenos</h3></div>
      ${sessions.length === 0
        ? `<p class="muted small">Aún no has completado ningún entrenamiento.</p>`
        : `<div class="home-recent-list">
            ${sessions.slice(0,3).map(s => `
              <div class="card recent-session-card">
                <strong>${s.routineName}</strong>
                <span class="muted small">${fmtDuration(s.durationSeconds||0)} · ${fmtWeight(s.volume||0)}</span>
              </div>
            `).join('')}
          </div>
          <button class="btn btn-ghost btn-block" id="view-history-btn">Ver historial completo</button>
        `}
    `;

    const resumeBtn = container.querySelector('#resume-session-btn');
    if (resumeBtn) resumeBtn.addEventListener('click', () => ctx.navigate('session'));

    const startBtn = container.querySelector('#start-today-btn');
    if (startBtn) startBtn.addEventListener('click', () => ctx.startSession(todayRoutine.id));

    const histBtn = container.querySelector('#view-history-btn');
    if (histBtn) histBtn.addEventListener('click', () => ctx.navigate('history'));
  }).catch(err => {
    container.innerHTML = `<div class="error-fallback"><h2>No se pudo cargar Inicio</h2><p>${err.message}</p></div>`;
  });
}

function isThisWeek(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const start = new Date(now); start.setDate(now.getDate() - now.getDay() + 1); start.setHours(0,0,0,0);
  return d >= start;
}
