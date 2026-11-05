/* Dictado: convierte la puntuación dicha («coma», «punto», «nueva línea») en signos y coloca cada frase
   en el campo donde está el cursor, con espacios y mayúsculas correctos. Funciones puras: se prueban en
   tests/voice.test.mjs y no tocan el DOM. */
import { fold } from './commands.js';

// Órdenes que no se escriben: se ejecutan. Se reconocen solo si son la frase entera.
const CONTROLS = [
  [/^(?:terminar|termina|fin del|acabar|para el|parar el|deja de) dictado$|^(?:deja de dictar|stop dictation|end dictation|stop dictating)$/, 'stop'],
  [/^(?:borra(?:r)?|limpia(?:r)?) todo$|^(?:clear all|delete all|clear everything)$/, 'clear'],
  [/^(?:borra(?:r)?|quita(?:r)?) (?:la )?ultima palabra$|^(?:delete|remove) (?:the )?last word$/, 'delete-word'],
  [/^(?:enviar|envia(?:lo)?|guardar|guarda(?:lo)?|send(?: it)?|save(?: it)?)$/, 'submit']
];

// De más largo a más corto para que «punto y coma» gane a «punto».
const MARKS = [
  ['punto y aparte', '.\n'], ['punto y seguido', '.'], ['punto y coma', ';'], ['puntos suspensivos', '…'],
  ['nueva linea', '\n'], ['salto de linea', '\n'], ['nuevo parrafo', '\n'], ['new paragraph', '\n'], ['new line', '\n'],
  ['abre interrogacion', '¿'], ['cierra interrogacion', '?'], ['signo de interrogacion', '?'], ['question mark', '?'],
  ['abre exclamacion', '¡'], ['cierra exclamacion', '!'], ['signo de exclamacion', '!'], ['exclamation mark', '!'],
  ['abre parentesis', '('], ['cierra parentesis', ')'],
  ['dos puntos', ':'], ['full stop', '.'], ['semicolon', ';'], ['colon', ':'], ['period', '.'], ['comma', ','],
  ['punto', '.'], ['coma', ','], ['guion', '-'], ['arroba', '@']
];

export function dictationControl(phrase) {
  const folded = fold(phrase.trim().replace(/[.,!?¡¿]/g, ''));
  return CONTROLS.find(([pattern]) => pattern.test(folded))?.[1] ?? null;
}

// Cambia las palabras de puntuación por sus signos respetando el resto del texto tal cual se dijo.
export function punctuate(phrase) {
  let text = ` ${phrase.trim()} `;
  for (const [words, mark] of MARKS) {
    let folded = fold(text);
    const needle = ` ${words} `;
    for (let at = folded.indexOf(needle); at >= 0; at = folded.indexOf(needle)) {
      text = `${text.slice(0, at)} \u0000${mark}\u0000 ${text.slice(at + needle.length)}`;
      folded = fold(text);
    }
  }
  return text
    .replace(/\s*\u0000([.,;:?!…)\n]+)\u0000\s*/g, (m, mark) => (mark.endsWith('\n') ? mark : `${mark} `)) // pegados a la palabra anterior
    .replace(/\s*\u0000([¿¡(])\u0000\s*/g, ' $1') // pegados a la palabra siguiente
    .replace(/\u0000(.)\u0000/g, '$1')
    .replace(/ +/g, ' ')
    .replace(/ \n/g, '\n')
    .replace(/^ +| +$/g, ''); // sin trim(): un salto de línea dictado al principio se conserva
}

const endsSentence = before => before.trim() === '' || /[.?!…]\s*$|\n\s*$/.test(before);

// Inserta una frase en value entre start y end. Devuelve el texto nuevo y dónde queda el cursor.
export function insertDictation(value, start, end, phrase) {
  let piece = punctuate(phrase);
  if (!piece) return { value, caret: end };
  const before = value.slice(0, start);
  const after = value.slice(end);
  if (endsSentence(before)) piece = piece.charAt(0).toLocaleUpperCase() + piece.slice(1);
  // Mayúscula también tras un punto dictado dentro de la misma frase.
  piece = piece.replace(/([.?!…]\s+|\n)(\p{Ll})/gu, (m, gap, letter) => gap + letter.toLocaleUpperCase());
  const needsSpace = before && !/[\s¿¡(]$/.test(before) && !/^[.,;:?!…)\n]/.test(piece);
  const spaced = `${needsSpace ? ' ' : ''}${piece}${after && !/^[\s.,;:?!)]/.test(after) ? ' ' : ''}`;
  return { value: before + spaced + after, caret: before.length + spaced.length };
}

export function deleteLastWord(value) {
  return value.replace(/\s*\S+\s*$/, '');
}
