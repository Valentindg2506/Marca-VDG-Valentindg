// Secciones y rutas de esta aplicación. Para añadir una página: su ruta aquí y su render en PAGES (main.js).
import { matchRoute } from './lib/router.js';

export const SECTIONS = {
  home: { path: '#/', label: 'Inicio', icon: 'layout-dashboard' },
  clients: { path: '#/clientes', label: 'Clientes', icon: 'users' },
  sales: { path: '#/ventas', label: 'Ventas', icon: 'target' },
  tasks: { path: '#/tareas', label: 'Tareas', icon: 'calendar-days' },
  reports: { path: '#/informes', label: 'Informes', icon: 'chart-no-axes-column' },
  settings: { path: '#/ajustes', label: 'Ajustes', icon: 'settings' }
};

const ROUTES = [
  [/^$/, 'home'], [/^clientes$/, 'clients'], [/^clientes\/([^/]+)$/, 'client'], [/^ventas$/, 'sales'],
  [/^tareas$/, 'tasks'], [/^informes$/, 'reports'], [/^ajustes$/, 'settings'], [/^facturas\/([^/]+)$/, 'invoice']
];
// Sección del menú que se marca como activa en cada página.
const PARENT = { client: 'clients', invoice: 'clients', notFound: null };

export function currentRoute() {
  const route = matchRoute(ROUTES);
  return { ...route, section: route.page in PARENT ? PARENT[route.page] : route.page };
}

export const clientPath = id => `#/clientes/${encodeURIComponent(id)}`;
export const invoicePath = number => `#/facturas/${encodeURIComponent(number)}`;
