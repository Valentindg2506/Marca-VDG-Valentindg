// Cálculos de los informes. Todo sale de los datos reales de la app: no hay cifras inventadas aparte.
import { daysFromToday, parseDay, startOfToday, DAY } from '../lib/dates.js';
import { roundCents } from '../lib/taxes.js';
import {
  invoices, invoiceTotals, pendingInvoices, recentInvoices, clients, clientBilled, deals, closedDeals,
  team, sum, charts, monthlyBilled, monthlyCollected, SECTORS
} from './store.js';

const average = list => (list.length ? sum(list, x => x) / list.length : 0);

// Plazo medio de cobro: días entre emisión y cobro de las facturas cobradas en los últimos 90 días.
export function collectionDays() {
  const paid = invoices().filter(i => i.paid && i.amount > 0 && daysFromToday(i.paid) > -90);
  const days = paid.map(i => Math.round((parseDay(i.paid) - parseDay(i.issued)) / DAY));
  return { days: Math.round(average(days)), count: paid.length };
}

export function closeRate() {
  const all = closedDeals();
  const won = all.filter(d => d.won);
  return { rate: all.length ? won.length / all.length : 0, won: won.length, total: all.length, amount: sum(won) };
}

export function thirtyDays() {
  const recent = recentInvoices();
  const billed = sum(recent);
  const collected = sum(recent.filter(i => i.paid));
  return { billed, collected, previous: charts().previousMonthsBilled.at(-1), count: recent.length };
}

// Lo pendiente por antigüedad del vencimiento.
const AGING = [
  { id: 'current', label: 'Sin vencer', test: d => d >= 0 },
  { id: 'd30', label: 'Vencidas hace 1–30 días', test: d => d < 0 && d >= -30 },
  { id: 'd60', label: 'Vencidas hace 31–60 días', test: d => d < -30 && d >= -60 },
  { id: 'd60plus', label: 'Vencidas hace más de 60 días', test: d => d < -60 }
];
export function aging() {
  const pending = pendingInvoices();
  const total = sum(pending);
  return AGING.map(bucket => {
    const list = pending.filter(i => bucket.test(daysFromToday(i.due)));
    return { ...bucket, list, amount: sum(list), share: total ? sum(list) / total : 0 };
  });
}

export function topClients(limit = 8) {
  const ranked = clients().map(c => ({ client: c, amount: clientBilled(c) })).filter(r => r.amount > 0).sort((a, b) => b.amount - a.amount);
  const total = sum(ranked) || 1;
  return ranked.slice(0, limit).map(r => ({ ...r, share: r.amount / total }));
}

export function sectorShares() {
  const totals = SECTORS.map(sector => [sector, sum(clients().filter(c => c.sector === sector), clientBilled)]);
  const grand = sum(totals, ([, v]) => v) || 1;
  return totals.map(([sector, v]) => [sector, v / grand, v]).filter(([, share]) => share > 0).sort((a, b) => b[1] - a[1]);
}

// Resultados por responsable de cuenta.
export function byOwner() {
  return team().map(member => {
    const own = clients().filter(c => c.owner === member.id);
    const pipeline = deals().filter(d => d.owner === member.id);
    const won = closedDeals().filter(d => d.owner === member.id && d.won);
    return { member, clients: own.length, billed: sum(own, clientBilled), pipeline: sum(pipeline), deals: pipeline.length, won: sum(won), wonCount: won.length };
  });
}

// IVA repercutido y retenciones del trimestre en curso (facturas emitidas, rectificativas incluidas).
export function quarterTaxes() {
  const today = startOfToday();
  const q = Math.floor(today.getMonth() / 3);
  const from = new Date(today.getFullYear(), q * 3, 1);
  const issued = invoices().filter(i => parseDay(i.issued) >= from);
  const byRate = new Map();
  let irpf = 0;
  for (const inv of issued) {
    const totals = invoiceTotals(inv);
    irpf += totals.irpf;
    for (const b of totals.bases) {
      const acc = byRate.get(b.rate) ?? { rate: b.rate, base: 0, vat: 0 };
      acc.base += b.base;
      acc.vat += b.vat;
      byRate.set(b.rate, acc);
    }
  }
  const rows = [...byRate.values()].sort((a, b) => b.rate - a.rate).map(r => ({ ...r, base: roundCents(r.base), vat: roundCents(r.vat) }));
  return { quarter: q + 1, year: today.getFullYear(), from, count: issued.length, rows, base: roundCents(sum(rows, r => r.base)), vat: roundCents(sum(rows, r => r.vat)), irpf: roundCents(irpf) };
}

export const monthsSeries = (months = 12) => ({ billed: monthlyBilled().slice(-months), collected: monthlyCollected().slice(-months) });
