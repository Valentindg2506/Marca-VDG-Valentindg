// Proveedor de ejemplo del asistente: entiende unas preguntas tipo por palabras clave y responde calculando con
// los datos de la demo (los mismos que ves en pantalla). Sirve para enseñar la interfaz y como guía del formato
// que debe devolver un proveedor real (ver assistant.js).
import { t } from '../i18n/index.js';
import { moneyText, percent, rate, monthLabel, relativeDay, formatDate, quarter } from '../lib/format.js';
import { daysFromToday, startOfToday, DAY } from '../lib/dates.js';
import { SECTIONS, clientPath, invoicePath } from '../routes.js';
import { state } from '../data/state.js';
import {
  pendingInvoices, invoiceStatus, invoices, clients, clientById, clientName, clientBilled, deals, quarterGoal,
  monthlyBilled, memberName, sum, STAGES, STATUS
} from '../data/store.js';
import { thirtyDays, collectionDays, topClients, quarterTaxes } from '../data/reports.js';

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = ms => new Promise(resolve => setTimeout(resolve, reducedMotion() ? 0 : ms));
const normalize = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// El texto llega palabra a palabra, como con un modelo de verdad.
async function* say(text) {
  for (const word of text.split(/(?<= )/)) {
    await wait(18);
    yield { type: 'text', text: word };
  }
}

function* billedAnswer() {
  const r = thirtyDays();
  const change = r.previous ? (r.billed - r.previous) / r.previous : 0;
  yield* [
    { type: 'say', text: t('En los últimos 30 días has facturado {amount}, {change} frente al mes anterior.', { amount: moneyText(r.billed, 0), change: percent(change, true) }) },
    { type: 'figure', label: t('Facturado · 30 días'), amount: r.billed, note: t('{percent} cobrado', { percent: percent(r.billed ? r.collected / r.billed : 0) }) },
    { type: 'chart', label: t('Facturado por mes'), values: monthlyBilled().slice(-6), labels: [-5, -4, -3, -2, -1, 0].map(monthLabel) },
    { type: 'source', text: t('Según {n} facturas de los últimos 30 días', { n: r.count }) }
  ];
}

function* pendingAnswer() {
  const pending = pendingInvoices();
  const overdue = pending.filter(i => invoiceStatus(i) === 'overdue').sort((a, b) => a.due.localeCompare(b.due));
  yield { type: 'say', text: overdue.length
    ? t('Tienes {amount} pendiente de cobro y {overdue} ya vencido. Estas son las facturas vencidas, de la más antigua a la más reciente:', { amount: moneyText(sum(pending), 0), overdue: moneyText(sum(overdue), 0) })
    : t('Tienes {amount} pendiente de cobro y nada vencido.', { amount: moneyText(sum(pending), 0) }) };
  yield { type: 'figure', label: t('Pendiente de cobro'), amount: sum(pending), note: t('{n} factura vencida|{n} facturas vencidas', { n: overdue.length }) };
  if (overdue.length) {
    yield { type: 'list', items: overdue.slice(0, 6).map(i => ({
      title: clientName(i.client), detail: t('{number} · vencida hace {n} días', { number: i.number, n: -daysFromToday(i.due) }), amount: i.amount, href: invoicePath(i.number)
    })) };
  }
  yield { type: 'source', text: t('Según {n} facturas pendientes', { n: pending.length }) };
}

function* goalAnswer() {
  const goal = quarterGoal();
  const q = quarter();
  const today = startOfToday();
  const start = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
  const elapsed = Math.max(1, Math.round((today - start) / DAY) + 1);
  const projection = goal.won / elapsed * (elapsed + q.daysLeft);
  const closing = deals().filter(d => d.stage === 'closing');
  yield { type: 'say', text: t('Lleváis {won} de {target} ({percent}). Quedan {days} días y faltan {left}.', {
    won: moneyText(goal.won, 0), target: moneyText(goal.target, 0), percent: percent(goal.won / goal.target), days: q.daysLeft, left: moneyText(goal.target - goal.won, 0)
  }) + ' ' + (projection >= goal.target
    ? t('Al ritmo actual llegáis al objetivo.')
    : t('Al ritmo actual cerraríais en unos {projection}: las oportunidades en cierre pueden cubrir la diferencia.', { projection: moneyText(projection, 0) })) };
  yield { type: 'figure', label: t('Objetivo {quarter}', { quarter: q.label }), amount: goal.won, note: t('{percent} de {target}', { percent: percent(goal.won / goal.target), target: moneyText(goal.target, 0) }) };
  if (closing.length) {
    yield { type: 'list', items: closing.map(d => ({ title: d.title, detail: `${clientName(d.client)} · ${t(STAGES[d.stage])}`, amount: d.amount, href: SECTIONS.sales.path })) };
  }
  yield { type: 'source', text: t('Según el objetivo del trimestre y {n} oportunidades en cierre', { n: closing.length }) };
}

function* riskAnswer() {
  const list = clients()
    .map(c => ({ c, days: -daysFromToday(c.lastContact) }))
    .filter(({ c, days }) => c.status === 'risk' || days > 30)
    .sort((a, b) => b.days - a.days);
  yield { type: 'say', text: list.length
    ? t('{n} cliente necesita atención: está en riesgo o lleva más de 30 días sin contacto.|{n} clientes necesitan atención: están en riesgo o llevan más de 30 días sin contacto.', { n: list.length })
    : t('Ningún cliente está en riesgo ni lleva más de 30 días sin contacto.') };
  if (list.length) {
    yield { type: 'list', items: list.slice(0, 8).map(({ c, days }) => ({
      title: c.name, detail: c.status === 'risk' ? `${t(STATUS.risk[0])} · ${t('último contacto hace {n} días', { n: days })}` : t('último contacto hace {n} días', { n: days }), href: clientPath(c.id)
    })) };
  }
  yield { type: 'source', text: t('Según el estado y el último contacto de {n} clientes', { n: clients().length }) };
}

function* topAnswer() {
  const top = topClients(5);
  yield { type: 'say', text: t('Tus {n} clientes que más facturan suman {amount}, el {percent} del total.', { n: top.length, amount: moneyText(sum(top), 0), percent: percent(sum(top, r => r.share)) }) };
  yield { type: 'list', items: top.map(r => ({ title: r.client.name, detail: `${r.client.sector} · ${r.client.city}`, amount: r.amount, href: clientPath(r.client.id) })) };
  yield { type: 'source', text: t('Según lo facturado a cada cliente este año') };
}

function* tasksAnswer() {
  const open = state.tasks.filter(task => !task.done && daysFromToday(task.due) <= 0).sort((a, b) => a.due.localeCompare(b.due));
  const late = open.filter(task => daysFromToday(task.due) < 0);
  yield { type: 'say', text: open.length
    ? t('Tienes {n} tareas para hoy o atrasadas; {late} vienen de días anteriores.', { n: open.length, late: late.length })
    : t('No tienes tareas para hoy ni atrasadas.') };
  if (open.length) {
    yield { type: 'list', items: open.slice(0, 8).map(task => ({
      title: task.text, detail: `${memberName(task.owner)} · ${daysFromToday(task.due) < 0 ? t('atrasada desde el {date}', { date: formatDate(task.due) }) : relativeDay(task.due)}`, href: SECTIONS.tasks.path
    })) };
  }
  yield { type: 'source', text: t('Según las tareas del equipo') };
}

function* collectionAnswer() {
  const r = collectionDays();
  yield { type: 'say', text: t('De media, tus clientes pagan {n} días después de emitir la factura.', { n: r.days }) };
  yield { type: 'figure', label: t('Plazo medio de cobro'), value: t('{n} días', { n: r.days }) };
  yield { type: 'source', text: t('Sobre {n} facturas cobradas en 90 días', { n: r.count }) };
}

function* pipelineAnswer() {
  const all = deals();
  const stages = Object.keys(STAGES).map(stage => ({ stage, list: all.filter(d => d.stage === stage) }));
  yield { type: 'say', text: t('Hay {n} oportunidades abiertas por {amount}.', { n: all.length, amount: moneyText(sum(all), 0) }) };
  yield { type: 'figure', label: t('Embudo abierto'), amount: sum(all) };
  yield { type: 'list', items: stages.map(({ stage, list }) => ({ title: t(STAGES[stage]), detail: t('{n} oportunidades', { n: list.length }), amount: sum(list), href: SECTIONS.sales.path })) };
  yield { type: 'source', text: t('Según el embudo de ventas') };
}

function* vatAnswer() {
  const q = quarterTaxes();
  yield { type: 'say', text: t('Este trimestre llevas {vat} de IVA repercutido sobre una base de {base}.', { vat: moneyText(q.vat), base: moneyText(q.base) }) };
  yield { type: 'figure', label: t('IVA repercutido T{q} {year}', { q: q.quarter, year: q.year }), amount: q.vat };
  yield { type: 'list', items: q.rows.map(r => ({ title: t('IVA {rate}', { rate: rate(r.rate) }), detail: t('Base {amount}', { amount: moneyText(r.base) }), amount: r.vat, href: SECTIONS.reports.path })) };
  yield { type: 'source', text: t('{n} facturas del trimestre, rectificativas incluidas', { n: q.count }) };
}

function* clientAnswer(context) {
  const c = clientById(context.clientId);
  const pending = invoices().filter(i => i.client === c.id && ['pending', 'overdue'].includes(invoiceStatus(i)));
  const open = deals().filter(d => d.client === c.id);
  yield { type: 'say', text: t('{name} ({status}) lleva facturado {amount}. Último contacto: {last}.', {
    name: c.name, status: t(STATUS[c.status][0]).toLocaleLowerCase(), amount: moneyText(clientBilled(c), 0), last: relativeDay(c.lastContact, true)
  }) + ' ' + (pending.length
    ? t('Tiene {n} facturas pendientes.', { n: pending.length })
    : t('No tiene facturas pendientes.')) + (open.length ? ' ' + t('Y {n} oportunidades abiertas por {amount}.', { n: open.length, amount: moneyText(sum(open), 0) }) : '') };
  yield { type: 'figure', label: t('Facturado'), amount: clientBilled(c) };
  if (pending.length) {
    yield { type: 'list', items: pending.map(i => ({ title: i.number, detail: t(invoiceStatus(i) === 'overdue' ? 'Vencida' : 'Pendiente'), amount: i.amount, href: invoicePath(i.number) })) };
  }
  yield { type: 'source', text: t('Según la ficha, las facturas y el embudo de {name}', { name: c.name }) };
}

// Palabras clave en español y en inglés. Gana la intención con más coincidencias; en empate, la primera.
const INTENTS = [
  { words: ['este cliente', 'resum', 'this client', 'summar'], needsClient: true, answer: clientAnswer },
  { words: ['tarda', 'tardan en pagar', 'plazo', 'how long', 'collection'], answer: collectionAnswer },
  { words: ['iva', '303', 'impuesto', 'vat', 'tax'], answer: vatAnswer },
  { words: ['objetivo', 'meta', 'llegamos', 'trimestre', 'target', 'goal', 'on track'], answer: goalAnswer },
  { words: ['embudo', 'oportunidad', 'pipeline', 'deal', 'negocia'], answer: pipelineAnswer },
  { words: ['riesgo', 'sin contacto', 'olvid', 'risk', 'neglect', 'contact'], answer: riskAnswer },
  { words: ['mejor', 'principales', 'mas factur', 'best', 'top', 'biggest'], answer: topAnswer },
  { words: ['tarea', 'hoy', 'agenda', 'task', 'today', 'to do'], answer: tasksAnswer },
  { words: ['debe', 'deben', 'cobr', 'pagad', 'pendiente', 'vencid', 'owe', 'unpaid', 'overdue', 'outstanding'], answer: pendingAnswer },
  { words: ['factur', 'ingres', 'vendid', 'invoic', 'billed', 'revenue', 'income'], answer: billedAnswer }
];

function pick(question, context) {
  const q = normalize(question);
  let best = null;
  let bestScore = 0;
  for (const intent of INTENTS) {
    if (intent.needsClient && !clientById(context.clientId)) continue;
    const score = intent.words.filter(word => q.includes(word)).length;
    if (score > bestScore) { best = intent; bestScore = score; }
  }
  return best;
}

export async function* demoProvider(question, context) {
  await wait(380); // el tiempo que tarda en «pensar»
  const intent = pick(question, context);
  if (!intent) {
    yield* say(t('Con los datos de la demo puedo responderte sobre facturación, cobros pendientes, el objetivo del trimestre, clientes en riesgo, tus mejores clientes, tareas, el embudo, el plazo de cobro y el IVA. Prueba a preguntarlo de otra forma.'));
    return;
  }
  for (const chunk of intent.answer(context)) {
    if (chunk.type === 'say') yield* say(chunk.text);
    else {
      await wait(90);
      yield chunk;
    }
  }
}

const SUGGESTIONS = {
  home: ['¿Cuánto he facturado este mes?', '¿Quién me debe dinero?', '¿Qué tareas tengo para hoy?'],
  clients: ['¿Qué clientes están en riesgo?', '¿Quiénes son mis mejores clientes?', '¿Quién me debe dinero?'],
  client: ['Resúmeme este cliente', '¿Quién me debe dinero?'],
  sales: ['¿Llegamos al objetivo del trimestre?', '¿Cómo está el embudo?'],
  tasks: ['¿Qué tareas tengo para hoy?', '¿Qué clientes están en riesgo?'],
  reports: ['¿Cuánto tardan en pagarme?', '¿Cuánto IVA llevo este trimestre?', '¿Cuánto he facturado este mes?']
};

export const suggestions = context => (SUGGESTIONS[context.page] ?? SUGGESTIONS.home).map(s => t(s));
