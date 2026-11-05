// Informes: indicadores de cobro y venta, evolución de 12 meses, deuda por antigüedad,
// clientes y responsables que más facturan, sectores e IVA repercutido del trimestre.
import { t } from '../i18n/index.js';
import { html, safe } from '../lib/html.js';
import { money, moneyText, percent, rate, monthLabel, longDate } from '../lib/format.js';
import { isoDay, YEAR } from '../lib/dates.js';
import { clientPath } from '../routes.js';
import { actionLink, btn, head, card, tag, progressBar, avatar, emptyState } from '../components/ui.js';
import { icon } from '../components/icons.js';
import { barChart } from '../components/charts.js';
import { collectionDays, closeRate, thirtyDays, aging, topClients, sectorShares, byOwner, quarterTaxes, monthsSeries } from '../data/reports.js';

const kpi = (label, value, caption, tone = '') => html`
  <div class="stat-tile">
    <h4>${label}</h4>
    <div class="value tabular">${value}</div>
    <p class="${tone}">${caption}</p>
  </div>`;

function kpis() {
  const month = thirtyDays();
  const change = month.billed / month.previous - 1;
  const dso = collectionDays();
  const close = closeRate();
  return html`
    <section class="card stats-card kpi-card" aria-label="${t('Indicadores')}">
      ${kpi(t('Facturado · 30 días'), money(month.billed, 0), t('{change} frente al mes anterior', { change: percent(change, true) }), change < 0 ? 'down' : 'up')}
      ${kpi(t('Cobrado · 30 días'), money(month.collected, 0), t('{percent} de lo facturado', { percent: percent(month.billed ? month.collected / month.billed : 0) }))}
      ${kpi(t('Plazo medio de cobro'), t('{n} días', { n: dso.days }), t('Sobre {n} facturas cobradas en 90 días', { n: dso.count }))}
      ${kpi(t('Tasa de cierre'), percent(close.rate), t('{won} de {total} propuestas · {amount}', { won: close.won, total: close.total, amount: moneyText(close.amount, 0) }))}
    </section>`;
}

function evolution() {
  const series = monthsSeries(12);
  const labels = series.billed.map((_, i) => monthLabel(i - 11));
  const billedYear = series.billed.reduce((a, b) => a + b, 0);
  const collectedYear = series.collected.reduce((a, b) => a + b, 0);
  return card('section-card wide-card', t('Facturado y cobrado · 12 meses'), tag(t('{percent} cobrado', { percent: percent(collectedYear / billedYear) })), html`
    ${barChart({ labels, ...series })}
    <div class="chart-bottom">
      <div class="chart-legend"><span><i></i>${t('Facturado')} · ${moneyText(billedYear, 0)}</span><span><i class="secondary"></i>${t('Cobrado')} · ${moneyText(collectedYear, 0)}</span></div>
    </div>`);
}

function agingCard() {
  const buckets = aging();
  const total = buckets.reduce((sum, b) => sum + b.amount, 0);
  if (!total) return card('section-card', t('Antigüedad de lo pendiente'), '', emptyState({ iconName: 'circle-check', title: t('Todo cobrado') }));
  return card('section-card', t('Antigüedad de lo pendiente'), actionLink(t('Ver facturas'), 'pending'), html`
    <div class="report-total"><strong>${money(total)}</strong><span class="muted">${t('pendiente de cobro')}</span></div>
    ${buckets.map(b => html`
      <div class="report-breakdown-item" data-key="${b.id}">
        <div class="report-breakdown-label">
          <strong class="${b.id !== 'current' && b.amount ? 'down' : ''}">${t(b.label)}</strong>
          <span class="muted">${t('{n} factura|{n} facturas', { n: b.list.length })} · ${moneyText(b.amount, 0)}</span>
        </div>
        ${progressBar(b.share * 100, b.id === 'current' ? '' : 'danger')}
      </div>`)}`);
}

function topClientsCard() {
  const ranked = topClients();
  return card('section-card', t('Clientes que más facturan'), tag(String(YEAR)), html`
    <ol class="ranking">
      ${ranked.map((r, i) => html`
        <li data-key="${safe(r.client.id)}">
          <span class="ranking-pos">${i + 1}</span>
          <span class="ranking-name"><a class="link" href="${clientPath(r.client.id)}">${safe(r.client.name)}</a>${progressBar(r.share / ranked[0].share * 100)}</span>
          <span class="ranking-value">${money(r.amount, 0)}<small>${percent(r.share)}</small></span>
        </li>`)}
    </ol>`);
}

function sectorsCard() {
  return card('section-card', t('Facturación por sector'), tag(String(YEAR)), sectorShares().map(([sector, share, amount]) => html`
    <div class="report-breakdown-item" data-key="${sector}">
      <div class="report-breakdown-label"><strong>${t(sector)}</strong><span class="muted">${moneyText(amount, 0)} · ${percent(share)}</span></div>
      ${progressBar(share * 100)}
    </div>`).join(''));
}

function ownersCard() {
  const rows = byOwner();
  return card('section-card', t('Por responsable'), '', html`
    <div class="table-wrap">
      <table class="data-table compact-table">
        <thead><tr><th>${t('Responsable')}</th><th class="text-right">${t('Clientes')}</th><th class="text-right">${t('Facturado {year}', { year: YEAR })}</th><th class="text-right">${t('Pipeline abierto')}</th><th class="text-right">${t('Ganado')}</th></tr></thead>
        <tbody>
          ${rows.map(o => html`
            <tr data-key="${o.member.id}">
              <td><span class="owner">${avatar(o.member.name, 'xs')}${safe(o.member.name)}</span></td>
              <td class="text-right">${o.clients}</td>
              <td class="text-right">${money(o.billed, 0)}</td>
              <td class="text-right">${money(o.pipeline, 0)}<small class="muted"> · ${o.deals}</small></td>
              <td class="text-right">${money(o.won, 0)}<small class="muted"> · ${o.wonCount}</small></td>
            </tr>`)}
        </tbody>
      </table>
    </div>`);
}

function taxesCard() {
  const q = quarterTaxes();
  return card('section-card', t('IVA repercutido · T{q} {year}', { q: q.quarter, year: q.year }), tag(t('Desde el {date}', { date: longDate(isoDay(q.from)) })), html`
    <div class="table-wrap">
      <table class="data-table compact-table">
        <thead><tr><th>${t('Tipo')}</th><th class="text-right">${t('Base imponible')}</th><th class="text-right">${t('Cuota')}</th></tr></thead>
        <tbody>
          ${q.rows.map(r => `<tr data-key="vat-${r.rate}"><td>${t('IVA {rate}', { rate: rate(r.rate) })}</td><td class="text-right">${money(r.base)}</td><td class="text-right">${money(r.vat)}</td></tr>`)}
          <tr class="total-row" data-key="vat-total"><td>${t('Total repercutido')}</td><td class="text-right">${money(q.base)}</td><td class="text-right">${money(q.vat)}</td></tr>
          ${q.irpf ? `<tr data-key="irpf"><td>${t('Retenciones de IRPF')}</td><td></td><td class="text-right">${money(q.irpf)}</td></tr>` : ''}
        </tbody>
      </table>
    </div>
    <p class="muted report-note">${t('{n} facturas del trimestre, rectificativas incluidas. Es el IVA que cobras (casillas de IVA devengado del modelo 303); el soportado sale de tus gastos.', { n: q.count })}</p>`);
}

export function reports() {
  return html`
    ${head(t('Informes'), t('Datos hasta hoy'), btn(`${icon('printer', 'xs')} ${t('Imprimir')}`, 'print') + btn(`${icon('download', 'xs')} ${t('Exportar CSV')}`, 'export-report', 'dark'))}
    ${kpis()}
    <div class="reports-grid">
      ${evolution()}
      ${agingCard()}
      ${topClientsCard()}
      ${sectorsCard()}
      ${ownersCard()}
      ${taxesCard()}
    </div>`;
}
