// tools.js -- Calculadora de discos y 1RM
import { settings } from './data.js';
import { toast } from './ui.js';

export function renderToolsView(container, ctx) {
  settings().then(s => {
    container.innerHTML = `
      <div class="section-header"><h2>Herramientas</h2></div>

      <div class="card tool-card">
        <h3>Calculadora de discos</h3>
        <div class="form-stack">
          <label>Peso objetivo (${s.unit})<input type="number" id="plate-target" min="0" max="600" step="0.5" /></label>
          <label>Peso de la barra (${s.unit})<input type="number" id="plate-bar" value="${s.bar}" min="0" max="50" step="0.5" /></label>
        </div>
        <div id="plate-result" class="plate-result"></div>
      </div>

      <div class="card tool-card">
        <h3>Calculadora de 1RM</h3>
        <div class="form-stack">
          <label>Peso levantado (${s.unit})<input type="number" id="orm-weight" min="0" max="600" step="0.5" /></label>
          <label>Repeticiones<input type="number" id="orm-reps" min="1" max="20" /></label>
        </div>
        <div id="orm-result" class="orm-result"></div>
      </div>
    `;

    const plates = s.plates;
    function calcPlates() {
      const target = Number(document.getElementById('plate-target').value) || 0;
      const bar = Number(document.getElementById('plate-bar').value) || 0;
      const resultEl = document.getElementById('plate-result');
      if (target <= bar) { resultEl.innerHTML = '<p class="muted small">Introduce un peso objetivo mayor que la barra.</p>'; return; }
      let perSide = (target - bar) / 2;
      const used = [];
      for (const p of plates) {
        while (perSide >= p - 0.001) { used.push(p); perSide -= p; }
      }
      resultEl.innerHTML = used.length
        ? `<p>Por lado: ${used.map(p => `<span class="plate-chip">${p}</span>`).join('')}</p><p class="muted small">Restante sin cubrir: ${perSide.toFixed(2)} ${s.unit}</p>`
        : '<p class="muted small">No se necesitan discos adicionales.</p>';
    }
    document.getElementById('plate-target').addEventListener('input', calcPlates);
    document.getElementById('plate-bar').addEventListener('input', calcPlates);

    function calcOrm() {
      const w = Number(document.getElementById('orm-weight').value) || 0;
      const r = Number(document.getElementById('orm-reps').value) || 0;
      const resultEl = document.getElementById('orm-result');
      if (w <= 0 || r <= 0) { resultEl.innerHTML = ''; return; }
      const orm = w * (1 + r / 30);
      resultEl.innerHTML = `<p class="orm-value">${orm.toFixed(1)} ${s.unit}</p><p class="muted small">1RM estimado (fórmula Epley)</p>`;
    }
    document.getElementById('orm-weight').addEventListener('input', calcOrm);
    document.getElementById('orm-reps').addEventListener('input', calcOrm);
  }).catch(err => {
    container.innerHTML = `<div class="error-fallback"><h2>No se pudieron cargar las herramientas</h2><p>${err.message}</p></div>`;
  });
}
