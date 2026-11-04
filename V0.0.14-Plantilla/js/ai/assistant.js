// Asistente: el único punto que cambia entre la plantilla y un CRM real.
//
// ask(pregunta, contexto) devuelve los trozos de la respuesta según van llegando. Cada trozo es un objeto:
//   { type: 'text',   text }                                   texto (se va sumando al anterior)
//   { type: 'figure', label, amount | value, note }            cifra destacada (amount en euros, value ya escrito)
//   { type: 'chart',  label, values, labels }                  minigráfico de barras
//   { type: 'list',   items: [{ title, detail, amount, href }] } filas; href solo puede ser una ruta interna (#/…)
//   { type: 'source', text }                                   de dónde sale el dato
// El contexto dice dónde está el usuario: { page, clientId, language }.
//
// La plantilla responde con demoProvider, que calcula las respuestas con los datos de la demo.
// En un CRM real, cambia la línea de PROVIDER por remoteProvider: tu servidor recibe la pregunta, llama al modelo
// (por ejemplo Claude) con la clave guardada allí y devuelve los mismos trozos. La clave nunca va en el navegador.
import { demoProvider, suggestions as demoSuggestions } from './demo.js';
// import { remoteProvider } from './remote.js';

const PROVIDER = demoProvider;
// const PROVIDER = (question, context) => remoteProvider(question, context, { endpoint: '/api/assistant' });

const TYPES = ['text', 'figure', 'chart', 'list', 'source'];
const internal = href => (typeof href === 'string' && href.startsWith('#/') ? href : null);
const text = value => (typeof value === 'string' ? value.slice(0, 2000) : '');
const amount = value => (Number.isFinite(value) ? value : null);

// Lo que llega del proveedor se filtra: solo tipos conocidos, textos acotados y enlaces internos.
// Con un modelo detrás, esto evita que una respuesta inesperada rompa la interfaz o meta enlaces externos.
function clean(chunk) {
  if (!chunk || !TYPES.includes(chunk.type)) return null;
  switch (chunk.type) {
    case 'text': return { type: 'text', text: text(chunk.text) };
    case 'source': return { type: 'source', text: text(chunk.text) };
    case 'figure': return { type: 'figure', label: text(chunk.label), amount: amount(chunk.amount), value: text(chunk.value), note: text(chunk.note) };
    case 'chart': {
      const values = Array.isArray(chunk.values) ? chunk.values.filter(Number.isFinite).slice(0, 24) : [];
      return values.length ? { type: 'chart', label: text(chunk.label), values, labels: (chunk.labels ?? []).map(text).slice(0, values.length) } : null;
    }
    case 'list': {
      const items = (Array.isArray(chunk.items) ? chunk.items : []).slice(0, 12)
        .map(item => ({ title: text(item?.title), detail: text(item?.detail), amount: amount(item?.amount), href: internal(item?.href) }))
        .filter(item => item.title);
      return items.length ? { type: 'list', items } : null;
    }
  }
}

export async function* ask(question, context) {
  for await (const chunk of PROVIDER(question, context)) {
    const safeChunk = clean(chunk);
    if (safeChunk) yield safeChunk;
  }
}

// Preguntas sugeridas al abrir el chat, según la página.
export const suggestions = context => demoSuggestions(context);
