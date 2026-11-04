// Copia de design-system/glass.js sin «export», para que funcione al abrir el manual con doble clic (file://
// no carga módulos). Si cambias design-system/glass.js, copia el cambio aquí.
(() => {
// Liquid Glass: lo que el CSS solo no puede hacer.
// - Estados de scroll en <html>: «lg-scrolled» (sombra más marcada y borde de scroll bajo la cabecera) y
//   «lg-tabs-min» (la barra del móvil se compacta al bajar y se despliega al subir).
// - Posición del puntero en --lg-px / --lg-py para el resplandor que nace bajo el cursor.
// - Lente: un mapa de desplazamiento por cada pieza [data-lg] que curva lo que hay detrás en los bordes, como
//   el cristal grueso. Solo en Chromium, el único que acepta filtros SVG en backdrop-filter; el resto se queda
//   con el desenfoque. Tampoco con «reducir transparencia» ni «más contraste».
// No toca los elementos (morph() borraría atributos ajenos): escribe una hoja de estilo y clases en <html>.
// Sin dependencias.

const SVG = 'http://www.w3.org/2000/svg';
const RIM = 18;           // ancho en px de la zona del borde que curva la luz
const MIN_SCROLL = 6;     // px de scroll antes de decidir si se sube o se baja
const COMPACT_AFTER = 80; // la barra del móvil no se compacta en lo alto de la página

const root = document.documentElement;
const lensOff = () => matchMedia('(prefers-reduced-transparency: reduce), (prefers-contrast: more)').matches;

function trackScroll() {
  let last = scrollY;
  const update = () => {
    const y = scrollY;
    root.classList.toggle('lg-scrolled', y > 4);
    if (Math.abs(y - last) < MIN_SCROLL) return;
    root.classList.toggle('lg-tabs-min', y > last && y > COMPACT_AFTER);
    last = y;
  };
  addEventListener('scroll', update, { passive: true });
  update();
}

function trackPointer() {
  if (!matchMedia('(hover: hover)').matches) return;
  addEventListener('pointermove', e => {
    root.style.setProperty('--lg-px', `${e.clientX}px`);
    root.style.setProperty('--lg-py', `${e.clientY}px`);
  }, { passive: true });
}

// Distancia con signo a un rectángulo redondeado centrado en el origen (negativa dentro).
function roundedBox(x, y, halfW, halfH, r) {
  const qx = Math.abs(x) - halfW + r;
  const qy = Math.abs(y) - halfH + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

// Mapa de desplazamiento: gris neutro dentro y, en el borde, rojo y verde que empujan hacia el centro,
// más fuerte cuanto más cerca del filo. Así el cristal «aumenta» lo de detrás junto al borde.
function lensMap(w, h, r) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h);
  const halfW = w / 2;
  const halfH = h / 2;
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const x = px + .5 - halfW;
      const y = py + .5 - halfH;
      const inside = -roundedBox(x, y, halfW, halfH, r);
      let red = 128;
      let green = 128;
      if (inside < RIM) {
        const nx = roundedBox(x + 1, y, halfW, halfH, r) - roundedBox(x - 1, y, halfW, halfH, r);
        const ny = roundedBox(x, y + 1, halfW, halfH, r) - roundedBox(x, y - 1, halfW, halfH, r);
        const length = Math.hypot(nx, ny) || 1;
        const strength = (1 - Math.max(inside, 0) / RIM) ** 2;
        red = 128 - (nx / length) * strength * 127;
        green = 128 - (ny / length) * strength * 127;
      }
      const i = (py * w + px) * 4;
      img.data[i] = red;
      img.data[i + 1] = green;
      img.data[i + 2] = 128;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL();
}

function trackLens() {
  const isChromium = navigator.userAgentData?.brands?.some(b => b.brand === 'Chromium');
  if (!isChromium) return;
  const defs = document.createElementNS(SVG, 'svg');
  defs.setAttribute('aria-hidden', 'true');
  defs.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  document.body.append(defs);
  const sheet = document.createElement('style');
  document.head.append(sheet);
  const sizes = new Map();
  let queued = false;

  const filterFor = (key, w, h, r, scale) => {
    const id = `lg-lens-${key}`;
    let filter = defs.querySelector(`#${id}`);
    if (!filter) {
      filter = document.createElementNS(SVG, 'filter');
      filter.id = id;
      filter.setAttribute('filterUnits', 'userSpaceOnUse');
      filter.setAttribute('color-interpolation-filters', 'sRGB');
      filter.innerHTML = '<feImage result="map" preserveAspectRatio="none"/><feDisplacementMap in="SourceGraphic" in2="map" xChannelSelector="R" yChannelSelector="G"/>';
      defs.append(filter);
    }
    for (const el of [filter, filter.firstChild]) {
      el.setAttribute('x', 0);
      el.setAttribute('y', 0);
      el.setAttribute('width', w);
      el.setAttribute('height', h);
    }
    filter.firstChild.setAttribute('href', lensMap(w, h, r));
    filter.lastChild.setAttribute('scale', scale);
    return id;
  };

  const update = () => {
    queued = false;
    if (lensOff()) {
      sheet.textContent = '';
      sizes.clear();
      return;
    }
    let changed = false;
    for (const el of document.querySelectorAll('[data-lg]')) {
      const key = el.dataset.lg;
      const w = Math.round(el.offsetWidth);
      const h = Math.round(el.offsetHeight);
      if (!w || !h) continue;
      const style = getComputedStyle(el);
      const r = Math.min(parseFloat(style.borderTopLeftRadius) || 0, w / 2, h / 2);
      const scale = parseFloat(style.getPropertyValue('--glass-lens')) || 0;
      const size = `${w}x${h}x${r}x${scale}`;
      if (sizes.get(key) === size) continue;
      sizes.set(key, size);
      filterFor(key, w, h, r, scale);
      changed = true;
    }
    if (changed) sheet.textContent = [...sizes.keys()].map(key => `[data-lg="${key}"]{--lg-lens:url(#lg-lens-${key})}`).join('');
  };
  const queue = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  };
  new MutationObserver(queue).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  addEventListener('resize', queue);
  matchMedia('(prefers-reduced-transparency: reduce), (prefers-contrast: more)').addEventListener('change', queue);
  // La barra del móvil cambia de tamaño al compactarse: se recalcula al terminar la transición.
  addEventListener('transitionend', e => { if (e.target.matches?.('[data-lg]')) queue(); });
  queue();
}

function liquidGlass() {
  trackScroll();
  trackPointer();
  trackLens();
}

liquidGlass();
})();
