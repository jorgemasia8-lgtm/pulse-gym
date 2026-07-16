// ui.js -- Utilidades de interfaz: toasts, modales accesibles, confirmaciones, formateo
export function toast(message, type = 'info', duration = 2600) {
  let host = document.getElementById('toast-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toast-host';
    host.setAttribute('aria-live', 'polite');
    host.className = 'toast-host';
    document.body.appendChild(host);
  }
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = message;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 250);
  }, duration);
}

let lastFocused = null;

export function openModal(html, { onOpen } = {}) {
  closeModal();
  lastFocused = document.activeElement;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'active-modal';
  overlay.innerHTML = `<div class="modal-panel" role="dialog" aria-modal="true">${html}</div>`;
  document.body.appendChild(overlay);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  const escHandler = (e) => {
    if (e.key === 'Escape') closeModal();
  };
  document.addEventListener('keydown', escHandler);
  overlay._escHandler = escHandler;

  const panel = overlay.querySelector('.modal-panel');
  const focusable = panel.querySelectorAll('button, input, select, textarea, [tabindex]');
  if (focusable.length) focusable[0].focus();

  panel.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' || focusable.length === 0) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  if (onOpen) onOpen(overlay);
  return overlay;
}

export function closeModal() {
  const overlay = document.getElementById('active-modal');
  if (overlay) {
    if (overlay._escHandler) document.removeEventListener('keydown', overlay._escHandler);
    overlay.remove();
  }
  if (lastFocused && lastFocused.focus) lastFocused.focus();
}

export function confirmDialog({ title, message, confirmText = 'Confirmar', danger = true }) {
  return new Promise((resolve) => {
    openModal(`
      <h3>${title}</h3>
      <p class="modal-message">${message}</p>
      <div class="modal-actions">
        <button class="btn btn-ghost" data-cancel>Cancelar</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-confirm>${confirmText}</button>
      </div>
    `);
    const overlay = document.getElementById('active-modal');
    overlay.querySelector('[data-cancel]').addEventListener('click', () => { closeModal(); resolve(false); });
    overlay.querySelector('[data-confirm]').addEventListener('click', () => { closeModal(); resolve(true); });
  });
}

export function fmtWeight(value, unit = 'kg') {
  const n = Number(value) || 0;
  return `${n % 1 === 0 ? n : n.toFixed(1)} ${unit}`;
}

export function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function emptyState(icon, title, message, actionHtml = '') {
  return `
    <div class="empty-state">
      <div class="empty-state-icon">${icon}</div>
      <h3>${title}</h3>
      <p>${message}</p>
      ${actionHtml}
    </div>
  `;
}

export function errorFallback(message, retry) {
  const host = document.getElementById('view');
  if (!host) return;
  host.innerHTML = `
    <div class="error-fallback">
      <h2>Algo salió mal</h2>
      <p>${message || 'Ha ocurrido un error inesperado. Tus datos están seguros en este dispositivo.'}</p>
      <button class="btn btn-primary" id="retry-btn">Reintentar</button>
    </div>
  `;
  const btn = document.getElementById('retry-btn');
  if (btn && retry) btn.addEventListener('click', retry);
}

export const icons = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>',
  routines: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="4" rx="1"/><rect x="3" y="11" width="18" height="4" rx="1"/><rect x="3" y="18" width="12" height="3" rx="1"/></svg>',
  session: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
  progress: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 17l5-5 4 4 8-9"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.6 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3h0a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9v0a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>'
};
