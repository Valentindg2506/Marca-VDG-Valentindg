// Ventas: objetivo del trimestre, embudo en Kanban (arrastrar o mover con botones) y últimos cierres.
import { t } from '../i18n/index.js';
import { html, safe } from '../lib/html.js';
import { money, moneyText, percent, formatDate, quarter } from '../lib/format.js';
import { daysFromToday } from '../lib/dates.js';
import { clientPath } from '../routes.js';
import { deals, closedDeals, quarterGoal, clientName, memberName, sum, STAGES } from '../data/store.js';
import { icon } from '../components/icons.js';
import { head, card, tag, actionLink, closedRow, avatar } from '../components/ui.js';

const STAGE_IDS = Object.keys(STAGES);

function dealCard(deal) {
  const index = STAGE_IDS.indexOf(deal.stage);
  const move = (to, iconName) => (to
    ? `<button type="button" class="deal-move" data-move="${deal.id}" data-to="${to}" aria-label="${t('Mover a {stage}', { stage: t(STAGES[to]) })}">${icon(iconName, 'xs')}</button>`
    : '');
  const soon = daysFromToday(deal.close) <= 10;
  return html`
    <article class="deal" draggable="true" data-deal="${deal.id}" aria-roledescription="${t('tarjeta arrastrable')}">
      <a class="deal-client" href="${clientPath(deal.client)}">${safe(clientName(deal.client))}</a>
      <p>${safe(deal.title)}</p>
      <div class="deal-meta">
        ${money(deal.amount, 0)}
        <span class="${soon ? 'down' : 'muted'}">${t('Cierre: {date}', { date: formatDate(deal.close) })}</span>
        <span class="deal-actions">${avatar(memberName(deal.owner), 'xs')}${move(STAGE_IDS[index - 1], 'chevron-left')}${move(STAGE_IDS[index + 1], 'chevron-right')}</span>
      </div>
    </article>`;
}

function board() {
  const all = deals();
  return html`
    <div class="board">
      ${STAGE_IDS.map(stage => {
        const list = all.filter(d => d.stage === stage).sort((a, b) => a.close.localeCompare(b.close));
        return html`
          <section class="board-column" data-drop="${stage}" aria-label="${t(STAGES[stage])}">
            <header class="board-head"><strong>${t(STAGES[stage])}</strong><span>${list.length} · ${moneyText(sum(list), 0)}</span></header>
            <div class="board-list">
              ${list.length ? list.map(dealCard) : `<p class="board-empty">${t('Arrastra aquí una oportunidad')}</p>`}
            </div>
          </section>`;
      })}
    </div>`;
}

export function sales() {
  const q = quarter();
  const goal = quarterGoal();
  const progress = goal.won / goal.target;
  const won = closedDeals().filter(d => d.won).length;
  const open = deals();
  return html`
    ${head(t('Ventas'), t('{n} oportunidades abiertas por {total}', { n: open.length, total: moneyText(sum(open), 0) }))}
    <div class="sales-grid">
      <section class="goal-card">
        <div class="goal-top"><span class="goal-tag">${t('Objetivo {quarter}', { quarter: q.label })}</span><span class="goal-period">${t('Quedan {n} días', { n: q.daysLeft })}</span></div>
        <div class="goal-amount">${money(goal.won, 0)} <small>${t('de {target}', { target: moneyText(goal.target, 0) })}</small></div>
        <div class="goal-bar" role="progressbar" aria-label="${t('Objetivo trimestral')}" aria-valuenow="${Math.round(progress * 100)}" aria-valuemin="0" aria-valuemax="100"><div style="width:${progress * 100}%"></div></div>
        <div class="goal-steps"><span>${t('{percent} conseguido', { percent: percent(progress) })}</span><span>${t('Faltan {amount}', { amount: moneyText(goal.target - goal.won, 0) })}</span></div>
        <div class="goal-actions">
          <button type="button" class="goal-button" data-action="closed">${icon('circle-check', 'xs')} ${t('Ver cierres')}</button>
          <span>${t('{n} propuesta ganada este trimestre|{n} propuestas ganadas este trimestre', { n: won })}</span>
        </div>
      </section>
      ${card('closed-card', t('Últimos cierres'), actionLink(t('Ver todo'), 'closed'), closedDeals().slice(0, 4).map(closedRow).join(''))}
      ${card('board-card', t('Embudo'), tag(t('Arrastra las tarjetas para cambiar de etapa')), board())}
    </div>`;
}
