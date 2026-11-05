import { header, toast, logger, crmData, euro, STAGES, startCamera, stopCamera, loadVision, createTask, MODELS, videoLoop, fitCanvas, HoldDetector } from '../shared/common.js';

header('comandos');
const $ = s => document.querySelector(s);
const log = logger($('#log'));
const video = $('#video');
const canvas = $('#overlay');
const ctx = canvas.getContext('2d');
const board = $('#board');
const cursor = $('#air-cursor');

// ---------------------------------------------------------------------------
// Embudo de ventas (mismos datos que la página «Ventas» del CRM)
// ---------------------------------------------------------------------------
let deals = [];
let selected = null;
const undoStack = [];

const ordered = () => STAGES.flatMap(([stage]) => deals.filter(d => d.stage === stage));

function renderBoard() {
  board.querySelectorAll('.column').forEach(c => c.remove());
  for (const [stage, label] of STAGES) {
    const list = deals.filter(d => d.stage === stage);
    const column = document.createElement('div');
    column.className = `column ${stage === 'won' ? 'won' : ''}`;
    column.innerHTML = `<h3><span>${label}</span><span class="mono">${list.length}</span></h3>${list.map(d => `
      <button class="deal ${d.id === selected ? 'selected' : ''}" data-id="${d.id}" aria-pressed="${d.id === selected}">
        <strong>${d.title}</strong><small>${d.clientName}</small><span class="mono">${euro(d.amount)}</span>
      </button>`).join('')}`;
    board.append(column);
  }
  const open = deals.filter(d => d.stage !== 'won').reduce((t, d) => t + d.amount, 0);
  $('#pipeline-total').textContent = `${euro(open)} en curso`;
  const deal = deals.find(d => d.id === selected);
  const detail = $('#deal-detail');
  if (deal) detail.innerHTML = `<strong>${deal.title}</strong> · ${deal.clientName}<br>Importe: <strong>${euro(deal.amount)}</strong> · Etapa: <strong>${STAGES.find(([s]) => s === deal.stage)[1]}</strong> · Cierre previsto en ${deal.close} días`;
}

board.addEventListener('click', e => {
  const card = e.target.closest('.deal');
  if (card) select(card.dataset.id, 'Clic');
});

function select(id, source) {
  selected = id;
  renderBoard();
  const deal = deals.find(d => d.id === id);
  if (deal) log(`${source}: ${deal.title}`);
}

function step(n, source) {
  const list = ordered();
  const i = list.findIndex(d => d.id === selected);
  const next = list[(i + n + list.length) % list.length];
  select(next.id, source);
}

function moveStage(n, source) {
  const deal = deals.find(d => d.id === selected);
  if (!deal) return;
  const i = STAGES.findIndex(([s]) => s === deal.stage);
  const target = STAGES[Math.max(0, Math.min(STAGES.length - 1, i + n))];
  if (target[0] === deal.stage) { toast(n > 0 ? 'Ya está ganada' : 'Ya está en la primera etapa'); return; }
  undoStack.push({ id: deal.id, stage: deal.stage });
  deal.stage = target[0];
  renderBoard();
  log(`${source}: «${deal.title}» pasa a ${target[1]}`);
  toast(`${deal.title} → ${target[1]}${target[0] === 'won' ? ' 🎉' : ''}`);
}

function win(source) {
  const deal = deals.find(d => d.id === selected);
  if (!deal || deal.stage === 'won') { toast('Elige una oportunidad abierta'); return; }
  undoStack.push({ id: deal.id, stage: deal.stage });
  deal.stage = 'won';
  renderBoard();
  log(`${source}: ¡venta ganada! ${deal.title}`);
  toast(`🎉 Venta ganada: ${deal.title} (${euro(deal.amount)})`);
}

function undo(source) {
  const last = undoStack.pop();
  if (!last) { toast('No hay nada que deshacer'); return; }
  const deal = deals.find(d => d.id === last.id);
  deal.stage = last.stage;
  selected = deal.id;
  renderBoard();
  log(`${source}: deshecho · ${deal.title}`);
  toast(`Deshecho: ${deal.title}`);
}

function jumpColumn(n, source) {
  const deal = deals.find(d => d.id === selected);
  let i = STAGES.findIndex(([s]) => s === deal?.stage);
  for (let k = 0; k < STAGES.length; k += 1) {
    i = (i + n + STAGES.length) % STAGES.length;
    const first = deals.find(d => d.stage === STAGES[i][0]);
    if (first) { select(first.id, `${source} → ${STAGES[i][1]}`); return; }
  }
}

const toggleDetail = source => {
  const detail = $('#deal-detail');
  detail.hidden = !detail.hidden;
  log(`${source}: ${detail.hidden ? 'detalle oculto' : 'detalle visible'}`);
};

const toggleTheme = source => {
  const root = document.documentElement;
  root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
  log(`${source}: tema ${root.dataset.theme === 'dark' ? 'oscuro' : 'claro'}`);
};

crmData().then(data => {
  const names = Object.fromEntries(data.clients.map(c => [c.id, c.name]));
  deals = data.deals.map(d => ({ ...d, clientName: names[d.client] ?? d.client }));
  selected = ordered()[0]?.id;
  renderBoard();
});

// ---------------------------------------------------------------------------
// Órdenes de cada gesto
// ---------------------------------------------------------------------------
const HAND = {
  Pointing_Up: { emoji: '☝️', label: 'Índice arriba', run: () => step(1, '☝️ Índice arriba') },
  Victory: { emoji: '✌️', label: 'Victoria', run: () => step(-1, '✌️ Victoria') },
  Thumb_Up: { emoji: '👍', label: 'Pulgar arriba', run: () => moveStage(1, '👍 Pulgar arriba') },
  Thumb_Down: { emoji: '👎', label: 'Pulgar abajo', run: () => moveStage(-1, '👎 Pulgar abajo') },
  Open_Palm: { emoji: '✋', label: 'Mano abierta', run: () => toggleDetail('✋ Mano abierta') },
  Closed_Fist: { emoji: '✊', label: 'Puño', run: () => undo('✊ Puño') },
  ILoveYou: { emoji: '🤟', label: 'Te quiero', run: () => toggleTheme('🤟 Te quiero') }
};
const BODY = {
  both_up: { emoji: '🙌', label: 'Brazos arriba', run: () => win('🙌 Brazos arriba') },
  t_pose: { emoji: '🧍', label: 'Brazos en cruz', run: () => undo('🧍 Brazos en cruz') },
  right_up: { emoji: '🙋', label: 'Brazo derecho arriba', run: () => step(1, '🙋 Brazo derecho') },
  left_up: { emoji: '🙋‍♂️', label: 'Brazo izquierdo arriba', run: () => step(-1, '🙋‍♂️ Brazo izquierdo') },
  lean_right: { emoji: '↗️', label: 'Inclinación a la derecha', run: () => moveStage(1, '↗️ Inclinación derecha'), row: 'lean' },
  lean_left: { emoji: '↖️', label: 'Inclinación a la izquierda', run: () => moveStage(-1, '↖️ Inclinación izquierda'), row: 'lean' }
};

function showNow(def, name, scoreText, progress) {
  $('#now-emoji').textContent = def?.emoji ?? '·';
  $('#now-label').textContent = def?.label ?? 'Ninguno';
  $('#now-score').textContent = scoreText;
  $('#ring').style.setProperty('--p', progress);
  document.querySelectorAll('[data-cmd]').forEach(tr => tr.classList.toggle('is-active', Boolean(name) && tr.dataset.cmd === (def?.row ?? name)));
}

// ---------------------------------------------------------------------------
// Manos: gesto + cursor aéreo con pinza + barrido
// ---------------------------------------------------------------------------
const hold = new HoldDetector({ hold: 650, cooldown: 1000 });
const wristTrail = [];
let lastSwipe = 0;
let pinching = false;

function airCursor(points) {
  // Zona cómoda de la imagen → tablero. Espejado: mover la mano a tu derecha mueve el cursor a la derecha.
  const x = Math.min(1, Math.max(0, ((1 - points[8].x) - 0.15) / 0.7));
  const y = Math.min(1, Math.max(0, (points[8].y - 0.15) / 0.6));
  const rect = board.getBoundingClientRect();
  cursor.hidden = false;
  cursor.style.left = `${x * rect.width}px`;
  cursor.style.top = `${y * rect.height}px`;
  const palm = Math.hypot(points[0].x - points[9].x, points[0].y - points[9].y) || 1;
  const pinch = Math.hypot(points[4].x - points[8].x, points[4].y - points[8].y) / palm < 0.3;
  cursor.classList.toggle('pinch', pinch);
  if (pinch && !pinching) {
    const target = document.elementFromPoint(rect.left + x * rect.width, rect.top + y * rect.height)?.closest('.deal');
    if (target) {
      select(target.dataset.id, '🤏 Pinza');
      document.querySelectorAll('[data-cmd="pinch"]').forEach(tr => { tr.classList.add('is-active'); });
    }
  }
  pinching = pinch;
}

function swipe(points, now) {
  wristTrail.push({ x: 1 - points[0].x, t: now });
  while (wristTrail.length && now - wristTrail[0].t > 350) wristTrail.shift();
  const dx = wristTrail.at(-1).x - wristTrail[0].x;
  if (Math.abs(dx) > 0.28 && now - lastSwipe > 900) {
    lastSwipe = now;
    wristTrail.length = 0;
    jumpColumn(dx > 0 ? 1 : -1, `👋 Barrido a la ${dx > 0 ? 'derecha' : 'izquierda'}`);
    return true;
  }
  return false;
}

function handsFrame(result, now, draw, vision) {
  const hands = result.landmarks ?? [];
  hands.forEach(points => {
    draw.drawConnectors(points, vision.GestureRecognizer.HAND_CONNECTIONS, { color: '#ed533e', lineWidth: 4 });
    draw.drawLandmarks(points, { color: '#ffffff', fillColor: '#ed533e', lineWidth: 1, radius: 4 });
  });
  if (!hands.length) { cursor.hidden = true; wristTrail.length = 0; showNow(null, null, '—', 0); hold.update(null, now); return; }
  const best = result.gestures.map((g, i) => ({ ...g[0], i })).sort((a, b) => b.score - a.score)[0];
  const points = hands[best.i];
  airCursor(points);
  if (swipe(points, now)) { hold.update(null, now); return; }
  const name = best.categoryName !== 'None' && best.score > 0.6 && HAND[best.categoryName] ? best.categoryName : null;
  const { progress, fired } = hold.update(name, now);
  showNow(HAND[name], name, name ? `${Math.round(best.score * 100)} % de confianza` : 'Sin gesto', progress);
  if (fired) HAND[fired].run();
}

// ---------------------------------------------------------------------------
// Cuerpo: posturas a partir de los 33 puntos del esqueleto
// ---------------------------------------------------------------------------
const bodyHold = new HoldDetector({ hold: 700, cooldown: 1200 });

function posture(p) {
  const seen = i => (p[i]?.visibility ?? 0) > 0.5;
  if (![11, 12].every(seen)) return null;
  const [ls, rs, lw, rw, nose] = [p[11], p[12], p[15], p[16], p[0]];
  const width = Math.abs(ls.x - rs.x) || 0.01;
  const leftUp = seen(15) && lw.y < ls.y - 0.08;
  const rightUp = seen(16) && rw.y < rs.y - 0.08;
  if (leftUp && rightUp && lw.y < nose.y && rw.y < nose.y) return 'both_up';
  if (seen(15) && seen(16) && Math.abs(lw.y - ls.y) < 0.09 && Math.abs(rw.y - rs.y) < 0.09 && Math.abs(lw.x - rw.x) > width * 2.6) return 't_pose';
  if (rightUp && !leftUp) return 'right_up';
  if (leftUp && !rightUp) return 'left_up';
  // Inclinación: un hombro claramente más bajo que el otro (y crece hacia abajo).
  const tilt = (rs.y - ls.y) / width;
  if (tilt > 0.35) return 'lean_right';
  if (tilt < -0.35) return 'lean_left';
  return null;
}

function bodyFrame(result, now, draw, vision) {
  const pose = result.landmarks?.[0];
  if (!pose) { showNow(null, null, 'Colócate de cuerpo entero (al menos de cintura para arriba)', 0); bodyHold.update(null, now); return; }
  draw.drawConnectors(pose, vision.PoseLandmarker.POSE_CONNECTIONS, { color: '#ed533e', lineWidth: 4 });
  draw.drawLandmarks(pose, { color: '#ffffff', fillColor: '#2ca67c', lineWidth: 1, radius: 4 });
  const name = posture(pose);
  const { progress, fired } = bodyHold.update(name, now);
  showNow(BODY[name], name, name ? 'Mantén la postura…' : 'Postura neutra', progress);
  if (fired) BODY[fired].run();
}

// ---------------------------------------------------------------------------
// Cámara, modelos y modo
// ---------------------------------------------------------------------------
let mode = 'hands';
const tasks = {};
let stopLoop = null;

async function ensureTask(vision, fileset) {
  if (mode === 'hands') {
    tasks.hands ??= await createTask(vision.GestureRecognizer, fileset, { baseOptions: { modelAssetPath: MODELS.gesture }, runningMode: 'VIDEO', numHands: 2 });
  } else {
    tasks.body ??= await createTask(vision.PoseLandmarker, fileset, { baseOptions: { modelAssetPath: MODELS.pose }, runningMode: 'VIDEO', numPoses: 1 });
  }
}

async function start() {
  const msg = $('#stage-msg');
  $('#start').disabled = true;
  msg.querySelector('span').textContent = `Cargando el modelo de ${mode === 'hands' ? 'gestos de la mano' : 'postura corporal'}…`;
  try {
    const { vision, fileset } = await loadVision();
    await ensureTask(vision, fileset);
    if (!video.srcObject) {
      msg.querySelector('span').textContent = 'Abriendo la cámara…';
      await startCamera(video);
    }
    msg.hidden = true;
    $('#fps').hidden = false;
    $('#stop').disabled = false;
    log(`Reconocimiento de ${mode === 'hands' ? 'manos' : 'cuerpo'} activo`);
    const draw = new vision.DrawingUtils(ctx);
    let frames = 0;
    let since = performance.now();
    stopLoop?.();
    stopLoop = videoLoop(video, now => {
      fitCanvas(canvas, video);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (mode === 'hands' && tasks.hands) handsFrame(tasks.hands.recognizeForVideo(video, now), now, draw, vision);
      else if (mode === 'body' && tasks.body) bodyFrame(tasks.body.detectForVideo(video, now), now, draw, vision);
      frames += 1;
      if (now - since > 1000) { $('#fps').textContent = `${frames} fps · ${mode === 'hands' ? 'manos' : 'cuerpo'}`; frames = 0; since = now; }
    });
  } catch (error) {
    console.error(error);
    msg.hidden = false;
    msg.querySelector('span').textContent = error.message;
    $('#start').disabled = false;
    toast(error.message);
  }
}

function stop() {
  stopLoop?.();
  stopLoop = null;
  stopCamera(video);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  cursor.hidden = true;
  showNow(null, null, '—', 0);
  $('#stage-msg').hidden = false;
  $('#stage-msg span').textContent = 'Cámara parada.';
  $('#start').disabled = false;
  $('#stop').disabled = true;
  $('#fps').hidden = true;
  log('Cámara parada');
}

document.querySelectorAll('[data-mode]').forEach(btn => btn.addEventListener('click', () => {
  mode = btn.dataset.mode;
  document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
  document.querySelectorAll('[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== mode; });
  cursor.hidden = true;
  showNow(null, null, '—', 0);
  if (video.srcObject) start();
}));

$('#start').addEventListener('click', start);
$('#stop').addEventListener('click', stop);
