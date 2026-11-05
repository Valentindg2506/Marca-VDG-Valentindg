// Realidad aumentada: tótem 3D con los indicadores del CRM.
// - Con WebXR (Android con ARCore, gafas con passthrough): se coloca sobre una superficie real tocándola (hit-test).
// - Sin WebXR (ordenador, iPhone): se pinta encima de la imagen de la cámara y se orienta con el giroscopio.
import { sceneData, entity, euro } from './xr-data.js';
import { startCamera, stopCamera } from '../shared/common.js';

const $ = s => document.querySelector(s);
const scene = $('a-scene');
const totem = $('#totem');
const video = $('#camera');
const status = text => { $('#status').textContent = text; };

let panel = null;

function buildTotem(d) {
  const totem = $('#totem-body');
  entity(totem, 'a-cylinder', { radius: 0.62, height: 0.04, position: '0 -0.3 0', material: 'color: #1b1a20; roughness: 0.6' });
  entity(totem, 'a-torus', { radius: 0.62, 'radius-tubular': 0.008, rotation: '90 0 0', position: '0 -0.28 0', material: 'color: #f65d49; shader: flat' });

  // Mini gráfico de barras en arco
  const max = Math.max(...d.billed);
  d.billed.forEach((value, i) => {
    const h = Math.max(0.03, value / max * 0.55);
    const a = (-75 + i * (150 / (d.billed.length - 1))) * Math.PI / 180;
    const last = i === d.billed.length - 1;
    const bar = entity(totem, 'a-box', {
      class: 'clickable',
      position: `${Math.sin(a) * 0.45} ${-0.28 + h / 2} ${-Math.cos(a) * 0.45 * 0.6}`,
      rotation: `0 ${-a * 180 / Math.PI} 0`,
      width: 0.06, depth: 0.06, height: h,
      material: `color: ${last ? '#f65d49' : '#ef6c59'}; opacity: ${last ? 1 : 0.7}; transparent: true`,
      'hover-grow': 'scale: 1.15',
      animation: `property: scale; from: 1 0.01 1; to: 1 1 1; dur: 800; delay: ${i * 50}; easing: easeOutCubic`
    });
    bar.addEventListener('click', () => {
      panel.setAttribute('canvas-panel', { eyebrow: d.months[i], title: 'Facturado', value: euro(value), note: `Cobrado ${euro(d.collected[i])}`, progress: -1 });
      status(`${d.months[i]}: ${euro(value)}`);
    });
  });

  // Anillo de progreso del objetivo trimestral
  const pct = Math.min(1, d.quarter.won / d.quarter.target);
  entity(totem, 'a-ring', { 'radius-inner': 0.44, 'radius-outer': 0.48, position: '0 0.62 -0.05', material: 'color: #39363e; shader: flat; side: double' });
  entity(totem, 'a-ring', {
    'radius-inner': 0.44, 'radius-outer': 0.48, 'theta-start': 90, 'theta-length': 0.1, position: '0 0.62 -0.04',
    material: 'color: #f65d49; shader: flat; side: double',
    animation: `property: geometry.thetaLength; to: ${-pct * 360}; dur: 1600; easing: easeOutCubic`
  });

  panel = entity(totem, 'a-entity', {
    position: '0 0.62 -0.03',
    'canvas-panel': { width: 0.8, height: 0.56, eyebrow: 'Objetivo', title: `${Math.round(pct * 100)} % del trimestre`, value: euro(d.quarter.won), note: `de ${euro(d.quarter.target)}`, background: '#1b1a20ee' }
  });
  entity(totem, 'a-entity', {
    position: '0 -0.12 0.5', rotation: '-25 0 0',
    'canvas-panel': { width: 0.66, height: 0.4, eyebrow: 'Por cobrar', value: euro(d.pending), note: `${d.risk} clientes en riesgo`, background: '#1b1a20dd' }
  });
}

// ---------------------------------------------------------------------------
// Modo WebXR
// ---------------------------------------------------------------------------
async function checkSupport() {
  const ar = await navigator.xr?.isSessionSupported?.('immersive-ar').catch(() => false);
  if (ar) {
    $('#enter-ar').hidden = false;
    $('#help').textContent = 'Este dispositivo admite WebXR: entra en AR, apunta a una mesa o al suelo y toca para colocar el panel. También puedes verlo sobre la cámara.';
  } else {
    $('#help').textContent = 'Este navegador no admite AR inmersiva (WebXR). Pulsa «Ver sobre la cámara»: el panel se dibuja encima de la imagen real y se mueve con el móvil. Arrástralo para girarlo y toca las barras.';
  }
}

$('#enter-ar').addEventListener('click', () => scene.enterAR().catch(error => status(`No se ha podido entrar en AR: ${error.message}`)));

scene.addEventListener('enter-vr', () => {
  if (!scene.is('ar-mode')) return;
  stopCamera(video);
  video.hidden = true;
  totem.object3D.scale.setScalar(0.35);
  status('Mueve el móvil despacio hasta ver el marco y toca para colocar el panel.');
});
scene.addEventListener('exit-vr', () => {
  totem.object3D.scale.setScalar(1);
  totem.setAttribute('position', '0 1.55 -2');
  status('Has salido de AR.');
});
scene.addEventListener('ar-hit-test-select', () => status('Panel colocado. Toca otra superficie para moverlo.'));

// ---------------------------------------------------------------------------
// Modo cámara (sin WebXR): vídeo detrás del lienzo transparente de A-Frame
// ---------------------------------------------------------------------------
$('#use-camera').addEventListener('click', async () => {
  if (video.srcObject) {
    stopCamera(video);
    video.hidden = true;
    $('#use-camera').textContent = 'Ver sobre la cámara';
    status('Cámara parada.');
    return;
  }
  try {
    await startCamera(video, { facingMode: 'environment', width: 1280, height: 720 });
    video.hidden = false;
    $('#use-camera').textContent = 'Parar la cámara';
    status('Cámara activa. En el móvil, gira alrededor: el panel se queda en su sitio.');
    // iOS pide permiso para el giroscopio desde un toque del usuario.
    if (typeof DeviceOrientationEvent?.requestPermission === 'function') await DeviceOrientationEvent.requestPermission().catch(() => {});
  } catch (error) {
    status(error.message);
  }
});

const ready = scene.hasLoaded ? Promise.resolve() : new Promise(r => scene.addEventListener('loaded', r, { once: true }));
Promise.all([sceneData(), ready]).then(([d]) => buildTotem(d)).catch(error => status(error.message));
checkSupport();
