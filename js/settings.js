// settings.js -- Ajustes funcionales al 100%: unidades, tema, sonido, vibracion, datos
import { settings, saveSettings } from './data.js';
import { clear, snapshot } from './db.js';
import { exportJSON, importJSON, exportCSV } from './backup.js';
import { openModal, closeModal, confirmDialog, toast, icons } from './ui.js';

export function renderSettingsView(container, ctx) {
  settings().then(s => {
    container.innerHTML = `
      <div class="section-header"><h2>Ajustes</h2></div>

      <div class="card settings-card">
        <h3>Preferencias</h3>
        <label class="settings-row">
          <span>Unidad</span>
          <select id="setting-unit">
            <option value="kg" ${s.unit==='kg'?'selected':''}>Kilogramos (kg)</option>
            <option value="lb" ${s.unit==='lb'?'selected':''}>Libras (lb)</option>
          </select>
        </label>
        <label class="settings-row">
          <span>Tema</span>
          <select id="setting-theme">
            <option value="dark" ${s.theme==='dark'?'selected':''}>Oscuro</option>
            <option value="light" ${s.theme==='light'?'selected':''}>Claro</option>
            <option value="system" ${s.theme==='system'?'selected':''}>Sistema</option>
          </select>
        </label>
        <label class="settings-row switch-row">
          <span>Sonido al terminar descanso</span>
          <input type="checkbox" id="setting-sound" ${s.sound?'checked':''} />
        </label>
        <label class="settings-row switch-row">
          <span>Vibración (si el dispositivo lo soporta)</span>
          <input type="checkbox" id="setting-vibration" ${s.vibration?'checked':''} />
        </label>
        <label class="settings-row">
          <span>Meta semanal de entrenos</span>
          <input type="number" id="setting-weekly-goal" min="1" max="14" value="${s.weeklyGoal}" style="width:70px" />
        </label>
      </div>

      <div class="card settings-card">
        <h3>Descansos por defecto (segundos)</h3>
        <label class="settings-row"><span>Básicos</span><input type="number" id="rest-basic" min="0" max="600" value="${s.restDefaults.basic}" style="width:80px" /></label>
        <label class="settings-row"><span>Accesorios</span><input type="number" id="rest-accessory" min="0" max="600" value="${s.restDefaults.accessory}" style="width:80px" /></label>
        <label class="settings-row"><span>Abdomen</span><input type="number" id="rest-core" min="0" max="600" value="${s.restDefaults.core}" style="width:80px" /></label>
      </div>

      <div class="card settings-card">
        <h3>Barra y discos</h3>
        <label class="settings-row"><span>Peso de la barra (${s.unit})</span><input type="number" id="setting-bar" min="0" max="50" step="0.5" value="${s.bar}" style="width:80px" /></label>
        <label>Discos disponibles (separados por coma)
          <input type="text" id="setting-plates" value="${s.plates.join(', ')}" />
        </label>
      </div>

      <div class="card settings-card">
        <h3>Datos</h3>
        <p class="muted small">Los datos se guardan en este dispositivo y no se envían a ningún servidor.</p>
        <p class="muted small">Última copia: ${s.lastBackup ? new Date(s.lastBackup).toLocaleString('es-ES') : 'Nunca'}</p>
        <div class="settings-actions">
          <button class="btn btn-primary" id="export-json-btn">Exportar copia (JSON)</button>
          <button class="btn btn-ghost" id="export-csv-btn">Exportar entrenos (CSV)</button>
          <button class="btn btn-ghost" id="import-btn">Importar copia</button>
          <button class="btn btn-danger" id="wipe-btn">Borrar todos los datos</button>
        </div>
        <input type="file" id="import-file-input" accept=".json" hidden />
      </div>

      <div class="card settings-card">
        <h3>Acerca de</h3>
        <p class="muted small">Pulse Gym v${s.appVersion}</p>
        <p class="muted small">100% local, offline-first, sin cuentas ni backend.</p>
      </div>
    `;

    bindAutoSave(container, s, ctx);
    bindDataActions(container, ctx);
  }).catch(err => {
    container.innerHTML = `<div class="error-fallback"><h2>No se pudieron cargar los ajustes</h2><p>${err.message}</p></div>`;
  });
}

function bindAutoSave(container, s, ctx) {
  const save = debounce(async (patch) => {
    try {
      await saveSettings({ ...s, ...patch });
      Object.assign(s, patch);
      toast('Ajustes guardados', 'success', 1200);
      if (patch.theme) ctx.applyTheme(patch.theme);
    } catch (err) {
      toast('No se pudo guardar: ' + err.message, 'error');
    }
  }, 300);

  container.querySelector('#setting-unit').addEventListener('change', (e) => save({ unit: e.target.value }));
  container.querySelector('#setting-theme').addEventListener('change', (e) => save({ theme: e.target.value }));
  container.querySelector('#setting-sound').addEventListener('change', (e) => save({ sound: e.target.checked }));
  container.querySelector('#setting-vibration').addEventListener('change', (e) => save({ vibration: e.target.checked }));
  container.querySelector('#setting-weekly-goal').addEventListener('input', (e) => {
    const v = Math.max(1, Math.min(14, Number(e.target.value) || 1));
    save({ weeklyGoal: v });
  });
  container.querySelector('#rest-basic').addEventListener('input', (e) => save({ restDefaults: { ...s.restDefaults, basic: Number(e.target.value)||0 } }));
  container.querySelector('#rest-accessory').addEventListener('input', (e) => save({ restDefaults: { ...s.restDefaults, accessory: Number(e.target.value)||0 } }));
  container.querySelector('#rest-core').addEventListener('input', (e) => save({ restDefaults: { ...s.restDefaults, core: Number(e.target.value)||0 } }));
  container.querySelector('#setting-bar').addEventListener('input', (e) => save({ bar: Number(e.target.value)||0 }));
  container.querySelector('#setting-plates').addEventListener('change', (e) => {
    const plates = e.target.value.split(',').map(v => Number(v.trim())).filter(v => v > 0).sort((a,b)=>b-a);
    if (plates.length === 0) { toast('Introduce al menos un disco válido', 'error'); return; }
    save({ plates });
  });
}

function bindDataActions(container, ctx) {
  container.querySelector('#export-json-btn').addEventListener('click', async () => {
    try { await exportJSON(); toast('Copia exportada', 'success'); renderSettingsView(container, ctx); }
    catch (err) { toast('Error al exportar: ' + err.message, 'error'); }
  });

  container.querySelector('#export-csv-btn').addEventListener('click', async () => {
    try { await exportCSV(); toast('CSV exportado', 'success'); }
    catch (err) { toast('Error al exportar CSV: ' + err.message, 'error'); }
  });

  const fileInput = container.querySelector('#import-file-input');
  container.querySelector('#import-btn').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    openModal(`
      <h3>Importar copia</h3>
      <p class="modal-message">¿Cómo quieres importar este archivo?</p>
      <div class="modal-actions" style="flex-direction:column;gap:8px;">
        <button class="btn btn-primary btn-block" data-mode="merge">Fusionar con datos actuales</button>
        <button class="btn btn-danger btn-block" data-mode="replace">Reemplazar todos los datos</button>
        <button class="btn btn-ghost btn-block" data-cancel>Cancelar</button>
      </div>
    `);
    const overlay = document.getElementById('active-modal');
    overlay.querySelector('[data-cancel]').addEventListener('click', () => { closeModal(); fileInput.value = ''; });
    overlay.querySelectorAll('[data-mode]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const mode = btn.dataset.mode;
        closeModal();
        try {
          await importJSON(file, mode);
          toast('Copia importada correctamente', 'success');
          renderSettingsView(container, ctx);
        } catch (err) {
          toast('No se pudo importar: ' + err.message, 'error');
        }
        fileInput.value = '';
      });
    });
  });

  container.querySelector('#wipe-btn').addEventListener('click', async () => {
    const ok1 = await confirmDialog({ title: 'Borrar todos los datos', message: 'Esto eliminará rutinas, sesiones, historial y check-ins de este dispositivo. No se puede deshacer.', confirmText: 'Continuar' });
    if (!ok1) return;
    const ok2 = await confirmDialog({ title: 'Confirmación final', message: 'Última confirmación: se borrará TODO permanentemente. ¿Seguro?', confirmText: 'Borrar todo' });
    if (!ok2) return;
    for (const store of ['sessions','routines','body','activeSession']) await clear(store);
    toast('Todos los datos han sido borrados', 'info');
    ctx.navigate('home');
  });
}

function debounce(fn, wait) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}
