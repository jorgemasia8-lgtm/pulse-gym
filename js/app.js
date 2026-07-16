// app.js -- Router, estado global, montaje de la app y tema
import { dbHealthCheck } from './db.js';
import { ensureSeedRoutines, settings } from './data.js';
import { renderHomeView } from './home.js';
import { renderRoutinesView } from './routines.js';
import { renderSessionView, startSession } from './session.js';
import { renderHistoryView } from './history.js';
import { renderProgressView } from './progress.js';
import { renderBodyView } from './body.js';
import { renderSettingsView } from './settings.js';
import { renderToolsView } from './tools.js';
import { errorFallback, toast, icons } from './ui.js';

const view = document.getElementById('view');
const navLinks = document.querySelectorAll('.bottom-nav a');

const routes = {
  home: (c, ctx) => renderHomeView(c, ctx),
  routines: (c, ctx) => renderRoutinesView(c, ctx),
  session: (c, ctx) => renderSessionView(c, ctx),
  history: (c, ctx, params) => renderHistoryView(c, ctx, params || {}),
  progress: (c, ctx) => renderProgressView(c, ctx),
  body: (c, ctx) => renderBodyView(c, ctx),
  settings: (c, ctx) => renderSettingsView(c, ctx),
  tools: (c, ctx) => renderToolsView(c, ctx)
};

let currentRoute = 'home';
let currentParams = {};

const ctx = {
  navigate,
  startSession: (routineId) => startSession(routineId, ctx),
  refreshCurrentView: () => render(currentRoute, currentParams),
  applyTheme
};

function navigate(route, params = {}) {
  if (!routes[route]) route = 'home';
  currentRoute = route;
  currentParams = params;
  location.hash = `#${route}`;
  render(route, params);
}

function render(route, params) {
  updateNavActive(route);
  try {
    routes[route](view, ctx, params);
  } catch (err) {
    console.error(err);
    errorFallback(err.message, () => render(route, params));
  }
}

function updateNavActive(route) {
  navLinks.forEach(link => {
    link.classList.toggle('active', link.dataset.route === route);
  });
}

function initHashRouting() {
  window.addEventListener('hashchange', () => {
    const route = location.hash.replace('#','') || 'home';
    if (routes[route]) { currentRoute = route; render(route, {}); }
  });
}

function bindBottomNav() {
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(link.dataset.route);
    });
  });
}

async function applyTheme(theme) {
  let effective = theme;
  if (theme === 'system') {
    effective = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', effective);
}

async function boot() {
  try {
    const healthy = await dbHealthCheck();
    if (!healthy) {
      errorFallback('No se pudo acceder al almacenamiento local. Si estás en modo privado/incógnito, sal de ese modo y vuelve a intentarlo.');
      return;
    }
    await ensureSeedRoutines();
    const s = await settings();
    applyTheme(s.theme);

    bindBottomNav();
    initHashRouting();

    const initialRoute = location.hash.replace('#','') || 'home';
    navigate(routes[initialRoute] ? initialRoute : 'home');

    registerServiceWorker();
  } catch (err) {
    console.error(err);
    errorFallback('No se pudo iniciar la aplicación: ' + err.message, boot);
  }
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateBanner(reg);
          }
        });
      });
    }).catch(() => { /* si falla el service worker, la app sigue funcionando online */ });
  });
}

function showUpdateBanner(reg) {
  const banner = document.createElement('div');
  banner.className = 'update-banner';
  banner.innerHTML = `
    <span>Hay una nueva versión de Pulse Gym disponible.</span>
    <button class="btn btn-primary btn-sm" id="update-now-btn">Actualizar</button>
  `;
  document.body.appendChild(banner);
  banner.querySelector('#update-now-btn').addEventListener('click', () => {
    if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    navigator.serviceWorker.addEventListener('controllerchange', () => location.reload());
  });
}

window.addEventListener('error', (e) => {
  console.error('Error global:', e.error);
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('Promesa rechazada sin capturar:', e.reason);
});

boot();
