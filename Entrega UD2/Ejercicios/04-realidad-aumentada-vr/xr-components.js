/* Componentes de A-Frame compartidos por la escena VR y la AR. Se cargan después de aframe.js.
   - canvas-panel: panel con texto pintado en un canvas (admite tildes y la tipografía de la marca).
   - hover-grow:   crece al pasar el cursor o el láser por encima.
   - sway:         balanceo suave (para el tótem de AR).
   - drag-rotate:  arrastrar con el dedo o el ratón gira el objeto (modo cámara sin WebXR). */
/* global AFRAME, THREE */

const FONT = '"Instrument Sans", system-ui, sans-serif';
const MONO = '"DM Mono", ui-monospace, monospace';

AFRAME.registerComponent('canvas-panel', {
  schema: {
    width: { default: 1.6 },
    height: { default: 0.9 },
    eyebrow: { default: '' },
    title: { default: '' },
    value: { default: '' },
    note: { default: '' },
    background: { default: '#1b1a20' },
    color: { default: '#f4f2f6' },
    accent: { default: '#f65d49' },
    progress: { default: -1 }
  },
  init() {
    this.canvas = document.createElement('canvas');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    const geometry = new THREE.PlaneGeometry(1, 1);
    const material = new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geometry, material);
    this.el.setObject3D('mesh', this.mesh);
    // Repinta cuando ya están las fuentes de la marca.
    document.fonts?.ready.then(() => this.draw());
  },
  update() { this.draw(); },
  draw() {
    const d = this.data;
    const scale = 512;
    const w = Math.round(d.width * scale);
    const h = Math.round(d.height * scale);
    this.canvas.width = w;
    this.canvas.height = h;
    const g = this.canvas.getContext('2d');
    const r = 36;
    g.clearRect(0, 0, w, h);
    g.fillStyle = d.background;
    g.beginPath();
    g.roundRect(0, 0, w, h, r);
    g.fill();
    const pad = 42;
    let y = pad + 10;
    if (d.eyebrow) {
      g.fillStyle = d.accent;
      g.font = `500 26px ${MONO}`;
      g.fillText(d.eyebrow.toUpperCase(), pad, y + 16);
      y += 52;
    }
    if (d.title) {
      g.fillStyle = d.color;
      const size = d.value ? 40 : 46;
      g.font = `700 ${size}px ${FONT}`;
      const lines = Math.min(2, wrap(g, d.title, pad, y + 30, w - pad * 2, size + 8, 2).length);
      y += lines * (size + 8) + 16;
    }
    if (d.value) {
      g.fillStyle = d.color;
      g.font = `500 ${Math.min(96, h / 4)}px ${MONO}`;
      g.fillText(d.value, pad, y + Math.min(80, h / 5));
      y += Math.min(100, h / 4) + 10;
    }
    if (d.progress >= 0) {
      const bw = w - pad * 2;
      g.fillStyle = 'rgba(255,255,255,.15)';
      g.beginPath(); g.roundRect(pad, y, bw, 18, 9); g.fill();
      g.fillStyle = d.accent;
      g.beginPath(); g.roundRect(pad, y, Math.max(18, bw * Math.min(1, d.progress)), 18, 9); g.fill();
      y += 44;
    }
    if (d.note) {
      g.fillStyle = d.color;
      g.globalAlpha = 0.7;
      g.font = `500 28px ${FONT}`;
      wrap(g, d.note, pad, y + 20, w - pad * 2, 36, 3);
      g.globalAlpha = 1;
    }
    this.texture.needsUpdate = true;
    this.mesh.scale.set(d.width, d.height, 1);
  },
  remove() { this.el.removeObject3D('mesh'); this.texture.dispose(); }
});

// Texto en varias líneas dentro de un ancho.
function wrap(g, text, x, y, maxWidth, lineHeight, maxLines) {
  const words = String(text).split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (g.measureText(test).width > maxWidth && line) { lines.push(line); line = word; } else line = test;
  }
  lines.push(line);
  lines.slice(0, maxLines).forEach((l, i) => g.fillText(i === maxLines - 1 && lines.length > maxLines ? `${l}…` : l, x, y + i * lineHeight));
  return lines;
}

AFRAME.registerComponent('hover-grow', {
  schema: { scale: { default: 1.08 } },
  init() {
    const base = this.el.object3D.scale.clone();
    this.el.addEventListener('mouseenter', () => this.el.object3D.scale.copy(base).multiplyScalar(this.data.scale));
    this.el.addEventListener('mouseleave', () => this.el.object3D.scale.copy(base));
  }
});

// Balanceo suave a izquierda y derecha: da volumen sin dejar nunca el panel de espaldas.
AFRAME.registerComponent('sway', {
  schema: { amplitude: { default: 20 }, period: { default: 8 } }, // grados y segundos
  tick(time) {
    this.el.object3D.rotation.y = THREE.MathUtils.degToRad(this.data.amplitude) * Math.sin(time / 1000 * 2 * Math.PI / this.data.period);
  }
});

AFRAME.registerComponent('drag-rotate', {
  init() {
    let lastX = null;
    const canvas = () => this.el.sceneEl.canvas;
    const down = e => { lastX = e.clientX; };
    const move = e => {
      if (lastX === null) return;
      this.el.object3D.rotation.y += (e.clientX - lastX) * 0.01;
      lastX = e.clientX;
    };
    const up = () => { lastX = null; };
    const attach = () => {
      canvas().addEventListener('pointerdown', down);
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    };
    if (this.el.sceneEl.hasLoaded) attach(); else this.el.sceneEl.addEventListener('loaded', attach);
  }
});
