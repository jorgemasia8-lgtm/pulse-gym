// progress.js -- Progreso y analitica con Chart.js, e1RM Epley, PRs, consistencia
import { all } from './db.js';
import { fmtWeight, fmtDate, emptyState, icons } from './ui.js';

let chartInstance = null;

function epley(weight, reps) {
  return weight * (1 + reps / 30);
}

export async function computeExerciseSeries(exerciseName, sessions) {
  const points = [];
  sessions
    .filter(s => s.exercises.some(e => e.name === exerciseName))
    .sort((a,b) => new Date(a.date) - new Date(b.date))
    .forEach(s => {
      const ex = s.exercises.find(e => e.name === exerciseName);
      const doneLogs = (ex.logs || []).filter(l => l.done);
      if (!doneLogs.length) return;
      const maxWeight = Math.max(...doneLogs.map(l => Number(l.weight)||0));
      const bestSet = doneLogs.reduce((best, l) => {
        const e1rm = epley(Number(l.weight)||0, Number(l.reps)||0);
        return e1rm > (best.e1rm||0) ? { ...l, e1rm } : best;
      }, {});
      const volume = doneLogs.reduce((acc,l) => acc + (Number(l.weight)||0)*(Number(l.reps)||0), 0);
      points.push({ date: s.date, maxWeight, e1rm: bestSet.e1rm || 0, volume, reps: bestSet.reps || 0 });
    });
  return points;
}

function filterByPeriod(points, period) {
  if (period === 'all') return points;
  const days = { '7d': 7, '30d': 30, '3m': 90, '1y': 365 }[period];
  const cutoff = Date.now() - days * 86400000;
  return points.filter(p => new Date(p.date).getTime() >= cutoff);
}

export function renderProgressView(container, ctx) {
  all('sessions').then(sessions => {
    if (sessions.length === 0) {
      container.innerHTML = emptyState(icons.progress, 'Todavía no hay progreso', 'Completa entrenamientos para ver tu evolución aquí.');
      return;
    }

    const exerciseNames = [...new Set(sessions.flatMap(s => s.exercises.filter(e=>!e.isCardio).map(e => e.name)))];
    const state = { exercise: exerciseNames[0], period: '30d', metric: 'e1rm' };

    const weekVolume = calcWeekVolume(sessions);
    const prs = calcPRs(sessions, exerciseNames);
    const streak = calcStreak(sessions);

    async function draw() {
      const points = filterByPeriod(await computeExerciseSeries(state.exercise, sessions), state.period);

      container.innerHTML = `
        <div class="section-header"><h2>Progreso</h2></div>

        <div class="progress-summary-grid">
          <div class="stat-card"><span class="stat-value">${sessions.filter(s=>isThisWeek(s.date)).length}</span><span class="stat-label">Entrenos esta semana</span></div>
          <div class="stat-card"><span class="stat-value">${fmtWeight(weekVolume)}</span><span class="stat-label">Volumen semanal</span></div>
          <div class="stat-card"><span class="stat-value">${streak}</span><span class="stat-label">Semanas de racha</span></div>
          <div class="stat-card"><span class="stat-value">${sessions.length}</span><span class="stat-label">Entrenos totales</span></div>
        </div>

        <div class="progress-controls">
          <select id="exercise-select">
            ${exerciseNames.map(n => `<option value="${n}" ${n===state.exercise?'selected':''}>${n}</option>`).join('')}
          </select>
          <div class="period-tabs">
            ${['7d','30d','3m','1y','all'].map(p => `<button class="period-tab ${p===state.period?'active':''}" data-period="${p}">${({'7d':'7d','30d':'30d','3m':'3m','1y':'1y','all':'Todo'})[p]}</button>`).join('')}
          </div>
        </div>

        <div class="chart-card">
          <canvas id="progress-chart" height="220"></canvas>
        </div>

        <div class="pr-grid">
          <h3>Récords: ${state.exercise}</h3>
          ${prs[state.exercise] ? `
            <div class="pr-item"><span>Peso máximo</span><strong>${fmtWeight(prs[state.exercise].maxWeight)}</strong></div>
            <div class="pr-item"><span>Mejor e1RM</span><strong>${fmtWeight(prs[state.exercise].bestE1rm)}</strong></div>
            <div class="pr-item"><span>Mayor volumen set</span><strong>${fmtWeight(prs[state.exercise].maxSetVolume)}</strong></div>
            <div class="pr-item"><span>Mayor volumen sesión</span><strong>${fmtWeight(prs[state.exercise].maxSessionVolume)}</strong></div>
          ` : '<p class="muted small">Sin datos suficientes todavía.</p>'}
        </div>
      `;

      container.querySelector('#exercise-select').addEventListener('change', (e) => { state.exercise = e.target.value; draw(); });
      container.querySelectorAll('.period-tab').forEach(btn => {
        btn.addEventListener('click', () => { state.period = btn.dataset.period; draw(); });
      });

      renderChart(points);
    }
    draw();
  }).catch(err => {
    container.innerHTML = `<div class="error-fallback"><h2>No se pudo cargar el progreso</h2><p>${err.message}</p></div>`;
  });
}

function renderChart(points) {
  const canvas = document.getElementById('progress-chart');
  if (!canvas) return;

  if (typeof Chart === 'undefined') {
    canvas.replaceWith(Object.assign(document.createElement('p'), {
      className: 'muted small',
      textContent: 'Los gráficos no están disponibles sin conexión la primera vez que abres esta pantalla.'
    }));
    return;
  }

  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
  if (points.length === 0) {
    canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);
    return;
  }

  chartInstance = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: points.map(p => fmtDate(p.date)),
      datasets: [{
        label: 'e1RM estimado',
        data: points.map(p => Math.round(p.e1rm)),
        borderColor: '#a3e635',
        backgroundColor: 'rgba(163,230,53,0.15)',
        tension: 0.3,
        fill: true,
        pointRadius: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#9a9a94' }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { ticks: { color: '#9a9a94' }, grid: { color: 'rgba(255,255,255,0.05)' } }
      }
    }
  });
}

function calcWeekVolume(sessions) {
  return sessions.filter(s => isThisWeek(s.date)).reduce((acc,s) => acc + (s.volume||0), 0);
}

function isThisWeek(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const start = new Date(now); start.setDate(now.getDate() - now.getDay() + 1); start.setHours(0,0,0,0);
  return d >= start;
}

function calcStreak(sessions) {
  const weeks = new Set(sessions.map(s => weekKey(s.date)));
  let streak = 0;
  let cursor = new Date();
  while (weeks.has(weekKey(cursor.toISOString()))) {
    streak++;
    cursor.setDate(cursor.getDate() - 7);
  }
  return streak;
}

function weekKey(dateStr) {
  const d = new Date(dateStr);
  const onejan = new Date(d.getFullYear(),0,1);
  const week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay()+1)/7);
  return `${d.getFullYear()}-${week}`;
}

function calcPRs(sessions, exerciseNames) {
  const prs = {};
  exerciseNames.forEach(name => {
    let maxWeight = 0, bestE1rm = 0, maxSetVolume = 0, maxSessionVolume = 0;
    sessions.forEach(s => {
      const ex = s.exercises.find(e => e.name === name);
      if (!ex) return;
      let sessionVol = 0;
      (ex.logs||[]).filter(l=>l.done).forEach(l => {
        const w = Number(l.weight)||0, r = Number(l.reps)||0;
        maxWeight = Math.max(maxWeight, w);
        bestE1rm = Math.max(bestE1rm, epley(w,r));
        maxSetVolume = Math.max(maxSetVolume, w*r);
        sessionVol += w*r;
      });
      maxSessionVolume = Math.max(maxSessionVolume, sessionVol);
    });
    if (maxWeight > 0) prs[name] = { maxWeight, bestE1rm, maxSetVolume, maxSessionVolume };
  });
  return prs;
}
