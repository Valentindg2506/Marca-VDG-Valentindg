// Manual de marca valentindg. Script clásico (sin módulos) para que funcione abriendo index.html con doble clic.
(function () {
  'use strict';
  const root = document.documentElement;
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

  // ---- Iconos -------------------------------------------------------------
  const ICON_ATTRS = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.85', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' };
  function drawIcon(svg, name) {
    for (const [key, value] of Object.entries(ICON_ATTRS)) svg.setAttribute(key, value);
    svg.innerHTML = window.VDG_ICONS[name] || '';
  }
  const newIcon = (name, size) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('icon');
    if (size) svg.style.cssText = `width:${size}px;height:${size}px`;
    drawIcon(svg, name);
    return svg;
  };
  $$('svg[data-i]').forEach(svg => drawIcon(svg, svg.dataset.i));
  $$('[data-icon-sample]').forEach(el => el.querySelector('span').replaceWith(newIcon(el.dataset.iconSample, el.dataset.size)));
  const grid = document.querySelector('[data-icons]');
  for (const name of Object.keys(window.VDG_ICONS)) {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'icon-cell';
    cell.dataset.copyValue = name;
    cell.append(newIcon(name));
    cell.insertAdjacentHTML('beforeend', `<span>${name}</span>`);
    grid.append(cell);
  }

  // ---- Color --------------------------------------------------------------
  const PALETTE = [
    ['Marca', [
      ['accent', 'Coral', 'Acento único: activo, foco, alertas', true],
      ['accent-hover', 'Coral intenso', 'Hover del acento', true],
      ['accent-soft', 'Coral suave', 'Fondo de etiquetas y avisos'],
      ['ink', 'Tinta', 'Texto, botón principal, logo'],
      ['on-accent', 'Blanco', 'Texto sobre coral o tinta']
    ]],
    ['Neutros', [
      ['bg', 'Fondo', 'Fondo de la aplicación'],
      ['surface', 'Superficie', 'Tarjetas, menús, modales'],
      ['surface-alt', 'Superficie alternativa', 'Campos, mosaicos, cabeceras de tabla'],
      ['surface-hover', 'Hover', 'Fondo al pasar el ratón'],
      ['border', 'Borde', 'Separadores'],
      ['border-strong', 'Borde fuerte', 'Bordes de controles'],
      ['text', 'Texto', 'Texto principal', true],
      ['text-muted', 'Texto secundario', 'Metadatos, ayudas', true],
      ['text-subtle', 'Texto tenue', 'Ejes de gráficos', true],
      ['icon', 'Iconos', 'Iconos de navegación', true]
    ]],
    ['Estados', [
      ['success', 'Éxito', 'Cobrado, activo, tendencia positiva', true],
      ['success-soft', 'Éxito suave', 'Fondo de etiquetas verdes'],
      ['danger', 'Alerta', 'Vencido, en riesgo, errores', true],
      ['chart-primary', 'Gráfico', 'Serie principal de los gráficos']
    ]],
    ['Logotipo original (no usar en interfaz)', [
      ['logo-blue', 'Azul eléctrico', 'Brillo del logo original'],
      ['logo-silver', 'Plata', 'Letras del logo original'],
      ['logo-night', 'Noche', 'Fondo de avatares, iconos y portadas']
    ]]
  ];

  const read = name => getComputedStyle(root).getPropertyValue(`--color-${name}`).trim();
  function valuesFor(theme) {
    const previous = root.dataset.theme;
    root.dataset.theme = theme;
    const values = Object.fromEntries([...PALETTE.flatMap(([, items]) => items).map(([name]) => name), 'surface'].map(name => [name, read(name)]));
    root.dataset.theme = previous;
    return values;
  }

  function toRgb(value) {
    const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (hex) {
      const h = hex[1].length === 3 ? [...hex[1]].map(c => c + c).join('') : hex[1];
      return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
    }
    const rgb = value.match(/rgba?\(([^)]+)\)/);
    return rgb ? rgb[1].split(',').slice(0, 3).map(n => Math.round(parseFloat(n))) : null;
  }
  const toHex = rgb => '#' + rgb.map(n => n.toString(16).padStart(2, '0')).join('').toUpperCase();
  function toHsl([r, g, b]) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
    if (max === min) return [0, 0, Math.round(l * 100)];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [Math.round(h * 60), Math.round(s * 100), Math.round(l * 100)];
  }
  const luminance = rgb => {
    const [r, g, b] = rgb.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  const level = ratio => (ratio >= 4.5 ? 'AA' : ratio >= 3 ? 'AA grande' : 'insuficiente');

  function codes(value) {
    const rgb = toRgb(value);
    if (!rgb) return '';
    const [h, s, l] = toHsl(rgb);
    const alpha = value.match(/rgba\([^)]*,\s*([\d.]+)\)/);
    const list = [['HEX', toHex(rgb)], ['RGB', `rgb(${rgb.join(', ')}${alpha ? ` / ${alpha[1]}` : ''})`], ['HSL', `hsl(${h} ${s}% ${l}%)`]];
    return list.map(([label, code]) => `<button type="button" data-copy-value="${code}"><span>${label}</span>${code}</button>`).join('');
  }

  function renderPalette() {
    const light = valuesFor('light');
    const dark = valuesFor('dark');
    const current = root.dataset.theme === 'dark' ? dark : light;
    document.querySelector('[data-palette]').innerHTML = PALETTE.map(([group, items]) => `
      <h3>${group}</h3>
      <div class="swatches">${items.map(([name, label, use, isText]) => {
        const rgb = toRgb(current[name]);
        const ratio = isText && rgb ? contrast(rgb, toRgb(current.surface)) : null;
        const differs = light[name] !== dark[name];
        return `
          <article class="swatch">
            <div class="swatch-chip" title="${differs ? 'Claro / oscuro' : ''}"><span style="background:${light[name]}"></span>${differs ? `<span style="background:${dark[name]}"></span>` : ''}</div>
            <div class="swatch-body">
              <strong>${label}</strong>
              <span class="swatch-token">--color-${name}</span>
              <p style="font-size:12px;color:var(--color-text-muted);margin:0">${use}</p>
              <div class="swatch-codes">${codes(current[name])}</div>
              ${differs ? `<p class="swatch-token" style="margin-top:6px">${current === dark ? 'Claro' : 'Oscuro'}: ${toHex(toRgb(current === dark ? light[name] : dark[name]) || [0, 0, 0])}</p>` : ''}
              ${ratio ? `<div class="swatch-contrast"><span class="contrast ${ratio < 4.5 ? 'fail' : ''}" title="Contraste sobre la superficie del tema">${ratio.toFixed(1).replace('.', ',')}:1 · ${level(ratio)}</span></div>` : ''}
            </div>
          </article>`;
      }).join('')}</div>`).join('');
  }
  renderPalette();

  // ---- Copiar ----------------------------------------------------------------
  function copy(text, button) {
    const done = () => {
      const original = button.dataset.label ?? button.innerHTML;
      button.dataset.label = original;
      button.classList.add('copied');
      if (button.matches('[data-copy]')) button.textContent = 'Copiado';
      setTimeout(() => { button.innerHTML = original; button.classList.remove('copied'); }, 1200);
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, () => fallback(text, done));
    else fallback(text, done);
  }
  function fallback(text, done) {
    const area = Object.assign(document.createElement('textarea'), { value: text });
    document.body.append(area);
    area.select();
    try { document.execCommand('copy'); done(); } catch { /* el navegador no permite copiar */ }
    area.remove();
  }
  document.addEventListener('click', event => {
    const value = event.target.closest('[data-copy-value]');
    if (value) return copy(value.dataset.copyValue, value);
    const code = event.target.closest('[data-copy]');
    if (code) return copy(code.parentElement.textContent.replace(code.textContent, '').trim(), code);
    const play = event.target.closest('[data-play]');
    if (play) {
      const demo = play.closest('.motion-demo');
      const dot = demo.querySelector('.motion-dot');
      dot.style.transition = `left ${demo.dataset.motion} var(--ease-ui)`;
      demo.classList.toggle('is-playing');
    }
  });

  // ---- Tema ------------------------------------------------------------------
  const toggle = document.querySelector('[data-theme-toggle]');
  function applyTheme(theme) {
    root.dataset.theme = theme;
    toggle.textContent = theme === 'dark' ? 'Modo claro' : 'Modo oscuro';
    document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#121116' : '#f7f6f8';
    renderPalette();
  }
  let saved = null;
  try { saved = localStorage.getItem('vdg-manual-theme'); } catch { /* sin almacenamiento */ }
  applyTheme(saved === 'dark' ? 'dark' : 'light');
  toggle.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem('vdg-manual-theme', next); } catch { /* sin almacenamiento */ }
  });

  // ---- Índice: marca la sección visible ----------------------------------------------
  const links = new Map($$('.doc-nav ol a').map(a => [a.getAttribute('href').slice(1), a]));
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      links.forEach(a => a.classList.remove('is-current'));
      links.get(entry.target.id)?.classList.add('is-current');
    }
  }, { rootMargin: '-30% 0px -60% 0px' });
  $$('.doc-section[id]').forEach(section => observer.observe(section));
})();
