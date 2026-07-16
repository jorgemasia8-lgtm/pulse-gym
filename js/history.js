// history.js -- Historial de sesiones con filtros, busqueda, edicion y repetir entreno
import { all, put, remove, get } from './db.js';
import { openModal, closeModal, confirmDialog, toast, fmtWeight, fmtDate, fmtDuration, icons, emptyState } from './ui.js';

export async function getSessions() {
  const list = await all('sessions');
  return list.sort((a, b) => new Date(b.date) - new Date(a.date));
}

export function renderHistoryView(container, ctx, opts = {}) {
  getSessions().then(sessions => {
    if (sessions.length === 0) {
      container.innerHTML = emptyState(
        icons.progress,
        'Sin entrenamientos todavía',
        'Cuando termines tu primer entreno, aparecerá aquí.',
        `<button class="btn btn-primary" id="go-routines">Empezar a entrenar</button>`
      );
      container.querySelector('#go-routines').addEventListener('click', () => ctx.navigate('routines'));
      return;
    }

    const state = { query: '', routine: 'all', month: 'all' };
    const routineNames = [...new Set(sessions.map(s => s.routineName))];
    const months = [...new Set(sessions.map(s => s.date.slice(0,7)))].sort().reverse();

    function draw() {
      const filtered = sessions.filter(s => {
        if (state.routine !== 'all' && s.routineName !== state.routine) return false;
        if (state.month !== 'all' && !s.date.startsWith(state.month)) return false;
        if (state.query && !s.routineName.toLowerCase().includes(state.query.toLowerCase()) &&
            !s.exercises.some(e => e.name.toLowerCase().includes(state.query.toLowerCase()))) return false;
        return true;
      });

      container.innerHTML = `
        <div class="section-header"><h2>Historial</h2></div>
        <div class="history-filters">
          <input type="search" id="history-search" placeholder="Buscar rutina o ejercicio..." value="${state.query}" />
          <select id="history-routine-filter">
            <option value="all">Todas las rutinas</option>
            ${routineNames.map(n => `<option value="${n}" ${state.routine===n?'selected':''}>${n}</option>`).join('')}
          </select>
          <select id="history-month-filter">
            <option value="all">Todos los meses</option>
            ${months.map(m => `<option value="${m}" ${state.month===m?'selected':''}>${m}</option>`).join('')}
          </select>
        </div>
        <div class="history-list">
          ${filtered.length === 0
            ? `<p class="muted">No hay entrenamientos que coincidan con el filtro.</p>`
            : filtered.map(s => historyCard(s, opts.justFinishedId === s.id)).join('')}
        </div>
      `;

      container.querySelector('#history-search').addEventListener('input', (e) => { state.query = e.target.value; draw(); });
      container.querySelector('#history-routine-filter').addEventListener('change', (e) => { state.routine = e.target.value; draw(); });
      container.querySelector('#history-month-filter').addEventListener('change', (e) => { state.month = e.target.value; draw(); });

      filtered.forEach(s => {
        const card = container.querySelector(`[data-session-id="${s.id}"]`);
        if (!card) return;
        card.addEventListener('click', (e) => {
          if (e.target.closest('[data-action]')) return;
          openSessionDetail(s, ctx, draw);
        });
        const dupBtn = card.querySelector('[data-action="repeat"]');
        if (dupBtn) dupBtn.addEventListener('click', (e) => { e.stopPropagation(); repeatSession(s, ctx); });
        const delBtn = card.querySelector('[data-action="delete"]');
        if (delBtn) delBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const ok = await confirmDialog({ title: 'Eliminar entreno', message: 'Esta sesión se eliminará permanentemente.', confirmText: 'Eliminar' });
          if (ok) {
            await remove('sessions', s.id);
            toast('Entreno eliminado', 'success');
            const i = sessions.indexOf(s);
            if (i > -1) sessions.splice(i, 1);
            draw();
          }
        });
      });
    }
    draw();
  }).catch(err => {
    container.innerHTML = `<div class="error-fallback"><h2>No se pudo cargar el historial</h2><p>${err.message}</p></div>`;
  });
}

function historyCard(s, justFinished) {
  const setsCount = s.exercises.reduce((acc, e) => acc + (e.logs ? e.logs.filter(l=>l.done).length : 0), 0);
  return `
    <div class="card history-card ${justFinished ? 'just-finished' : ''}" data-session-id="${s.id}">
      <div class="history-card-top">
        <strong>${s.routineName}</strong>
        <span class="muted small">${fmtDate(s.date)}</span>
      </div>
      <div class="history-card-stats">
        <span>${fmtDuration(s.durationSeconds || 0)}</span>
        <span>${setsCount} series</span>
        <span>${fmtWeight(s.volume || 0)} vol.</span>
      </div>
      <div class="history-card-actions">
        <button class="btn btn-ghost btn-sm" data-action="repeat">Repetir</button>
        <button class="icon-btn icon-btn-danger" data-action="delete" aria-label="Eliminar">${icons.trash}</button>
      </div>
    </div>
  `;
}

function openSessionDetail(session, ctx, onChange) {
  openModal(`
    <div class="modal-header">
      <h3>${session.routineName}</h3>
      <button class="icon-btn" data-close aria-label="Cerrar">${icons.close}</button>
    </div>
    <p class="muted">${fmtDate(session.date)} · ${fmtDuration(session.durationSeconds||0)} · ${fmtWeight(session.volume||0)} volumen</p>
    <div class="session-detail-list">
      ${session.exercises.map(ex => `
        <div class="session-detail-exercise">
          <h4>${ex.name}</h4>
          ${ex.isCardio
            ? `<p class="muted small">Cardio · ${ex.cardio?.duration || '-'} min · ${ex.cardio?.intensity || ''}</p>`
            : (ex.logs||[]).filter(l=>l.done).map(l => `<p class="muted small">Set ${l.set}: ${fmtWeight(l.weight)} × ${l.reps} reps (RIR ${l.rir || '-'})</p>`).join('') || '<p class="muted small">Sin series completadas</p>'
          }
        </div>
      `).join('')}
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" data-edit>Editar</button>
      <button class="btn btn-primary" data-close-2>Cerrar</button>
    </div>
  `);
  const overlay = document.getElementById('active-modal');
  overlay.querySelector('[data-close]').addEventListener('click', closeModal);
  overlay.querySelector('[data-close-2]').addEventListener('click', closeModal);
  overlay.querySelector('[data-edit]').addEventListener('click', () => openSessionEditor(session, onChange));
}

function openSessionEditor(session, onChange) {
  openModal(`
    <div class="modal-header"><h3>Editar entreno</h3><button class="icon-btn" data-close aria-label="Cerrar">${icons.close}</button></div>
    <div class="session-edit-list">
      ${session.exercises.map((ex, exi) => ex.isCardio ? '' : `
        <div class="session-edit-exercise">
          <h4>${ex.name}</h4>
          ${(ex.logs||[]).map((l,li) => `
            <div class="set-row" data-exi="${exi}" data-li="${li}">
              <span>Set ${l.set}</span>
              <input type="number" data-field="weight" value="${l.weight}" step="0.5" min="0" />
              <input type="number" data-field="reps" value="${l.reps}" min="0" />
            </div>
          `).join('')}
        </div>
      `).join('')}
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" data-cancel>Cancelar</button>
      <button class="btn btn-primary" data-save>Guardar cambios</button>
    </div>
  `);
  const overlay = document.getElementById('active-modal');
  overlay.querySelector('[data-close]').addEventListener('click', closeModal);
  overlay.querySelector('[data-cancel]').addEventListener('click', closeModal);
  overlay.querySelectorAll('.set-row input').forEach(input => {
    input.addEventListener('input', () => {
      const row = input.closest('.set-row');
      const exi = Number(row.dataset.exi), li = Number(row.dataset.li);
      session.exercises[exi].logs[li][input.dataset.field] = Number(input.value) || 0;
    });
  });
  overlay.querySelector('[data-save]').addEventListener('click', async () => {
    session.volume = session.exercises.reduce((acc, ex) => {
      if (ex.isCardio) return acc;
      return acc + ex.logs.filter(l=>l.done).reduce((a,l) => a + (Number(l.weight)||0)*(Number(l.reps)||0), 0);
    }, 0);
    await put('sessions', session);
    toast('Entreno actualizado', 'success');
    closeModal();
    if (onChange) onChange();
  });
}

async function repeatSession(session, ctx) {
  const routine = await get('routines', session.routineId);
  if (!routine) { toast('La rutina original ya no existe', 'error'); return; }
  const ok = await confirmDialog({
    title: 'Repetir entreno',
    message: `Se iniciará una nueva sesión con la rutina "${routine.name}".`,
    confirmText: 'Empezar',
    danger: false
  });
  if (ok) ctx.startSession(routine.id);
}
