// Estructura común. Una sola navegación: las secciones van en la barra lateral (abajo en móvil)
// y la barra superior queda para búsqueda, idioma, notificaciones y perfil.
// La capa de navegación es de Liquid Glass: clase «lg» y un «data-lg» fijo para que lib/glass.js le dé su lente.
import { state } from '../data/state.js';
import { t } from '../i18n/index.js';
import { html, safe } from '../lib/html.js';
import { moneyText, dayAndTime, initials } from '../lib/format.js';
import { daysFromToday } from '../lib/dates.js';
import { SECTIONS, invoicePath } from '../routes.js';
import { events, meetings, clientName, invoiceByNumber } from '../data/store.js';
import { icon } from './icons.js';
import { tag, kbd, menuItem, menuLink } from './ui.js';
import { logo } from './logo.js';

const MOBILE_SECTIONS = ['home', 'clients', 'sales', 'tasks', 'settings'];
const current = on => `aria-current="${on ? 'page' : 'false'}"`;

function notificationsMenu() {
  const payment = events().find(e => e.type === 'paid');
  const invoice = payment && invoiceByNumber(payment.invoice);
  const meeting = meetings().find(m => daysFromToday(m.date) >= 0);
  return html`
    <div class="menu-pop notif-list lg is-thick" data-lg="notifications" role="group" aria-label="${t('Notificaciones')}">
      <div class="menu-title">${t('Notificaciones')} ${tag(state.notificationsRead ? t('Leídas') : t('{n} nuevas', { n: 2 }), 'accent')}</div>
      ${payment ? html`
        <a class="notif-item" href="${invoicePath(payment.invoice)}">
          <strong>${t('{client} ha pagado la {invoice}', { client: safe(clientName(payment.client)), invoice: payment.invoice })}</strong>
          <small>${moneyText(invoice?.amount ?? 0)} · ${dayAndTime(payment.date, payment.time)}</small>
        </a>` : ''}
      ${meeting ? html`
        <div class="notif-item">
          <strong>${t('Reunión con {client}', { client: safe(clientName(meeting.client)) })}</strong>
          <small>${safe(meeting.title)} · ${dayAndTime(meeting.date, meeting.time)}</small>
        </div>` : ''}
      ${menuLink('calendar-days', t('Ver agenda'), SECTIONS.tasks.path)}
      ${state.notificationsRead ? '' : menuItem('check-check', t('Marcar como leídas'), 'data-action="mark-notifications-read"')}
    </div>`;
}

const profileMenu = () => html`
  <div class="menu-pop lg is-thick" data-lg="profile" role="group" aria-label="${t('Perfil')}">
    <div class="menu-title">${safe(state.name)}</div>
    ${menuLink('settings', t('Ajustes'), SECTIONS.settings.path)}
    ${menuItem(state.theme === 'light' ? 'moon' : 'sun', t(state.theme === 'light' ? 'Modo oscuro' : 'Modo claro'), 'data-action="theme"')}
    ${menuItem(state.privacy ? 'eye' : 'eye-off', t(state.privacy ? 'Mostrar importes' : 'Ocultar importes'), 'data-action="privacy"')}
    ${menuItem('keyboard', t('Atajos de teclado'), 'data-action="shortcuts"')}
  </div>`;

export const header = () => html`
  <header class="topbar">
    <a class="brand" href="${SECTIONS.home.path}" aria-label="valentindg · ${t('Inicio')}">${logo()}</a>
    <button type="button" class="search-trigger lg" data-lg="search" data-action="search">
      ${icon('search', 'sm')}<span>${t('Buscar clientes, facturas o secciones')}</span>${kbd('Ctrl K')}
    </button>
    <div class="toolbar lg" data-lg="toolbar">
      <div class="language-toggle" role="group" aria-label="${t('Idioma')}">
        ${['es', 'en'].map(code => `<button type="button" class="language-option ${state.language === code ? 'active' : ''}" aria-pressed="${state.language === code}" data-lang="${code}" lang="${code}">${code.toUpperCase()}</button>`)}
      </div>
      <button type="button" class="icon-btn search-mobile" aria-label="${t('Buscar')}" data-action="search">${icon('search')}</button>
      <div class="menu-anchor">
        <button type="button" class="icon-btn" aria-label="${t('Notificaciones')}" aria-expanded="${state.pop === 'notifications'}" data-action="notifications">
          ${icon('bell')}${state.notifications && !state.notificationsRead ? '<span class="notification-dot"></span>' : ''}
        </button>
        ${state.pop === 'notifications' ? notificationsMenu() : ''}
      </div>
      <div class="menu-anchor">
        <button type="button" class="profile-button" aria-expanded="${state.pop === 'profile'}" data-action="profile">
          <span class="avatar">${safe(initials(state.name))}</span>
          <span class="profile-info"><strong>${safe(state.name)}</strong><small>${t('Dirección comercial')}</small></span>
          ${icon('chevron-down', 'xs')}
        </button>
        ${state.pop === 'profile' ? profileMenu() : ''}
      </div>
    </div>
  </header>`;

export const rail = section => html`
  <aside class="rail">
    <nav class="rail-nav lg is-thick" data-lg="rail" aria-label="${t('Secciones')}">
      ${Object.entries(SECTIONS).map(([id, s]) => `<a class="rail-link ${section === id ? 'active' : ''}" ${current(section === id)} href="${s.path}">${icon(s.icon)}<span>${t(s.label)}</span></a>`)}
    </nav>
    <button type="button" class="rail-link rail-shortcuts lg" data-lg="shortcuts" data-action="shortcuts">${icon('keyboard')}<span>${t('Atajos')}</span></button>
  </aside>`;

export const mobileNav = section => html`
  <nav class="mobile-nav lg" data-lg="tabs" aria-label="${t('Secciones')}">
    ${MOBILE_SECTIONS.map(id => `<a class="${section === id ? 'active' : ''}" ${current(section === id)} href="${SECTIONS[id].path}">${icon(SECTIONS[id].icon)}<span>${t(SECTIONS[id].label)}</span></a>`)}
  </nav>`;

// Esqueleto mientras llegan los datos: misma rejilla que el inicio para que no salte el diseño.
export const skeleton = () => html`
  <div class="app-shell" aria-busy="true" aria-label="${t('Cargando')}">
    <header class="topbar">
      <span class="brand">${logo()}</span>
      <span class="skeleton skeleton-search"></span>
      <span class="skeleton skeleton-pill"></span>
    </header>
    <div class="workspace">
      <span class="skeleton skeleton-rail"></span>
      <main class="main">
        <span class="skeleton skeleton-title"></span>
        <div class="today-grid">${'<span class="skeleton skeleton-card"></span>'.repeat(3)}</div>
        <div class="overview-grid">${'<span class="skeleton skeleton-card"></span>'.repeat(3)}</div>
      </main>
    </div>
  </div>`;

export const errorScreen = () => html`
  <div class="app-shell">
    <div class="error-screen">
      <span class="empty-icon">${icon('circle-alert')}</span>
      <h1>${t('No se han podido cargar los datos')}</h1>
      <p>${t('Comprueba la conexión y vuelve a intentarlo. Si sigue fallando, avisa al administrador.')}</p>
      <button type="button" class="btn dark" data-action="retry">${icon('repeat', 'xs')} ${t('Reintentar')}</button>
    </div>
  </div>`;
