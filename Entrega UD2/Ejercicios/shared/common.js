// Piezas comunes de los ejercicios: tema, cabecera, avisos, registro, cámara, MediaPipe y datos del CRM.
// Reutiliza el logo y los datos de ejemplo del propio CRM (../../CRM) para que todo cuente la misma historia.
import { logo } from '../../CRM/js/components/logo.js';

// ---------------------------------------------------------------------------
// Tema: el mismo que haya elegido el usuario en el CRM; si no, el del sistema.
// ---------------------------------------------------------------------------
export function applyTheme() {
  let theme = null;
  try { theme = JSON.parse(localStorage.getItem('vdg-crm') || '{}').theme; } catch { /* sin almacenamiento */ }
  theme ??= matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme;
  return theme;
}

const PAGES = [
  ['../index.html', 'Ejercicios', 'index'],
  ['../01-gestos/index.html', 'Gestos', 'gestos'],
  ['../02-detector-facial/index.html', 'Detector facial', 'facial'],
  ['../03-comandos-gestos/index.html', 'Comandos por gestos', 'comandos'],
  ['../04-realidad-aumentada-vr/index.html', 'AR / VR', 'arvr']
];

// Cabecera con navegación entre ejercicios y vuelta al CRM.
export function header(current) {
  applyTheme();
  const top = document.createElement('header');
  top.className = 'ex-top';
  top.innerHTML = `
    <a class="ex-brand" href="../../CRM/index.html" aria-label="Volver al CRM">${logo().replace('<svg', '<svg style="height:22px;width:auto"')}<span class="muted">· UD2</span></a>
    <nav aria-label="Ejercicios">${PAGES.map(([href, label, id]) => `<a href="${href}" ${id === current ? 'aria-current="page"' : ''}>${label}</a>`).join('')}</nav>`;
  document.body.prepend(top);
}

let toastTimer = null;
export function toast(message) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.textContent = message;
  document.body.append(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 2600);
}

// Registro de eventos reconocidos (lo último arriba).
export function logger(list, max = 40) {
  return text => {
    const li = document.createElement('li');
    const now = new Date();
    li.innerHTML = `<time>${now.toLocaleTimeString('es-ES')}</time><span></span>`;
    li.lastChild.textContent = text;
    list.prepend(li);
    while (list.children.length > max) list.lastChild.remove();
  };
}

// ---------------------------------------------------------------------------
// Cámara
// ---------------------------------------------------------------------------
const CAMERA_ERRORS = {
  NotAllowedError: 'Has bloqueado la cámara. Permítela en el candado de la barra de direcciones y vuelve a intentarlo.',
  NotFoundError: 'No se ha encontrado ninguna cámara.',
  NotReadableError: 'La cámara la está usando otra aplicación.',
  SecurityError: 'La cámara solo funciona en https o en localhost.'
};

export async function startCamera(video, { facingMode = 'user', width = 640, height = 480 } = {}) {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error(CAMERA_ERRORS.SecurityError);
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode, width: { ideal: width }, height: { ideal: height } }, audio: false });
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    await video.play();
    return stream;
  } catch (error) {
    throw new Error(CAMERA_ERRORS[error.name] ?? `No se ha podido abrir la cámara (${error.name}).`);
  }
}

export const stopCamera = video => { video.srcObject?.getTracks().forEach(track => track.stop()); video.srcObject = null; };

// ---------------------------------------------------------------------------
// MediaPipe Tasks Vision (Google): modelos de aprendizaje automático ya entrenados que corren en el navegador
// con WebAssembly y la GPU. Versión fijada para que la entrega no cambie sola.
// ---------------------------------------------------------------------------
const MEDIAPIPE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
export const MODELS = {
  face: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
  gesture: 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task',
  pose: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'
};

let visionPromise = null;
export const hasWebGL = () => { try { const c = document.createElement('canvas'); return Boolean(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } };

export function loadVision() {
  // MediaPipe pasa cada fotograma por WebGL incluso en CPU: sin él no puede analizar la imagen.
  if (!hasWebGL()) return Promise.reject(new Error('Este navegador no tiene WebGL (aceleración gráfica). Actívala en la configuración o usa Chrome o Edge actualizados.'));
  visionPromise ??= (async () => {
    const vision = await import(`${MEDIAPIPE}/vision_bundle.mjs`);
    const fileset = await vision.FilesetResolver.forVisionTasks(`${MEDIAPIPE}/wasm`);
    return { vision, fileset };
  })();
  return visionPromise;
}

// La GPU necesita WebGL2; sin él (equipos antiguos, navegadores sin aceleración) se usa la CPU.
const hasWebGL2 = () => { try { return Boolean(document.createElement('canvas').getContext('webgl2')); } catch { return false; } };

// Crea una tarea probando primero la GPU y, si falla, la CPU.
export async function createTask(TaskClass, fileset, options) {
  if (!hasWebGL2()) return TaskClass.createFromOptions(fileset, { ...options, baseOptions: { ...options.baseOptions, delegate: 'CPU' } });
  try {
    return await TaskClass.createFromOptions(fileset, { ...options, baseOptions: { ...options.baseOptions, delegate: 'GPU' } });
  } catch {
    return TaskClass.createFromOptions(fileset, { ...options, baseOptions: { ...options.baseOptions, delegate: 'CPU' } });
  }
}

// Bucle de vídeo: llama a step(ahora) en cada fotograma nuevo. Devuelve una función para pararlo.
export function videoLoop(video, step) {
  let running = true;
  let last = -1;
  const tick = () => {
    if (!running) return;
    if (video.readyState >= 2 && video.currentTime !== last) {
      last = video.currentTime;
      step(performance.now());
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return () => { running = false; };
}

// Igualar el tamaño interno del canvas al del vídeo para que las coordenadas normalizadas encajen.
export function fitCanvas(canvas, video) {
  if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }
}

// Confirma un gesto solo si se mantiene un tiempo: evita disparos por un fotograma suelto.
export class HoldDetector {
  constructor({ hold = 600, cooldown = 900 } = {}) { Object.assign(this, { hold, cooldown, current: null, since: 0, lastFire: -Infinity }); }
  // Devuelve el avance (0–1) del gesto actual y su nombre en el fotograma en que se confirma.
  update(name, now) {
    if (name !== this.current || now - this.lastFire < this.cooldown) { this.current = name; this.since = now; }
    if (!name) return { progress: 0, fired: null };
    const progress = Math.min(1, (now - this.since) / this.hold);
    if (progress < 1) return { progress, fired: null };
    this.lastFire = now;
    this.since = now;
    return { progress: 1, fired: name };
  }
}

// ---------------------------------------------------------------------------
// Datos del CRM (los mismos de la demo, con fechas relativas a hoy)
// ---------------------------------------------------------------------------
let dataPromise = null;
export function crmData() {
  dataPromise ??= fetch(new URL('../../CRM/data/demo.json', import.meta.url)).then(r => {
    if (!r.ok) throw new Error('No se han podido cargar los datos del CRM');
    return r.json();
  });
  return dataPromise;
}

export const euro = n => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
export const STAGES = [['proposal', 'Propuesta'], ['negotiation', 'Negociación'], ['closing', 'Cierre'], ['won', 'Ganada']];
