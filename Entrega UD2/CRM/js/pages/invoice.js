// Factura en formato documento. Al imprimir solo sale la hoja (ver @media print en styles.css).
import { t } from '../i18n/index.js';
import { html, safe } from '../lib/html.js';
import { money, longDate, number, rate } from '../lib/format.js';
import { daysFromToday } from '../lib/dates.js';
import { formatIban, outsideVatTerritory } from '../lib/spain.js';
import { clientPath, invoicePath } from '../routes.js';
import { invoiceByNumber, invoiceTotals, invoiceStatus, clientById, company } from '../data/store.js';
import { icon } from '../components/icons.js';
import { btn, head, crumb, invoiceTag } from '../components/ui.js';
import { notFound } from './not-found.js';

const invoiceLink = number => `<a class="link" href="${invoicePath(number)}">${number}</a>`;

export function invoicePage(route) {
  const inv = invoiceByNumber(route.param);
  const client = inv && clientById(inv.client);
  if (!inv || !client) return notFound();
  const issuer = company();
  const totals = invoiceTotals(inv);
  const status = invoiceStatus(inv);
  const credit = status === 'credit';
  const overdueDays = status === 'overdue' ? -daysFromToday(inv.due) : 0;
  const noVat = totals.bases.every(b => b.rate === 0) && outsideVatTerritory(client.postcode);
  const party = (label, p) => html`
    <div class="party">
      <span class="sheet-label">${label}</span>
      <strong>${safe(p.name)}</strong>
      <span>${safe(p.cif)}</span>
      <span>${safe(p.address)}</span>
      <span>${safe(`${p.postcode} ${p.city}`)}${p.province && !p.province.split('/').includes(p.city) ? ` (${safe(p.province)})` : ''}</span>
    </div>`;
  const subtitle = overdueDays ? t('Vencida hace {n} días', { n: overdueDays })
    : inv.correctedBy.length ? t('Rectificada por {numbers}', { numbers: inv.correctedBy.map(invoiceLink).join(', ') })
    : safe(client.name);
  const actions = [
    status === 'overdue' ? btn(`${icon('clock', 'xs')} ${t('Recordar cobro')}`, 'remind-payment', '', `data-id="${inv.number}"`) : '',
    ['pending', 'overdue'].includes(status) ? btn(`${icon('banknote', 'xs')} ${t('Registrar cobro')}`, 'payment', '', `data-id="${inv.number}"`) : '',
    !credit && status !== 'cancelled' ? btn(`${icon('undo', 'xs')} ${t('Rectificar')}`, 'rectify', '', `data-id="${inv.number}"`) : '',
    btn(`${icon('printer', 'xs')} ${t('Imprimir o guardar PDF')}`, 'print', 'dark')
  ].join('');

  return html`
    ${head(inv.number, `${invoiceTag(inv)} <span>${subtitle}</span>`, actions, crumb(clientPath(client.id), safe(client.name)))}
    <article class="invoice-sheet" aria-label="${t('Factura {number}', { number: inv.number })}">
      <header class="sheet-head">
        <div class="sheet-brand">${safe(issuer.name)}</div>
        <div class="sheet-title">
          <h2>${credit ? t('Factura rectificativa') : t('Factura')}</h2>
          <span class="amount">${inv.number}</span>
        </div>
      </header>
      <div class="sheet-parties">
        ${party(t('Emisor'), issuer)}
        ${party(t('Cliente'), client)}
        <dl class="sheet-dates">
          <div><dt>${t('Fecha de emisión')}</dt><dd>${longDate(inv.issued)}</dd></div>
          ${credit ? '' : `<div><dt>${t('Vencimiento')}</dt><dd>${longDate(inv.due)}</dd></div>`}
          ${inv.rectifies ? `<div><dt>${t('Rectifica a')}</dt><dd>${invoiceLink(inv.rectifies)}</dd></div>` : ''}
        </dl>
      </div>
      <div class="table-wrap">
      <table class="sheet-lines">
        <thead><tr><th>${t('Concepto')}</th><th class="text-right">${t('Cant.')}</th><th class="text-right">${t('Precio')}</th><th class="text-right">${t('IVA')}</th><th class="text-right">${t('Importe')}</th></tr></thead>
        <tbody>
          ${inv.lines.map(([concept, qty, price, vat = 21], i) => html`
            <tr data-key="line-${i}">
              <td>${safe(concept)}</td>
              <td class="text-right">${number(qty)}</td>
              <td class="text-right">${money(price)}</td>
              <td class="text-right">${rate(vat)}</td>
              <td class="text-right">${money(qty * price)}</td>
            </tr>`)}
        </tbody>
      </table>
      </div>
      <dl class="sheet-totals">
        <div><dt>${t('Base imponible')}</dt><dd>${money(totals.base)}</dd></div>
        ${totals.bases.map(b => html`<div><dt>${t('IVA {rate} sobre {base}', { rate: rate(b.rate), base: money(b.base) })}</dt><dd>${money(b.vat)}</dd></div>`)}
        ${totals.irpf ? `<div><dt>${t('Retención IRPF ({rate})', { rate: rate(totals.irpfRate) })}</dt><dd>−${money(totals.irpf)}</dd></div>` : ''}
        <div class="sheet-total"><dt>${t('Total')}</dt><dd>${money(totals.total)}</dd></div>
      </dl>
      <footer class="sheet-foot">
        ${inv.reason ? `<p><strong>${t('Motivo de la rectificación')}:</strong> ${safe(inv.reason)}</p>` : ''}
        ${noVat ? `<p>${t('Operación sin IVA español: destinatario establecido en {province}.', { province: safe(client.province) })}</p>` : ''}
        ${credit
          ? `<p>${t('El importe se descontará del próximo pago o se devolverá por transferencia.')}</p>`
          : `<p>${t('Forma de pago: transferencia a {iban} antes del {date}.', { iban: `<span class="amount">${formatIban(issuer.iban)}</span>`, date: longDate(inv.due) })}</p>`}
        ${inv.paid && !credit ? `<p class="sheet-paid">${icon('circle-check', 'xs')} ${t('Cobrada el {date}', { date: longDate(inv.paid) })}</p>` : ''}
      </footer>
    </article>`;
}
