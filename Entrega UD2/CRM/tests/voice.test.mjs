// Pruebas unitarias de la gramática de voz y del dictado (sin navegador).
//   node --test tests/voice.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCommand, parseWhen, matchClient } from '../js/voice/commands.js';
import { punctuate, insertDictation, dictationControl, deleteLastWord } from '../js/voice/dictation.js';

const clients = [
  { id: 'arrieta', name: 'Talleres Arrieta S.L.' },
  { id: 'norte', name: 'Clínica Dental Norte' },
  { id: 'turia', name: 'Distribuciones Turia' }
];
const cmd = text => parseCommand(text, { clients });

test('navegación por secciones en español e inglés', () => {
  assert.deepEqual(cmd('Ir a clientes'), { type: 'go', section: 'clients' });
  assert.deepEqual(cmd('abre las ventas'), { type: 'go', section: 'sales' });
  assert.deepEqual(cmd('informes'), { type: 'go', section: 'reports' });
  assert.deepEqual(cmd('Llévame a la página de ajustes'), { type: 'go', section: 'settings' });
  assert.deepEqual(cmd('go to tasks'), { type: 'go', section: 'tasks' });
  assert.deepEqual(cmd('Volver al inicio'), { type: 'go', section: 'home' });
  assert.equal(cmd('atrás').type, 'back');
});

test('altas y ventanas', () => {
  assert.deepEqual(cmd('Nuevo cliente'), { type: 'modal', id: 'new-client' });
  assert.deepEqual(cmd('crea una factura'), { type: 'modal', id: 'new-invoice' });
  assert.deepEqual(cmd('Registrar cobro'), { type: 'modal', id: 'payment' });
  assert.deepEqual(cmd('nueva tarea'), { type: 'modal', id: 'new-task' });
  assert.deepEqual(cmd('new invoice'), { type: 'modal', id: 'new-invoice' });
});

test('tareas dictadas con fecha', () => {
  assert.deepEqual(cmd('Recuérdame llamar a Clínica Norte mañana'), { type: 'create-task', text: 'Llamar a Clínica Norte', days: 1 });
  assert.deepEqual(cmd('crea una tarea revisar la propuesta pasado mañana'), { type: 'create-task', text: 'Revisar la propuesta', days: 2 });
  assert.deepEqual(cmd('Añade una tarea preparar el informe'), { type: 'create-task', text: 'Preparar el informe', days: 0 });
  assert.deepEqual(cmd('remind me to send the quote in 3 days'), { type: 'create-task', text: 'Send the quote', days: 3 });
  const friday = parseWhen('el viernes', new Date(2026, 10, 5)); // jueves
  assert.equal(friday.days, 1);
});

test('preferencias', () => {
  assert.deepEqual(cmd('Modo oscuro'), { type: 'theme', value: 'dark' });
  assert.deepEqual(cmd('activa el modo claro'), { type: 'theme', value: 'light' });
  assert.deepEqual(cmd('Oculta los importes'), { type: 'privacy', value: true });
  assert.deepEqual(cmd('show amounts'), { type: 'privacy', value: false });
  assert.deepEqual(cmd('en inglés'), { type: 'language', code: 'en' });
  assert.deepEqual(cmd('Spanish'), { type: 'language', code: 'es' });
});

test('clientes, búsqueda y asistente', () => {
  assert.deepEqual(cmd('Abre Talleres Arrieta'), { type: 'open-client', id: 'arrieta', name: 'Talleres Arrieta S.L.' });
  assert.equal(cmd('ficha de clínica norte').id, 'norte');
  assert.equal(cmd('Distribuciones Turia').id, 'turia');
  assert.deepEqual(cmd('Busca Valencia'), { type: 'search', query: 'Valencia' });
  assert.deepEqual(cmd('¿Cuánto hemos facturado este mes?'), { type: 'ask', question: 'Cuánto hemos facturado este mes' });
  assert.deepEqual(cmd('pregunta al asistente quién debe más'), { type: 'ask', question: 'quién debe más' });
  assert.equal(cmd('¿Qué tengo hoy?').type, 'today');
  assert.equal(matchClient('ferretería', clients), null);
});

test('control y frases sin sentido', () => {
  assert.equal(cmd('para de escuchar').type, 'stop');
  assert.equal(cmd('cerrar').type, 'close');
  assert.equal(cmd('¿qué puedo decir?').type, 'help');
  assert.equal(cmd('plátano azul').type, 'unknown');
  assert.equal(cmd('   ').type, 'empty');
});

test('puntuación dictada', () => {
  assert.equal(punctuate('hola coma qué tal signo de interrogación'), 'hola, qué tal?');
  assert.equal(punctuate('abre interrogación vienes mañana cierra interrogación'), '¿vienes mañana?');
  assert.equal(punctuate('primero punto y coma segundo punto'), 'primero; segundo.');
  assert.equal(punctuate('línea uno nueva línea línea dos'), 'línea uno\nlínea dos');
  assert.equal(punctuate('Quieren 12 licencias'), 'Quieren 12 licencias');
});

test('inserción en el campo con espacios y mayúsculas', () => {
  assert.deepEqual(insertDictation('', 0, 0, 'llamar mañana punto'), { value: 'Llamar mañana.', caret: 14 });
  assert.equal(insertDictation('Llamar mañana.', 14, 14, 'pedir presupuesto').value, 'Llamar mañana. Pedir presupuesto');
  assert.equal(insertDictation('Hola', 4, 4, 'coma Ane').value, 'Hola, Ane');
  assert.equal(insertDictation('Antes después', 5, 5, 'y').value, 'Antes y después');
  assert.equal(insertDictation('Primera línea', 13, 13, 'nueva línea segunda').value, 'Primera línea\nSegunda');
  assert.equal(dictationControl('Terminar dictado.'), 'stop');
  assert.equal(dictationControl('borrar todo'), 'clear');
  assert.equal(dictationControl('hola'), null);
  assert.equal(deleteLastWord('uno dos tres'), 'uno dos');
});
