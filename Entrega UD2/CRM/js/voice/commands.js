/* Gramática de los comandos de voz. Convierte una frase en una orden: { type, ...datos }.
   Función pura (sin DOM ni estado): se prueba en tests/voice.test.mjs y la usa components/voice.js.
   Entiende español e inglés a la vez: se puede hablar en cualquiera de los dos sin cambiar el idioma.

   La frase se limpia (signos fuera, minúsculas, sin tildes) para compararla, pero los textos que se
   extraen (una tarea, una búsqueda, una pregunta) se recortan de la frase original, con sus tildes. */

// Quita signos y espacios de más sin cambiar el texto en sí.
const tidy = s => s.replace(/[¿?¡!.,;:"«»]/g, ' ').replace(/\s+/g, ' ').trim();
// Minúsculas y sin tildes, letra a letra, para que las posiciones coincidan con el texto original.
export const fold = s => [...s.toLowerCase()].map(c => c.normalize('NFD')[0]).join('');

export const SECTION_WORDS = {
  home: ['inicio', 'portada', 'principal', 'panel', 'escritorio', 'home', 'dashboard', 'start'],
  clients: ['clientes', 'cartera', 'clients', 'customers'],
  sales: ['ventas', 'embudo', 'oportunidades', 'sales', 'pipeline', 'deals'],
  tasks: ['tareas', 'agenda', 'pendientes', 'tasks', 'to do', 'todo'],
  reports: ['informes', 'informe', 'estadisticas', 'reports', 'report', 'analytics'],
  settings: ['ajustes', 'configuracion', 'preferencias', 'opciones', 'settings', 'preferences', 'options']
};

const GO_VERBS = /^(?:(?:por favor|please) )?(?:quiero (?:ir|ver)|llevame|vamos|volver|vuelve|regresa|ir|ve|vete|abre|abrir|abreme|muestra|mostrar|muestrame|ensename|ver|pon|go(?: to)?|take me to|open|show(?: me)?|navigate to)\b ?/;
const ARTICLES = /^(?:(?:a|al|a la|a los|a las|to|the|el|la|los|las|mis|my)\b ?)+/;
const PAGE_WORDS = /^(?:(?:pagina|seccion|pantalla|page|section|screen)(?: de| del| of)? ?)/;

function sectionOf(rest) {
  const clean = rest.replace(ARTICLES, '').replace(PAGE_WORDS, '').replace(ARTICLES, '').trim();
  return Object.keys(SECTION_WORDS).find(id => SECTION_WORDS[id].includes(clean)) ?? null;
}

const WEEKDAYS = { lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6, domingo: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 0 };
const NUMBERS = { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, one: 1, a: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };

// Cuándo vence una tarea dicha en voz alta. Devuelve los días desde hoy y dónde empieza la fecha en la frase.
export function parseWhen(folded, today = new Date()) {
  const rules = [
    [/(?:^| )(?:para |el |on |for )?(?:pasado manana|day after tomorrow)$/, () => 2],
    [/(?:^| )(?:para |for )?(?:manana|tomorrow)$/, () => 1],
    [/(?:^| )(?:para |for )?(?:hoy|today|esta tarde|this afternoon|tonight)$/, () => 0],
    [/(?:^| )(?:dentro de |en |in )(\d+|\w+) (?:dias?|days?)$/, m => Number(m[1]) || NUMBERS[m[1]] || null],
    [/(?:^| )(?:para |el |this |next |on )?(?:la )?(?:semana que viene|proxima semana|next week)$/, () => 7],
    [/(?:^| )(?:para |el |este |el proximo |next |on |this )?(lunes|martes|miercoles|jueves|viernes|sabado|domingo|monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?: que viene)?$/, m => {
      const diff = (WEEKDAYS[m[1]] - today.getDay() + 7) % 7;
      return diff === 0 ? 7 : diff;
    }]
  ];
  for (const [pattern, days] of rules) {
    const match = folded.match(pattern);
    const value = match && days(match);
    if (match && value !== null && value !== undefined) return { days: value, index: match.index };
  }
  return { days: 0, index: folded.length };
}

const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1);

// Cliente cuyo nombre se parece más a lo dicho (todas o casi todas las palabras coinciden).
export function matchClient(query, clients) {
  const words = fold(query).split(' ').filter(w => w.length > 2 && !['del', 'los', 'las', 'the', 'cliente', 'client', 'ficha'].includes(w));
  if (!words.length) return null;
  let best = null;
  for (const client of clients) {
    const name = fold(client.name).replace(/[^a-z0-9 ]/g, ' ');
    const hits = words.filter(w => name.split(' ').some(part => part.startsWith(w) || w.startsWith(part) && part.length > 3)).length;
    const score = hits / words.length;
    if (score > (best?.score ?? 0)) best = { client, score };
  }
  return best && best.score >= 0.5 ? best.client : null;
}

const RULES = [
  // Control de la escucha y de la interfaz
  [/^(?:para|parar|para de escuchar|deja de escuchar|silencio|basta|callate|stop|stop listening|be quiet)$/, () => ({ type: 'stop' })],
  [/^(?:ayuda|que puedo decir|que comandos hay|comandos(?: de voz)?|lista de comandos|help|what can i say|voice commands|commands)$/, () => ({ type: 'help' })],
  [/^(?:cierra|cerrar|cancela|cancelar|salir|sal|close|cancel|exit|dismiss)(?: (?:esto|eso|la ventana|el dialogo|el asistente|this|that|the window|the assistant))?$/, () => ({ type: 'close' })],
  [/^(?:atras|vuelve|volver|vuelve atras|regresa|go back|back)$/, () => ({ type: 'back' })],

  // Preferencias
  [/^(?:(?:activa|pon|poner|cambia a|cambiar a|switch to|turn on|enable) )?(?:el )?(?:modo|tema) (?:oscuro|noche|nocturno)$|^(?:apaga la luz|oscurece|dark (?:mode|theme)|(?:switch to|turn on) dark mode|lights off)$/, () => ({ type: 'theme', value: 'dark' })],
  [/^(?:(?:activa|pon|poner|cambia a|cambiar a|switch to|turn on|enable) )?(?:el )?(?:modo|tema) (?:claro|dia|diurno)$|^(?:enciende la luz|light (?:mode|theme)|(?:switch to|turn on) light mode|lights on)$/, () => ({ type: 'theme', value: 'light' })],
  [/^(?:cambia(?:r)? (?:el )?tema|toggle (?:the )?theme|change (?:the )?theme)$/, () => ({ type: 'theme', value: 'toggle' })],
  [/^(?:oculta(?:r)?|esconde(?:r)?|tapa(?:r)?|hide)(?: (?:los|las|the))? (?:importes|cifras|cantidades|numeros|amounts|figures|numbers)$|^(?:modo (?:privado|privacidad)|privacy mode)$/, () => ({ type: 'privacy', value: true })],
  [/^(?:muestra(?:r)?|ensena(?:r)?|ver|show)(?: (?:los|las|the))? (?:importes|cifras|cantidades|numeros|amounts|figures|numbers)$/, () => ({ type: 'privacy', value: false })],
  [/^(?:(?:cambia(?:r)?(?: el idioma)?(?: a| al)?|pon(?:lo|er)?(?: en)?|habla(?: en)?|en|switch to|change (?:the )?language to|speak|in) )?(?:ingles|english)$/, () => ({ type: 'language', code: 'en' })],
  [/^(?:(?:cambia(?:r)?(?: el idioma)?(?: a| al)?|pon(?:lo|er)?(?: en)?|habla(?: en)?|en|switch to|change (?:the )?language to|speak|in) )?(?:espanol|castellano|spanish)$/, () => ({ type: 'language', code: 'es' })],

  // Altas y ventanas
  [/^(?:(?:crea(?:r)?|anade|anadir|nuevo|nueva|dar de alta|da de alta|alta de|add|create|new)(?: un| una| a| an)? )?(?:nuevo )?(?:cliente|client|customer)$|^(?:nuevo cliente|new client)$/, () => ({ type: 'modal', id: 'new-client' })],
  [/^(?:(?:crea(?:r)?|haz|hacer|emite|emitir|nueva|add|create|new|issue)(?: un| una| a| an)? )(?:nueva )?(?:factura|invoice)$/, () => ({ type: 'modal', id: 'new-invoice' })],
  [/^(?:registra(?:r)?|apunta(?:r)?|anota(?:r)?|nuevo|record|log|new)(?: un| una| a)? (?:cobro|pago|payment)$/, () => ({ type: 'modal', id: 'payment' })],
  [/^(?:(?:crea(?:r)?|anade|anadir|nueva|apunta|add|create|new)(?: un| una| a)? )(?:nueva )?(?:tarea|task|recordatorio|reminder)$/, () => ({ type: 'modal', id: 'new-task' })],
  [/^(?:(?:ver|muestra(?:me)?|abre) )?(?:los )?atajos(?: de teclado)?$|^(?:show )?(?:keyboard )?shortcuts$/, () => ({ type: 'modal', id: 'shortcuts' })],

  // Tareas dictadas de una vez: «recuérdame llamar a Clínica Norte mañana»
  [/^(?:(?:crea(?:r)?|anade|anadir|apunta|apuntame|nueva|add|create|new)(?: una| un| a)? (?:tarea|task|recordatorio|reminder)(?: de| para| que| to|:)?|recuerdame(?: que)?|remind me to) (.+)$/, (m, original, folded) => {
    const start = m.index + m[0].length - m[1].length;
    const tail = folded.slice(start);
    const when = parseWhen(tail);
    const text = original.slice(start, start + when.index).trim().replace(/ (?:para|for|el|on)$/i, '');
    return text ? { type: 'create-task', text: capitalize(text), days: when.days } : { type: 'modal', id: 'new-task' };
  }],

  // Datos
  [/^(?:que tengo(?: para)? hoy|que hay(?: para)? hoy|mi dia|como va (?:el|mi) dia|resumen(?: del?)? (?:hoy|dia)|what(?:s| is) on today|my day|today'?s summary)$/, () => ({ type: 'today' })],
  [/^(?:exporta(?:r)?|descarga(?:r)?|export|download)(?: (?:los|las|el|the))? (?:clientes|cartera|clients|customers)$/, () => ({ type: 'export-clients' })],
  [/^(?:exporta(?:r)?|descarga(?:r)?|export|download)(?: (?:el|the))? (?:informe|report)$/, () => ({ type: 'export-report' })],
  [/^(?:imprime(?:lo)?|imprimir|print(?: this)?)$/, () => ({ type: 'print' })],
  [/^(?:busca(?:r|me)?|encuentra|localiza|search(?: for)?|find|look for|look up) (.+)$/, (m, original) => ({ type: 'search', query: original.slice(original.length - m[1].length) })],

  // Asistente
  [/^(?:(?:abre|abrir|muestra|open|show) )?(?:el |the )?(?:asistente|assistant)$/, () => ({ type: 'assistant' })],
  [/^(?:pregunta(?:le)?(?: al asistente)?|oye asistente|asistente|ask(?: the assistant)?|hey assistant|assistant) (.+)$/, (m, original) => ({ type: 'ask', question: original.slice(original.length - m[1].length) })]
];

const QUESTION = /^(?:cuanto|cuanta|cuantos|cuantas|que|quien|quienes|cual|cuales|como|cuando|donde|hay|tengo|how|what|whats|who|which|when|where|is|are|do|does|did|have)\b/;

export function parseCommand(input, { clients = [] } = {}) {
  const original = tidy(String(input ?? ''));
  const folded = fold(original);
  if (!folded) return { type: 'empty' };

  for (const [pattern, build] of RULES) {
    const match = folded.match(pattern);
    if (match) return build(match, original, folded);
  }

  // Ir a una sección: «ir a clientes», «abre los informes», o solo «ventas».
  const verb = folded.match(GO_VERBS);
  const rest = verb ? folded.slice(verb[0].length) : folded;
  const section = sectionOf(rest);
  if (section) return { type: 'go', section };

  // Abrir la ficha de un cliente: «abre Talleres Arrieta», «ficha de Clínica Norte»
  const lead = rest.match(/^(?:(?:a |al |la |the )?(?:ficha|cliente|client|customer)(?: del?| of)? )?/)[0];
  const query = original.slice(folded.length - rest.length + lead.length).trim();
  if ((verb || lead) && query) {
    const client = matchClient(query, clients);
    if (client) return { type: 'open-client', id: client.id, name: client.name };
    return { type: 'search', query };
  }
  // Solo el nombre: «Talleres Arrieta». Se exige que empiece igual para no confundirlo con otra frase.
  const client = matchClient(original, clients);
  if (client && fold(client.name).startsWith(folded.split(' ')[0])) return { type: 'open-client', id: client.id, name: client.name };

  if (QUESTION.test(folded)) return { type: 'ask', question: original };
  return { type: 'unknown', text: original };
}

// Lista que se enseña en la ayuda (y en Ajustes). Agrupada para leerla de un vistazo.
export const COMMAND_HELP = [
  ['Navegar', ['«Ir a clientes», «abre ventas», «informes»', '«Abre Talleres Arrieta» (ficha de un cliente)', '«Atrás»']],
  ['Crear', ['«Nuevo cliente», «nueva factura», «registrar cobro»', '«Recuérdame llamar a Clínica Norte mañana»', '«Crea una tarea revisar la propuesta el viernes»']],
  ['Buscar y preguntar', ['«Busca Valencia»', '«¿Cuánto hemos facturado este mes?»', '«Pregunta al asistente quién debe más»', '«¿Qué tengo hoy?» (te lo lee en voz alta)']],
  ['Preferencias', ['«Modo oscuro», «modo claro»', '«Oculta los importes», «muestra los importes»', '«En inglés», «en español»']],
  ['Control', ['«Cerrar», «para de escuchar», «ayuda»', 'Dictado: «punto», «coma», «nueva línea», «borrar todo», «terminar dictado»']]
];
