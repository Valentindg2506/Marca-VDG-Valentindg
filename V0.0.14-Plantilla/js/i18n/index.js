/* Textos de la interfaz. El texto fuente es el español; en.js tiene la traducción al inglés.
   Plurales: «singular|plural», elegido según {n}. Variables: {nombre}. Los datos (nombres, conceptos, notas) no se traducen.
   No depende del resto de la app: se puede llevar a otro proyecto junto con su diccionario. */
import { en } from './en.js';

const DICTIONARIES = { en };
const LOCALES = { es: 'es-ES', en: 'en-GB' };
let language = 'es';

export const setLanguage = code => { language = LOCALES[code] ? code : 'es'; };
export const locale = () => LOCALES[language];

export function t(text, params = {}) {
  let result = DICTIONARIES[language]?.[text] ?? text;
  if (result.includes('|')) result = result.split('|')[params.n === 1 ? 0 : 1];
  return result.replace(/\{(\w+)\}/g, (match, key) => (key in params ? params[key] : match));
}
