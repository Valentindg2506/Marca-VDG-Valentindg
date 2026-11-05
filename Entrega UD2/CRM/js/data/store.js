// Datos de partida (data/demo.json) combinados con lo que el usuario crea o modifica (state).
// Para conectar una API real basta con cambiar loadData().
import { state } from './state.js';
import { day, addDays, daysFromToday, YEAR } from '../lib/dates.js';
import { invoiceTotals as computeTotals } from '../lib/taxes.js';
import { provinceFromPostcode } from '../lib/spain.js';

export const ME = 'lf';
export const SECTORS = ['Alimentación', 'Comercio', 'Educación', 'Hostelería', 'Industria', 'Salud', 'Servicios'];
export const STATUS = { active: ['Activo', 'green'], risk: ['En riesgo', 'danger'], new: ['Nuevo', ''] };
export const STAGES = { proposal: 'Propuesta', negotiation: 'Negociación', closing: 'Cierre' };
export const INVOICE_STATUS = {
  paid: ['Cobrada', 'green'], pending: ['Pendiente', ''], overdue: ['Vencida', 'danger'], credit: ['Rectificativa', ''], cancelled: ['Anulada', '']
};

let db = null;
// Las series se guardan sin año (F-0409) y se numeran con el año en curso: F = facturas, R = rectificativas.
const series = number => number?.replace(/^([A-Z])-(?=\d{4}$)/, `$1-${YEAR}-`);
const withProvince = place => ({ ...place, province: provinceFromPostcode(place.postcode) ?? place.province ?? '' });

export async function loadData(url = 'data/demo.json') {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const raw = await response.json();
  db = {
    company: raw.company, team: raw.team, quarter: raw.quarter, charts: raw.charts,
    clients: raw.clients.map(c => withProvince({ ...c, lastContact: day(c.lastContact) })),
    invoices: raw.invoices.map(i => ({ ...i, number: series(i.number), rectifies: series(i.rectifies), issued: day(i.issued), paid: i.paid === null ? null : day(i.paid) })),
    deals: raw.deals.map(d => ({ ...d, close: day(d.close) })),
    closedDeals: raw.closedDeals.map(d => ({ ...d, date: day(d.date) })),
    meetings: raw.meetings.map(m => ({ ...m, date: day(m.date) })),
    events: raw.events.map(e => ({ ...e, date: day(e.date), invoice: series(e.invoice) })),
    notes: raw.notes.map(n => ({ ...n, date: day(n.date) })),
    tasks: raw.tasks.map((task, i) => ({ ...task, id: `t${i + 1}`, due: day(task.due), doneAt: task.doneAt === undefined ? null : day(task.doneAt) }))
  };
  ensureTasks();
}

// Tras restablecer, las tareas vuelven a las de ejemplo.
export function ensureTasks() {
  if (!state.tasks) state.tasks = structuredClone(db.tasks);
}

export const sum = (list, pick = x => x.amount) => list.reduce((total, x) => total + pick(x), 0);
const byMoment = (a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`);

export const company = () => withProvince({ ...db.company, ...state.company });
export const team = () => db.team;
export const memberName = id => (id === ME ? state.name : db.team.find(m => m.id === id)?.name ?? '—');

export const clients = () => [...state.clients, ...db.clients].map(c => withProvince({ ...c, status: state.clientStatus[c.id] ?? c.status }));
export const clientById = id => clients().find(c => c.id === id);
export const clientName = id => clientById(id)?.name ?? '—';

export const invoiceTotals = invoice => computeTotals(invoice.lines, invoice.irpf ?? 0);

export function invoices() {
  const all = [...state.invoices, ...db.invoices];
  const fullyCancelled = new Set(all.filter(i => i.cancels).map(i => i.rectifies));
  return all
    .map(inv => ({
      ...inv,
      paid: inv.paid ?? state.payments[inv.number] ?? null,
      amount: invoiceTotals(inv).total,
      due: addDays(inv.issued, db.company.paymentDays),
      cancelled: fullyCancelled.has(inv.number),
      correctedBy: all.filter(r => r.rectifies === inv.number).map(r => r.number)
    }))
    .sort((a, b) => b.issued.localeCompare(a.issued) || b.number.localeCompare(a.number));
}
export const invoiceByNumber = number => invoices().find(i => i.number === number);
export function invoiceStatus(inv) {
  if (inv.amount < 0) return 'credit';
  if (inv.cancelled) return 'cancelled';
  if (inv.paid) return 'paid';
  return daysFromToday(inv.due) < 0 ? 'overdue' : 'pending';
}
export const recentInvoices = () => invoices().filter(i => daysFromToday(i.issued) > -30);
export const pendingInvoices = () => invoices().filter(i => ['pending', 'overdue'].includes(invoiceStatus(i)));
export const billed = () => sum(recentInvoices());
export const collected = () => sum(recentInvoices().filter(i => i.paid));
export const clientBilled = c => (c.billed ?? 0) + sum(state.invoices.filter(i => i.client === c.id), i => invoiceTotals(i).total);

export function nextNumber(prefix = 'F') {
  const used = invoices().filter(i => i.number.startsWith(`${prefix}-${YEAR}-`)).map(i => Number(i.number.slice(-4)));
  return `${prefix}-${YEAR}-${String(Math.max(0, ...used) + 1).padStart(4, '0')}`;
}

export const deals = () => db.deals.map(d => ({ ...d, stage: state.dealStages[d.id] ?? d.stage }));
export const closedDeals = () => db.closedDeals;
export const quarterGoal = () => db.quarter;
export const meetings = () => [...db.meetings].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
export const tasksFor = clientId => state.tasks.filter(task => task.client === clientId);
export const charts = () => db.charts;
export const monthlyBilled = () => [...db.charts.previousMonthsBilled, billed()];
export const monthlyCollected = () => [...db.charts.previousMonthsCollected, collected()];

export const events = () => [...state.events, ...db.events].sort(byMoment);
export const timeline = clientId => [
  ...events().filter(e => e.client === clientId),
  ...[...state.notes, ...db.notes].filter(n => n.client === clientId).map(n => ({ ...n, type: 'note' }))
].sort(byMoment);
