// Estado de la interfaz y cambios del usuario, guardados en localStorage.
// Los datos de partida vienen de data/demo.json; aquí solo se guarda lo que el usuario crea o modifica.
import { isDay } from '../lib/dates.js';

const STORAGE_KEY = 'vdg-crm';

const DEFAULTS = {
  theme: 'light', language: 'es', range: 'weeks', privacy: false,
  name: 'Lucía Ferrer', notifications: true, notificationsRead: false,
  tasks: null, clients: [], invoices: [], payments: {}, events: [], notes: [],
  clientStatus: {}, dealStages: {}, hiddenColumns: [], company: {}, dismissedInsights: [],
  // Voz: respuestas habladas y escucha continua (sigue escuchando tras cada orden).
  voiceReplies: true, voiceContinuous: false,
  // Solo de la sesión: no se guardan.
  pop: '', modal: null, detail: null, query: '', selected: [], draft: null,
  assistant: false, chat: [], chatBusy: false, voice: null
};
const TRANSIENT = ['pop', 'modal', 'detail', 'query', 'selected', 'draft', 'assistant', 'chat', 'chatBusy', 'voice'];

const oneOf = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);
const isText = s => typeof s === 'string' && s.trim().length > 0;
const list = (value, valid, max = 500) => (Array.isArray(value) ? value.filter(valid).slice(0, max) : []);
const dictionary = (value, valid) => (value && typeof value === 'object' && !Array.isArray(value)
  ? Object.fromEntries(Object.entries(value).filter(([, v]) => valid(v))) : {});

function restore() {
  let stored = {};
  try { stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {}; } catch { /* entrada corrupta */ }
  const s = { ...structuredClone(DEFAULTS), ...stored };
  for (const key of TRANSIENT) s[key] = structuredClone(DEFAULTS[key]);
  s.theme = oneOf(s.theme, ['light', 'dark'], DEFAULTS.theme);
  s.language = oneOf(s.language, ['es', 'en'], DEFAULTS.language);
  s.range = oneOf(s.range, ['weeks', 'months'], DEFAULTS.range);
  s.name = isText(s.name) ? s.name.trim().slice(0, 40) : DEFAULTS.name;
  for (const key of ['privacy', 'notifications', 'notificationsRead', 'voiceReplies', 'voiceContinuous']) s[key] = Boolean(s[key]);
  s.tasks = Array.isArray(s.tasks)
    ? list(s.tasks, t => t && isText(t.id) && isText(t.text) && isDay(t.due)).map(t => ({ ...t, done: Boolean(t.done), doneAt: isDay(t.doneAt) ? t.doneAt : null }))
    : null;
  s.clients = list(s.clients, c => c && isText(c.id) && isText(c.name) && isDay(c.lastContact));
  s.invoices = list(s.invoices, i => i && isText(i.number) && isText(i.client) && isDay(i.issued) && Array.isArray(i.lines));
  s.events = list(s.events, e => e && isText(e.type) && isDay(e.date));
  s.notes = list(s.notes, n => n && isText(n.client) && isText(n.text) && isDay(n.date));
  s.payments = dictionary(s.payments, isDay);
  s.clientStatus = dictionary(s.clientStatus, v => ['active', 'risk', 'new'].includes(v));
  s.dealStages = dictionary(s.dealStages, v => ['proposal', 'negotiation', 'closing'].includes(v));
  s.hiddenColumns = list(s.hiddenColumns, isText, 10);
  s.dismissedInsights = list(s.dismissedInsights, isText, 100);
  s.company = dictionary(s.company, v => typeof v === 'string' || typeof v === 'number');
  return s;
}

export const state = restore();

export function persist() {
  const payload = Object.fromEntries(Object.keys(DEFAULTS).filter(k => !TRANSIENT.includes(k)).map(k => [k, state[k]]));
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(payload)); } catch { /* sin almacenamiento: no se guardan cambios */ }
}

// Vuelve a los datos de ejemplo conservando idioma y tema.
export function resetState() {
  const { language, theme } = state;
  Object.assign(state, structuredClone(DEFAULTS), { language, theme });
}
