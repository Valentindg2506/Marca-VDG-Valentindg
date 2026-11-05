// Datos del CRM preparados para las escenas 3D (VR y AR).
import { crmData, euro, STAGES } from '../shared/common.js';

export { euro, STAGES };

const invoiceTotal = inv => inv.lines.reduce((t, [, q, p, vat = 21]) => t + q * p * (1 + vat / 100), 0);

export async function sceneData() {
  const data = await crmData();
  const names = Object.fromEntries(data.clients.map(c => [c.id, c.name]));
  const billed = [...data.charts.previousMonthsBilled];
  const collected = [...data.charts.previousMonthsCollected];
  // Mes en curso: lo facturado en los últimos 30 días según las facturas de la demo.
  const recent = data.invoices.filter(i => i.issued > -30);
  billed.push(Math.round(recent.reduce((t, i) => t + invoiceTotal(i), 0)));
  collected.push(Math.round(recent.filter(i => i.paid !== null).reduce((t, i) => t + invoiceTotal(i), 0)));
  const now = new Date();
  const months = billed.map((_, i) => new Date(now.getFullYear(), now.getMonth() - (billed.length - 1) + i, 1)
    .toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }));
  const pending = data.invoices.filter(i => i.paid === null).reduce((t, i) => t + invoiceTotal(i), 0);
  return {
    months, billed, collected,
    deals: data.deals.map(d => ({ ...d, clientName: names[d.client] ?? d.client })),
    quarter: data.quarter,
    pending: Math.round(pending),
    risk: data.clients.filter(c => c.status === 'risk').length,
    clients: data.clients.length
  };
}

// Atajo para crear entidades de A-Frame desde JavaScript.
export function entity(parent, tag, attrs = {}) {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  parent.append(el);
  return el;
}
