// routines.js -- Gestion de rutinas: crear, editar, duplicar, eliminar, ejercicios
import { all, put, remove, get } from './db.js';
import { newRoutine, newExercise } from './data.js';
import { openModal, closeModal, confirmDialog, toast, icons } from './ui.js';

export async function getRoutines() {
  const list = await all('routines');
  const order = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
  return list.sort((a,b) => order.indexOf(a.day) - order.indexOf(b.day));
}

export async function getRoutine(id) {
  return get('routines', id);
}

export async function saveRoutine(routine) {
  return put('routines', routine);
}

export async function deleteRoutine(id) {
  return remove('routines', id);
}

export async function duplicateRoutine(id) {
  const r = await get('routines', id);
  if (!r) return null;
  const copy = { ...r, id: crypto.randomUUID(), name: r.name + ' (copia)' };
  copy.exercises = r.exercises.map(ex => ({ ...ex, id: crypto.randomUUID() }));
  await put('routines', copy);
  return copy;
}

export function renderRoutinesView(container, ctx) {
  getRoutines().then(routines => {
    if (routines.length === 0) {
      container.innerHTML = `<div class="empty-state">
        <div class="empty-state-icon">${icons.routines}</div>
        <h3>Sin rutinas todavía</h3>
        <p>Crea tu primera rutina para empezar a entrenar.</p>
        <button class="btn btn-primary" id="new-routine-btn">Crear rutina</button>
      </div>`;
      container.querySelector('#new-routine-btn').addEventListener('click', () => openRoutineEditor(null, ctx));
      return;
    }

    container.innerHTML = `
      <div class="section-header">
        <h2>Rutinas</h2>
        <button class="btn btn-primary btn-sm" id="new-routine-btn">${icons.plus} Nueva</button>
      </div>
      <div class="routine-list">
        ${routines.map(r => routineCard(r)).join('')}
      </div>
    `;

    container.querySelector('#new-routine-btn').addEventListener('click', () => openRoutineEditor(null, ctx));

    routines.forEach(r => {
      const card = container.querySelector(`[data-routine-id="${r.id}"]`);
      card.querySelector('[data-action="edit"]').addEventListener('click', (e) => {
        e.stopPropagation();
        openRoutineEditor(r.id, ctx);
      });
      card.querySelector('[data-action="duplicate"]').addEventListener('click', async (e) => {
        e.stopPropagation();
        await duplicateRoutine(r.id);
        toast('Rutina duplicada', 'success');
        renderRoutinesView(container, ctx);
      });
      card.querySelector('[data-action="delete"]').addEventListener('click', async (e) => {
        e.stopPropagation();
        const ok = await confirmDialog({
          title: 'Eliminar rutina',
          message: `¿Seguro que quieres eliminar "${r.name}"? Esta acción no se puede deshacer.`,
          confirmText: 'Eliminar'
        });
        if (ok) {
          await deleteRoutine(r.id);
          toast('Rutina eliminada', 'success');
          renderRoutinesView(container, ctx);
        }
      });
      const trainBtn = card.querySelector('[data-action="train"]');
      if (trainBtn) {
        trainBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (!r.exercises || r.exercises.length === 0) {
            toast('Esta rutina no tiene ejercicios todavía. Añade al menos uno para poder entrenarla.', 'error');
            return;
          }
          ctx.startSession(r.id);
        });
      }
    });
  }).catch(err => {
    container.innerHTML = `<div class="error-fallback"><h2>No se pudieron cargar las rutinas</h2><p>${err.message}</p></div>`;
  });
}

function routineCard(r) {
  const empty = !r.exercises || r.exercises.length === 0;
  const isRest = r.isRestDay || empty;
  return `
    <div class="card routine-card" data-routine-id="${r.id}">
      <div class="routine-card-top">
        <span class="routine-day">${r.day}</span>
        <div class="routine-card-actions">
          <button class="icon-btn" data-action="duplicate" aria-label="Duplicar rutina">${icons.plus}</button>
          <button class="icon-btn" data-action="edit" aria-label="Editar rutina">${icons.edit}</button>
          <button class="icon-btn icon-btn-danger" data-action="delete" aria-label="Eliminar rutina">${icons.trash}</button>
        </div>
      </div>
      <h3>${r.name}</h3>
      ${empty
        ? `<p class="muted">${r.isRestDay ? 'Día de descanso. Movilidad, paseo o recuperación activa.' : 'Sin ejercicios todavía. Añade al menos uno para poder entrenar este día.'}</p>`
        : `<p class="muted">${r.exercises.length} ejercicios</p>`
      }
      ${!isRest ? `<button class="btn btn-primary btn-block" data-action="train">Entrenar</button>` : ''}
    </div>
  `;
}

function openRoutineEditor(id, ctx) {
  (id ? getRoutine(id) : Promise.resolve(newRoutine())).then(routine => {
    if (!routine) { toast('No se encontró la rutina', 'error'); return; }
    renderEditorModal(routine, ctx);
  });
}

function renderEditorModal(routine, ctx) {
  const days = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
  openModal(`
    <div class="modal-header">
      <h3>${routine.name ? 'Editar rutina' : 'Nueva rutina'}</h3>
      <button class="icon-btn" data-close aria-label="Cerrar">${icons.close}</button>
    </div>
    <form id="routine-form" class="form-stack">
      <label>Nombre
        <input type="text" name="name" value="${escapeHtml(routine.name)}" required maxlength="60" />
      </label>
      <label>Día
        <select name="day">
          ${days.map(d => `<option value="${d}" ${d === routine.day ? 'selected' : ''}>${d}</option>`).join('')}
        </select>
      </label>
      <label class="checkbox-label">
        <input type="checkbox" name="isRestDay" ${routine.isRestDay ? 'checked' : ''} />
        Es día de descanso
      </label>
      <label>Notas
        <textarea name="notes" maxlength="200">${escapeHtml(routine.notes || '')}</textarea>
      </label>

      <div class="exercise-editor-header">
        <h4>Ejercicios (${routine.exercises.length})</h4>
        <button type="button" class="btn btn-ghost btn-sm" id="add-exercise-btn">${icons.plus} Añadir ejercicio</button>
      </div>
      <div id="exercise-list" class="exercise-edit-list"></div>

      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" data-cancel>Cancelar</button>
        <button type="submit" class="btn btn-primary">Guardar rutina</button>
      </div>
    </form>
  `);

  const overlay = document.getElementById('active-modal');
  const exList = overlay.querySelector('#exercise-list');
  let exercises = routine.exercises.map(e => ({ ...e }));

  function renderExList() {
    if (exercises.length === 0) {
      exList.innerHTML = `<p class="muted small">Sin ejercicios. Añade al menos uno para poder entrenar este día.</p>`;
      return;
    }
    exList.innerHTML = exercises.map((ex, i) => `
      <div class="exercise-edit-row" data-idx="${i}">
        <div class="exercise-edit-order">
          <button type="button" class="icon-btn" data-move="-1" ${i === 0 ? 'disabled' : ''} aria-label="Subir">▲</button>
          <button type="button" class="icon-btn" data-move="1" ${i === exercises.length-1 ? 'disabled' : ''} aria-label="Bajar">▼</button>
        </div>
        <div class="exercise-edit-fields">
          <input type="text" data-field="name" value="${escapeHtml(ex.name)}" placeholder="Nombre" maxlength="40" />
          <input type="text" data-field="muscle" value="${escapeHtml(ex.muscle || '')}" placeholder="Grupo muscular" maxlength="30" />
          ${ex.isCardio ? `
            <input type="number" data-field="duration" value="${ex.duration || 20}" min="1" max="240" placeholder="Duración (min)" />
          ` : `
            <input type="number" data-field="sets" value="${ex.sets ?? 3}" min="1" max="10" placeholder="Series" />
            <input type="text" data-field="targetReps" value="${escapeHtml(ex.targetReps || '')}" placeholder="Reps objetivo" maxlength="10" />
            <input type="number" data-field="rest" value="${ex.rest ?? 90}" min="0" max="600" placeholder="Descanso (s)" />
          `}
        </div>
        <button type="button" class="icon-btn icon-btn-danger" data-remove aria-label="Eliminar ejercicio">${icons.trash}</button>
      </div>
    `).join('');

    exList.querySelectorAll('.exercise-edit-row').forEach(row => {
      const idx = Number(row.dataset.idx);
      row.querySelectorAll('input[data-field]').forEach(input => {
        input.addEventListener('input', () => {
          const field = input.dataset.field;
          exercises[idx][field] = input.type === 'number' ? Number(input.value) : input.value;
        });
      });
      row.querySelector('[data-remove]').addEventListener('click', () => {
        exercises.splice(idx, 1);
        renderExList();
      });
      row.querySelectorAll('[data-move]').forEach(btn => {
        btn.addEventListener('click', () => {
          const dir = Number(btn.dataset.move);
          const target = idx + dir;
          if (target < 0 || target >= exercises.length) return;
          [exercises[idx], exercises[target]] = [exercises[target], exercises[idx]];
          renderExList();
        });
      });
    });
  }
  renderExList();

  overlay.querySelector('#add-exercise-btn').addEventListener('click', () => {
    exercises.push(newExercise());
    renderExList();
  });

  overlay.querySelector('[data-close]').addEventListener('click', closeModal);
  overlay.querySelector('[data-cancel]').addEventListener('click', closeModal);

  overlay.querySelector('#routine-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const name = fd.get('name').trim();
    if (!name) { toast('El nombre no puede estar vacío', 'error'); return; }

    const updated = {
      ...routine,
      name,
      day: fd.get('day'),
      isRestDay: fd.get('isRestDay') === 'on',
      notes: fd.get('notes').trim(),
      exercises: exercises.map(ex => ({ ...ex, id: ex.id || crypto.randomUUID() }))
    };

    try {
      await saveRoutine(updated);
      toast('Rutina guardada', 'success');
      closeModal();
      ctx.refreshCurrentView();
    } catch (err) {
      toast('No se pudo guardar la rutina: ' + err.message, 'error');
    }
  });
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
