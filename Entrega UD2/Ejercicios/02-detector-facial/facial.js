import { header, toast, logger, crmData, euro, startCamera, stopCamera, loadVision, createTask, MODELS, videoLoop, fitCanvas } from '../shared/common.js';

header('facial');
const $ = s => document.querySelector(s);
const log = logger($('#log'));
const video = $('#video');
const canvas = $('#overlay');
const ctx = canvas.getContext('2d');

// ---------------------------------------------------------------------------
// Pantalla del CRM que se controla con la cara
// ---------------------------------------------------------------------------
let clients = [];
let index = 0;
const stars = {};

function renderClient() {
  const c = clients[index];
  if (!c) return;
  $('#client-name').textContent = c.name;
  $('#client-meta').textContent = `${c.sector} · ${c.city}`;
  $('#client-pending').textContent = euro(c.pending);
  $('#client-billed').textContent = euro(c.billed);
  $('#client-stars').textContent = '★'.repeat(stars[c.id] ?? 0) + '☆'.repeat(3 - (stars[c.id] ?? 0));
  $('#detail').innerHTML = `<strong>Contactos</strong><br>${c.contacts.map(p => `${p.name} · ${p.role}`).join('<br>') || 'Sin contactos'}<br><span class="muted">Último contacto hace ${-c.lastContact} días</span>`;
  $('#dots').innerHTML = clients.map((_, i) => `<i class="${i === index ? 'on' : ''}"></i>`).join('');
}
const move = (step, source) => {
  index = (index + step + clients.length) % clients.length;
  renderClient();
  log(`${source}: ${clients[index].name}`);
};
$('#prev').addEventListener('click', () => move(-1, 'Botón'));
$('#next').addEventListener('click', () => move(1, 'Botón'));

crmData().then(data => {
  const pending = {};
  for (const inv of data.invoices.filter(i => i.paid === null)) {
    pending[inv.client] = (pending[inv.client] ?? 0) + inv.lines.reduce((t, [, q, p, vat = 21]) => t + q * p * (1 + vat / 100), 0);
  }
  clients = data.clients.map(c => ({ ...c, pending: Math.round(pending[c.id] ?? 0) })).sort((a, b) => b.pending - a.pending).slice(0, 8);
  renderClient();
});

// ---------------------------------------------------------------------------
// Privacidad: se ocultan las cifras si no hay nadie o si hay más de una cara
// ---------------------------------------------------------------------------
let privateReason = '';
function setPrivate(reason) {
  if (reason === privateReason) return;
  privateReason = reason;
  $('#screen').classList.toggle('is-private', Boolean(reason));
  $('#privacy-reason').textContent = reason;
  document.querySelectorAll('[data-rule="away"], [data-rule="crowd"]').forEach(tr => tr.classList.remove('is-active'));
  if (reason) {
    document.querySelector(`[data-rule="${reason.startsWith('No hay') ? 'away' : 'crowd'}"]`)?.classList.add('is-active');
    log(`Privacidad: ${reason}`);
  } else log('Privacidad: cifras visibles de nuevo');
}

// ---------------------------------------------------------------------------
// Lectura de la cara: expresiones (blendshapes) y giro a partir de los puntos
// ---------------------------------------------------------------------------
const score = (shapes, name) => shapes?.categories.find(c => c.categoryName === name)?.score ?? 0;

// Giro aproximado: dónde queda la punta de la nariz entre las dos mejillas (0,5 = de frente).
// La imagen de la cámara no está espejada: si giras hacia tu izquierda, la nariz va hacia la derecha de la imagen.
function headYaw(points) {
  const nose = points[1];
  const left = points[234];
  const right = points[454];
  const ratio = (nose.x - left.x) / ((right.x - left.x) || 1);
  return Math.max(-60, Math.min(60, (0.5 - ratio) * 150)); // grados aproximados: negativo = tu izquierda
}

const setMeter = (id, value) => {
  $(`#m-${id}`).textContent = `${Math.round(value * 100)} %`;
  $(`#b-${id}`).style.width = `${Math.round(value * 100)}%`;
};

function flash(rule) {
  const row = document.querySelector(`[data-rule="${rule}"]`);
  row?.classList.add('is-active');
  setTimeout(() => row?.classList.remove('is-active'), 900);
}

// Estado de los comandos con la cara
const cmd = { turnSince: 0, turnDir: 0, lastTurn: 0, smileSince: 0, lastSmile: 0, jawSince: 0, lastJaw: 0, blinks: [], eyesClosed: false, lastBlinkCmd: 0 };
let noFaceSince = 0;

function commands(face, now) {
  const shapes = face.shapes;
  // Girar la cabeza: mantener 400 ms más de 18° y esperar a volver al centro para repetir.
  const yaw = headYaw(face.points);
  const dir = yaw < -18 ? -1 : yaw > 18 ? 1 : 0;
  if (dir === 0) cmd.turnDir = 0;
  else if (dir !== cmd.turnDir) { cmd.turnDir = dir; cmd.turnSince = now; cmd.fired = false; }
  else if (!cmd.fired && now - cmd.turnSince > 400) {
    cmd.fired = true;
    flash('turn');
    move(dir, `Cabeza a la ${dir < 0 ? 'izquierda' : 'derecha'}`);
  }

  // Sonrisa mantenida 1 s → una estrella más
  const smile = (score(shapes, 'mouthSmileLeft') + score(shapes, 'mouthSmileRight')) / 2;
  if (smile > 0.55) {
    cmd.smileSince ||= now;
    if (now - cmd.smileSince > 1000 && now - cmd.lastSmile > 2000) {
      cmd.lastSmile = now;
      const c = clients[index];
      stars[c.id] = Math.min(3, (stars[c.id] ?? 0) + 1);
      renderClient();
      flash('smile');
      log(`Sonrisa: ${c.name} · satisfacción ${stars[c.id]}/3`);
      toast(`😊 ${c.name}: satisfacción ${stars[c.id]}/3`);
    }
  } else cmd.smileSince = 0;

  // Doble parpadeo voluntario (dos cierres de ambos ojos en menos de 800 ms)
  const blink = (score(shapes, 'eyeBlinkLeft') + score(shapes, 'eyeBlinkRight')) / 2;
  if (blink > 0.55 && !cmd.eyesClosed) { cmd.eyesClosed = true; cmd.blinks.push(now); }
  if (blink < 0.3) cmd.eyesClosed = false;
  cmd.blinks = cmd.blinks.filter(t => now - t < 800);
  if (cmd.blinks.length >= 2 && now - cmd.lastBlinkCmd > 1200) {
    cmd.lastBlinkCmd = now;
    cmd.blinks = [];
    $('#screen').classList.toggle('show-detail');
    flash('blink');
    log(`Doble parpadeo: ${$('#screen').classList.contains('show-detail') ? 'detalle abierto' : 'detalle cerrado'}`);
  }

  // Boca abierta 1 s → lectura en voz alta (síntesis de voz)
  const jaw = score(shapes, 'jawOpen');
  if (jaw > 0.5) {
    cmd.jawSince ||= now;
    if (now - cmd.jawSince > 1000 && now - cmd.lastJaw > 4000) {
      cmd.lastJaw = now;
      const c = clients[index];
      const text = privateReason ? `${c.name}. Las cifras están ocultas.` : `${c.name}, de ${c.city}. Pendiente de cobro: ${euro(c.pending)}.`;
      if ('speechSynthesis' in window) {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'es-ES';
        speechSynthesis.speak(u);
      }
      flash('jaw');
      log(`Boca abierta: lectura de ${c.name}`);
    }
  } else cmd.jawSince = 0;

  return { yaw, smile, blink, jaw };
}

// ---------------------------------------------------------------------------
// Dibujo: caja, malla y contornos
// ---------------------------------------------------------------------------
function drawFace(points, draw, vision, i) {
  const xs = points.map(p => p.x * canvas.width);
  const ys = points.map(p => p.y * canvas.height);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const color = i === 0 ? '#ed533e' : '#f5b041';
  if ($('#mesh').checked) {
    draw.drawConnectors(points, vision.FaceLandmarker.FACE_LANDMARKS_TESSELATION, { color: 'rgba(255,255,255,.18)', lineWidth: 0.6 });
    draw.drawConnectors(points, vision.FaceLandmarker.FACE_LANDMARKS_FACE_OVAL, { color, lineWidth: 2 });
    draw.drawConnectors(points, vision.FaceLandmarker.FACE_LANDMARKS_LEFT_EYE, { color: '#61d2a6', lineWidth: 1.5 });
    draw.drawConnectors(points, vision.FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE, { color: '#61d2a6', lineWidth: 1.5 });
    draw.drawConnectors(points, vision.FaceLandmarker.FACE_LANDMARKS_LIPS, { color, lineWidth: 1.5 });
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 6]);
  ctx.strokeRect(x0 - 10, y0 - 10, x1 - x0 + 20, y1 - y0 + 20);
  ctx.setLineDash([]);
  // Etiqueta (el canvas está espejado con CSS: se invierte el texto para que se lea bien)
  ctx.save();
  ctx.scale(-1, 1);
  ctx.fillStyle = color;
  ctx.font = '600 16px "Instrument Sans", sans-serif';
  ctx.fillText(i === 0 ? 'Tú' : `Persona ${i + 1}`, -x1 - 10, y0 - 18);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Cámara y modelo
// ---------------------------------------------------------------------------
let landmarker = null;
let stopLoop = null;

async function start() {
  const msg = $('#stage-msg');
  $('#start').disabled = true;
  msg.querySelector('span').textContent = 'Cargando el modelo de detección facial…';
  try {
    const { vision, fileset } = await loadVision();
    landmarker ??= await createTask(vision.FaceLandmarker, fileset, {
      baseOptions: { modelAssetPath: MODELS.face },
      runningMode: 'VIDEO',
      numFaces: 3,
      outputFaceBlendshapes: true
    });
    msg.querySelector('span').textContent = 'Abriendo la cámara…';
    await startCamera(video);
    msg.hidden = true;
    $('#fps').hidden = false;
    $('#stop').disabled = false;
    log('Cámara y modelo listos');
    const draw = new vision.DrawingUtils(ctx);
    let frames = 0;
    let fpsSince = performance.now();
    stopLoop = videoLoop(video, now => {
      fitCanvas(canvas, video);
      const result = landmarker.detectForVideo(video, now);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const faces = result.faceLandmarks.map((points, i) => ({ points, shapes: result.faceBlendshapes?.[i] }));
      faces.forEach((face, i) => drawFace(face.points, draw, vision, i));
      $('#m-faces').textContent = faces.length;

      // Privacidad automática
      if ($('#opt-privacy').checked) {
        if (faces.length === 0) { noFaceSince ||= now; if (now - noFaceSince > 2000) setPrivate('No hay nadie delante de la pantalla'); }
        else { noFaceSince = 0; setPrivate(faces.length > 1 ? `Hay ${faces.length} personas mirando la pantalla` : ''); }
      } else setPrivate('');

      if (faces[0]) {
        // Solo la cara principal da órdenes: las demás solo cuentan para la privacidad.
        const m = $('#opt-commands').checked ? commands(faces[0], now) : { yaw: headYaw(faces[0].points), smile: 0, blink: 0, jaw: 0 };
        setMeter('smile', m.smile);
        setMeter('blink', m.blink);
        setMeter('jaw', m.jaw);
        $('#m-yaw').textContent = `${Math.round(m.yaw)}°`;
        $('#g-yaw').style.left = `${50 + m.yaw / 60 * 50}%`;
      }
      frames += 1;
      if (now - fpsSince > 1000) { $('#fps').textContent = `${frames} fps · ${faces.length} cara${faces.length === 1 ? '' : 's'}`; frames = 0; fpsSince = now; }
    });
  } catch (error) {
    console.error(error);
    msg.querySelector('span').textContent = error.message;
    $('#start').disabled = false;
    toast(error.message);
  }
}

function stop() {
  stopLoop?.();
  stopCamera(video);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  setPrivate('');
  $('#stage-msg').hidden = false;
  $('#stage-msg span').textContent = 'Cámara parada.';
  $('#start').disabled = false;
  $('#stop').disabled = true;
  $('#fps').hidden = true;
  log('Cámara parada');
}

$('#start').addEventListener('click', start);
$('#stop').addEventListener('click', stop);
