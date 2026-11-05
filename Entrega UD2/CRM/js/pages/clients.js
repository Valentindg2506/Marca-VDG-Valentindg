// Lista de clientes: búsqueda, filtros, orden, paginación, selección múltiple y columnas visibles.
// Filtros, orden y página van en la URL; la selección y las columnas, en el estado.
import { state } from '../data/state.js';
import { t } from '../i18n/index.js';
import { html, safe } from '../lib/html.js';
import { money, relativeDay, initials } from '../lib/format.js';
import { YEAR } from '../lib/dates.js';
import { withQuery } from '../lib/router.js';
import { SECTIONS, clientPath } from '../routes.js';
import { clients, clientBilled, memberName, SECTORS, STATUS } from '../data/store.js';
import { icon } from '../components/icons.js';
import { btn, head, statusTag, emptyState, options, avatar } from '../components/ui.js';

const PAGE_SIZE = 10;
const COLUMNS = [
  { key: 'name', slug: 'nombre', label: 'Cliente', fixed: true, sort: (a, b) => a.name.localeCompare(b.name, 'es') },
  { key: 'sector', slug: 'sector', label: 'Sector', sort: (a, b) => t(a.sector).localeCompare(t(b.sector)) },
  { key: 'owner', slug: 'responsable', label: 'Responsable', sort: (a, b) => memberName(a.owner).localeCompare(memberName(b.owner)) },
  { key: 'lastContact', slug: 'contacto', label: 'Último contacto', sort: (a, b) => a.lastContact.localeCompare(b.lastContact) },
  { key: 'status', slug: 'estado', label: 'Estado', sort: (a, b) => Object.keys(STATUS).indexOf(a.status) - Object.keys(STATUS).indexOf(b.status) },
  { key: 'billed', slug: 'facturado', label: 'Facturado {year}', align: 'right', sort: (a, b) => clientBilled(a) - clientBilled(b) }
];
const DEFAULT_SORT = { slug: 'contacto', dir: 'desc' };

function sortOf(query) {
  const column = COLUMNS.find(c => c.slug === query.orden) ?? COLUMNS.find(c => c.slug === DEFAULT_SORT.slug);
  const dir = query.orden ? (query.dir === 'asc' ? 'asc' : 'desc') : DEFAULT_SORT.dir;
  return { column, dir };
}


export function filterClients(query) {
  const text = (query.q ?? '').trim().toLocaleLowerCase();
  const matches = c => [c.name, c.city, c.province, c.cif, ...c.contacts.map(x => x.name)].join(' ').toLocaleLowerCase().includes(text);
  const { column, dir } = sortOf(query);
  const list = clients()
    .filter(c => (!query.estado || c.status === query.estado) && (!query.sector || c.sector === query.sector) && (!text || matches(c)))
    .sort(column.sort);
  return dir === 'desc' ? list.reverse() : list;
}

const visibleColumns = () => COLUMNS.filter(c => c.fixed || !state.hiddenColumns.includes(c.key));
const columnLabel = c => t(c.label, { year: YEAR });

function cell(column, c) {
  switch (column.key) {
    case 'name': return html`
      <td>
        <a class="row-title" href="${clientPath(c.id)}">
          <span class="transaction-icon">${safe(initials(c.name))}</span>
          <span><strong>${safe(c.name)}</strong><small>${safe(c.city)}${c.contacts[0] ? ` · ${safe(c.contacts[0].name)}` : ''}</small></span>
        </a>
      </td>`;
    case 'sector': return `<td>${t(c.sector)}</td>`;
    case 'owner': return `<td><span class="owner">${avatar(memberName(c.owner), 'xs')}${safe(memberName(c.owner).split(' ')[0])}</span></td>`;
    case 'lastContact': return `<td class="muted">${relativeDay(c.lastContact)}</td>`;
    case 'status': return `<td>${statusTag(c.status)}</td>`;
    default: return `<td class="text-right">${money(clientBilled(c), 0)}</td>`;
  }
}

function headerCell(column, query) {
  const { column: sorted, dir } = sortOf(query);
  const active = sorted.key === column.key;
  const nextDir = active && dir === 'desc' ? 'asc' : 'desc';
  const href = withQuery(SECTIONS.clients.path, { ...query, orden: column.slug, dir: nextDir, pag: '' });
  const ariaSort = active ? `aria-sort="${dir === 'asc' ? 'ascending' : 'descending'}"` : '';
  return html`
    <th class="${column.align === 'right' ? 'text-right' : ''}" ${ariaSort}>
      <a class="sort-link ${active ? 'is-sorted' : ''}" href="${href}">${columnLabel(column)}${active ? icon('chevron-down', `xs sort-${dir}`) : ''}</a>
    </th>`;
}

function pager(query, page, pages) {
  if (pages < 2) return '';
  const link = (n, label, attrs = '') => `<a class="pager-link" href="${withQuery(SECTIONS.clients.path, { ...query, pag: n > 1 ? n : '' })}" ${attrs}>${label}</a>`;
  const numbers = Array.from({ length: pages }, (_, i) => i + 1)
    .map(n => (n === page ? `<span class="pager-link is-current" aria-current="page">${n}</span>` : link(n, n)));
  return html`
    <nav class="pager" aria-label="${t('Páginas')}">
      ${page > 1 ? link(page - 1, icon('chevron-left', 'xs'), `aria-label="${t('Anterior')}"`) : ''}
      ${numbers}
      ${page < pages ? link(page + 1, icon('chevron-right', 'xs'), `aria-label="${t('Siguiente')}"`) : ''}
    </nav>`;
}

// Parte que se repinta al escribir en el buscador o al seleccionar filas, sin perder el foco.
function clientsResults(query) {
  const list = filterClients(query);
  if (!list.length) {
    return emptyState({
      iconName: 'search',
      title: t('Ningún cliente coincide con estos filtros'),
      text: t('Prueba con otro nombre o quita algún filtro.'),
      action: `<a class="btn" href="${SECTIONS.clients.path}">${t('Quitar filtros')}</a>`
    });
  }
  const pages = Math.ceil(list.length / PAGE_SIZE);
  const page = Math.min(Math.max(1, Number(query.pag) || 1), pages);
  const rows = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selectedHere = rows.filter(c => state.selected.includes(c.id)).length;
  const columns = visibleColumns();
  const bulk = state.selected.length ? html`
    <div class="bulk-bar" data-key="bulk" role="region" aria-label="${t('Acciones sobre la selección')}">
      <strong>${t('{n} seleccionado|{n} seleccionados', { n: state.selected.length })}</strong>
      <select data-bulk-status aria-label="${t('Cambiar estado')}">
        <option value="">${t('Cambiar estado…')}</option>
        ${options(Object.entries(STATUS).map(([id, [label]]) => [id, t(label)]), '')}
      </select>
      ${btn(`${icon('download', 'xs')} ${t('Exportar selección')}`, 'export-selected', 'small')}
      ${btn(t('Quitar selección'), 'clear-selection', 'small')}
    </div>` : '';
  return html`
    ${bulk}
    <div class="table-wrap" data-key="table">
      <table class="data-table">
        <thead>
          <tr>
            <th class="select-cell"><input type="checkbox" data-select-all aria-label="${t('Seleccionar esta página')}" ${selectedHere === rows.length ? 'checked' : ''}/></th>
            ${columns.map(c => headerCell(c, query))}
          </tr>
        </thead>
        <tbody>
          ${rows.map(c => html`
            <tr class="${state.selected.includes(c.id) ? 'is-selected' : ''}" data-key="${safe(c.id)}">
              <td class="select-cell"><input type="checkbox" data-select="${safe(c.id)}" aria-label="${t('Seleccionar {name}', { name: safe(c.name) })}" ${state.selected.includes(c.id) ? 'checked' : ''}/></td>
              ${columns.map(col => cell(col, c))}
            </tr>`)}
        </tbody>
      </table>
    </div>
    <div class="table-footer" data-key="footer">
      <span class="muted">${t('{from}–{to} de {total}', { from: (page - 1) * PAGE_SIZE + 1, to: (page - 1) * PAGE_SIZE + rows.length, total: list.length })}</span>
      ${pager(query, page, pages)}
    </div>`;
}

const columnsMenu = () => html`
  <div class="menu-pop columns-menu lg is-thick" data-lg="columns" role="group" aria-label="${t('Columnas visibles')}">
    <div class="menu-title">${t('Columnas visibles')}</div>
    ${COLUMNS.filter(c => !c.fixed).map(c => `<label class="menu-item"><input type="checkbox" data-column="${c.key}" ${state.hiddenColumns.includes(c.key) ? '' : 'checked'}/><span>${columnLabel(c)}</span></label>`)}
  </div>`;

export function clientsPage(route) {
  const query = route.query;
  const all = clients();
  return html`
    ${head(t('Clientes'), t('{n} clientes · {active} activos', { n: all.length, active: all.filter(c => c.status === 'active').length }),
      btn(`${icon('download', 'xs')} ${t('Exportar CSV')}`, 'export-clients') + btn(`${icon('plus', 'xs')} ${t('Nuevo cliente')}`, 'new-client', 'dark'))}
    <section class="card section-card">
      <div class="table-toolbar">
        <label class="table-search">
          ${icon('search', 'sm')}
          <input id="clients-search" type="search" autocomplete="off" value="${safe(query.q ?? '')}" placeholder="${t('Nombre, población, CIF o contacto')}" aria-label="${t('Buscar clientes')}"/>
        </label>
        <select data-filter="estado" aria-label="${t('Estado')}">
          <option value="">${t('Todos los estados')}</option>
          ${options(Object.entries(STATUS).map(([id, [label]]) => [id, t(label)]), query.estado ?? '')}
        </select>
        <select data-filter="sector" aria-label="${t('Sector')}">
          <option value="">${t('Todos los sectores')}</option>
          ${options(SECTORS.map(s => [s, t(s)]), query.sector ?? '')}
        </select>
        <div class="menu-anchor">
          <button type="button" class="btn small" data-action="columns" aria-expanded="${state.pop === 'columns'}">${icon('columns', 'xs')} ${t('Columnas')}</button>
          ${state.pop === 'columns' ? columnsMenu() : ''}
        </div>
      </div>
      <div id="clients-results">${clientsResults(query)}</div>
    </section>`;
}
