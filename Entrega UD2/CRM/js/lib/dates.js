// Fechas de calendario en formato ISO (AAAA-MM-DD), siempre en hora local.
export const DAY = 86400000;

export function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export const isoDay = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const day = offset => isoDay(new Date(startOfToday().getTime() + offset * DAY));
export const addDays = (iso, n) => isoDay(new Date(parseDay(iso).getTime() + n * DAY));
export const isDay = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

export function parseDay(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const daysFromToday = s => Math.round((parseDay(s) - startOfToday()) / DAY);
export const YEAR = startOfToday().getFullYear();

export function nowTime() {
  return new Date().toTimeString().slice(0, 5);
}
