import { state, persist, resetState } from './data/state.js';
import { t, setLanguage } from './i18n/index.js';
import { html, safe } from './lib/html.js';
import { morph } from './lib/morph.js';
import { setMasked, relativeDay } from './lib/format.js';
import { day, addDays, isDay, nowTime, daysFromToday } from './lib/dates.js';
import { pathOf, withQuery } from './lib/router.js';
import { checkTaxId, checkIban, provinceFromPostcode, normalize } from './lib/spain.js';
import { roundCents, VAT_RATES, IRPF_RATES } from './lib/taxes.js';
import { liquidGlass } from './lib/glass.js';
import { currentRoute, SECTIONS, clientPath, invoicePath } from './routes.js';
import { loadData, ensureTasks, clients, clientById, invoiceByNumber, deals, nextNumber, memberName, SECTORS, STATUS, STAGES, ME } from './data/store.js';
import { exportClients, exportReport } from './data/exports.js';
import { icon } from './components/icons.js';
import { header, rail, mobileNav, skeleton, errorScreen } from './components/shell.js';
import { assistant } from './components/assistant.js';
import { ask } from './ai/assistant.js';
import { insights } from './ai/insights.js';
import { modal, modalFocus, searchResults, isModal, newInvoiceDraft, draftLines } from './components/modals.js';
import { home } from './pages/home.js';
import { clientsPage, filterClients } from './pages/clients.js';
import { clientPage } from './pages/client.js';
import { sales } from './pages/sales.js';
import { tasksPage } from './pages/tasks.js';
import { reports } from './pages/reports.js';
import { settings } from './pages/settings.js';
import { invoicePage } from './pages/invoice.js';
import { notFound } from './pages/not-found.js';

const PAGES = { home, clients: clientsPage, client: clientPage, sales, tasks: tasksPage, reports, settings, invoice: invoicePage, notFound };
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
const $ = (selector, root = document) => root.querySelector(selector);
const isVisible = el => el.getClientRects().length > 0;

let ready = false;
let renderedPath = null;
let renderedModal = null;
let movedByUser = false;
let modalReturnFocus = null;
let toastTimeout = null;

// ---------------------------------------------------------------------------
// Render: se describe la pantalla entera y morph() solo toca lo que cambia,
// así que el foco, el scroll y lo que se está escribiendo se conservan solos.
// ---------------------------------------------------------------------------
function pageTitle(route) {
  if (route.page === 'client') return clientById(route.param)?.name;
  if (route.page === 'invoice') return route.param;
  if (route.page === 'notFound') return t('Página no encontrada');
  return t(SECTIONS[route.page].label);
}

function applyDocumentPreferences() {
  const root = document.documentElement;
  setLanguage(state.language);
  setMasked(state.privacy);
  root.dataset.theme = state.theme;
  root.lang = state.language;
  $('meta[name="theme-color"]')?.setAttribute('content', getComputedStyle(root).getPropertyValue('--color-bg').trim());
}

function render() {
  if (!ready) return;
  const route = currentRoute();
  const path = pathOf(location.hash);
  const entered = path !== renderedPath;
  const openedModal = state.modal && state.modal !== renderedModal;
  renderedPath = path;
  renderedModal = state.modal;
  applyDocumentPreferences();
  document.title = `${pageTitle(route) ?? 'valentindg'} · valentindg`;
  morph($('#app'), html`
    <div class="app-shell">
      ${header()}
      <div class="workspace">
        ${rail(route.section)}
        <main class="main ${entered ? 'page-enter' : ''}" id="main-content" data-key="${path}">${PAGES[route.page](route)}</main>
      </div>
    </div>
    ${mobileNav(route.section)}
    ${assistant(assistantContext(route))}
    ${modal()}`);
  document.body.classList.toggle('dialog-open', Boolean(state.modal));
  persist();
  if (openedModal) {
    const target = $(modalFocus());
    target?.focus({ preventScroll: true });
    if (target?.id === 'global-search') target.setSelectionRange(target.value.length, target.value.length);
  } else if (entered && movedByUser) {
    $('.page-head h1')?.focus({ preventScroll: true });
  }
  movedByUser = false;
}

// ---------------------------------------------------------------------------
// Asistente: abre y cierra la ventana y pinta la respuesta según llega de ai/assistant.js.
// ---------------------------------------------------------------------------
const isSmallScreen = () => matchMedia('(max-width: 620px)').matches;
const assistantContext = (route = currentRoute()) => ({
  page: route.page, clientId: route.page === 'client' ? route.param : null, language: state.language, privacy: state.privacy
});

function renderChat() {
  render();
  const box = $('#assistant-scroll');
  if (box) box.scrollTop = box.scrollHeight;
}

function toggleAssistant(open = !state.assistant) {
  state.assistant = open;
  state.pop = '';
  renderChat();
  (open ? $('#assistant-input') : $('.assistant-bubble'))?.focus({ preventScroll: true });
}

async function askAssistant(question) {
  const q = question.trim().slice(0, 300);
  if (!q || state.chatBusy) return;
  const reply = { role: 'assistant', blocks: [], done: false };
  state.chat.push({ role: 'user', text: q }, reply);
  Object.assign(state, { assistant: true, chatBusy: true, pop: '' });
  renderChat();
  try {
    for await (const chunk of ask(q, assistantContext())) {
      const last = reply.blocks.at(-1);
      if (chunk.type === 'text' && last?.type === 'text') last.text += chunk.text;
      else reply.blocks.push(chunk);
      renderChat();
    }
  } catch (error) {
    console.error(error);
    reply.blocks.push({ type: 'error' });
  }
  reply.done = true;
  state.chatBusy = false;
  renderChat();
}

const dismissInsight = id => { if (!state.dismissedInsights.includes(id)) state.dismissedInsights.push(id); };

// Aviso breve. Con undo muestra «Deshacer» y lo deja más tiempo en pantalla.
let pendingUndo = null;
function toast(message, undo = null) {
  const area = $('#toast-area');
  pendingUndo = undo;
  area.innerHTML = `<div class="toast">${icon('circle-check', 'sm')}<span>${message}</span>${undo ? `<button type="button" class="toast-action" data-action="undo">${t('Deshacer')}</button>` : ''}</div>`;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => { area.innerHTML = ''; pendingUndo = null; }, undo ? 6000 : 3600);
}

// Navega y pinta en el momento (sin esperar a hashchange, que llega después y ya no cambia nada).
function go(hash) {
  const changed = pathOf(hash) !== pathOf(location.hash);
  if (location.hash !== hash) location.hash = hash;
  if (changed) state.selected = [];
  movedByUser = changed;
  render();
  if (changed) window.scrollTo({ top: 0, behavior: 'instant' });
}

function showModal(id, detail = null) {
  if (!isModal(id)) return;
  if (!state.modal) modalReturnFocus = document.activeElement;
  const drafts = { 'new-invoice': () => newInvoiceDraft(detail), 'rectify': () => ({ mode: 'full' }) };
  Object.assign(state, { modal: id, detail, pop: '', draft: drafts[id]?.() ?? null });
  render();
}

function closeModal() {
  Object.assign(state, { modal: null, draft: null });
  render();
  if (modalReturnFocus?.isConnected) modalReturnFocus.focus({ preventScroll: true });
  modalReturnFocus = null;
}

function logEvent(event) {
  state.events.unshift({ author: ME, date: day(0), time: nowTime(), ...event });
}

// ---------------------------------------------------------------------------
// Acciones
// ---------------------------------------------------------------------------
const findTask = id => state.tasks.find(task => task.id === id);
const togglePop = name => { state.pop = state.pop === name ? '' : name; render(); };
const selectedClients = () => clients().filter(c => state.selected.includes(c.id));

const ACTIONS = {
  'notifications': () => togglePop('notifications'),
  'profile': () => togglePop('profile'),
  'columns': () => togglePop('columns'),
  'theme': () => { state.theme = state.theme === 'light' ? 'dark' : 'light'; state.pop = ''; render(); },
  'privacy': () => { state.privacy = !state.privacy; state.pop = ''; render(); },
  'toggle-notifications': () => {
    state.notifications = !state.notifications;
    render();
    toast(t(state.notifications ? 'Notificaciones activadas' : 'Notificaciones desactivadas'));
  },
  'mark-notifications-read': () => { state.notificationsRead = true; render(); },
  'close-modal': closeModal,
  'assistant': () => toggleAssistant(),
  'assistant-ask': target => askAssistant(target.dataset.question ?? ''),
  'assistant-insight': target => {
    const insight = insights().find(i => i.id === target.dataset.id);
    if (!insight) return;
    dismissInsight(insight.id);
    toggleAssistant(true);
    askAssistant(insight.question);
  },
  'dismiss-insight': target => { dismissInsight(target.dataset.id); render(); $('.assistant-bubble')?.focus({ preventScroll: true }); },
  'assistant-reset': () => { if (state.chatBusy) return; state.chat = []; renderChat(); $('#assistant-input')?.focus(); },
  'export-clients': () => {
    const route = currentRoute();
    const list = route.page === 'clients' ? filterClients(route.query) : clients();
    exportClients(list);
    toast(t('{n} clientes exportados', { n: list.length }));
  },
  'export-selected': () => { exportClients(selectedClients()); toast(t('{n} clientes exportados', { n: state.selected.length })); },
  'clear-selection': () => { state.selected = []; render(); },
  'export-report': () => { exportReport(); toast(t('Informe exportado')); },
  'add-line': () => {
    const last = state.draft.lines.at(-1);
    state.draft.lines.push({ concept: '', qty: '1', price: '', vat: last.vat });
    render();
    $(`#line-${state.draft.lines.length - 1}-concept`)?.focus();
  },
  'remove-line': target => {
    state.draft.lines.splice(Number(target.dataset.index), 1);
    render();
  },
  'print': () => window.print(),
  'undo': () => {
    const undo = pendingUndo;
    $('#toast-area').innerHTML = '';
    pendingUndo = null;
    undo?.();
    render();
  },
  'postpone-task': target => {
    const task = findTask(target.dataset.id);
    if (!task) return;
    const previous = task.due;
    task.due = addDays(daysFromToday(task.due) < 0 ? day(0) : task.due, 1);
    render();
    toast(t('Pospuesta a {date}', { date: relativeDay(task.due, true) }), () => { task.due = previous; });
  },
  'delete-task': target => {
    const index = state.tasks.findIndex(task => task.id === target.dataset.id);
    if (index < 0) return;
    const [removed] = state.tasks.splice(index, 1);
    render();
    toast(t('Tarea borrada'), () => { state.tasks.splice(index, 0, removed); });
  },
  'remind-payment': target => {
    const invoice = invoiceByNumber(target.dataset.id);
    if (!invoice) return;
    const client = clientById(invoice.client);
    const task = { id: `t${Date.now()}`, text: t('Reclamar el pago de la {number}', { number: invoice.number }), due: day(1), done: false, doneAt: null, client: client.id, owner: client.owner ?? ME };
    state.tasks.push(task);
    render();
    toast(t('Tarea creada para mañana: {name}', { name: safe(memberName(task.owner)) }), () => { state.tasks.splice(state.tasks.indexOf(task), 1); });
  },
  'retry': boot,
  'confirm-reset': () => {
    resetState();
    ensureTasks();
    closeModal();
    toast(t('Datos restablecidos'));
  }
};

function moveDeal(id, stage) {
  const deal = deals().find(d => d.id === id);
  if (!deal || !STAGES[stage] || deal.stage === stage) return;
  state.dealStages[id] = stage;
  logEvent({ type: 'stage', client: deal.client, deal: deal.title, stage });
  render();
  toast(t('«{deal}» pasa a {stage}', { deal: safe(deal.title), stage: t(STAGES[stage]) }));
}

function setClientsStatus(status) {
  if (!STATUS[status]) return;
  const count = state.selected.length;
  for (const id of state.selected) {
    state.clientStatus[id] = status;
    logEvent({ type: 'status', client: id, status });
  }
  state.selected = [];
  render();
  toast(t('{n} clientes marcados como «{status}»', { n: count, status: t(STATUS[status][0]) }));
}

// ---------------------------------------------------------------------------
// Formularios: los errores se muestran junto al campo, no en avisos
// ---------------------------------------------------------------------------
function fieldError(input, message) {
  const error = $(`#${input.id}-error`);
  input.setAttribute('aria-invalid', 'true');
  error.textContent = t(message);
  error.hidden = false;
  input.focus();
  return null;
}

function clearFieldError(input) {
  if (!input.hasAttribute('aria-invalid')) return;
  input.removeAttribute('aria-invalid');
  const error = $(`#${input.id}-error`);
  if (error) error.hidden = true;
}

const text = (form, name) => form.elements[name].value.trim();
const taxIdError = value => (value && !checkTaxId(value).valid ? 'Revisa el CIF, NIF o NIE: la letra o el dígito de control no cuadran.' : null);

function uniqueId(name) {
  const base = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'cliente';
  let id = base;
  for (let n = 2; clientById(id); n += 1) id = `${base}-${n}`;
  return id;
}

const FORMS = {
  'profile-form': form => {
    const name = text(form, 'name');
    if (name.length < 2) return fieldError(form.elements.name, 'Escribe tu nombre.');
    state.name = name.slice(0, 40);
    render();
    toast(t('Perfil guardado'));
  },
  'company-form': form => {
    const values = Object.fromEntries(['type', 'name', 'cif', 'address', 'postcode', 'city', 'iban'].map(k => [k, text(form, k)]));
    if (values.name.length < 2) return fieldError(form.elements.name, 'Escribe la razón social o el nombre completo.');
    const cif = checkTaxId(values.cif);
    if (!cif.valid) return fieldError(form.elements.cif, 'Revisa el CIF, NIF o NIE: la letra o el dígito de control no cuadran.');
    if (values.type === 'freelance' && cif.type === 'cif') return fieldError(form.elements.cif, 'Un autónomo factura con su NIF o NIE, no con un CIF.');
    if (!provinceFromPostcode(values.postcode)) return fieldError(form.elements.postcode, 'El código postal tiene 5 cifras y empieza por 01 a 52.');
    if (!values.city) return fieldError(form.elements.city, 'Escribe la población.');
    const iban = checkIban(values.iban);
    if (!iban.valid) return fieldError(form.elements.iban, 'El IBAN no es válido: revisa que no falte ni sobre ninguna cifra.');
    const irpf = values.type === 'freelance' ? Number(form.elements.irpf.value) : 0;
    state.company = { ...values, cif: cif.value, iban: iban.value, irpf: IRPF_RATES.includes(irpf) ? irpf : 0 };
    render();
    toast(t('Datos de la empresa guardados'));
  },
  'client-form': form => {
    const name = text(form, 'name');
    const cif = normalize(text(form, 'cif'));
    const postcode = text(form, 'postcode');
    const city = text(form, 'city');
    if (name.length < 2) return fieldError(form.elements.name, 'Escribe el nombre o la razón social.');
    const cifProblem = taxIdError(cif);
    if (cifProblem) return fieldError(form.elements.cif, cifProblem);
    if (postcode && !provinceFromPostcode(postcode)) return fieldError(form.elements.postcode, 'El código postal tiene 5 cifras y empieza por 01 a 52.');
    if (!city) return fieldError(form.elements.city, 'Escribe la población.');
    const client = {
      id: uniqueId(name), name, cif, postcode, city, sector: SECTORS.includes(form.elements.sector.value) ? form.elements.sector.value : SECTORS[0],
      address: '', status: 'new', owner: ME, lastContact: day(0), billed: 0, contacts: []
    };
    state.clients.unshift(client);
    logEvent({ type: 'client', client: client.id });
    Object.assign(state, { modal: null, draft: null });
    go(clientPath(client.id));
    toast(t('Cliente creado: {name}', { name: safe(name) }));
  },
  'invoice-form': form => {
    const draft = state.draft;
    if (!clientById(draft.client)) return fieldError(form.elements.client, 'Elige un cliente.');
    for (const [i, line] of draft.lines.entries()) {
      if (!line.concept.trim()) return fieldError($(`#line-${i}-concept`), 'Escribe el concepto.');
      if (!(Number(line.qty) > 0)) return fieldError($(`#line-${i}-qty`), 'La cantidad tiene que ser mayor que cero.');
      if (!(Number(line.price) > 0)) return fieldError($(`#line-${i}-price`), 'Escribe el precio sin IVA.');
    }
    const invoice = {
      number: nextNumber('F'), client: draft.client, issued: day(0), paid: null,
      lines: draftLines(draft).map(([concept, qty, price, vat]) => [concept.trim(), qty, roundCents(price), VAT_RATES.includes(vat) ? vat : 21]),
      irpf: IRPF_RATES.includes(draft.irpf) ? draft.irpf : 0
    };
    state.invoices.unshift(invoice);
    logEvent({ type: 'invoice', client: invoice.client, invoice: invoice.number });
    Object.assign(state, { modal: null, draft: null });
    go(invoicePath(invoice.number));
    toast(t('Factura {number} emitida', { number: invoice.number }));
  },
  'rectify-form': form => {
    const original = invoiceByNumber(form.dataset.invoice);
    const reason = text(form, 'reason');
    const full = state.draft.mode !== 'partial';
    let lines;
    if (full) {
      lines = original.lines.map(([concept, qty, price, vat = 21]) => [concept, qty, -price, vat]);
    } else {
      const concept = text(form, 'concept');
      const base = roundCents(Number(form.elements.base.value));
      if (!concept) return fieldError(form.elements.concept, 'Escribe el concepto que se abona.');
      if (!(base > 0)) return fieldError(form.elements.base, 'Escribe la base que se abona, sin IVA.');
      if (base > roundCents(original.lines.reduce((total, [, q, p]) => total + q * p, 0))) return fieldError(form.elements.base, 'No puedes abonar más de lo facturado.');
      lines = [[concept, 1, -base, Number(form.elements.vat.value)]];
    }
    if (!reason) return fieldError(form.elements.reason, 'Explica el motivo: es obligatorio en una rectificativa.');
    const credit = { number: nextNumber('R'), client: original.client, issued: day(0), paid: null, lines, irpf: original.irpf ?? 0, rectifies: original.number, reason, cancels: full };
    state.invoices.unshift(credit);
    logEvent({ type: 'credit', client: credit.client, invoice: credit.number });
    Object.assign(state, { modal: null, draft: null });
    go(invoicePath(credit.number));
    toast(t('Rectificativa {number} emitida', { number: credit.number }));
  },
  'payment-form': form => {
    const invoice = invoiceByNumber(form.elements.invoice.value);
    const date = form.elements.date.value;
    if (!invoice || invoice.paid) return fieldError(form.elements.invoice, 'Elige una factura pendiente.');
    if (!isDay(date) || daysFromToday(date) > 0 || date < invoice.issued) return fieldError(form.elements.date, 'La fecha no puede ser futura ni anterior a la factura.');
    const own = state.invoices.find(i => i.number === invoice.number);
    if (own) own.paid = date;
    else state.payments[invoice.number] = date;
    logEvent({ type: 'paid', client: invoice.client, invoice: invoice.number, date });
    closeModal();
    toast(t('Cobro registrado: {number}', { number: invoice.number }));
  },
  'task-form': form => {
    const description = text(form, 'text');
    const due = form.elements.due.value;
    if (!description) return fieldError(form.elements.text, 'Describe la tarea.');
    if (!isDay(due)) return fieldError(form.elements.due, 'Elige una fecha.');
    const values = { text: description, due, owner: form.elements.owner.value, client: clientById(form.elements.client.value) ? form.elements.client.value : null };
    const existing = findTask(form.dataset.taskId);
    if (existing) Object.assign(existing, values);
    else state.tasks.push({ id: `t${Date.now()}`, done: false, doneAt: null, ...values });
    closeModal();
    toast(t(existing ? 'Tarea guardada' : 'Tarea añadida'));
  },
  'quick-task': form => {
    const description = text(form, 'text');
    const due = isDay(form.elements.due.value) ? form.elements.due.value : day(0);
    if (!description) return form.elements.text.focus();
    state.tasks.push({ id: `t${Date.now()}`, text: description, due, done: false, doneAt: null, client: null, owner: currentRoute().query.responsable || ME });
    form.elements.text.value = '';
    render();
    toast(t('Tarea añadida'));
  },
  'assistant-form': form => {
    const question = text(form, 'question');
    if (!question) return form.elements.question.focus();
    form.elements.question.value = '';
    askAssistant(question);
  },
  'note-form': form => {
    const note = text(form, 'text');
    if (!note) return fieldError(form.elements.text, 'Escribe algo antes de guardar.');
    state.notes.unshift({ client: form.dataset.client, author: ME, text: note.slice(0, 600), date: day(0), time: nowTime() });
    form.reset();
    render();
    toast(t('Nota guardada'));
  }
};

// Borradores: lo que se escribe en la factura o la rectificativa se guarda al momento para recalcular totales.
function updateDraft(el) {
  const draft = state.draft;
  if (!draft) return; // el modal ya se cerró: llega el «change» del campo que perdió el foco
  if (el.dataset.line !== undefined) {
    const line = draft.lines[Number(el.dataset.line)];
    line[el.dataset.field] = el.dataset.field === 'vat' ? Number(el.value) : el.value;
  } else if (el.dataset.draft === 'client') {
    const outside = /^(35|38|51|52)/.test(clientById(el.value)?.postcode ?? '');
    draft.client = el.value;
    draft.lines.forEach(line => { line.vat = outside ? 0 : line.vat === 0 ? 21 : line.vat; });
  } else if (el.dataset.draft === 'irpf') {
    draft.irpf = Number(el.value);
  } else if (el.dataset.draft === 'mode') {
    draft.mode = el.value;
  }
  render();
}

// Provincia en vivo a partir del código postal (alta de cliente y datos de la empresa).
function fillProvince(input) {
  const target = $(`#${input.id.replace('postcode', 'province')}`);
  if (target) target.value = provinceFromPostcode(input.value) ?? '';
}

// ---------------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------------
document.addEventListener('click', event => {
  const target = event.target.closest('[data-action],[data-range],[data-lang],[data-move]');
  if (!target) {
    if (event.target.matches('[data-dismiss]')) closeModal();
    else if (state.pop && !event.target.closest('.menu-anchor')) { state.pop = ''; render(); }
    return;
  }
  const { action, range, lang, move, to, id } = target.dataset;
  if (lang) { state.language = lang; state.pop = ''; render(); }
  else if (range) { state.range = range; render(); }
  else if (move) moveDeal(move, to);
  else if (ACTIONS[action]) ACTIONS[action](target);
  else if (action) showModal(action, id ?? null);
});

document.addEventListener('change', event => {
  const el = event.target;
  const route = currentRoute();
  if (el.matches('[data-line], [data-draft]')) updateDraft(el);
  else if (el.matches('[data-task]')) {
    const task = findTask(el.dataset.task);
    if (!task) return;
    task.done = el.checked;
    task.doneAt = task.done ? day(0) : null;
    render();
    if (task.done) toast(t('Tarea completada'), () => { task.done = false; task.doneAt = null; });
  } else if (el.matches('[data-filter]')) {
    state.selected = [];
    go(withQuery(SECTIONS.clients.path, { ...route.query, [el.dataset.filter]: el.value, pag: '' }));
  } else if (el.matches('[data-select]')) {
    const id = el.dataset.select;
    state.selected = el.checked ? [...state.selected, id] : state.selected.filter(s => s !== id);
    render();
  } else if (el.matches('[data-select-all]')) {
    const ids = [...document.querySelectorAll('[data-select]')].map(box => box.dataset.select);
    state.selected = el.checked ? [...new Set([...state.selected, ...ids])] : state.selected.filter(s => !ids.includes(s));
    render();
  } else if (el.matches('[data-bulk-status]')) {
    setClientsStatus(el.value);
  } else if (el.matches('[data-column]')) {
    const key = el.dataset.column;
    state.hiddenColumns = el.checked ? state.hiddenColumns.filter(k => k !== key) : [...state.hiddenColumns, key];
    render();
  } else if (el.id === 'company-type') {
    $('#company-irpf').disabled = el.value !== 'freelance';
  }
});

document.addEventListener('input', event => {
  const el = event.target;
  if (el.closest('.field')) clearFieldError(el);
  if (el.matches('input[data-line]')) updateDraft(el);
  else if (el.id.endsWith('-postcode')) fillProvince(el);
  else if (el.id === 'global-search') {
    state.query = el.value;
    $('#search-results').innerHTML = searchResults();
  } else if (el.id === 'clients-search') {
    // replaceState no dispara hashchange: se actualiza la URL y se repinta sin perder el foco.
    history.replaceState(null, '', withQuery(SECTIONS.clients.path, { ...currentRoute().query, q: el.value.trim(), pag: '' }));
    render();
  }
});

document.addEventListener('submit', event => {
  const handler = FORMS[event.target.id];
  if (!handler) return;
  event.preventDefault();
  handler(event.target);
});

// Kanban: arrastrar con ratón; con teclado se usan los botones de mover de cada tarjeta.
document.addEventListener('dragstart', event => {
  const card = event.target.closest?.('[data-deal]');
  if (!card) return;
  event.dataTransfer.setData('text/plain', card.dataset.deal);
  event.dataTransfer.effectAllowed = 'move';
  card.classList.add('is-dragging');
});
document.addEventListener('dragover', event => {
  const column = event.target.closest?.('[data-drop]');
  if (!column) return;
  event.preventDefault();
  document.querySelectorAll('.board-column.is-over').forEach(c => c !== column && c.classList.remove('is-over'));
  column.classList.add('is-over');
});
document.addEventListener('drop', event => {
  const column = event.target.closest?.('[data-drop]');
  if (!column) return;
  event.preventDefault();
  column.classList.remove('is-over');
  moveDeal(event.dataTransfer.getData('text/plain'), column.dataset.drop);
});
document.addEventListener('dragend', () => {
  document.querySelectorAll('.is-dragging, .is-over').forEach(el => el.classList.remove('is-dragging', 'is-over'));
});

function trapFocus(event) {
  const focusable = [...($('.modal')?.querySelectorAll(FOCUSABLE) ?? [])].filter(isVisible);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

const SHORTCUTS = { 'n': 'new-client', 'f': 'new-invoice', 'c': 'payment', 't': 'new-task', '/': 'search', '?': 'shortcuts' };
const isTyping = el => el?.matches('input, select, textarea, [contenteditable]');

document.addEventListener('keydown', event => {
  if (!ready) return;
  const inSearch = document.activeElement?.id === 'global-search';
  const shortcut = SHORTCUTS[event.key.toLowerCase()];
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    showModal('search');
  } else if (event.key === 'Escape') {
    if (state.modal) { event.preventDefault(); closeModal(); }
    else if (state.pop) { state.pop = ''; render(); }
    else if (state.assistant) { event.preventDefault(); toggleAssistant(false); }
  } else if (event.key === 'Tab' && state.modal) {
    trapFocus(event);
  } else if (inSearch && event.key === 'ArrowDown') {
    event.preventDefault();
    $('#search-results a')?.focus();
  } else if (inSearch && event.key === 'Enter') {
    event.preventDefault();
    $('#search-results a')?.click();
  } else if (event.key.toLowerCase() === 'a' && !state.modal && !isTyping(document.activeElement) && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault();
    toggleAssistant();
  } else if (shortcut && !state.modal && !isTyping(document.activeElement) && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault();
    showModal(shortcut);
  }
});

window.addEventListener('hashchange', event => {
  const pathChanged = pathOf(new URL(event.oldURL).hash) !== pathOf(location.hash);
  Object.assign(state, { pop: '', modal: null, query: '', draft: null });
  if (pathChanged) state.selected = [];
  // En móvil el asistente ocupa la pantalla: al seguir un enlace de una respuesta se cierra para ver la página.
  if (pathChanged && isSmallScreen()) state.assistant = false;
  movedByUser = pathChanged;
  render();
  if (pathChanged) window.scrollTo({ top: 0, behavior: 'instant' });
});

async function boot() {
  applyDocumentPreferences();
  liquidGlass();
  $('#app').innerHTML = skeleton();
  try {
    await loadData();
    ready = true;
    $('#app').innerHTML = '';
    render();
  } catch (error) {
    console.error(error);
    $('#app').innerHTML = errorScreen();
  }
}

boot();
