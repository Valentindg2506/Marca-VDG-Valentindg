// Escena VR: facturación de 12 meses en barras 3D, embudo de ventas interactivo y paneles de indicadores.
import { sceneData, entity, euro, STAGES } from './xr-data.js';

const scene = document.querySelector('a-scene');
const info = document.querySelector('#info');
const ACCENT = '#f65d49';

const setInfo = (eyebrow, title, note = '') => info.setAttribute('canvas-panel', { eyebrow, title, note, value: '' });

// Cursor de mirada solo dentro de las gafas: en el ordenador molestaría al hacer clic con el ratón.
scene.addEventListener('enter-vr', () => {
  const gaze = document.querySelector('#gaze');
  gaze.setAttribute('visible', true);
  gaze.setAttribute('raycaster', 'enabled', true);
});
scene.addEventListener('exit-vr', () => {
  const gaze = document.querySelector('#gaze');
  gaze.setAttribute('visible', false);
  gaze.setAttribute('raycaster', 'enabled', false);
});

function buildChart(d) {
  const chart = document.querySelector('#chart');
  const max = Math.max(...d.billed);
  const gap = 0.46;
  const startX = -((d.billed.length - 1) * gap) / 2;
  entity(chart, 'a-entity', {
    position: '0 2.75 0',
    'canvas-panel': { width: 2.6, height: 0.5, eyebrow: 'Facturación · últimos 12 meses', title: 'Barra: facturado · marca verde: cobrado', background: '#1b1a20cc' }
  });
  d.billed.forEach((value, i) => {
    const h = Math.max(0.05, value / max * 2.1);
    const last = i === d.billed.length - 1;
    const bar = entity(chart, 'a-box', {
      class: 'clickable',
      position: `${startX + i * gap} ${h / 2 + 0.02} 0`,
      width: 0.3, depth: 0.3, height: h,
      material: `color: ${last ? ACCENT : '#ef6c59'}; opacity: ${last ? 1 : 0.6}; transparent: true; roughness: 0.5`,
      'hover-grow': 'scale: 1.08',
      animation: `property: scale; from: 1 0.01 1; to: 1 1 1; dur: 900; delay: ${i * 60}; easing: easeOutCubic`
    });
    // Cobrado: una marca verde a la altura de lo cobrado, para comparar sin tapar la barra.
    const ch = Math.max(0.04, d.collected[i] / max * 2.1);
    entity(chart, 'a-box', { position: `${startX + i * gap} ${ch + 0.02} 0`, width: 0.36, depth: 0.36, height: 0.03, material: 'color: #61d2a6; shader: flat' });
    entity(chart, 'a-entity', {
      position: `${startX + i * gap} 0.03 0.32`, rotation: '-90 0 0',
      'canvas-panel': { width: 0.44, height: 0.16, title: d.months[i], background: '#00000000' }
    });
    bar.addEventListener('click', () => setInfo(d.months[i], `Facturado ${euro(value)} · Cobrado ${euro(d.collected[i])}`,
      `${Math.round(d.collected[i] / value * 100)} % cobrado${i ? ` · ${value >= d.billed[i - 1] ? '▲' : '▼'} ${euro(Math.abs(value - d.billed[i - 1]))} frente al mes anterior` : ''}`));
  });
}

function buildPipeline(d) {
  const root = document.querySelector('#pipeline');
  const cards = new Map();
  const colX = i => (i - 1.5) * 1.15;
  STAGES.forEach(([stage, label], i) => {
    entity(root, 'a-entity', {
      position: `${colX(i)} 2.75 0`,
      'canvas-panel': { width: 1.05, height: 0.26, title: label, background: stage === 'won' ? '#17382c' : '#242229' }
    });
  });
  const layout = () => {
    STAGES.forEach(([stage], i) => {
      d.deals.filter(deal => deal.stage === stage).forEach((deal, row) => {
        cards.get(deal.id).setAttribute('animation__move', {
          property: 'position', to: `${colX(i)} ${2.4 - row * 0.4} 0`, dur: 700, easing: 'easeOutCubic'
        });
      });
    });
  };
  d.deals.forEach(deal => {
    const card = entity(root, 'a-entity', {
      class: 'clickable',
      position: '0 1.4 -0.6',
      'canvas-panel': { width: 1.05, height: 0.34, title: deal.title, note: `${deal.clientName} · ${euro(deal.amount)}`, background: '#1b1a20' },
      'hover-grow': 'scale: 1.06'
    });
    cards.set(deal.id, card);
    card.addEventListener('click', () => {
      const i = STAGES.findIndex(([s]) => s === deal.stage);
      if (i === STAGES.length - 1) { setInfo('Embudo', `${deal.title} ya está ganada`, deal.clientName); return; }
      deal.stage = STAGES[i + 1][0];
      card.setAttribute('canvas-panel', 'background', deal.stage === 'won' ? '#17382c' : '#1b1a20');
      layout();
      setInfo('Embudo', `«${deal.title}» pasa a ${STAGES[i + 1][1]}`, `${deal.clientName} · ${euro(deal.amount)}`);
      updateKpis(d);
    });
  });
  layout();
}

let kpiPanels = null;
function updateKpis(d) {
  const won = d.quarter.won + d.deals.filter(x => x.stage === 'won').reduce((t, x) => t + x.amount, 0);
  const open = d.deals.filter(x => x.stage !== 'won').reduce((t, x) => t + x.amount, 0);
  kpiPanels.goal.setAttribute('canvas-panel', { value: euro(won), progress: won / d.quarter.target, note: `${Math.round(won / d.quarter.target * 100)} % de ${euro(d.quarter.target)}` });
  kpiPanels.pipeline.setAttribute('canvas-panel', { value: euro(open) });
}

function buildKpis(d) {
  const root = document.querySelector('#kpis');
  kpiPanels = {
    goal: entity(root, 'a-entity', { position: '0 2.3 0', 'canvas-panel': { width: 1.5, height: 0.8, eyebrow: 'Objetivo del trimestre', title: 'Ganado', progress: 0 } }),
    pipeline: entity(root, 'a-entity', { position: '0 1.4 0', 'canvas-panel': { width: 1.5, height: 0.62, eyebrow: 'Embudo', title: 'En curso' } }),
    pending: entity(root, 'a-entity', { position: '0 0.65 0', 'canvas-panel': { width: 1.5, height: 0.62, eyebrow: 'Por cobrar', title: `${d.risk} clientes en riesgo`, value: euro(d.pending) } })
  };
  updateKpis(d);
}

const ready = scene.hasLoaded ? Promise.resolve() : new Promise(r => scene.addEventListener('loaded', r, { once: true }));
Promise.all([sceneData(), ready]).then(([d]) => {
  buildChart(d);
  buildPipeline(d);
  buildKpis(d);
}).catch(error => setInfo('Error', error.message));
