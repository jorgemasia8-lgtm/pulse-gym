// data.js -- Estado global, ajustes por defecto y datos semilla (rutinas iniciales)
import { put, get, all } from './db.js';

export const DEFAULT_SETTINGS = {
  id: 'settings',
  unit: 'kg',
  theme: 'dark',
  sound: true,
  vibration: true,
  restDefaults: { basic: 150, accessory: 90, core: 60 },
  bar: 20,
  plates: [25, 20, 15, 10, 5, 2.5, 1.25],
  weeklyGoal: 4,
  lastBackup: null,
  appVersion: '2.0.0'
};

export async function settings() {
  const s = await get('settings', 'settings');
  return s ? { ...DEFAULT_SETTINGS, ...s } : { ...DEFAULT_SETTINGS };
}

export async function saveSettings(next) {
  return put('settings', { ...next, id: 'settings' });
}

function ex(name, muscle, sets, reps, rest, notes = '') {
  return { id: crypto.randomUUID(), name, muscle, sets, targetReps: reps, rest, notes };
}

export const SEED_ROUTINES = [
  {
    id: crypto.randomUUID(), day: 'Lunes', name: 'Empuje (Pecho / Hombro / Tríceps)',
    exercises: [
      ex('Press banca', 'Pecho', 4, '6-8', 150),
      ex('Press militar', 'Hombro', 3, '8-10', 120),
      ex('Fondos en paralelas', 'Tríceps', 3, '8-12', 90),
      ex('Elevaciones laterales', 'Hombro', 3, '12-15', 60)
    ]
  },
  {
    id: crypto.randomUUID(), day: 'Martes', name: 'Tirón (Espalda / Bíceps)',
    exercises: [
      ex('Dominadas', 'Espalda', 4, '6-10', 150),
      ex('Remo con barra', 'Espalda', 4, '8-10', 120),
      ex('Curl de bíceps', 'Bíceps', 3, '10-12', 75)
    ]
  },
  {
    id: crypto.randomUUID(), day: 'Miércoles', name: 'Pierna',
    exercises: [
      ex('Sentadilla', 'Pierna', 4, '6-8', 180),
      ex('Prensa', 'Pierna', 3, '10-12', 120),
      ex('Curl femoral', 'Pierna', 3, '10-12', 90)
    ]
  },
  {
    id: crypto.randomUUID(), day: 'Jueves', name: 'Descanso activo',
    exercises: []
  },
  {
    id: crypto.randomUUID(), day: 'Viernes', name: 'Empuje + Abdomen',
    exercises: [
      ex('Press inclinado mancuernas', 'Pecho', 4, '8-10', 120),
      ex('Press francés', 'Tríceps', 3, '10-12', 75),
      ex('Plancha', 'Abdomen', 3, '30-45s', 45)
    ]
  },
  {
    id: crypto.randomUUID(), day: 'Sábado', name: 'Tirón + Cardio',
    exercises: [
      ex('Jalón al pecho', 'Espalda', 4, '8-10', 100),
      ex('Remo mancuerna', 'Espalda', 3, '10-12', 90),
      { id: crypto.randomUUID(), name: 'Cardio', muscle: 'Cardio', isCardio: true, cardioType: 'Cinta', duration: 20, intensity: 'Moderada', distance: null, sets: 0, targetReps: '', rest: 0, notes: '' }
    ]
  },
  {
    id: crypto.randomUUID(), day: 'Domingo', name: 'Descanso',
    exercises: [],
    isRestDay: true
  }
];

export async function ensureSeedRoutines() {
  const existing = await all('routines');
  if (existing.length === 0) {
    for (const r of SEED_ROUTINES) await put('routines', r);
  }
}

export function newExercise() {
  return ex('Nuevo ejercicio', 'General', 3, '8-10', 90);
}

export function newRoutine(day = 'Lunes') {
  return { id: crypto.randomUUID(), day, name: 'Nueva rutina', exercises: [], notes: '' };
}
