import { createNewGame, migrateState } from './state.js';

const KEY = 'liga-simulator-v4-save';

export function saveGame(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function loadGame() {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return migrateState(parsed);
  } catch {
    return null;
  }
}

export function clearGame() {
  localStorage.removeItem(KEY);
}

export function ensureGame() {
  const loaded = loadGame();
  return loaded || createNewGame();
}

export function exportGame(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `liga-sim-temporada-${state.season}-j${state.currentMatchday}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importGame(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result);
        const migrated = migrateState(imported);
        if (!migrated) throw new Error('Partida incompatible');
        resolve(migrated);
      } catch {
        reject(new Error('JSON inválido o incompatible con v5'));
      }
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsText(file);
  });
}
