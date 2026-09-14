import { CONFIG } from './config.js';
import { loadGame, serializeGame } from './engine.js';

export function loadSavedGame(): any | null {
  const saved = window.localStorage.getItem(CONFIG.storageKey);
  if (!saved) return null;
  return loadGame(saved);
}

export function saveGame(state: any) {
  window.localStorage.setItem(CONFIG.storageKey, serializeGame(state));
}

export function clearSavedGame() {
  window.localStorage.removeItem(CONFIG.storageKey);
}

export function importGame(jsonText: string) {
  return loadGame(jsonText);
}

export function exportGame(state: any) {
  return serializeGame(state);
}
