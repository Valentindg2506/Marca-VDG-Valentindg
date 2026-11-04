// Asistente: burbuja flotante, aviso proactivo y ventana de chat. Las respuestas llegan de ai/assistant.js en trozos
// (texto, cifra, gráfico, lista y fuente) y aquí se pintan con los componentes de siempre.
// Burbuja, aviso y ventana son capa de navegación: van de Liquid Glass. Lo de dentro de la ventana es sólido.
import { state } from '../data/state.js';
import { t } from '../i18n/index.js';
import { html, safe } from '../lib/html.js';
import { money, moneyText, compact } from '../lib/format.js';
import { suggestions } from '../ai/assistant.js';
import { insights } from '../ai/insights.js';
import { icon } from './icons.js';

const orb = (extra = '') => `<span class="assistant-orb ${state.chatBusy ? 'is-busy' : ''} ${extra}" aria-hidden="true"></span>`;

function chart(block) {
  const max = Math.max(...block.values, 1);
  const label = `${block.label}: ${block.values.map((v, i) => `${block.labels[i] ?? ''} ${moneyText(v, 0)}`).join(', ')}`;
  return html`
    <figure class="msg-chart" role="img" aria-label="${safe(label)}">
      <figcaption>${safe(block.label)}</figcaption>
      <div class="msg-bars">
        ${block.values.map((v, i) => html`
          <span class="msg-bar ${i === block.values.length - 1 ? 'is-last' : ''}" title="${safe(moneyText(v, 0))}">
            <i style="height:${Math.max(4, v / max * 100)}%"></i><small>${safe(block.labels[i] ?? '')}</small>
          </span>`)}
      </div>
      <span class="msg-chart-max">${compact(max)}</span>
    </figure>`;
}

function listItem(item) {
  const body = html`
    <span class="msg-item-text"><strong>${safe(item.title)}</strong>${item.detail ? `<small>${safe(item.detail)}</small>` : ''}</span>
    ${item.amount !== null ? money(item.amount, 0) : ''}
    ${item.href ? icon('chevron-right', 'xs') : ''}`;
  return item.href ? `<li><a class="msg-item" href="${safe(item.href)}">${body}</a></li>` : `<li><div class="msg-item">${body}</div></li>`;
}

const BLOCKS = {
  text: b => `<p>${safe(b.text)}</p>`,
  figure: b => html`
    <div class="msg-figure">
      <span>${safe(b.label)}</span>
      <strong>${b.amount !== null ? money(b.amount) : safe(b.value)}</strong>
      ${b.note ? `<small>${safe(b.note)}</small>` : ''}
    </div>`,
  chart,
  list: b => `<ul class="msg-list">${b.items.map(listItem).join('')}</ul>`,
  source: b => `<p class="msg-source">${icon('circle-check', 'xs')}<span>${safe(b.text)}</span></p>`,
  error: () => `<p class="msg-error">${icon('circle-alert', 'xs')}<span>${t('No he podido responder. Vuelve a intentarlo en un momento.')}</span></p>`
};

function message(m) {
  if (m.role === 'user') return `<div class="msg is-user"><p>${safe(m.text)}</p></div>`;
  const typing = !m.done && !m.blocks.length ? '<span class="msg-typing" aria-hidden="true"><i></i><i></i><i></i></span>' : '';
  return `<div class="msg is-assistant">${typing}${m.blocks.map(b => BLOCKS[b.type]?.(b) ?? '').join('')}</div>`;
}

// Solo se anuncia la respuesta terminada: anunciar cada palabra mientras llega sería ruido.
function announcement() {
  const last = state.chat.at(-1);
  if (!last || last.role !== 'assistant' || !last.done) return '';
  return last.blocks.filter(b => b.type === 'text').map(b => b.text).join(' ');
}

function welcome(context, tips) {
  const first = state.name.split(/\s+/)[0];
  return html`
    <div class="assistant-welcome">
      <p>${t('Hola, {name}. Pregúntame por cobros, clientes o ventas: respondo con los datos del CRM.', { name: safe(first) })}</p>
      ${tips.length ? html`
        <h3>${t('Para hoy')}</h3>
        <div class="assistant-tips">
          ${tips.map(tip => `<button type="button" class="assistant-tip" data-action="assistant-insight" data-id="${safe(tip.id)}">${icon('circle-alert', 'xs')}<span>${safe(tip.text)}</span></button>`)}
        </div>` : ''}
      <h3>${t('Prueba con')}</h3>
      <div class="assistant-chips">
        ${suggestions(context).map(q => `<button type="button" class="assistant-chip" data-action="assistant-ask" data-question="${safe(q)}">${safe(q)}</button>`)}
      </div>
    </div>`;
}

function panel(context, tips) {
  return html`
    <section class="assistant-panel lg is-thick" id="assistant-panel" data-lg="assistant-panel" role="dialog" aria-modal="false" aria-labelledby="assistant-title">
      <header class="assistant-head">
        ${orb()}
        <div class="assistant-title"><h2 id="assistant-title">${t('Asistente')}</h2><small>${t(state.chatBusy ? 'Pensando…' : 'Responde con los datos del CRM')}</small></div>
        ${state.chat.length ? `<button type="button" class="icon-btn" data-action="assistant-reset" aria-label="${t('Nueva conversación')}" title="${t('Nueva conversación')}">${icon('repeat', 'sm')}</button>` : ''}
        <button type="button" class="icon-btn" data-action="assistant" aria-label="${t('Cerrar el asistente')}">${icon('x', 'sm')}</button>
      </header>
      <div class="assistant-scroll" id="assistant-scroll" tabindex="-1">
        ${state.chat.length ? state.chat.map(message).join('') : welcome(context, tips)}
      </div>
      <p class="sr-only" aria-live="polite">${safe(announcement())}</p>
      <form class="assistant-input" id="assistant-form" autocomplete="off">
        <input id="assistant-input" name="question" type="text" maxlength="300" placeholder="${t('Pregunta por cobros, clientes o ventas…')}" aria-label="${t('Pregunta al asistente')}">
        <button type="submit" class="assistant-send" aria-label="${t('Enviar')}" ${state.chatBusy ? 'disabled' : ''}>${icon('send', 'sm')}</button>
      </form>
      <p class="assistant-note">${t('Responde con los datos de esta demo. Comprueba las cifras importantes antes de decidir.')}</p>
    </section>`;
}

function hint(tip) {
  return html`
    <div class="assistant-hint lg is-thick" data-lg="assistant-hint" data-key="hint-${safe(tip.id)}" role="status">
      ${orb('is-small')}
      <p>${safe(tip.text)}</p>
      <button type="button" class="assistant-hint-open" data-action="assistant-insight" data-id="${safe(tip.id)}">${t('Ver')}</button>
      <button type="button" class="assistant-hint-close" data-action="dismiss-insight" data-id="${safe(tip.id)}" aria-label="${t('Descartar aviso')}">${icon('x', 'xs')}</button>
    </div>`;
}

export function assistant(context) {
  const tips = insights();
  const showHint = !state.assistant && !state.modal && tips.length;
  return html`
    <div class="assistant ${state.assistant ? 'is-open' : ''}">
      ${showHint ? hint(tips[0]) : ''}
      ${state.assistant ? panel(context, tips) : ''}
      <button type="button" class="assistant-bubble lg" data-lg="assistant" data-action="assistant" aria-expanded="${state.assistant}" aria-controls="assistant-panel" aria-keyshortcuts="A" aria-label="${t(state.assistant ? 'Cerrar el asistente' : 'Abrir el asistente')}">${orb()}</button>
    </div>`;
}
