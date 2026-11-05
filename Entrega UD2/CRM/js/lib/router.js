// Rutas en el hash (#/clientes/arrieta?estado=risk) para que funcionen sin configurar el servidor. Sin dependencias.

// routes: [[RegExp, nombre], …]. Devuelve { page, param, query } o { page: 'notFound' }.
export function matchRoute(routes, hash = location.hash) {
  const [path = '', search = ''] = hash.replace(/^#\/?/, '').split('?');
  const clean = path.replace(/\/$/, '');
  const query = Object.fromEntries(new URLSearchParams(search));
  for (const [pattern, page] of routes) {
    const match = clean.match(pattern);
    if (match) return { page, param: match[1] && decodeURIComponent(match[1]), query };
  }
  return { page: 'notFound', param: clean, query };
}

export const pathOf = hash => hash.split('?')[0] || '#/';

export function withQuery(path, query) {
  const search = new URLSearchParams(Object.entries(query).filter(([, v]) => v !== '' && v != null)).toString();
  return search ? `${path}?${search}` : path;
}
