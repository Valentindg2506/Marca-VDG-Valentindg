import { state } from '../data/state.js';
import { t } from '../i18n/index.js';
import { html } from '../lib/html.js';
import { moneyText, compact, formatDate, monthLabel } from '../lib/format.js';
import { startOfToday, isoDay, DAY } from '../lib/dates.js';
import { charts, monthlyBilled, monthlyCollected } from '../data/store.js';

export function lineChart(values, label) {
  const width = 315;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const dx = width / (values.length - 1);
  const points = values.map((v, i) => [i * dx, 118 - (v - min) / (max - min || 1) * 96]);
  const line = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return html`
    <svg class="line-graph" viewBox="0 0 ${width} 147" role="img" aria-label="${label}">
      <defs>
        <linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--color-accent)" stop-opacity=".18"/>
          <stop offset="100%" stop-color="var(--color-accent)" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path class="gridline" d="M0 27H${width}M0 75H${width}M0 123H${width}"/>
      <path class="svg-area" d="${line} L${width},135 L0,135 Z"/>
      <path class="svg-line" d="${line}"/>
      <circle cx="${width}" cy="${points.at(-1)[1].toFixed(1)}" r="4.5" fill="var(--color-accent)" stroke="var(--color-surface)" stroke-width="3"/>
    </svg>`;
}

// Facturado y cobrado del inicio: semanas o meses según el selector.
export function homeBars() {
  if (state.range === 'months') {
    return { labels: [-6, -5, -4, -3, -2, -1, 0].map(monthLabel), billed: monthlyBilled().slice(-7), collected: monthlyCollected().slice(-7) };
  }
  const monday = startOfToday();
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const labels = [6, 5, 4, 3, 2, 1, 0].map(w => formatDate(isoDay(new Date(monday.getTime() - w * 7 * DAY)), { day: 'numeric', month: 'numeric' }));
  return { labels, ...charts().weeks };
}

// Marca del eje «redonda» (1, 2, 2,5, 4, 5, 6 u 8 por una potencia de 10) para que se lea a simple vista.
function niceTick(value) {
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return magnitude * [1, 2, 2.5, 4, 5, 6, 8, 10].find(n => n * magnitude >= value);
}

// Barras dobles (facturado / cobrado) con cuatro marcas en el eje.
export function barChart({ labels, billed, collected }) {
  const top = niceTick(Math.max(...billed) / 4) * 4;
  const title = (label, value) => `${t(label)}: ${moneyText(value, 0)}`;
  return html`
    <div class="bar-chart">
      <div class="chart-yaxis">${[4, 3, 2, 1, 0].map(i => `<span>${compact(top * i / 4)}</span>`)}</div>
      <div class="bar-chart-body" style="grid-template-columns:repeat(${labels.length},1fr)">
        ${labels.map((label, i) => html`
          <div class="bar-group">
            <div class="bar primary" title="${title('Facturado', billed[i])}" style="height:${billed[i] / top * 100}%"></div>
            <div class="bar secondary" title="${title('Cobrado', collected[i])}" style="height:${collected[i] / top * 100}%"></div>
            <span class="bar-label">${label}</span>
          </div>`)}
      </div>
    </div>`;
}
