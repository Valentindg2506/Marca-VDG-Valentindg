// Validación de identificadores españoles (NIF, NIE, CIF), IBAN y provincias por código postal. Sin dependencias.

const DNI_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE';
const CIF_LETTERS = 'JABCDEFGHI';

export const normalize = value => String(value ?? '').toUpperCase().replace(/[\s.\-/]/g, '');

const dniLetterOk = (digits, letter) => DNI_LETTERS[Number(digits) % 23] === letter;

// Devuelve { valid, type: 'dni' | 'nie' | 'cif' | null, value }.
export function checkTaxId(raw) {
  const value = normalize(raw);
  let match = value.match(/^(\d{8})([A-Z])$/);
  if (match) return { valid: dniLetterOk(match[1], match[2]), type: 'dni', value };
  match = value.match(/^([XYZ])(\d{7})([A-Z])$/);
  if (match) return { valid: dniLetterOk('XYZ'.indexOf(match[1]) + match[2], match[3]), type: 'nie', value };
  match = value.match(/^([ABCDEFGHJNPQRSUVW])(\d{7})([0-9A-J])$/);
  if (match) {
    const [, letter, digits, control] = match;
    const d = [...digits].map(Number);
    const even = d[1] + d[3] + d[5];
    const odd = [d[0], d[2], d[4], d[6]].reduce((total, n) => total + Math.floor(n * 2 / 10) + (n * 2) % 10, 0);
    const check = (10 - (even + odd) % 10) % 10;
    // Las entidades sin ánimo de lucro y extranjeras llevan letra; las sociedades, número.
    const expected = 'NPQRSW'.includes(letter) ? [CIF_LETTERS[check]]
      : 'ABEH'.includes(letter) ? [String(check)]
      : [String(check), CIF_LETTERS[check]];
    return { valid: expected.includes(control), type: 'cif', value };
  }
  return { valid: false, type: null, value };
}

// Comprobación mod 97 (ISO 13616). Para cuentas españolas exige además 24 caracteres.
export function checkIban(raw) {
  const value = normalize(raw);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(value) || (value.startsWith('ES') && value.length !== 24)) return { valid: false, value };
  const digits = (value.slice(4) + value.slice(0, 4)).replace(/[A-Z]/g, ch => String(ch.charCodeAt(0) - 55));
  const remainder = digits.match(/\d{1,7}/g).reduce((rest, chunk) => Number(String(rest) + chunk) % 97, 0);
  return { valid: remainder === 1, value };
}

export const formatIban = value => normalize(value).replace(/(.{4})(?=.)/g, '$1 ');

export const PROVINCES = {
  '01': 'Araba/Álava', '02': 'Albacete', '03': 'Alicante/Alacant', '04': 'Almería', '05': 'Ávila', '06': 'Badajoz',
  '07': 'Illes Balears', '08': 'Barcelona', '09': 'Burgos', '10': 'Cáceres', '11': 'Cádiz', '12': 'Castellón/Castelló',
  '13': 'Ciudad Real', '14': 'Córdoba', '15': 'A Coruña', '16': 'Cuenca', '17': 'Girona', '18': 'Granada',
  '19': 'Guadalajara', '20': 'Gipuzkoa', '21': 'Huelva', '22': 'Huesca', '23': 'Jaén', '24': 'León',
  '25': 'Lleida', '26': 'La Rioja', '27': 'Lugo', '28': 'Madrid', '29': 'Málaga', '30': 'Murcia',
  '31': 'Navarra', '32': 'Ourense', '33': 'Asturias', '34': 'Palencia', '35': 'Las Palmas', '36': 'Pontevedra',
  '37': 'Salamanca', '38': 'Santa Cruz de Tenerife', '39': 'Cantabria', '40': 'Segovia', '41': 'Sevilla', '42': 'Soria',
  '43': 'Tarragona', '44': 'Teruel', '45': 'Toledo', '46': 'Valencia/València', '47': 'Valladolid', '48': 'Bizkaia',
  '49': 'Zamora', '50': 'Zaragoza', '51': 'Ceuta', '52': 'Melilla'
};

export const provinceFromPostcode = postcode => (/^\d{5}$/.test(postcode ?? '') ? PROVINCES[postcode.slice(0, 2)] ?? null : null);

// Canarias, Ceuta y Melilla quedan fuera del territorio de aplicación del IVA.
export const outsideVatTerritory = postcode => /^(35|38|51|52)\d{3}$/.test(postcode ?? '');
