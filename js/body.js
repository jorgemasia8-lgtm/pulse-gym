// body.js -- Transformacion corporal: check-ins, medidas, comparacion, fotos locales
import { all, put, remove } from './db.js';
import { settings } from './data.js';
import { openModal, closeModal, confirmDialog, toast, fmtDate, emptyState, icons } from './ui.js';

export async function getCheckins() {
  const list = await all('body');
  return list.sort((a,b) => new Date(b.date) - new Date(a.date));
}

export function renderBodyView(container, ctx) {
  Promise.all([getCheckins(), settings()]).then(([checkins, s]) => {
    container.innerHTML = `
      <div class="section-header">
        <h2>Cuerpo</h2>
        <button class="btn btn-primary btn-sm" id="new-checkin-btn">${icons.plus} Check-in</button>
      </div>
      ${checkins.length === 0
        ? emptyState(icons.progress, 'Sin check-ins todavía', 'Registra tu peso y medidas para ver tu evolución.')
        : `
          <div class="chart-card"><canvas id="body-chart" height="200"></canvas></div>
          <div class="body-checkin-list">
            ${checkins.map(c => checkinCard(c, s.unit)).join('')}
          </div>
        `}
    `;

    container.querySelector('#new-checkin-btn').addEventListener('click', () => openCheckinForm(null, ctx, s.unit));

    if (checkins.length) {
      renderBodyChart(checkins);
      checkins.forEach(c => {
        const card = container.querySelector(`[data-checkin-id="${c.id}"]`);
        card.querySelector('[data-action="edit"]').addEventListener('click', () => openCheckinForm(c, ctx, s.unit));
        card.querySelector('[data-action="delete"]').addEventListener('click', async () => {
          const ok = await confirmDialog({ title: 'Eliminar check-in', message: 'Se eliminará este registro corporal.', confirmText: 'Eliminar' });
          if (ok) { await remove('body', c.id); toast('Check-in eliminado', 'success'); renderBodyView(container, ctx); }
        });
      });
    }
  }).catch(err => {
    container.innerHTML = `<div class="error-fallback"><h2>No se pudo cargar Cuerpo</h2><p>${err.message}</p></div>`;
  });
}

let bodyChartInstance = null;
function renderBodyChart(checkins) {
  const canvas = document.getElementById('body-chart');
  if (!canvas || typeof Chart === 'undefined') return;
  if (bodyChartInstance) { bodyChartInstance.destroy(); bodyChartInstance = null; }
  const sorted = [...checkins].sort((a,b) => new Date(a.date)-new Date(b.date));
  bodyChartInstance = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: sorted.map(c => fmtDate(c.date)),
      datasets: [{ label: 'Peso corporal', data: sorted.map(c => c.weight), borderColor: '#a3e635', backgroundColor: 'rgba(163,230,53,0.12)', fill: true, tension: 0.3 }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
      scales: { x: { ticks: { color: '#9a9a94' }, grid: { display: false } }, y: { ticks: { color: '#9a9a94' }, grid: { color: 'rgba(255,255,255,0.05)' } } } }
  });
}

function checkinCard(c, unit) {
  return `
    <div class="card checkin-card" data-checkin-id="${c.id}">
      <div class="checkin-top">
        <strong>${fmtDate(c.date)}</strong>
        <div class="checkin-actions">
          <button class="icon-btn" data-action="edit" aria-label="Editar">${icons.edit}</button>
          <button class="icon-btn icon-btn-danger" data-action="delete" aria-label="Eliminar">${icons.trash}</button>
        </div>
      </div>
      <div class="checkin-stats">
        <span>${c.weight} ${unit}</span>
        ${c.bodyFat ? `<span>${c.bodyFat}% grasa</span>` : ''}
        ${c.waist ? `<span>Cintura ${c.waist}cm</span>` : ''}
      </div>
      ${c.notes ? `<p class="muted small">${c.notes}</p>` : ''}
    </div>
  `;
}

function openCheckinForm(checkin, ctx, unit) {
  const c = checkin || { date: new Date().toISOString().slice(0,10), weight: '', bodyFat: '', waist: '', chest: '', arm: '', thigh: '', hip: '', notes: '' };
  openModal(`
    <div class="modal-header"><h3>${checkin ? 'Editar check-in' : 'Nuevo check-in'}</h3><button class="icon-btn" data-close aria-label="Cerrar">${icons.close}</button></div>
    <form id="checkin-form" class="form-stack">
      <label>Fecha<input type="date" name="date" value="${c.date.slice(0,10)}" required /></label>
      <label>Peso (${unit})<input type="number" name="weight" step="0.1" min="20" max="400" value="${c.weight}" required /></label>
      <label>% Grasa (opcional)<input type="number" name="bodyFat" step="0.1" min="0" max="70" value="${c.bodyFat||''}" /></label>
      <div class="measure-grid">
        <label>Cintura (cm)<input type="number" name="waist" min="0" max="200" value="${c.waist||''}" /></label>
        <label>Pecho (cm)<input type="number" name="chest" min="0" max="200" value="${c.chest||''}" /></label>
        <label>Brazo (cm)<input type="number" name="arm" min="0" max="100" value="${c.arm||''}" /></label>
        <label>Muslo (cm)<input type="number" name="thigh" min="0" max="120" value="${c.thigh||''}" /></label>
        <label>Cadera (cm)<input type="number" name="hip" min="0" max="200" value="${c.hip||''}" /></label>
      </div>
      <label>Notas<textarea name="notes" maxlength="200">${c.notes||''}</textarea></label>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" data-cancel>Cancelar</button>
        <button type="submit" class="btn btn-primary">Guardar</button>
      </div>
    </form>
  `);
  const overlay = document.getElementById('active-modal');
  overlay.querySelector('[data-close]').addEventListener('click', closeModal);
  overlay.querySelector('[data-cancel]').addEventListener('click', closeModal);
  overlay.querySelector('#checkin-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const weight = Number(fd.get('weight'));
    if (!weight || weight <= 0) { toast('El peso debe ser un número válido', 'error'); return; }
    const record = {
      id: c.id, date: fd.get('date'), weight,
      bodyFat: fd.get('bodyFat') ? Number(fd.get('bodyFat')) : null,
      waist: fd.get('waist') ? Number(fd.get('waist')) : null,
      chest: fd.get('chest') ? Number(fd.get('chest')) : null,
      arm: fd.get('arm') ? Number(fd.get('arm')) : null,
      thigh: fd.get('thigh') ? Number(fd.get('thigh')) : null,
      hip: fd.get('hip') ? Number(fd.get('hip')) : null,
      notes: fd.get('notes').trim()
    };
    await put('body', record);
    toast('Check-in guardado', 'success');
    closeModal();
    ctx.refreshCurrentView();
  });
}
