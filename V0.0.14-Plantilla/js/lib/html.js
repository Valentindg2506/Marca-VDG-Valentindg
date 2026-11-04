// Plantillas HTML con escape. Sin dependencias.
export const safe = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

// Las plantillas pueden ocupar varias líneas: se descartan saltos e indentación y se unen los arrays.
export const html = (strings, ...values) => strings.reduce((out, str, i) => {
  const value = i ? values[i - 1] : '';
  return out + (Array.isArray(value) ? value.join('') : value ?? '') + str.replace(/\n\s*/g, '');
}, '');
