// Voz: botón de micrófono de la barra superior, panel de escucha y botones de dictado de los campos.
// Lo que se pinta sale de state.voice; la lógica (escuchar, entender y ejecutar) está en voice/controller.js.
// El panel es capa de navegación, como el asistente: va de Liquid Glass.
import { state } from '../data/state.js';
import { t } from '../i18n/index.js';
import { html, safe } from '../lib/html.js';
import { canListen } from '../voice/speech.js';
import { COMMAND_HELP } from '../voice/commands.js';
import { icon } from './icons.js';
import { kbd } from './ui.js';

const listening = mode => state.voice?.mode === mode && state.voice.status === 'listening';

export const micButton = () => html`
  <button type="button" class="icon-btn voice-btn ${listening('command') ? 'is-listening' : ''}" data-action="voice"
    aria-pressed="${listening('command')}" aria-keyshortcuts="V"
    aria-label="${t(listening('command') ? 'Dejar de escuchar' : 'Comandos de voz')}" title="${t('Comandos de voz')} (V)">
    ${icon('mic')}
  </button>`;

// Botón de dictado junto a un campo. Sin reconocimiento de voz en el navegador no se pinta.
export function dictateButton(target, label = '') {
  if (!canListen()) return '';
  const on = listening('dictation') && state.voice.target === target;
  const name = String(label).replace(/<[^>]+>/g, '').trim();
  return html`
    <button type="button" class="dictate-btn ${on ? 'is-listening' : ''}" data-action="dictate" data-target="${target}" data-label="${safe(name)}"
      aria-pressed="${on}" aria-label="${on ? t('Terminar el dictado') : name ? t('Dictar «{field}»', { field: safe(name) }) : t('Dictar')}"
      title="${on ? t('Terminar el dictado') : t('Dictar por voz')}">${icon(on ? 'square' : 'mic', 'sm')}</button>`;
}

const STATUS_TEXT = {
  command: { listening: 'Te escucho…', idle: 'Comando de voz' },
  dictation: { listening: 'Dictando', idle: 'Dictado terminado' }
};

function waves() {
  return `<span class="voice-waves" aria-hidden="true">${'<i></i>'.repeat(5)}</span>`;
}

export function voicePanel() {
  const v = state.voice;
  if (!v) return '';
  const live = v.status === 'listening';
  const dictating = v.mode === 'dictation';
  const title = t(STATUS_TEXT[v.mode][live ? 'listening' : 'idle']);
  const heard = v.interim || v.heard;
  return html`
    <section class="voice-panel lg is-thick ${live ? 'is-live' : ''} ${dictating ? 'is-dictation' : ''}" data-lg="voice" aria-labelledby="voice-title">
      <header class="voice-head">
        <span class="voice-orb ${live ? 'is-live' : ''}" aria-hidden="true">${live ? waves() : icon(canListen() ? 'mic' : 'mic-off', 'sm')}</span>
        <div class="voice-title">
          <h2 id="voice-title">${title}${dictating && v.label ? ` · <span>${safe(v.label)}</span>` : ''}</h2>
          <small>${t(dictating ? 'Di «coma», «punto» o «nueva línea». «Terminar dictado» para acabar.' : 'Di «ayuda» para ver lo que entiendo.')}</small>
        </div>
        ${live ? `<button type="button" class="icon-btn" data-action="voice-stop" aria-label="${t('Dejar de escuchar')}" title="${t('Dejar de escuchar')}">${icon('square', 'sm')}</button>` : ''}
        <button type="button" class="icon-btn" data-action="voice-close" aria-label="${t('Cerrar')}">${icon('x', 'sm')}</button>
      </header>
      <p class="voice-transcript ${v.interim ? 'is-interim' : ''}" aria-live="off">${heard ? `«${safe(heard)}»` : `<span class="muted">${t(live ? 'Habla ahora…' : canListen() ? 'Pulsa el micro o la tecla V para hablar.' : 'Este navegador no reconoce la voz: usa Chrome, Edge o Safari, o escribe el comando.')}</span>`}</p>
      ${v.reply ? `<p class="voice-reply ${v.tone ? `is-${v.tone}` : ''}" role="status">${icon(v.tone === 'error' ? 'circle-alert' : 'circle-check', 'xs')}<span>${safe(v.reply)}</span></p>` : '<p class="sr-only" role="status"></p>'}
      ${dictating ? '' : html`
        <form class="voice-form" id="voice-form" autocomplete="off">
          <label class="sr-only" for="voice-text">${t('Escribe un comando')}</label>
          <input id="voice-text" name="command" maxlength="160" placeholder="${t('…o escríbelo: «ir a ventas»')}"/>
          <button type="submit" class="btn small">${t('Ejecutar')}</button>
          <button type="button" class="btn small" data-action="voice-help">${t('Comandos')}</button>
        </form>`}
    </section>`;
}

export function commandHelp() {
  return html`
    <div class="voice-help">
      <p class="muted">${t('Pulsa el micrófono de la barra superior o la tecla {key} y di una orden. Se entiende en español y en inglés.', { key: kbd('V') })}</p>
      ${COMMAND_HELP.map(([group, lines]) => html`
        <h3>${t(group)}</h3>
        <ul>${lines.map(line => `<li>${t(line)}</li>`)}</ul>`)}
    </div>`;
}
