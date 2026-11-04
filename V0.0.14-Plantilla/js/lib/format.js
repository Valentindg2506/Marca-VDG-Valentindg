// Formato de importes, porcentajes y fechas según el idioma activo. Solo depende de i18n.
import { t, locale } from '../i18n/index.js';
import { startOfToday, parseDay, daysFromToday, DAY } from './dates.js';

const HIDDEN = '••••';
let masked = false;
// Con importes ocultos (al compartir pantalla) todas las cifras de dinero se sustituyen por puntos.
export const setMasked = value => { masked = Boolean(value); };

export const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1);
export const initials = name => name.split(/\s+/).filter(w => /^\p{L}/u.test(w)).slice(0, 2).map(w => w[0]).join('').toUpperCase();

const euro = (decimals = 2) => new Intl.NumberFormat(locale(), {
  style: 'currency', currency: 'EUR', minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: 'always'
});
export const moneyText = (n, decimals = 2) => (masked ? HIDDEN : euro(decimals).format(n));

// Importe con los céntimos atenuados.
export function money(n, decimals = 2) {
  if (masked) return `<span class="amount">${HIDDEN}</span>`;
  const parts = euro(decimals).formatToParts(n).map(p => [p.type, p.value]);
  const cut = parts.findIndex(([type]) => type === 'decimal');
  const join = list => list.map(([, value]) => value).join('');
  return cut < 0
    ? `<span class="amount">${join(parts)}</span>`
    : `<span class="amount">${join(parts.slice(0, cut))}<span class="cents">${join(parts.slice(cut))}</span></span>`;
}
export const signedMoney = n => `${n > 0 ? '+' : '−'}${money(Math.abs(n))}`;

export const percent = (ratio, signed = false) => new Intl.NumberFormat(locale(), {
  style: 'percent', maximumFractionDigits: 1, signDisplay: signed ? 'exceptZero' : 'auto'
}).format(ratio);
export const rate = n => new Intl.NumberFormat(locale(), { style: 'percent', maximumFractionDigits: 1 }).format(n / 100);
export const compact = n => (masked ? '••' : new Intl.NumberFormat(locale(), { notation: 'compact', maximumFractionDigits: 0 }).format(n));
export const number = n => new Intl.NumberFormat(locale()).format(n);

export const formatDate = (s, options = { day: 'numeric', month: 'short' }) => parseDay(s).toLocaleDateString(locale(), options);
export const longDate = s => formatDate(s, { day: 'numeric', month: 'long', year: 'numeric' });

// En mitad de una frase («cobrada ayer») se pide en minúscula.
export function relativeDay(s, midSentence = false) {
  const word = { 0: 'Hoy', 1: 'Mañana', '-1': 'Ayer' }[daysFromToday(s)];
  if (!word) return formatDate(s);
  return midSentence ? t(word).toLocaleLowerCase(locale()) : t(word);
}
export const dayAndTime = (date, time) => `${relativeDay(date)}, ${time}`;

export function monthLabel(offset) {
  const d = startOfToday();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return d.toLocaleDateString(locale(), { month: 'short' });
}

export function quarter() {
  const today = startOfToday();
  const q = Math.floor(today.getMonth() / 3);
  const end = new Date(today.getFullYear(), q * 3 + 3, 0);
  return { label: `T${q + 1} ${today.getFullYear()}`, daysLeft: Math.round((end - today) / DAY) };
}
