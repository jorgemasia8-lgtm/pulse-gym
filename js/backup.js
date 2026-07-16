// backup.js -- Exportacion/importacion JSON y CSV
import { snapshot, put, clear, all } from './db.js';
import { saveSettings, settings } from './data.js';

export async function exportJSON() {
  const data = await snapshot();
  download(
    JSON.stringify({ app: 'Pulse Gym', version: 2, exportedAt: new Date().toISOString(), data }, null, 2),
    'pulse-gym-backup.json',
    'application/json'
  );
  const s = await settings();
  await saveSettings({ ...s, lastBackup: new Date().toISOString() });
}

export function download(content, name, type = 'text/plain') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

export async function importJSON(file, mode = 'merge') {
  const text = await file.text();
  let raw;
  try { raw = JSON.parse(text); }
  catch (e) { throw new Error('El archivo no es un JSON válido.'); }

  const data = raw.data || raw;
  if (!data || !Array.isArray(data.sessions)) {
    throw new Error('El archivo no parece una copia válida de Pulse Gym.');
  }

  if (mode === 'replace') {
    for (const store of ['sessions','settings','routines','body','activeSession']) {
      await clear(store);
    }
  }

  for (const store of ['sessions','settings','routines','body','activeSession']) {
    for (const item of data[store] || []) {
      await put(store, item);
    }
  }
}

export async function exportCSV() {
  const sessions = await all('sessions');
  const rows = [['fecha','rutina','ejercicio','serie','peso','reps','rir','tipo','volumen']];
  sessions.forEach(session => {
    session.exercises.forEach(exercise => {
      (exercise.logs || []).filter(l => l.done).forEach(log => {
        rows.push([
          session.date, session.routineName, exercise.name, log.set,
          log.weight, log.reps, log.rir, log.type,
          (Number(log.weight)||0) * (Number(log.reps)||0)
        ]);
      });
    });
  });
  const csv = '\ufeff' + rows.map(row => row.map(v => `"${String(v ?? '').replaceAll('"','""')}"`).join(',')).join('\n');
  download(csv, 'pulse-gym-entrenos.csv', 'text/csv');
}
