// localStorage wrapper: never throws, survives corrupt JSON and blocked storage.
import { SAVE_KEY, sanitize, defaultMeta } from '../logic/meta.js';

export function loadMeta(data) {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultMeta();
    return sanitize(JSON.parse(raw), data);
  } catch (e) {
    try { const bad = window.localStorage.getItem(SAVE_KEY); if (bad) window.localStorage.setItem(SAVE_KEY + '.corrupt', bad.slice(0, 50000)); } catch (_) { /* ignore */ }
    return defaultMeta();
  }
}

export function saveMeta(meta) {
  try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(meta)); return true; } catch (e) { return false; }
}

export function wipeMeta() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
  return defaultMeta();
}
