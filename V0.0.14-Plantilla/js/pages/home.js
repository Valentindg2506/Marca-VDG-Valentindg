// Inicio: primero lo que hay que hacer hoy (agenda, cobros y tareas); después, cómo va el negocio.
import { state } from '../data/state.js';
import { t, locale } from '../i18n/index.js';
import { html, safe } from '../lib/html.js';
import { money, moneyText, percent, capitalize, monthLabel, quarter, relativeDay } from '../lib/format.js';
import { startOfToday, daysFromToday } from '../lib/dates.js';
import { SECTIONS, clientPath, invoicePath } from '../routes.js';
import {
  sum, billed, recentInvoices, pendingInvoices, invoiceStatus, clients, clientName, deals, events, meetings,
  quarterGoal, charts, monthlyBilled
} from '../data/store.js';
import { icon } from '../components/icons.js';
import { btn, linkBtn, actionLink, dotsLink, head, card, kbd, eventRow, emptyState, taskRow, tag } from '../components/ui.js';
import { lineChart, barChart, homeBars } from '../components/charts.js';

const statTile = (title, value, caption, cls = '') => html`
  <div class="stat-tile ${cls}">
    <h4>${title}</h4>
    <div class="value tabular">${value}</div>
    <p>${caption}</p>
  </div>`;

function agendaCard() {
  const soon = meetings().filter(m => daysFromToday(m.date) >= 0 && daysFromToday(m.date) <= 1);
  const row = m => html`
    <a class="agenda-row" href="${clientPath(m.client)}" data-key="${m.date}-${m.time}">
      <span class="agenda-time"><strong>${m.time}</strong><small>${relativeDay(m.date)}</small></span>
      <span class="list-detail"><strong>${safe(m.title)}</strong><small>${safe(clientName(m.client))} · ${m.length} min</small></span>
      ${icon(m.icon, 'sm')}
    </a>`;
  return card('today-card', t('Agenda'), linkBtn(t('Ver todo'), SECTIONS.tasks.path), soon.length
    ? soon.map(row).join('')
    : emptyState({ iconName: 'calendar-days', title: t('Sin reuniones hoy ni mañana') }));
}

function collectionsCard() {
  const pending = pendingInvoices().sort((a, b) => a.due.localeCompare(b.due));
  const row = inv => {
    const overdue = invoiceStatus(inv) === 'overdue';
    const days = Math.abs(daysFromToday(inv.due));
    return html`
      <a class="list-row" href="${invoicePath(inv.number)}" data-key="${inv.number}">
        <span class="activity-icon ${overdue ? 'danger' : ''}">${icon(overdue ? 'circle-alert' : 'clock', 'sm')}</span>
        <span class="list-detail"><strong>${safe(clientName(inv.client))}</strong><small class="${overdue ? 'down' : ''}">${inv.number} · ${overdue ? t('vencida hace {n} días', { n: days }) : t('vence en {n} días', { n: days })}</small></span>
        <span class="list-value">${money(inv.amount)}</span>
      </a>`;
  };
  const overdueCount = pending.filter(i => invoiceStatus(i) === 'overdue').length;
  return card('today-card', t('Por cobrar'), overdueCount ? tag(t('{n} vencida|{n} vencidas', { n: overdueCount }), 'danger') : '', pending.length
    ? html`
      ${pending.slice(0, 4).map(row)}
      <div class="today-foot">
        <span class="muted">${t('{n} factura|{n} facturas', { n: pending.length })} · ${moneyText(sum(pending))}</span>
        ${btn(`${t('Registrar cobro')} ${kbd('C')}`, 'payment', 'small')}
      </div>`
    : emptyState({ iconName: 'circle-check', title: t('Todo cobrado'), text: t('No hay facturas pendientes.') }));
}

function tasksCard() {
  const due = state.tasks.filter(task => !task.done && daysFromToday(task.due) <= 1).sort((a, b) => a.due.localeCompare(b.due));
  return card('today-card', t('Tareas'), linkBtn(t('Ver todas'), SECTIONS.tasks.path), due.length
    ? due.slice(0, 5).map(taskRow).join('')
    : emptyState({ iconName: 'check-check', title: t('Nada pendiente para hoy'), text: t('Pulsa {key} para crear una tarea.', { key: kbd('T') }) }));
}

function barsCard() {
  return html`
    <section class="card bars-card" id="bars-card">
      <div class="card-header">
        <h3>${t('Facturado y cobrado')}</h3>
        <div class="range-tabs" role="group" aria-label="${t('Periodo')}">
          ${[['weeks', 'Semanas'], ['months', 'Meses']].map(([id, label]) => `<button type="button" class="${state.range === id ? 'active' : ''}" aria-pressed="${state.range === id}" data-range="${id}">${t(label)}</button>`)}
        </div>
      </div>
      ${barChart(homeBars())}
      <div class="chart-bottom">
        <div class="chart-legend"><span><i></i>${t('Facturado')}</span><span><i class="secondary"></i>${t('Cobrado')}</span></div>
        ${linkBtn(t('Ver informes'), SECTIONS.reports.path)}
      </div>
    </section>`;
}

export function home() {
  const recent = recentInvoices();
  const total = billed();
  const previousMonth = charts().previousMonthsBilled.at(-1);
  const yearTotal = sum(monthlyBilled(), x => x);
  const goal = quarterGoal();
  const progress = goal.won / goal.target;
  const open = deals();
  const todayTasks = state.tasks.filter(task => !task.done && daysFromToday(task.due) <= 0).length;
  const todayMeetings = meetings().filter(m => daysFromToday(m.date) === 0).length;
  const invoicedClients = new Set(recent.map(i => i.client)).size;
  const change = total / previousMonth - 1;

  return html`
    ${head(capitalize(startOfToday().toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' })),
      t('{meetings} y {tasks} para hoy.', {
        meetings: t('{n} reunión|{n} reuniones', { n: todayMeetings }),
        tasks: t('{n} tarea pendiente|{n} tareas pendientes', { n: todayTasks })
      }),
      btn(`${icon('download', 'xs')} ${t('Exportar')}`, 'export-clients') + btn(`${icon('plus', 'xs')} ${t('Nuevo cliente')} ${kbd('N')}`, 'new-client', 'dark'))}
    <div class="today-grid">
      ${agendaCard()}
      ${collectionsCard()}
      ${tasksCard()}
    </div>
    <h2 class="section-title">${t('Cómo va el negocio')}</h2>
    <div class="overview-grid">
      <section class="card revenue-card">
        <div class="revenue-top">
          <span class="eyebrow">${t('Facturado · últimos 30 días')}</span>
          <span class="muted">${t('{n} factura|{n} facturas', { n: recent.length })}</span>
        </div>
        <div class="revenue-amount tabular">${money(total)}</div>
        <div class="revenue-change ${change < 0 ? 'down' : ''}">${icon('arrow-up-right', 'xs')}${percent(change, true)} <small>${t('frente a los 30 días anteriores')}</small></div>
        <div class="revenue-actions">
          ${btn(`${icon('file-text', 'xs')} ${t('Nueva factura')}`, 'new-invoice', 'dark')}
          ${btn(`${icon('banknote', 'xs')} ${t('Registrar cobro')}`, 'payment')}
        </div>
        <div class="revenue-foot">
          <span>${t('Clientes facturados')}<br/><strong>${t('{n} de {total}', { n: invoicedClients, total: clients().length })}</strong></span>
          <span class="avatar-stack">${['LF', 'JM', 'AR'].map(abbr => `<span class="stack-face">${abbr}</span>`)}</span>
        </div>
      </section>
      <section class="card stats-card" aria-label="${t('Indicadores')}">
        <div class="stat-tile highlight-tile">
          <h4>${t('Objetivo {quarter}', { quarter: quarter().label })}</h4>
          <div>
            <div class="value tabular">${money(goal.won, 0)}</div>
            <div class="tile-progress" role="progressbar" aria-label="${t('Objetivo trimestral')}" aria-valuenow="${Math.round(progress * 100)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${progress * 100}%"></span></div>
            <p>${t('{percent} de {target}', { percent: percent(progress), target: moneyText(goal.target, 0) })}</p>
          </div>
        </div>
        ${statTile(t('Pipeline abierto'), money(sum(open), 0), t('{n} oportunidad|{n} oportunidades', { n: open.length }))}
        ${statTile(t('Clientes activos'), clients().filter(c => c.status === 'active').length, t('{n} nuevo este mes|{n} nuevos este mes', { n: clients().filter(c => c.status === 'new').length }))}
        ${statTile(t('Ticket medio'), money(recent.length ? total / recent.length : 0, 0), t('Últimos 30 días'))}
      </section>
      <section class="card trend-card">
        <div class="card-header"><h3>${t('Facturación anual')}</h3>${dotsLink(t('Ver informes'), SECTIONS.reports.path)}</div>
        <div class="trend-amount tabular">${money(yearTotal, 0)}</div>
        <p class="muted trend-delta">${icon('arrow-up-right', 'xs trend-icon')} <span class="up">${percent(yearTotal / charts().previousYearBilled - 1, true)}</span> ${t('frente a los 12 meses anteriores')}</p>
        ${lineChart(monthlyBilled(), t('Facturación mensual'))}
        <div class="graph-footer"><span>${monthLabel(-11)}</span><span class="graph-legend"><i class="legend-dot"></i>${t('Facturación mensual')}</span><span>${monthLabel(0)}</span></div>
      </section>
    </div>
    <div class="lower-grid">
      ${barsCard()}
      ${card('activity-card', t('Actividad reciente'), actionLink(t('Ver todo'), 'activity-log'),
        events().length
          ? `<div class="activity-list">${events().slice(0, 4).map(e => eventRow(e)).join('')}</div>`
          : emptyState({ iconName: 'inbox', title: t('Todavía no hay actividad'), text: t('Aquí aparecerán facturas, cobros, llamadas y notas.') }))}
    </div>`;
}
