// Ficha de cliente: datos fiscales, contactos, facturas, oportunidades y actividad con notas.
import { t } from '../i18n/index.js';
import { html, safe } from '../lib/html.js';
import { money, relativeDay, formatDate } from '../lib/format.js';
import { YEAR } from '../lib/dates.js';
import { SECTIONS } from '../routes.js';
import { clientById, clientBilled, invoices, deals, timeline, memberName, tasksFor, STAGES } from '../data/store.js';
import { icon } from '../components/icons.js';
import { btn, head, crumb, card, tag, statusTag, detailLine, listRow, invoiceRow, eventRow, emptyState, field, avatar, taskRow } from '../components/ui.js';
import { notFound } from './not-found.js';

export function clientPage(route) {
  const c = clientById(route.param);
  if (!c) return notFound();
  const own = invoices().filter(i => i.client === c.id);
  const pending = own.filter(i => !i.paid && i.amount > 0);
  const openDeals = deals().filter(d => d.client === c.id);
  const activity = timeline(c.id);
  const clientTasks = tasksFor(c.id).filter(task => !task.done).sort((a, b) => a.due.localeCompare(b.due));
  const location = [c.postcode, c.city].filter(Boolean).join(' ');

  const notes = html`
    <form id="note-form" class="note-form" data-client="${safe(c.id)}" novalidate>
      ${field('note-text', t('Nueva nota'), `<textarea id="note-text" name="text" rows="2" maxlength="600" placeholder="${t('Lo que hablaste, lo que prometiste, lo que hay que vigilar…')}"></textarea>`)}
      <button type="submit" class="btn small">${t('Guardar nota')}</button>
    </form>
    ${activity.length
      ? `<div class="activity-list timeline">${activity.map(e => eventRow(e, { inClient: true })).join('')}</div>`
      : emptyState({ iconName: 'note', title: t('Sin actividad todavía'), text: t('Las llamadas, facturas y notas de este cliente aparecerán aquí.') })}`;

  const invoiceList = own.length
    ? own.map(inv => invoiceRow(inv, false)).join('')
    : emptyState({ iconName: 'file-text', title: t('Todavía no tiene facturas'), action: btn(t('Nueva factura'), 'new-invoice', 'small', `data-id="${safe(c.id)}"`) });

  const contacts = c.contacts.length
    ? c.contacts.map(p => listRow({ iconName: 'user', title: safe(p.name), subtitle: safe(p.role) })).join('')
    : emptyState({ iconName: 'user', title: t('Sin contactos'), text: t('Nadie de este cliente tiene ficha de contacto.') });

  const dealList = openDeals.length
    ? openDeals.map(d => listRow({ iconName: 'target', title: safe(d.title), subtitle: `${t(STAGES[d.stage])} · ${t('Cierre previsto: {date}', { date: formatDate(d.close) })}`, value: money(d.amount, 0), href: SECTIONS.sales.path })).join('')
    : emptyState({ iconName: 'target', title: t('Sin oportunidades abiertas') });

  return html`
    ${head(safe(c.name), `${statusTag(c.status)} <span>${safe(c.cif || t('Sin CIF'))} · ${t(c.sector)} · ${safe(c.city)}</span>`,
      btn(`${icon('file-text', 'xs')} ${t('Nueva factura')}`, 'new-invoice', 'dark', `data-id="${safe(c.id)}"`),
      crumb(SECTIONS.clients.path, t('Clientes')))}
    <div class="client-grid">
      <div class="client-main">
        ${card('section-card', t('Actividad'), tag(t('{n} entrada|{n} entradas', { n: activity.length })), notes)}
        ${card('section-card', t('Facturas'), tag(t('{amount} en {year}', { amount: money(clientBilled(c), 0), year: YEAR }), pending.length ? 'danger' : ''), invoiceList)}
      </div>
      <div class="client-side">
        ${card('section-card', t('Datos fiscales'), '', [
          detailLine(t('Razón social'), safe(c.name)),
          detailLine(t('CIF / NIF'), `<span class="amount">${safe(c.cif || '—')}</span>`),
          detailLine(t('Dirección'), safe(c.address || '—')),
          detailLine(t('Población'), safe(location || '—')),
          detailLine(t('Provincia'), safe(c.province || '—')),
          detailLine(t('Responsable'), `<span class="owner">${avatar(memberName(c.owner), 'xs')}${safe(memberName(c.owner))}</span>`),
          detailLine(t('Último contacto'), relativeDay(c.lastContact))
        ].join(''))}
        ${card('section-card', t('Contactos'), '', contacts)}
        ${card('section-card', t('Tareas'), btn(`${icon('plus', 'xs')} ${t('Nueva')}`, 'new-task', 'small', `data-id="${safe(c.id)}"`), clientTasks.length
          ? clientTasks.map(task => taskRow(task, { showClient: false })).join('')
          : emptyState({ iconName: 'check-check', title: t('Sin tareas pendientes') }))}
        ${card('section-card', t('Oportunidades'), '', dealList)}
      </div>
    </div>`;
}
