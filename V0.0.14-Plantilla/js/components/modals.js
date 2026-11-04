import { state } from '../data/state.js';
import { t } from '../i18n/index.js';
import { html, safe } from '../lib/html.js';
import { money, moneyText, rate } from '../lib/format.js';
import { day } from '../lib/dates.js';
import { VAT_RATES, IRPF_RATES, invoiceTotals } from '../lib/taxes.js';
import { outsideVatTerritory } from '../lib/spain.js';
import { SECTIONS, clientPath, invoicePath } from '../routes.js';
import {
  clients, clientById, invoices, invoiceByNumber, pendingInvoices, closedDeals, events, clientName, nextNumber, company, team, memberName, ME, SECTORS
} from '../data/store.js';
import { icon } from './icons.js';
import { btn, kbd, field, options, detailLine, modalActions, closeBtn, cancelBtn, invoiceRow, closedRow, eventRow, emptyState } from './ui.js';

const submit = label => `<button type="submit" class="btn dark">${label}</button>`;
const scroll = content => `<div class="modal-scroll">${content}</div>`;
const sortedClients = () => [...clients()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
const vatOptions = selected => options(VAT_RATES.map(r => [String(r), rate(r)]), String(selected));

// Borrador de factura: vive en el estado mientras el modal está abierto para poder recalcular totales al escribir.
export function newInvoiceDraft(clientId) {
  const client = clientById(clientId) ?? sortedClients()[0];
  const vat = outsideVatTerritory(client.postcode) ? 0 : 21;
  return { client: client.id, irpf: Number(company().irpf ?? 0), lines: [{ concept: '', qty: '1', price: '', vat }] };
}

export const draftLines = draft => draft.lines.map(l => [l.concept, Number(l.qty) || 0, Number(l.price) || 0, Number(l.vat)]);

function invoiceForm() {
  const draft = state.draft;
  const client = clientById(draft.client);
  const totals = invoiceTotals(draftLines(draft), draft.irpf);
  const line = (l, i) => html`
    <div class="invoice-line" data-key="line-${i}">
      ${field(`line-${i}-concept`, i ? '' : t('Concepto'), `<input id="line-${i}-concept" data-line="${i}" data-field="concept" value="${safe(l.concept)}" maxlength="120" autocomplete="off" aria-label="${t('Concepto')}"/>`)}
      ${field(`line-${i}-qty`, i ? '' : t('Cant.'), `<input id="line-${i}-qty" data-line="${i}" data-field="qty" value="${safe(l.qty)}" type="number" min="0.01" step="0.01" inputmode="decimal" aria-label="${t('Cantidad')}"/>`)}
      ${field(`line-${i}-price`, i ? '' : t('Precio (€)'), `<input id="line-${i}-price" data-line="${i}" data-field="price" value="${safe(l.price)}" type="number" step="0.01" inputmode="decimal" aria-label="${t('Precio sin IVA')}"/>`)}
      ${field(`line-${i}-vat`, i ? '' : t('IVA'), `<select id="line-${i}-vat" data-line="${i}" data-field="vat" aria-label="${t('Tipo de IVA')}">${vatOptions(l.vat)}</select>`)}
      <button type="button" class="icon-btn line-remove" data-action="remove-line" data-index="${i}" aria-label="${t('Quitar línea')}" ${draft.lines.length === 1 ? 'disabled' : ''}>${icon('trash', 'sm')}</button>
    </div>`;
  return html`
    <form id="invoice-form" novalidate>
      ${field('invoice-client', t('Cliente'), `<select id="invoice-client" name="client" data-draft="client">${options(sortedClients().map(c => [c.id, c.name]), draft.client)}</select>`)}
      ${client && outsideVatTerritory(client.postcode) ? `<p class="form-hint">${icon('circle-alert', 'xs')} ${t('Cliente en {province}: la operación no lleva IVA español.', { province: safe(client.province) })}</p>` : ''}
      <div class="invoice-lines">${draft.lines.map(line)}</div>
      <button type="button" class="btn small" data-action="add-line">${icon('plus', 'xs')} ${t('Añadir línea')}</button>
      <div class="invoice-form-foot">
        ${field('invoice-irpf', t('Retención de IRPF'), `<select id="invoice-irpf" data-draft="irpf">${options(IRPF_RATES.map(r => [String(r), r ? rate(r) : t('Sin retención')]), String(draft.irpf))}</select>`)}
        <dl class="form-totals" id="invoice-totals">
          <div><dt>${t('Base imponible')}</dt><dd>${money(totals.base)}</dd></div>
          ${totals.bases.map(b => `<div><dt>${t('IVA ({rate})', { rate: rate(b.rate) })}</dt><dd>${money(b.vat)}</dd></div>`)}
          ${totals.irpf ? `<div><dt>${t('Retención IRPF ({rate})', { rate: rate(totals.irpfRate) })}</dt><dd>−${money(totals.irpf)}</dd></div>` : ''}
          <div class="form-total"><dt>${t('Total')}</dt><dd>${money(totals.total)}</dd></div>
        </dl>
      </div>
      <p class="muted modal-note">${t('Se numerará como {number}. El IRPF solo se retiene si facturas como autónomo a una empresa o a otro profesional.', { number: nextNumber('F') })}</p>
      ${modalActions(cancelBtn(), submit(t('Emitir factura')))}
    </form>`;
}

function rectifyForm() {
  const inv = invoiceByNumber(state.detail);
  if (!inv) return `<p>${t('No se ha encontrado la factura.')}</p>${modalActions(closeBtn())}`;
  const full = state.draft?.mode !== 'partial';
  const firstRate = inv.lines[0]?.[3] ?? 21;
  return html`
    <form id="rectify-form" novalidate data-invoice="${inv.number}">
      <p class="modal-note">${t('Se emitirá {number}, que corrige la {invoice} ({amount}).', { number: nextNumber('R'), invoice: inv.number, amount: moneyText(inv.amount) })}</p>
      <fieldset class="choice">
        <legend>${t('Tipo de rectificación')}</legend>
        <label><input type="radio" name="mode" value="full" data-draft="mode" ${full ? 'checked' : ''}/> ${t('Anular la factura completa')}</label>
        <label><input type="radio" name="mode" value="partial" data-draft="mode" ${full ? '' : 'checked'}/> ${t('Abonar una parte')}</label>
      </fieldset>
      ${full ? '' : html`
        <div class="field-row">
          ${field('rectify-concept', t('Concepto que se abona'), '<input id="rectify-concept" name="concept" maxlength="120" autocomplete="off"/>')}
          ${field('rectify-base', t('Base a abonar (€)'), '<input id="rectify-base" name="base" type="number" min="0.01" step="0.01" inputmode="decimal"/>')}
        </div>
        ${field('rectify-vat', t('IVA'), `<select id="rectify-vat" name="vat">${vatOptions(firstRate)}</select>`)}`}
      ${field('rectify-reason', t('Motivo (aparece en la factura)'), '<textarea id="rectify-reason" name="reason" rows="2" maxlength="300"></textarea>')}
      ${modalActions(cancelBtn(), submit(t('Emitir rectificativa')))}
    </form>`;
}

// Alta y edición de tareas: mismo formulario. Al crear desde una ficha, detail es el cliente.
function taskForm(task = null) {
  const clientId = task ? task.client ?? '' : clientById(state.detail) ? state.detail : '';
  const owner = task?.owner ?? (clientById(clientId)?.owner || ME);
  return html`
    <form id="task-form" novalidate data-task-id="${safe(task?.id ?? '')}">
      ${field('task-text', t('Descripción'), `<input id="task-text" name="text" maxlength="120" autocomplete="off" value="${safe(task?.text ?? '')}"/>`)}
      <div class="field-row">
        ${field('task-due', t('Fecha'), `<input id="task-due" name="due" type="date" value="${task?.due ?? day(1)}"/>`)}
        ${field('task-owner', t('Responsable'), `<select id="task-owner" name="owner">${options(team().map(m => [m.id, memberName(m.id)]), owner)}</select>`)}
      </div>
      ${field('task-client', t('Cliente'), `<select id="task-client" name="client"><option value="">${t('Sin cliente')}</option>${options(sortedClients().map(c => [c.id, c.name]), clientId)}</select>`)}
      ${modalActions(cancelBtn(), submit(task ? t('Guardar cambios') : t('Añadir tarea')))}
    </form>`;
}

const MODALS = {
  'new-client': {
    title: 'Nuevo cliente',
    focus: '#client-name',
    body: () => html`
      <form id="client-form" novalidate>
        ${field('client-name', t('Nombre o razón social'), '<input id="client-name" name="name" maxlength="90" autocomplete="off"/>')}
        <div class="field-row">
          ${field('client-cif', t('CIF / NIF / NIE'), '<input id="client-cif" name="cif" maxlength="12" autocomplete="off" spellcheck="false" placeholder="B12345674"/>')}
          ${field('client-postcode', t('Código postal'), '<input id="client-postcode" name="postcode" maxlength="5" inputmode="numeric" autocomplete="postal-code"/>')}
        </div>
        <div class="field-row">
          ${field('client-city', t('Población'), '<input id="client-city" name="city" maxlength="40" autocomplete="address-level2"/>')}
          ${field('client-province', t('Provincia'), `<input id="client-province" readonly tabindex="-1" placeholder="${t('Sale del código postal')}"/>`)}
        </div>
        ${field('client-sector', t('Sector'), `<select id="client-sector" name="sector">${options(SECTORS.map(s => [s, t(s)]), SECTORS[0])}</select>`)}
        ${modalActions(cancelBtn(), submit(t('Crear cliente')))}
      </form>`
  },
  'new-invoice': { title: 'Nueva factura', focus: '#line-0-concept', wide: true, body: invoiceForm },
  'rectify': { title: 'Rectificar factura', focus: '#rectify-reason', body: rectifyForm },
  'payment': {
    title: 'Registrar cobro',
    focus: '#payment-invoice',
    body: () => {
      const pending = pendingInvoices();
      if (!pending.length) return `${emptyState({ iconName: 'circle-check', title: t('Todo cobrado'), text: t('No hay facturas pendientes.') })}${modalActions(closeBtn())}`;
      const label = inv => `${inv.number} · ${clientName(inv.client)} · ${moneyText(inv.amount)}`;
      return html`
        <form id="payment-form" novalidate>
          ${field('payment-invoice', t('Factura'), `<select id="payment-invoice" name="invoice">${options(pending.map(inv => [inv.number, label(inv)]), state.detail)}</select>`)}
          ${field('payment-date', t('Fecha de cobro'), `<input id="payment-date" name="date" type="date" value="${day(0)}" max="${day(0)}"/>`)}
          ${modalActions(cancelBtn(), submit(t('Registrar cobro')))}
        </form>`;
    }
  },
  'new-task': { title: 'Nueva tarea', focus: '#task-text', body: () => taskForm() },
  'edit-task': { title: 'Editar tarea', focus: '#task-text', body: () => taskForm(state.tasks.find(task => task.id === state.detail)) },
  'pending': {
    title: 'Facturas pendientes',
    body: () => {
      const list = pendingInvoices();
      return `${list.length ? scroll(list.map(inv => invoiceRow(inv)).join('')) : emptyState({ iconName: 'circle-check', title: t('Todo cobrado'), text: t('No hay facturas pendientes.') })}${modalActions(closeBtn())}`;
    }
  },
  'activity-log': {
    title: 'Actividad',
    body: () => `${scroll(`<div class="activity-list">${events().map(e => eventRow(e)).join('')}</div>`)}${modalActions(closeBtn())}`
  },
  'closed': {
    title: 'Cierres del trimestre',
    body: () => `${scroll(closedDeals().map(closedRow).join(''))}${modalActions(closeBtn())}`
  },
  'shortcuts': {
    title: 'Atajos de teclado',
    body: () => {
      const rows = [[['Ctrl K', '/'], 'Buscar'], [['N'], 'Nuevo cliente'], [['F'], 'Nueva factura'], [['C'], 'Registrar cobro'], [['T'], 'Nueva tarea'], [['A'], 'Abrir el asistente'], [['?'], 'Ver los atajos'], [['Esc'], 'Cerrar']];
      return `${rows.map(([keys, label]) => detailLine(t(label), keys.map(kbd).join(' '))).join('')}${modalActions(closeBtn())}`;
    }
  },
  'reset': {
    title: 'Restablecer datos',
    body: () => `<p>${t('Se borrarán los clientes, facturas, cobros, notas y tareas que hayas creado en este navegador y se recuperarán los datos de ejemplo.')}</p>${modalActions(cancelBtn(), btn(t('Restablecer'), 'confirm-reset', 'danger'))}`
  }
};

export const isModal = id => id === 'search' || id in MODALS;

export function searchResults() {
  const query = state.query.trim().toLocaleLowerCase();
  const matches = (...words) => words.join(' ').toLocaleLowerCase().includes(query);
  const sections = Object.values(SECTIONS).filter(s => !query || matches(s.label, t(s.label)));
  const foundClients = clients().filter(c => matches(c.name, c.city, c.cif, ...c.contacts.map(p => p.name))).slice(0, 5);
  const foundInvoices = query ? invoices().filter(i => matches(i.number, clientName(i.client))).slice(0, 4) : [];
  const group = (title, items) => (items.length ? `<div class="search-group-title">${title}</div>${items.join('')}` : '');
  const result = (href, iconName, label, aside = '') => `<a class="search-result" href="${href}">${icon(iconName)}<span>${label}</span>${aside}</a>`;
  const content = [
    group(t('Secciones'), sections.map(s => result(s.path, s.icon, t(s.label), icon('chevron-right', 'xs')))),
    group(t('Clientes'), foundClients.map(c => result(clientPath(c.id), 'building', safe(c.name), `<span class="muted">${safe(c.city)}</span>`))),
    group(t('Facturas'), foundInvoices.map(i => result(invoicePath(i.number), 'file-text', `${i.number} · ${safe(clientName(i.client))}`, `<span class="muted">${moneyText(i.amount)}</span>`)))
  ].join('');
  return content || emptyState({ iconName: 'search', title: t('Sin resultados para «{query}»', { query: safe(state.query.trim()) }), text: t('Busca por nombre, población, CIF, contacto o número de factura.') });
}

const closeIconBtn = () => `<button type="button" class="icon-btn" data-action="close-modal" aria-label="${t('Cerrar')}">${icon('x')}</button>`;
const shell = (dialogAttrs, heading, content, cls = '') => html`
  <div class="modal-shade" data-dismiss="true">
    <div class="modal ${cls}" role="dialog" aria-modal="true" ${dialogAttrs}>
      <div class="modal-head">${heading}${closeIconBtn()}</div>
      ${content}
    </div>
  </div>`;

export function modal() {
  if (!state.modal) return '';
  if (state.modal === 'search') {
    return shell(`aria-label="${t('Buscar')}"`, `<h3>${t('Buscar')}</h3>`, html`
      <div class="search-input-wrap">
        ${icon('search')}<input id="global-search" type="search" autocomplete="off" placeholder="${t('Clientes, facturas o secciones')}" value="${safe(state.query)}" aria-label="${t('Buscar')}"/>${kbd('Esc')}
      </div>
      <div id="search-results">${searchResults()}</div>`);
  }
  const { title, body, wide } = MODALS[state.modal];
  return shell('aria-labelledby="dialog-title"', `<h2 id="dialog-title">${t(title)}</h2>`, body(), wide ? 'is-wide' : '');
}

export const modalFocus = () => (state.modal === 'search' ? '#global-search' : MODALS[state.modal]?.focus ?? '.modal [data-action="close-modal"]');
