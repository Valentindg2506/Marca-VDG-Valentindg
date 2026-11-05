// Piezas de interfaz compartidas por todas las páginas.
import { t } from '../i18n/index.js';
import { html, safe } from '../lib/html.js';
import { money, signedMoney, dayAndTime, relativeDay, initials } from '../lib/format.js';
import { daysFromToday } from '../lib/dates.js';
import { STATUS, STAGES, INVOICE_STATUS, clientName, clientById, memberName, invoiceStatus, invoiceByNumber } from '../data/store.js';
import { clientPath, invoicePath } from '../routes.js';
import { icon } from './icons.js';
import { dictateButton } from './voice.js';

export const kbd = keys => `<kbd>${keys}</kbd>`;
export const btn = (text, action, cls = '', extra = '') => `<button type="button" class="btn ${cls}" data-action="${action}" ${extra}>${text}</button>`;
export const linkBtn = (label, href) => `<a class="btn small" href="${href}">${label} ${icon('chevron-right', 'xs')}</a>`;
export const actionLink = (label, action) => `<button type="button" class="btn small" data-action="${action}">${label} ${icon('chevron-right', 'xs')}</button>`;
export const dotsLink = (label, href, iconName = 'more-horizontal') => `<a class="dots" href="${href}" aria-label="${label}">${icon(iconName)}</a>`;
export const tag = (text, tone = '') => `<span class="tag ${tone}">${text}</span>`;
export const statusTag = status => tag(t(STATUS[status][0]), STATUS[status][1]);
export const invoiceTag = inv => { const [label, tone] = INVOICE_STATUS[invoiceStatus(inv)]; return tag(t(label), tone); };
export const avatar = (name, cls = '') => `<span class="avatar ${cls}" title="${safe(name)}">${safe(initials(name))}</span>`;
export const detailLine = (label, value) => `<div class="detail-line"><span>${label}</span><strong>${value}</strong></div>`;
export const progressBar = (pct, tone = '') => `<div class="progress-track"><div class="progress-fill ${tone}" style="width:${Math.max(0, Math.min(100, pct))}%"></div></div>`;
export const options = (list, selected) => list.map(([value, label]) => `<option value="${safe(value)}"${value === selected ? ' selected' : ''}>${safe(label)}</option>`).join('');
export const menuItem = (iconName, label, attrs) => `<button type="button" class="menu-item" ${attrs}>${icon(iconName)}<span>${label}</span></button>`;
export const menuLink = (iconName, label, href) => `<a class="menu-item" href="${href}">${icon(iconName)}<span>${label}</span></a>`;
export const closeBtn = () => btn(t('Cerrar'), 'close-modal', 'dark');
export const cancelBtn = () => btn(t('Cancelar'), 'close-modal');
export const modalActions = (...buttons) => `<div class="modal-actions">${buttons.join('')}</div>`;

// El mensaje de error se pinta vacío y se rellena al validar (ver showFieldError en main.js).
// Con «data-dictate» en el campo se añade el botón de dictado por voz (voice/controller.js).
export const field = (id, label, input) => {
  const control = input.replace(/^<(input|select|textarea)/, `<$1 aria-describedby="${id}-error"`);
  return html`
  <div class="field">
    <label for="${id}">${label}</label>
    ${input.includes('data-dictate') ? `<div class="dictate-wrap">${control}${dictateButton(id, label)}</div>` : control}
    <p class="field-error" id="${id}-error" hidden></p>
  </div>`;
};

export const head = (title, subtitle = '', actions = '', crumb = '') => html`
  <div class="page-head">
    <div>
      ${crumb}
      <h1 tabindex="-1">${title}</h1>
      ${subtitle ? `<p>${subtitle}</p>` : ''}
    </div>
    ${actions ? `<div class="head-buttons">${actions}</div>` : ''}
  </div>`;
export const crumb = (href, label) => `<a class="crumb" href="${href}">${icon('arrow-left', 'xs')}${label}</a>`;

export const card = (cls, title, aside, body) => html`
  <section class="card ${cls}">
    <div class="card-header"><h3>${title}</h3>${aside}</div>
    ${body}
  </section>`;

export const emptyState = ({ iconName = 'inbox', title, text = '', action = '' }) => html`
  <div class="empty-state">
    <span class="empty-icon">${icon(iconName)}</span>
    <strong>${title}</strong>
    ${text ? `<p>${text}</p>` : ''}
    ${action}
  </div>`;

export const listRow = ({ iconName, tone = '', title, subtitle, value = '', valueTone = '', href = '', key = '' }) => {
  const tagName = href ? 'a' : 'div';
  return html`
    <${tagName} class="list-row"${href ? ` href="${href}"` : ''}${key ? ` data-key="${safe(key)}"` : ''}>
      <span class="activity-icon ${tone}">${icon(iconName, 'sm')}</span>
      <span class="list-detail"><strong>${title}</strong><small>${subtitle}</small></span>
      <span class="list-value ${valueTone}">${value}</span>
    </${tagName}>`;
};

function issuedAgo(inv) {
  const n = -daysFromToday(inv.issued);
  return n ? t('Emitida hace {n} día|Emitida hace {n} días', { n }) : t('Emitida hoy');
}

export const invoiceRow = (inv, withClient = true) => listRow({
  iconName: 'file-text',
  tone: { paid: 'green', overdue: 'danger' }[invoiceStatus(inv)] ?? '',
  title: withClient ? `${inv.number} · ${safe(clientName(inv.client))}` : inv.number,
  subtitle: inv.paid ? t('Cobrada {date}', { date: relativeDay(inv.paid, true) }) : issuedAgo(inv),
  value: money(inv.amount),
  href: invoicePath(inv.number),
  key: inv.number
});

export const closedRow = deal => listRow({
  iconName: deal.won ? 'circle-check' : 'circle-x',
  tone: deal.won ? 'green' : '',
  title: safe(clientName(deal.client)),
  subtitle: `${safe(deal.title)} · ${relativeDay(deal.date)}`,
  value: deal.won ? money(deal.amount, 0) : `<s>${money(deal.amount, 0)}</s>`,
  valueTone: deal.won ? 'up' : 'muted',
  href: clientPath(deal.client),
  key: `${deal.client}-${deal.date}`
});

// own: la frase que se usa dentro de la ficha del cliente, donde su nombre sobra.
const EVENT_TYPES = {
  paid: { text: '{client} ha pagado la {invoice}', own: 'Ha pagado la {invoice}', icon: 'banknote', tone: 'green', sign: true },
  invoice: { text: 'Factura {invoice} emitida a {client}', own: 'Factura {invoice} emitida', icon: 'file-text', tone: '' },
  call: { text: 'Llamada con {client}', own: 'Llamada', icon: 'phone', tone: '' },
  meeting: { text: 'Reunión con {client}', own: 'Reunión', icon: 'video', tone: '' },
  proposal: { text: 'Propuesta enviada a {client}', own: 'Propuesta enviada', icon: 'send', tone: 'accent' },
  won: { text: '{client} ha aceptado la propuesta', own: 'Ha aceptado la propuesta', icon: 'circle-check', tone: 'green' },
  client: { text: 'Alta de cliente: {client}', own: 'Alta de cliente', icon: 'building', tone: '' },
  stage: { text: '{deal} pasa a {stage}', own: '{deal} pasa a {stage}', icon: 'move', tone: '' },
  status: { text: '{client} marcado como «{status}»', own: 'Marcado como «{status}»', icon: 'user', tone: '' },
  credit: { text: 'Rectificativa {invoice} emitida a {client}', own: 'Rectificativa {invoice} emitida', icon: 'undo', tone: '' },
  note: { icon: 'note', tone: '' }
};

// Una entrada de actividad; las notas muestran su texto tal cual.
export function eventRow(event, { inClient = false } = {}) {
  const type = EVENT_TYPES[event.type] ?? EVENT_TYPES.note;
  const client = clientById(event.client);
  const name = `<a class="link" href="${clientPath(event.client)}">${safe(client?.name ?? '—')}</a>`;
  const invoice = event.invoice ? `<a class="link" href="${invoicePath(event.invoice)}">${event.invoice}</a>` : '';
  const text = event.type === 'note'
    ? `<span class="note-text">${safe(event.text)}</span>`
    : t(inClient ? type.own : type.text, { client: name, invoice, deal: safe(event.deal ?? ''), stage: event.stage ? t(STAGES[event.stage]) : '', status: event.status ? t(STATUS[event.status][0]) : '' });
  const amount = event.amount ?? (event.invoice ? invoiceByNumber(event.invoice)?.amount : null);
  const value = amount ? (type.sign ? signedMoney(amount) : money(amount)) : event.minutes ? `<span class="muted">${event.minutes} min</span>` : '';
  return html`
    <div class="activity-row ${event.type === 'note' ? 'is-note' : ''}" data-key="${safe(`${event.type}-${event.date}-${event.time}-${event.client}`)}">
      <span class="activity-icon ${type.tone}">${icon(type.icon, 'sm')}</span>
      <span class="activity-label"><strong>${text}</strong><small>${safe(memberName(event.author))} · ${dayAndTime(event.date, event.time)}</small></span>
      <span class="activity-value ${type.sign ? 'up' : ''}">${value}</span>
    </div>`;
}

// Fila de tarea. Con actions se muestran posponer, editar y borrar (página de tareas).
export function taskRow(task, { actions = false, showClient = true } = {}) {
  const diff = daysFromToday(task.due);
  const late = !task.done && diff < 0;
  const client = showClient && task.client ? clientById(task.client) : null;
  const due = task.done
    ? t('Hecha {date}', { date: relativeDay(task.doneAt ?? task.due, true) })
    : late ? t('Atrasada · {date}', { date: relativeDay(task.due) }) : relativeDay(task.due);
  const action = (name, iconName, label) => `<button type="button" class="icon-btn" data-action="${name}" data-id="${safe(task.id)}" aria-label="${label}" title="${label}">${icon(iconName, 'sm')}</button>`;
  return html`
    <div class="task-item ${task.done ? 'done' : ''}" data-key="${safe(task.id)}">
      <input type="checkbox" id="task-${safe(task.id)}" data-task="${safe(task.id)}" ${task.done ? 'checked' : ''}/>
      <span class="task-body">
        <label for="task-${safe(task.id)}">${safe(task.text)}</label>
        ${client || task.owner ? html`
          <span class="task-meta">
            ${client ? `<a class="task-client" href="${clientPath(client.id)}">${safe(client.name)}</a>` : ''}
            ${task.owner ? `<span class="task-owner">${avatar(memberName(task.owner), 'xs')}${safe(memberName(task.owner).split(' ')[0])}</span>` : ''}
          </span>` : ''}
      </span>
      <small class="task-due ${late ? 'down' : ''}">${due}</small>
      ${actions ? html`
        <span class="task-actions">
          ${task.done ? '' : action('postpone-task', 'clock', t('Posponer a mañana'))}
          ${action('edit-task', 'pencil', t('Editar'))}
          ${action('delete-task', 'trash', t('Borrar'))}
        </span>` : ''}
    </div>`;
}
