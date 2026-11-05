import { header, toast, logger, crmData, euro } from '../shared/common.js';
import { PointerGestures, ShakeDetector } from './gestures.js';

header('gestos');
const $ = s => document.querySelector(s);
const log = logger($('#log'));
const tray = $('#tray');

const ACTIONS = {
  right: { label: 'Contactado', stamp: 'Contactado' },
  left: { label: 'Pospuesto una semana', stamp: 'Posponer' },
  up: { label: 'Marcado como urgente', stamp: 'Urgente' }
};
const counts = { right: 0, left: 0, up: 0 };
let queue = [];
const history = [];

function highlight(gesture) {
  document.querySelectorAll('#gesture-table tr').forEach(tr => tr.classList.toggle('is-active', tr.dataset.gesture === gesture));
}

const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function cardHtml(client, index) {
  const days = -client.lastContact;
  const contacts = client.contacts.map(p => `<li><strong>${escapeHtml(p.name)}</strong> · ${escapeHtml(p.role)}<br><span class="muted mono">${escapeHtml(p.phone ?? '')} ${escapeHtml(p.email ?? '')}</span></li>`).join('');
  return `
    <article class="client-card ${index === 1 ? 'behind' : index === 2 ? 'behind-2' : ''}" data-id="${client.id}" tabindex="${index === 0 ? 0 : -1}" aria-label="${escapeHtml(client.name)}">
      <span class="stamp right">${ACTIONS.right.stamp}</span><span class="stamp left">${ACTIONS.left.stamp}</span><span class="stamp up">${ACTIONS.up.stamp}</span>
      <div class="front">
        <span class="tag ${client.status === 'risk' ? 'accent' : client.status === 'active' ? 'green' : ''}">${{ risk: 'En riesgo', active: 'Activo', new: 'Nuevo' }[client.status]}</span>
        <h2>${escapeHtml(client.name)}</h2>
        <p class="muted">${escapeHtml(client.sector)} · ${escapeHtml(client.city)}</p>
      </div>
      <div class="back"><h3>Contactos de ${escapeHtml(client.name)}</h3><ul style="margin:0;padding-left:18px;display:grid;gap:8px">${contacts || '<li>Sin contactos</li>'}</ul></div>
      <div class="facts">
        <div><strong>${days === 0 ? 'Hoy' : `${days} días`}</strong><small>sin contacto</small></div>
        <div><strong>${euro(client.billed)}</strong><small>facturado</small></div>
        <div><strong>${client.contacts.length}</strong><small>contactos</small></div>
      </div>
    </article>`;
}

function renderTray() {
  $('#remaining').textContent = `${queue.length} pendientes`;
  if (!queue.length) {
    tray.innerHTML = '<div class="tray-empty"><strong>Bandeja vacía</strong><span class="muted">Has revisado todos los clientes. Agita el móvil o pulsa «Deshacer» para recuperar el último.</span></div>';
    return;
  }
  tray.innerHTML = queue.slice(0, 3).map(cardHtml).reverse().join('');
  bindTopCard();
}

const topCard = () => tray.querySelector('.client-card:not(.behind):not(.behind-2)');

function decide(direction, source) {
  const card = topCard();
  if (!card || !ACTIONS[direction]) return;
  const client = queue.shift();
  counts[direction] += 1;
  history.push({ client, direction });
  $(`#count-${direction}`).textContent = counts[direction];
  highlight(`swipe-${direction}`);
  log(`${source}: ${ACTIONS[direction].label} · ${client.name}`);
  toast(`${client.name}: ${ACTIONS[direction].label.toLowerCase()}`);
  const fly = { right: 'translate(140%, 10%) rotate(25deg)', left: 'translate(-140%, 10%) rotate(-25deg)', up: 'translate(0, -140%)' }[direction];
  card.style.transform = fly;
  card.style.opacity = '0';
  setTimeout(renderTray, 300);
}

function undo(source) {
  const last = history.pop();
  if (!last) { toast('No hay nada que deshacer'); return; }
  counts[last.direction] -= 1;
  $(`#count-${last.direction}`).textContent = counts[last.direction];
  queue.unshift(last.client);
  renderTray();
  highlight(source === 'Agitar' ? 'shake' : '');
  log(`${source}: deshecho · ${last.client.name}`);
  toast(`Recuperado: ${last.client.name}`);
}

function flip(source) {
  const card = topCard();
  if (!card) return;
  card.classList.toggle('flipped');
  highlight('doubletap');
  log(`${source}: ${card.classList.contains('flipped') ? 'ver contactos' : 'volver a la tarjeta'}`);
}

// Menú de la pulsación larga
function contextMenu(x, y) {
  closeMenu();
  const client = queue[0];
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.setAttribute('role', 'menu');
  menu.innerHTML = ['📞 Llamar', '✉️ Enviar correo', '📝 Añadir nota'].map(label => `<button role="menuitem">${label}</button>`).join('');
  menu.style.left = `${Math.min(x, innerWidth - 220)}px`;
  menu.style.top = `${Math.min(y, innerHeight - 160)}px`;
  menu.addEventListener('click', e => {
    const item = e.target.closest('button');
    if (!item) return;
    log(`Menú: ${item.textContent.slice(3)} · ${client.name}`);
    toast(`${item.textContent.slice(3)} · ${client.name}`);
    closeMenu();
  });
  document.body.append(menu);
  menu.querySelector('button').focus();
}
const closeMenu = () => document.querySelector('.context-menu')?.remove();
document.addEventListener('pointerdown', e => { if (!e.target.closest('.context-menu')) closeMenu(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

// Gestos sobre la tarjeta de arriba
let gestures = null;
function bindTopCard() {
  gestures?.destroy();
  const card = topCard();
  if (!card) return;
  const stamps = { right: card.querySelector('.stamp.right'), left: card.querySelector('.stamp.left'), up: card.querySelector('.stamp.up') };
  gestures = new PointerGestures(card, { swipeMin: 90 });

  gestures.addEventListener('pan', ({ detail: { dx, dy } }) => {
    card.classList.add('is-dragging');
    card.style.transform = `translate(${dx}px, ${Math.min(dy, 40)}px) rotate(${dx / 18}deg)`;
    stamps.right.style.opacity = Math.max(0, dx / 120);
    stamps.left.style.opacity = Math.max(0, -dx / 120);
    stamps.up.style.opacity = Math.abs(dx) < 60 ? Math.max(0, -dy / 120) : 0;
  });
  const reset = () => {
    card.classList.remove('is-dragging');
    card.style.transform = '';
    Object.values(stamps).forEach(s => { s.style.opacity = 0; });
  };
  gestures.addEventListener('panend', ({ detail: { dx, dy } }) => {
    // Recorrido largo pero lento: también cuenta si pasa de un tercio de la tarjeta.
    const w = card.offsetWidth / 3;
    if (Math.abs(dx) > w) { card.classList.remove('is-dragging'); decide(dx > 0 ? 'right' : 'left', 'Arrastrar'); }
    else if (-dy > 120) { card.classList.remove('is-dragging'); decide('up', 'Arrastrar'); }
    else reset();
  });
  gestures.addEventListener('swipe', ({ detail }) => {
    card.classList.remove('is-dragging');
    if (detail.direction === 'down') { reset(); return; }
    decide(detail.direction, `Deslizar (${detail.velocity.toFixed(2)} px/ms)`);
  });
  gestures.addEventListener('doubletap', () => flip('Doble toque'));
  gestures.addEventListener('tap', () => log('Toque: tarjeta seleccionada'));
  gestures.addEventListener('longpress', ({ detail }) => {
    highlight('longpress');
    log('Pulsación larga: menú contextual');
    navigator.vibrate?.(30);
    contextMenu(detail.x, detail.y);
  });
}

// Botones y teclado: misma acción sin gestos (accesibilidad)
document.querySelectorAll('[data-do]').forEach(btn => btn.addEventListener('click', () => {
  const what = btn.dataset.do;
  if (what === 'undo') undo('Botón');
  else if (what === 'flip') flip('Botón');
  else decide(what, 'Botón');
}));
document.addEventListener('keydown', e => {
  if (e.target.closest('input, textarea, .context-menu')) return;
  const keys = { ArrowRight: 'right', ArrowLeft: 'left', ArrowUp: 'up' };
  if (keys[e.key]) { e.preventDefault(); decide(keys[e.key], 'Teclado'); }
  else if (e.key === ' ' && e.target.closest('.client-card')) { e.preventDefault(); flip('Teclado'); }
  else if (e.key.toLowerCase() === 'z' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); undo('Teclado'); }
});

// ---------------------------------------------------------------------------
// Gráfico con pellizco y giro
// ---------------------------------------------------------------------------
const chart = $('#chart');
const zoom = { scale: 1, rotation: 0, base: null };
function applyZoom() {
  chart.style.transform = `scale(${zoom.scale}) rotate(${zoom.rotation}deg)`;
  $('#zoom-readout').textContent = `${Math.round(zoom.scale * 100)} % · ${Math.round(zoom.rotation)}°`;
}
const area = new PointerGestures($('#zoom-area'));
let lastLog = 0;
const throttledLog = text => { const now = performance.now(); if (now - lastLog > 500) { lastLog = now; log(text); } };
area.addEventListener('pinch', ({ detail }) => {
  if (detail.relative) zoom.scale *= detail.scale;
  else { zoom.base ??= { scale: zoom.scale, rotation: zoom.rotation }; zoom.scale = zoom.base.scale * detail.scale; }
  zoom.scale = Math.min(4, Math.max(0.5, zoom.scale));
  highlight('pinch');
  applyZoom();
  throttledLog(`Pellizcar: ${Math.round(zoom.scale * 100)} %`);
});
area.addEventListener('rotate', ({ detail }) => {
  if (detail.relative) zoom.rotation += detail.rotation;
  else { zoom.base ??= { scale: zoom.scale, rotation: zoom.rotation }; zoom.rotation = zoom.base.rotation + detail.rotation; }
  if (Math.abs(detail.rotation) > 3) highlight('rotate');
  applyZoom();
  throttledLog(`Girar: ${Math.round(zoom.rotation)}°`);
});
area.addEventListener('pinchend', () => { zoom.base = null; });
const resetZoom = source => { Object.assign(zoom, { scale: 1, rotation: 0, base: null }); applyZoom(); log(`${source}: gráfico restablecido`); };
area.addEventListener('doubletap', () => resetZoom('Doble toque'));
$('#reset-zoom').addEventListener('click', () => resetZoom('Botón'));

function drawChart(values) {
  const max = Math.max(...values);
  const months = Array.from({ length: 12 }, (_, i) => new Date(new Date().getFullYear(), new Date().getMonth() - 11 + i, 1).toLocaleDateString('es-ES', { month: 'short' }));
  const bw = 480 / 12;
  chart.innerHTML = values.map((v, i) => {
    const h = v / max * 170;
    return `<rect x="${i * bw + 6}" y="${190 - h}" width="${bw - 12}" height="${h}" rx="5" fill="${i === 11 ? 'var(--color-accent)' : 'var(--color-chart-primary)'}" opacity="${i === 11 ? 1 : 0.45}"><title>${months[i]}: ${euro(v)}</title></rect>
      <text x="${i * bw + bw / 2}" y="208" text-anchor="middle" font-size="11" fill="var(--color-text-muted)">${months[i]}</text>`;
  }).join('');
}

// ---------------------------------------------------------------------------
// Agitar para deshacer (acelerómetro del móvil)
// ---------------------------------------------------------------------------
const shake = new ShakeDetector(() => undo('Agitar'));
$('#shake-btn').addEventListener('click', async () => {
  if (!ShakeDetector.supported) { toast('Este dispositivo no tiene acelerómetro'); return; }
  try {
    await shake.start();
    $('#shake-btn').textContent = 'Agitar para deshacer: activado';
    $('#shake-btn').disabled = true;
    log('Acelerómetro activado');
  } catch (error) { toast(error.message); }
});

// Datos: clientes que más tiempo llevan sin contacto (primero los que están en riesgo)
crmData().then(data => {
  queue = [...data.clients].sort((a, b) => (a.status === 'risk' ? -1 : 0) - (b.status === 'risk' ? -1 : 0) || a.lastContact - b.lastContact);
  renderTray();
  const months = data.charts.previousMonthsBilled;
  drawChart([...months, Math.round(months.at(-1) * 1.04)]);
  log('Datos del CRM cargados');
}).catch(error => { tray.innerHTML = `<div class="tray-empty">${error.message}</div>`; });
