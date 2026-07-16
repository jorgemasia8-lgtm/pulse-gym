// session.js -- Sesion activa: flujo rapido, autosave, temporizador desacoplado, edicion de sets
import { get, put, remove, all } from './db.js';
import { settings } from './data.js';
import { getRoutine } from './routines.js';
import { toast, confirmDialog, fmtWeight, fmtDuration, icons, emptyState } from './ui.js';
import { RestTimer } from './timer.js';

const ACTIVE_ID = 'current';
let timer = null;
let sessionStartInterval = null;

export async function getActiveSession() {
  return get('activeSession', ACTIVE_ID);
}

export async function startSession(routineId, ctx) {
  const routine = await getRoutine(routineId);
  if (!routine || !routine.exercises || routine.exercises.length === 0) {
    toast('Esta rutina no tiene ejercicios. Añade alguno antes de entrenar.', 'error');
    return;
  }

  const existing = await getActiveSession();
  if (existing) {
    const resume = await confirmDialog({
      title: 'Sesión en curso',
      message: 'Ya tienes una sesión activa sin terminar. ¿Quieres descartarla y empezar una nueva?',
      confirmText: 'Descartar y empezar nueva',
    });
    if (!resume) { ctx.navigate('session'); return; }
    await remove('activeSession', ACTIVE_ID);
  }

  const lastLogs = await getLastLogsFor(routine.exercises.map(e => e.name));

  const session = {
    id: ACTIVE_ID,
    routineId: routine.id,
    routineName: routine.name,
    startedAt: new Date().toISOString(),
    currentExerciseIndex: 0,
    exercises: routine.exercises.map(ex => ({
      exerciseId: ex.id,
      name: ex.name,
      muscle: ex.muscle,
      isCardio: !!ex.isCardio,
      targetReps: ex.targetReps,
      rest: ex.rest || 90,
      notes: ex.notes || '',
      lastMark: lastLogs[ex.name] || null,
      logs: ex.isCardio ? [] : Array.from({ length: ex.sets || 3 }, (_, i) => ({
        set: i + 1, weight: lastLogs[ex.name]?.weight ?? '', reps: '', rir: '', type: 'effective', done: false, notes: ''
      })),
      cardio: ex.isCardio ? { duration: '', intensity: ex.intensity || 'Moderada', distance: '' } : null
    }))
  };

  await put('activeSession', session);
  ctx.navigate('session');
}

async function getLastLogsFor(names) {
  const sessions = await all('sessions');
  const result = {};
  const sorted = sessions.sort((a, b) => new Date(b.date) - new Date(a.date));
  for (const name of names) {
    for (const s of sorted) {
      const ex = s.exercises.find(e => e.name === name);
      if (ex && ex.logs && ex.logs.length) {
        const lastDone = [...ex.logs].reverse().find(l => l.done);
        if (lastDone) { result[name] = lastDone; break; }
      }
    }
  }
  return result;
}

export function renderSessionView(container, ctx) {
  getActiveSession().then(session => {
    if (!session) {
      container.innerHTML = emptyState(
        icons.session,
        'Sin sesión activa',
        'Ve a Rutinas y pulsa "Entrenar" en el día que quieras hacer.',
        `<button class="btn btn-primary" id="go-routines">Ver rutinas</button>`
      );
      container.querySelector('#go-routines').addEventListener('click', () => ctx.navigate('routines'));
      return;
    }
    renderActiveSession(container, session, ctx);
  }).catch(err => {
    container.innerHTML = `<div class="error-fallback"><h2>No se pudo cargar la sesión</h2><p>${err.message}</p></div>`;
  });
}

async function saveSession(session) {
  await put('activeSession', session);
}

function renderActiveSession(container, session, ctx) {
  const idx = session.currentExerciseIndex;
  const exercise = session.exercises[idx];
  const nextExercise = session.exercises[idx + 1];
  const totalVolume = calcSessionVolume(session);
  const elapsed = Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000);

  container.innerHTML = `
    <div class="session-header">
      <div>
        <span class="session-routine-name">${session.routineName}</span>
        <span class="session-elapsed" id="session-elapsed">${fmtDuration(elapsed)}</span>
      </div>
      <button class="btn btn-ghost btn-sm" id="discard-session-btn">Descartar</button>
    </div>

    <div class="session-progress-bar">
      <div class="session-progress-fill" style="width:${((idx) / session.exercises.length) * 100}%"></div>
    </div>
    <p class="muted small">Ejercicio ${idx + 1} de ${session.exercises.length} · Volumen sesión: <strong>${fmtWeight(totalVolume)}</strong></p>

    <div id="rest-timer-zone"></div>

    <div class="exercise-active-card">
      <div class="exercise-active-top">
        <h2>${exercise.name}</h2>
        <button class="btn btn-ghost btn-sm" id="switch-exercise-btn">Cambiar ejercicio</button>
      </div>
      ${exercise.muscle ? `<span class="chip">${exercise.muscle}</span>` : ''}
      ${exercise.lastMark ? `<p class="muted small">Última vez: ${fmtWeight(exercise.lastMark.weight)} × ${exercise.lastMark.reps} reps</p>` : ''}

      ${exercise.isCardio ? renderCardioForm(exercise) : renderSetsTable(exercise, session)}

      ${nextExercise ? `<p class="muted small next-exercise">Siguiente: ${nextExercise.name}</p>` : `<p class="muted small next-exercise">Último ejercicio de la sesión</p>`}
    </div>

    <div class="session-nav-actions">
      <button class="btn btn-ghost" id="prev-ex-btn" ${idx === 0 ? 'disabled' : ''}>Anterior</button>
      ${idx === session.exercises.length - 1
        ? `<button class="btn btn-primary" id="finish-session-btn">Finalizar entreno</button>`
        : `<button class="btn btn-primary" id="next-ex-btn">Siguiente</button>`
      }
    </div>
  `;

  if (sessionStartInterval) clearInterval(sessionStartInterval);
  sessionStartInterval = setInterval(() => {
    const el = document.getElementById('session-elapsed');
    if (!el) { clearInterval(sessionStartInterval); return; }
    const e = Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000);
    el.textContent = fmtDuration(e);
  }, 1000);

  wireSessionEvents(container, session, ctx, exercise);
}

function renderSetsTable(exercise, session) {
  return `
    <div class="sets-table" data-exercise-sets>
      <div class="sets-table-head">
        <span>Set</span><span>Peso</span><span>Reps</span><span>RIR</span><span>Tipo</span><span></span>
      </div>
      ${exercise.logs.map((log, i) => `
        <div class="set-row ${log.done ? 'set-done' : ''}" data-set-idx="${i}">
          <span class="set-num">${log.set}</span>
          <input type="number" inputmode="decimal" step="0.5" min="0" max="600" data-field="weight" value="${log.weight}" aria-label="Peso set ${log.set}" />
          <input type="number" inputmode="numeric" min="0" max="100" data-field="reps" value="${log.reps}" aria-label="Repeticiones set ${log.set}" />
          <input type="number" inputmode="numeric" min="0" max="10" data-field="rir" value="${log.rir}" aria-label="RIR set ${log.set}" />
          <select data-field="type" aria-label="Tipo de set">
            <option value="warmup" ${log.type==='warmup'?'selected':''}>Calent.</option>
            <option value="effective" ${log.type==='effective'?'selected':''}>Efectivo</option>
            <option value="failure" ${log.type==='failure'?'selected':''}>Fallo</option>
            <option value="dropset" ${log.type==='dropset'?'selected':''}>Dropset</option>
          </select>
          <div class="set-row-actions">
            <button class="icon-btn set-complete-btn ${log.done ? 'is-done' : ''}" data-action="toggle-done" aria-label="${log.done ? 'Marcado como completado, pulsa para editar' : 'Marcar serie como completada'}">${icons.check}</button>
            <button class="icon-btn icon-btn-danger" data-action="remove-set" aria-label="Eliminar set">${icons.trash}</button>
          </div>
        </div>
      `).join('')}
      <div class="sets-table-actions">
        <button class="btn btn-ghost btn-sm" data-action="add-set">${icons.plus} Añadir set</button>
        <button class="btn btn-ghost btn-sm" data-action="duplicate-last-set">Duplicar último</button>
      </div>
    </div>
  `;
}

function renderCardioForm(exercise) {
  const c = exercise.cardio || {};
  return `
    <div class="cardio-form">
      <label>Duración (minutos)
        <input type="number" min="1" max="240" data-cardio-field="duration" value="${c.duration || ''}" />
      </label>
      <label>Intensidad
        <select data-cardio-field="intensity">
          <option ${c.intensity==='Baja'?'selected':''}>Baja</option>
          <option ${c.intensity==='Moderada'?'selected':''}>Moderada</option>
          <option ${c.intensity==='Alta'?'selected':''}>Alta</option>
        </select>
      </label>
      <label>Distancia (km, opcional)
        <input type="number" min="0" max="200" step="0.1" data-cardio-field="distance" value="${c.distance || ''}" />
      </label>
      <button class="btn btn-primary btn-block" data-action="complete-cardio">Marcar cardio completado</button>
    </div>
  `;
}

function calcSessionVolume(session) {
  let total = 0;
  session.exercises.forEach(ex => {
    if (ex.isCardio) return;
    ex.logs.forEach(l => {
      if (l.done) total += (Number(l.weight) || 0) * (Number(l.reps) || 0);
    });
  });
  return total;
}

function wireSessionEvents(container, session, ctx, exercise) {
  const persistDebounced = debounce(() => saveSession(session), 400);

  container.querySelectorAll('.set-row').forEach(row => {
    const i = Number(row.dataset.setIdx);
    row.querySelectorAll('input[data-field], select[data-field]').forEach(input => {
      input.addEventListener('input', () => {
        const field = input.dataset.field;
        let value = input.value;
        if ((field === 'weight' || field === 'reps' || field === 'rir') && value !== '') {
          value = Math.max(0, Number(value));
        }
        exercise.logs[i][field] = value;
        persistDebounced();
      });
    });

    row.querySelector('[data-action="toggle-done"]').addEventListener('click', () => {
      const log = exercise.logs[i];
      if (!log.done) {
        if (log.weight === '' || log.reps === '') {
          toast('Introduce peso y reps antes de completar el set', 'error');
          return;
        }
        log.done = true;
        maybeSuggestProgression(log, exercise);
        startRestTimer(container, exercise.rest, ctx, session);
      } else {
        log.done = false;
      }
      saveSession(session);
      renderActiveSession(container, session, ctx);
    });

    row.querySelector('[data-action="remove-set"]').addEventListener('click', () => {
      exercise.logs.splice(i, 1);
      exercise.logs.forEach((l, idx2) => l.set = idx2 + 1);
      saveSession(session);
      renderActiveSession(container, session, ctx);
    });
  });

  const addSetBtn = container.querySelector('[data-action="add-set"]');
  if (addSetBtn) addSetBtn.addEventListener('click', () => {
    exercise.logs.push({ set: exercise.logs.length + 1, weight: '', reps: '', rir: '', type: 'effective', done: false, notes: '' });
    saveSession(session);
    renderActiveSession(container, session, ctx);
  });

  const dupBtn = container.querySelector('[data-action="duplicate-last-set"]');
  if (dupBtn) dupBtn.addEventListener('click', () => {
    const last = exercise.logs[exercise.logs.length - 1];
    exercise.logs.push({ ...last, set: exercise.logs.length + 1, done: false });
    saveSession(session);
    renderActiveSession(container, session, ctx);
  });

  const cardioBtn = container.querySelector('[data-action="complete-cardio"]');
  if (cardioBtn) {
    container.querySelectorAll('[data-cardio-field]').forEach(input => {
      input.addEventListener('input', () => {
        exercise.cardio[input.dataset.cardioField] = input.value;
        persistDebounced();
      });
    });
    cardioBtn.addEventListener('click', () => {
      if (!exercise.cardio.duration) { toast('Indica la duración del cardio', 'error'); return; }
      toast('Cardio registrado', 'success');
      saveSession(session);
      goNext(container, session, ctx);
    });
  }

  const switchBtn = container.querySelector('#switch-exercise-btn');
  if (switchBtn) switchBtn.addEventListener('click', () => openExerciseSwitcher(container, session, ctx));

  const prevBtn = container.querySelector('#prev-ex-btn');
  if (prevBtn) prevBtn.addEventListener('click', () => {
    session.currentExerciseIndex = Math.max(0, session.currentExerciseIndex - 1);
    saveSession(session);
    renderActiveSession(container, session, ctx);
  });

  const nextBtn = container.querySelector('#next-ex-btn');
  if (nextBtn) nextBtn.addEventListener('click', () => goNext(container, session, ctx));

  const finishBtn = container.querySelector('#finish-session-btn');
  if (finishBtn) finishBtn.addEventListener('click', () => finishSession(container, session, ctx));

  const discardBtn = container.querySelector('#discard-session-btn');
  if (discardBtn) discardBtn.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Descartar sesión',
      message: 'Se perderá todo el progreso de este entrenamiento. ¿Seguro que quieres descartarlo?',
      confirmText: 'Descartar'
    });
    if (ok) {
      stopTimer();
      await remove('activeSession', ACTIVE_ID);
      toast('Sesión descartada', 'info');
      ctx.navigate('home');
    }
  });
}

function goNext(container, session, ctx) {
  session.currentExerciseIndex = Math.min(session.exercises.length - 1, session.currentExerciseIndex + 1);
  saveSession(session);
  renderActiveSession(container, session, ctx);
}

function maybeSuggestProgression(log, exercise) {
  const target = exercise.targetReps;
  if (!target) return;
  const max = parseInt(String(target).split('-').pop(), 10);
  if (!isNaN(max) && Number(log.reps) >= max && log.type === 'effective') {
    toast(`¡Buen trabajo! Lograste ${log.reps} reps. Considera subir 2,5–5% de peso la próxima vez.`, 'success', 4000);
  }
}

function startRestTimer(container, seconds, ctx, session) {
  const zone = container.querySelector('#rest-timer-zone');
  if (!zone || !seconds) return;

  settings().then(s => {
    stopTimer();
    timer = new RestTimer({
      sound: s.sound,
      vibration: s.vibration,
      onTick: (remaining, total) => {
        const zoneEl = document.getElementById('rest-timer-zone');
        if (!zoneEl) return;
        zoneEl.innerHTML = renderTimerUI(remaining, total);
        wireTimerButtons(zoneEl);
      },
      onDone: () => {
        const zoneEl = document.getElementById('rest-timer-zone');
        if (zoneEl) zoneEl.innerHTML = '';
        toast('Descanso terminado. ¡A por la siguiente serie!', 'success');
      }
    });
    timer.start(seconds);
  });
}

function renderTimerUI(remaining, total) {
  const pct = total ? (remaining / total) * 100 : 0;
  const m = Math.floor(remaining / 60), s = remaining % 60;
  return `
    <div class="rest-timer-widget">
      <div class="rest-timer-ring" style="--pct:${pct}%">
        <span class="rest-timer-time">${m}:${String(s).padStart(2,'0')}</span>
      </div>
      <div class="rest-timer-controls">
        <button class="icon-btn" data-timer="-15" aria-label="Restar 15 segundos">-15s</button>
        <button class="icon-btn" data-timer="pause" aria-label="Pausar">⏸</button>
        <button class="icon-btn" data-timer="reset" aria-label="Reiniciar">⟲</button>
        <button class="icon-btn" data-timer="+15" aria-label="Sumar 15 segundos">+15s</button>
        <button class="btn btn-ghost btn-sm" data-timer="skip">Saltar</button>
      </div>
    </div>
  `;
}

function wireTimerButtons(zoneEl) {
  zoneEl.querySelectorAll('[data-timer]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.timer;
      if (!timer) return;
      if (action === '-15') timer.adjust(-15);
      else if (action === '+15') timer.adjust(15);
      else if (action === 'pause') { timer.paused ? timer.resume() : timer.pause(); btn.textContent = timer.paused ? '▶' : '⏸'; }
      else if (action === 'reset') timer.start(timer.total);
      else if (action === 'skip') timer.skip();
    });
  });
}

function stopTimer() {
  if (timer) { timer.stop(); timer = null; }
  const zone = document.getElementById('rest-timer-zone');
  if (zone) zone.innerHTML = '';
}

function openExerciseSwitcher(container, session, ctx) {
  import('./ui.js').then(({ openModal, closeModal }) => {
    openModal(`
      <h3>Cambiar ejercicio</h3>
      <div class="switcher-list">
        ${session.exercises.map((ex, i) => `
          <button class="switcher-item ${i === session.currentExerciseIndex ? 'active' : ''}" data-idx="${i}">
            ${ex.name} ${ex.logs && ex.logs.every(l=>l.done) && ex.logs.length ? '✓' : ''}
          </button>
        `).join('')}
      </div>
    `);
    const overlay = document.getElementById('active-modal');
    overlay.querySelectorAll('.switcher-item').forEach(btn => {
      btn.addEventListener('click', () => {
        session.currentExerciseIndex = Number(btn.dataset.idx);
        saveSession(session);
        closeModal();
        renderActiveSession(container, session, ctx);
      });
    });
  });
}

async function finishSession(container, session, ctx) {
  const incomplete = session.exercises.some(ex => !ex.isCardio && ex.logs.some(l => !l.done));
  if (incomplete) {
    const ok = await confirmDialog({
      title: 'Series sin completar',
      message: 'Todavía tienes series marcadas como pendientes. ¿Quieres finalizar el entreno igualmente?',
      confirmText: 'Finalizar igualmente'
    });
    if (!ok) return;
  }

  stopTimer();
  if (sessionStartInterval) clearInterval(sessionStartInterval);

  const finished = {
    id: crypto.randomUUID(),
    routineId: session.routineId,
    routineName: session.routineName,
    date: session.startedAt,
    finishedAt: new Date().toISOString(),
    durationSeconds: Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000),
    exercises: session.exercises,
    volume: calcSessionVolume(session)
  };

  await put('sessions', finished);
  await remove('activeSession', ACTIVE_ID);

  toast('¡Entreno completado y guardado!', 'success', 3000);
  ctx.navigate('history', { justFinishedId: finished.id });
}

function debounce(fn, wait) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}
