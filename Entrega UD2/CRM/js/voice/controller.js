// Orquesta la voz dentro del CRM: escucha (speech.js), entiende (commands.js / dictation.js) y ejecuta
// con las mismas funciones que usan los botones. main.js le pasa esas funciones en setupVoice(app).
import { state } from '../data/state.js';
import { t } from '../i18n/index.js';
import { day, daysFromToday } from '../lib/dates.js';
import { relativeDay } from '../lib/format.js';
import { SECTIONS, clientPath } from '../routes.js';
import { clients, meetings, clientName, ME } from '../data/store.js';
import { listen, speak, stopSpeaking, canListen } from './speech.js';
import { parseCommand } from './commands.js';
import { dictationControl, insertDictation, deleteLastWord } from './dictation.js';

let app = null;
let session = null;
let hideTimer = null;

const ERRORS = {
  'not-allowed': 'Permite el micrófono en el navegador para usar la voz.',
  'service-not-allowed': 'Permite el micrófono en el navegador para usar la voz.',
  'no-speech': 'No te he oído. Pulsa el micro y vuelve a hablar.',
  'audio-capture': 'No encuentro ningún micrófono conectado.',
  'network': 'El reconocimiento de voz necesita conexión a internet.',
  'unsupported': 'Este navegador no reconoce la voz: usa Chrome, Edge o Safari, o escribe el comando.',
  'start-failed': 'No se ha podido empezar a escuchar. Vuelve a intentarlo.'
};

export function setupVoice(api) { app = api; }

const update = patch => {
  clearTimeout(hideTimer);
  state.voice = { ...state.voice, ...patch };
  app.render();
};

// El panel se queda unos segundos con la respuesta y se va solo si ya no se está escuchando.
function scheduleHide(ms = 5000) {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    if (state.voice && state.voice.status !== 'listening' && document.activeElement?.id !== 'voice-text') {
      state.voice = null;
      app.render();
    }
  }, ms);
}

function reply(text, tone = 'ok', { say = state.voiceReplies } = {}) {
  update({ reply: text, tone });
  if (say) speak(text, state.language);
}

// Para con suavidad: el reconocedor entrega lo último que oyó y avisa con onState('idle').
export function stopListening() {
  session?.stop();
}

export function closeVoice() {
  session?.abort();
  session = null;
  stopSpeaking();
  state.voice = null;
  app.render();
}

function start(mode, extra = {}) {
  session?.abort();
  stopSpeaking();
  state.voice = { mode, status: canListen() ? 'listening' : 'idle', interim: '', heard: '', reply: '', tone: '', target: '', label: '', ...extra };
  app.render();
  if (!canListen()) {
    reply(t(ERRORS.unsupported), 'error', { say: false });
    if (mode === 'command') document.getElementById('voice-text')?.focus();
    return;
  }
  const current = listen({
    lang: state.language,
    continuous: mode === 'dictation' || state.voiceContinuous,
    onInterim: text => { if (session === current && state.voice) update({ interim: text }); },
    onFinal: text => {
      if (session !== current || !state.voice) return;
      update({ interim: '', heard: text });
      if (mode === 'command') runCommand(text);
      else dictate(text);
    },
    onError: code => { if (session === current) reply(t(ERRORS[code] ?? 'No se ha podido usar el micrófono ({code}).', { code }), 'error', { say: false }); },
    onState: status => {
      if (session !== current || !state.voice) return;
      update({ status });
      if (status === 'idle') { session = null; scheduleHide(); }
    }
  });
  session = current;
}

// Botón del micro y tecla V: empieza o para la escucha de comandos.
export function toggleCommands() {
  if (state.voice?.mode === 'command' && state.voice.status === 'listening') stopListening();
  else start('command');
}

// Botón de dictado de un campo: escribe lo que se dice donde está el cursor.
export function toggleDictation(target, label) {
  if (state.voice?.mode === 'dictation' && state.voice.target === target && state.voice.status === 'listening') { stopListening(); return; }
  const el = document.getElementById(target);
  if (!el) return;
  el.focus();
  start('dictation', { target, label });
}

// Si el campo que se dictaba desaparece (se cerró el modal, se cambió de página) se deja de escuchar.
export function afterRender() {
  if (state.voice?.mode === 'dictation' && state.voice.status === 'listening' && !document.getElementById(state.voice.target)) {
    session?.abort();
    session = null;
    state.voice = null;
  }
}

function dictate(phrase) {
  const el = document.getElementById(state.voice.target);
  if (!el) { stopListening(); return; }
  const control = dictationControl(phrase);
  if (control === 'stop') { stopListening(); reply(t('Dictado terminado'), 'ok', { say: false }); return; }
  if (control === 'submit') { stopListening(); el.form?.requestSubmit(); return; }
  if (control === 'clear') el.value = '';
  else if (control === 'delete-word') el.value = deleteLastWord(el.value);
  else {
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const max = el.maxLength > 0 ? el.maxLength : Infinity;
    const { value, caret } = insertDictation(el.value, start, end, phrase);
    el.value = value.slice(0, max);
    try { el.setSelectionRange(Math.min(caret, max), Math.min(caret, max)); } catch { /* campos sin selección */ }
  }
  // Mismo evento que al teclear: recalcula borradores, limpia errores y filtra búsquedas.
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.focus({ preventScroll: true });
}

function todaySummary() {
  const open = state.tasks.filter(task => !task.done);
  const today = open.filter(task => daysFromToday(task.due) === 0);
  const late = open.filter(task => daysFromToday(task.due) < 0);
  const meets = meetings().filter(m => daysFromToday(m.date) === 0);
  const parts = [t('Hoy tienes {tasks} y {meetings}.', {
    tasks: t('{n} tarea|{n} tareas', { n: today.length }),
    meetings: t('{n} reunión|{n} reuniones', { n: meets.length })
  })];
  if (late.length) parts.push(t('{n} tarea atrasada.|{n} tareas atrasadas.', { n: late.length }));
  if (meets[0]) parts.push(t('La próxima reunión: {title} con {client} a las {time}.', { title: meets[0].title, client: clientName(meets[0].client), time: meets[0].time }));
  if (today[0]) parts.push(t('Primera tarea: {task}.', { task: today[0].text }));
  return parts.join(' ');
}

// Ejecuta una orden ya entendida. Las mismas funciones que los botones y los atajos.
export function runCommand(phrase) {
  const command = parseCommand(phrase, { clients: clients() });
  const sectionName = id => t(SECTIONS[id].label);
  switch (command.type) {
    case 'empty': return;
    case 'go':
      app.go(SECTIONS[command.section].path);
      return reply(t('Abriendo {section}', { section: sectionName(command.section) }));
    case 'back':
      history.back();
      return reply(t('Volviendo atrás'));
    case 'open-client':
      app.go(clientPath(command.id));
      return reply(t('Abriendo la ficha de {name}', { name: command.name }));
    case 'modal':
      app.showModal(command.id);
      return reply(t('Abriendo «{title}»', { title: t(app.modalTitle(command.id)) }));
    case 'help':
      app.showModal('voice-help');
      return reply(t('Estos son los comandos que entiendo'), 'ok', { say: false });
    case 'search':
      state.query = command.query;
      app.showModal('search');
      return reply(t('Buscando «{query}»', { query: command.query }));
    case 'create-task': {
      const task = { id: `t${Date.now()}`, text: command.text.slice(0, 120), due: day(command.days), done: false, doneAt: null, client: null, owner: ME };
      state.tasks.push(task);
      app.render();
      app.toast(t('Tarea añadida'), () => { state.tasks.splice(state.tasks.indexOf(task), 1); });
      return reply(t('Tarea creada para {when}: {task}', { when: relativeDay(task.due, true), task: task.text }));
    }
    case 'today':
      return reply(todaySummary(), 'ok', { say: true });
    case 'theme':
      state.theme = command.value === 'toggle' ? (state.theme === 'light' ? 'dark' : 'light') : command.value;
      app.render();
      return reply(t(state.theme === 'dark' ? 'Modo oscuro activado' : 'Modo claro activado'));
    case 'privacy':
      state.privacy = command.value;
      app.render();
      return reply(t(command.value ? 'Importes ocultos' : 'Importes visibles'));
    case 'language':
      state.language = command.code;
      app.render();
      return reply(t('Idioma cambiado a español'));
    case 'assistant':
      app.toggleAssistant(true);
      return reply(t('Asistente abierto'), 'ok', { say: false });
    case 'ask':
      app.askAssistant(command.question);
      return reply(t('Se lo pregunto al asistente'), 'ok', { say: false });
    case 'export-clients':
    case 'export-report':
    case 'print':
      app.run(command.type);
      return reply(t(command.type === 'print' ? 'Abriendo la impresión' : 'Exportación descargada'), 'ok', { say: false });
    case 'close':
      if (state.modal) app.closeModal();
      else if (state.assistant) app.toggleAssistant(false);
      else { state.pop = ''; app.render(); }
      return reply(t('Cerrado'), 'ok', { say: false });
    case 'stop':
      stopListening();
      return reply(t('He dejado de escuchar'), 'ok', { say: false });
    default:
      return reply(t('No he entendido «{text}». Di «ayuda» para ver los comandos.', { text: command.text }), 'error');
  }
}
