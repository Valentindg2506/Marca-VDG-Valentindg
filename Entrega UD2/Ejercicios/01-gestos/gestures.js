/* Reconocedor de gestos con Pointer Events (táctil, ratón y lápiz con el mismo código).
   Componente sin dependencias: se engancha a un elemento y emite eventos con el gesto reconocido.

     const g = new PointerGestures(elemento, { swipeMin: 70 });
     g.addEventListener('swipe', e => console.log(e.detail.direction));

   Eventos: tap, doubletap, longpress, pan, panend, swipe, pinch, rotate, pinchend.
   En escritorio: Ctrl + rueda (o pellizco en el trackpad) = pinch; Mayús + rueda = rotate. */

const DEFAULTS = {
  tapMove: 10,        // px que se tolera moverse en un toque
  tapTime: 260,       // ms máximos de un toque
  doubleTapTime: 320, // ms máximos entre dos toques para que sea doble
  longPressTime: 550, // ms manteniendo sin moverse
  swipeMin: 70,       // px mínimos de recorrido para un deslizamiento
  swipeVelocity: 0.3  // px/ms mínimos (o recorrido largo) para un deslizamiento
};

const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const angle = (a, b) => Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;

export class PointerGestures extends EventTarget {
  constructor(element, options = {}) {
    super();
    this.el = element;
    this.opts = { ...DEFAULTS, ...options };
    this.pointers = new Map();
    this.lastTap = null;
    this.longTimer = null;
    this.multi = null;
    this.handlers = {
      pointerdown: e => this.down(e),
      pointermove: e => this.move(e),
      pointerup: e => this.up(e),
      pointercancel: e => this.cancel(e),
      wheel: e => this.wheel(e)
    };
    element.style.touchAction = 'none';
    for (const [type, fn] of Object.entries(this.handlers)) element.addEventListener(type, fn, { passive: type !== 'wheel' });
  }

  destroy() {
    for (const [type, fn] of Object.entries(this.handlers)) this.el.removeEventListener(type, fn);
  }

  emit(type, detail = {}) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  down(event) {
    if (event.button > 0) return;
    try { this.el.setPointerCapture(event.pointerId); } catch { /* puntero sintético o ya liberado */ }
    const p = { x: event.clientX, y: event.clientY };
    this.pointers.set(event.pointerId, { start: p, now: p, t0: performance.now(), type: event.pointerType });
    clearTimeout(this.longTimer);
    if (this.pointers.size === 1) {
      this.longTimer = setTimeout(() => {
        const only = [...this.pointers.values()][0];
        if (only && distance(only.start, only.now) < this.opts.tapMove) {
          only.long = true;
          this.emit('longpress', { x: only.now.x, y: only.now.y });
        }
      }, this.opts.longPressTime);
    } else if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.multi = { d0: distance(a.now, b.now), a0: angle(a.now, b.now) };
    }
  }

  move(event) {
    const p = this.pointers.get(event.pointerId);
    if (!p) return;
    p.now = { x: event.clientX, y: event.clientY };
    if (this.pointers.size === 1 && !p.long) {
      const dx = p.now.x - p.start.x;
      const dy = p.now.y - p.start.y;
      if (Math.hypot(dx, dy) > this.opts.tapMove) {
        clearTimeout(this.longTimer);
        p.panning = true;
        this.emit('pan', { dx, dy, pointerType: p.type });
      }
    } else if (this.pointers.size === 2 && this.multi) {
      const [a, b] = [...this.pointers.values()];
      const scale = distance(a.now, b.now) / (this.multi.d0 || 1);
      let rotation = angle(a.now, b.now) - this.multi.a0;
      if (rotation > 180) rotation -= 360;
      if (rotation < -180) rotation += 360;
      this.emit('pinch', { scale });
      this.emit('rotate', { rotation });
    }
  }

  up(event) {
    const p = this.pointers.get(event.pointerId);
    if (!p) return;
    this.pointers.delete(event.pointerId);
    clearTimeout(this.longTimer);
    if (this.multi) {
      if (this.pointers.size < 2) { this.multi = null; this.emit('pinchend'); }
      // Al soltar un dedo de un pellizco no se cuenta como toque ni deslizamiento.
      for (const other of this.pointers.values()) other.long = true;
      return;
    }
    if (p.long) return;
    const now = performance.now();
    const dt = now - p.t0;
    const dx = p.now.x - p.start.x;
    const dy = p.now.y - p.start.y;
    const dist = Math.hypot(dx, dy);
    if (dist < this.opts.tapMove && dt < this.opts.tapTime) {
      const last = this.lastTap;
      if (last && now - last.t < this.opts.doubleTapTime && distance(last, p.now) < 30) {
        this.lastTap = null;
        this.emit('doubletap', { x: p.now.x, y: p.now.y });
      } else {
        this.lastTap = { ...p.now, t: now };
        this.emit('tap', { x: p.now.x, y: p.now.y });
      }
      return;
    }
    const velocity = dist / dt;
    if (dist >= this.opts.swipeMin && (velocity >= this.opts.swipeVelocity || dist >= this.opts.swipeMin * 2)) {
      const direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      this.emit('swipe', { direction, dx, dy, velocity, distance: dist });
    } else {
      this.emit('panend', { dx, dy });
    }
  }

  cancel(event) {
    this.pointers.delete(event.pointerId);
    clearTimeout(this.longTimer);
    this.multi = null;
    this.emit('panend', { dx: 0, dy: 0 });
  }

  // Trackpad y ratón: el navegador manda el pellizco del trackpad como rueda con Ctrl.
  wheel(event) {
    if (!event.ctrlKey && !event.shiftKey && !event.metaKey) return;
    event.preventDefault();
    if (event.shiftKey) this.emit('rotate', { rotation: (event.deltaY || event.deltaX) * 0.25, relative: true });
    else this.emit('pinch', { scale: Math.exp(-event.deltaY * 0.01), relative: true });
  }
}

/* Agitar el dispositivo (acelerómetro). Llama a onShake como mucho una vez por segundo.
   En iOS hay que pedir permiso desde un toque del usuario: requestPermission(). */
export class ShakeDetector {
  constructor(onShake, { threshold = 18, hits = 3, window = 600 } = {}) {
    Object.assign(this, { onShake, threshold, hits, window, peaks: [], last: 0 });
    this.handler = e => this.motion(e);
  }

  static get supported() { return 'DeviceMotionEvent' in window; }

  async start() {
    if (typeof DeviceMotionEvent?.requestPermission === 'function') {
      const answer = await DeviceMotionEvent.requestPermission();
      if (answer !== 'granted') throw new Error('Permiso de movimiento denegado');
    }
    window.addEventListener('devicemotion', this.handler);
  }

  stop() { window.removeEventListener('devicemotion', this.handler); }

  motion(event) {
    const a = event.acceleration?.x != null ? event.acceleration : event.accelerationIncludingGravity;
    if (!a) return;
    const force = Math.hypot(a.x ?? 0, a.y ?? 0, a.z ?? 0) - (event.acceleration?.x != null ? 0 : 9.8);
    const now = performance.now();
    if (force > this.threshold) this.peaks.push(now);
    this.peaks = this.peaks.filter(t => now - t < this.window);
    if (this.peaks.length >= this.hits && now - this.last > 1000) {
      this.last = now;
      this.peaks = [];
      this.onShake();
    }
  }
}
