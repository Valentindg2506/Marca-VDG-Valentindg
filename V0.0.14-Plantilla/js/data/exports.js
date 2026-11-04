// Exportaciones CSV de esta aplicación.
import { t, locale } from '../i18n/index.js';
import { downloadCsv } from '../lib/csv.js';
import { roundCents } from '../lib/taxes.js';
import { monthLabel } from '../lib/format.js';
import { day, YEAR } from '../lib/dates.js';
import { STATUS, memberName, clientBilled } from './store.js';
import { sectorShares, aging, topClients, byOwner, quarterTaxes, monthsSeries } from './reports.js';

export function exportClients(list) {
  downloadCsv([
    [t('Cliente'), t('CIF / NIF'), t('Código postal'), t('Población'), t('Provincia'), t('Sector'), t('Responsable'), t('Estado'), t('Último contacto'), t('Facturado {year}', { year: YEAR })],
    ...list.map(c => [c.name, c.cif ?? '', c.postcode ?? '', c.city, c.province ?? '', t(c.sector), memberName(c.owner), t(STATUS[c.status][0]), c.lastContact, roundCents(clientBilled(c))])
  ], `clientes-${day(0)}.csv`, { locale: locale() });
}

// Un único CSV con todas las tablas del informe, separadas por una fila en blanco.
export function exportReport() {
  const series = monthsSeries(12);
  const taxes = quarterTaxes();
  downloadCsv([
    [t('Mes'), t('Facturado'), t('Cobrado')],
    ...series.billed.map((v, i) => [monthLabel(i - 11), roundCents(v), roundCents(series.collected[i])]),
    [],
    [t('Antigüedad de lo pendiente'), t('Facturas'), t('Importe')],
    ...aging().map(b => [t(b.label), b.list.length, roundCents(b.amount)]),
    [],
    [t('Cliente'), t('Facturado {year}', { year: YEAR }), t('Porcentaje')],
    ...topClients().map(r => [r.client.name, roundCents(r.amount), roundCents(r.share * 100)]),
    [],
    [t('Responsable'), t('Clientes'), t('Facturado {year}', { year: YEAR }), t('Pipeline abierto'), t('Ganado')],
    ...byOwner().map(o => [o.member.name, o.clients, roundCents(o.billed), roundCents(o.pipeline), roundCents(o.won)]),
    [],
    [t('Sector'), t('Porcentaje')],
    ...sectorShares().map(([sector, share]) => [t(sector), roundCents(share * 100)]),
    [],
    [t('IVA repercutido T{q} {year}', { q: taxes.quarter, year: taxes.year }), t('Base imponible'), t('Cuota')],
    ...taxes.rows.map(r => [`${r.rate} %`, r.base, r.vat]),
    [t('Total'), taxes.base, taxes.vat],
    [t('Retenciones de IRPF'), '', taxes.irpf]
  ], `informe-${day(0)}.csv`, { locale: locale() });
}
