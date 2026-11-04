// Cálculo de facturas españolas: IVA por línea (21, 10, 4 o 0 %) y retención de IRPF sobre la base. Sin dependencias.
export const VAT_RATES = [21, 10, 4, 0];
export const IRPF_RATES = [0, 7, 15];

export const roundCents = n => Math.round((n + Number.EPSILON) * 100) / 100;

// Líneas: [concepto, cantidad, precio sin IVA, tipo de IVA].
export function invoiceTotals(lines, irpfRate = 0) {
  const byRate = new Map();
  for (const [, qty, price, rate = 21] of lines) byRate.set(rate, (byRate.get(rate) ?? 0) + qty * price);
  const bases = [...byRate].sort((a, b) => b[0] - a[0]).map(([rate, base]) => ({ rate, base: roundCents(base), vat: roundCents(base * rate / 100) }));
  const base = roundCents(bases.reduce((total, b) => total + b.base, 0));
  const vat = roundCents(bases.reduce((total, b) => total + b.vat, 0));
  const irpf = roundCents(base * irpfRate / 100);
  return { bases, base, vat, irpfRate, irpf, total: roundCents(base + vat - irpf) };
}
