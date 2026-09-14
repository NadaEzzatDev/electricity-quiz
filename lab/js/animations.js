/**
 * animations.js
 * -------------
 * Visual feedback layer: current-flow motion on wires, LED glow, switch
 * toggle motion, toast messages, and the challenge-complete celebration.
 * Operates on DOM/SVG nodes handed to it by app.js — it does not know
 * about circuit structure or electrical math.
 */

const Animations = {
  /**
   * Turns the "flowing current" look on/off for a set of wire <path>/<line>
   * elements, and scales the animation speed to the current magnitude.
   * amps === null means "very large" (short/overload) -> fastest speed.
   */
  setWireFlow(wireEls, amps) {
    const flowing = amps !== 0 && amps !== undefined;
    wireEls.forEach((el) => {
      el.classList.toggle('flowing', !!flowing);
      if (flowing) {
        const magnitude = amps === null ? 0.08 : Math.min(Math.abs(amps), 0.08);
        // Higher current -> shorter duration (faster dash motion). Clamp to a sane range.
        const duration = Math.max(0.35, 1.1 - magnitude * 10);
        el.style.setProperty('--flow-duration', `${duration}s`);
      }
    });
  },

  /** Sets LED glow intensity (0-1) on its bulb + rays. */
  setLedBrightness(ledId, brightness) {
    const bulb = document.getElementById(`bulb-${ledId}`);
    const rays = document.getElementById(`rays-${ledId}`);
    if (!bulb) return;
    const b = Math.max(0, Math.min(1, brightness || 0));
    bulb.style.setProperty('--brightness', b.toFixed(3));
    bulb.classList.toggle('lit', b > 0.02);
    if (rays) rays.classList.toggle('lit', b > 0.15);
  },

  /** Marks an LED bulb as burnt out (blackened). */
  setLedBurnt(ledId, burnt) {
    const bulb = document.getElementById(`bulb-${ledId}`);
    if (!bulb) return;
    bulb.classList.toggle('burnt', !!burnt);
    if (burnt) {
      bulb.style.setProperty('--brightness', 0);
      bulb.classList.remove('lit');
    }
  },

  /** Quick flash-then-die animation for the LED overload scenario. */
  playLedOverload(ledId, onComplete) {
    const bulb = document.getElementById(`bulb-${ledId}`);
    if (!bulb) {
      if (onComplete) onComplete();
      return;
    }
    bulb.classList.add('overload-flash');
    window.setTimeout(() => {
      bulb.classList.remove('overload-flash');
      Animations.setLedBurnt(ledId, true);
      if (onComplete) onComplete();
    }, 550);
  },

  /** Toggles the switch lever's on/off rotation with a CSS-driven animation. */
  setSwitchState(switchId, on) {
    const group = document.getElementById(`lever-group-${switchId}`);
    if (!group) return;
    group.classList.toggle('switch-on', !!on);
    group.classList.toggle('switch-off', !on);
  },

  /**
   * Shows a small floating feedback card near the top of the workspace,
   * styled like a game notification popup (icon + title + subtitle).
   * type: 'success' | 'warning' | 'danger' | 'info'
   */
  showToast(container, { title, subtitle, type = 'info', duration = 3400 }) {
    const icons = { success: '🎉', warning: '⚠️', danger: '💥', info: '💡' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icon = document.createElement('span');
    icon.className = 'toast-icon';
    icon.textContent = icons[type] || '💡';
    toast.appendChild(icon);

    const textWrap = document.createElement('div');
    textWrap.className = 'toast-text';
    const t = document.createElement('div');
    t.className = 'toast-title';
    t.textContent = title;
    textWrap.appendChild(t);
    if (subtitle) {
      const s = document.createElement('div');
      s.className = 'toast-subtitle';
      s.textContent = subtitle;
      textWrap.appendChild(s);
    }
    toast.appendChild(textWrap);

    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('toast-in'));
    window.setTimeout(() => {
      toast.classList.remove('toast-in');
      toast.classList.add('toast-out');
      window.setTimeout(() => toast.remove(), 350);
    }, duration);
    return toast;
  },

  /** Briefly pops a value on the dashboard so a change feels alive. */
  pulseStat(el) {
    if (!el) return;
    const card = el.closest('.stat-card') || el;
    card.classList.remove('pulse');
    // Force reflow so the animation can restart on rapid repeated changes.
    void card.offsetWidth;
    card.classList.add('pulse');
  },

  /** Highlights the exact terminal where the circuit is open (a small pulsing ring). */
  highlightOpenPoint(svg, x, y) {
    this.clearOpenHighlight(svg);
    const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    ring.setAttribute('cx', x);
    ring.setAttribute('cy', y);
    ring.setAttribute('r', 10);
    ring.setAttribute('class', 'open-point-ring');
    ring.setAttribute('id', 'open-point-ring');
    svg.appendChild(ring);
  },

  clearOpenHighlight(svg) {
    const existing = svg.querySelector('#open-point-ring');
    if (existing) existing.remove();
  },

  /** Confetti-ish star burst for challenge completion. */
  celebrate(container) {
    const burst = document.createElement('div');
    burst.className = 'celebrate-burst';
    const symbols = ['⭐', '✨', '🎉', '⭐', '✨'];
    for (let i = 0; i < 14; i++) {
      const s = document.createElement('span');
      s.textContent = symbols[i % symbols.length];
      s.style.setProperty('--angle', `${(360 / 14) * i}deg`);
      s.style.setProperty('--delay', `${(i % 5) * 40}ms`);
      burst.appendChild(s);
    }
    container.appendChild(burst);
    window.setTimeout(() => burst.remove(), 1500);
  },
};

/**
 * Sfx
 * ---
 * Tiny synthesized sound effects via the Web Audio API — no audio files
 * needed. Kept intentionally short and cheerful (game "blips", not real
 * electrical sounds) so the lab feels alive with the tab muted-by-default
 * browsers won't complain about, since sounds only ever start from a user
 * gesture (a click).
 */
const Sfx = {
  enabled: true,
  _ctx: null,

  _ctxRef() {
    if (!this._ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this._ctx = new AC();
    }
    if (this._ctx.state === 'suspended') this._ctx.resume();
    return this._ctx;
  },

  setEnabled(on) {
    this.enabled = on;
  },

  _tone(freq, startTime, duration, { type = 'sine', gain = 0.08, glideTo = null } = {}) {
    const ctx = this._ctxRef();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, startTime + duration);
    amp.gain.setValueAtTime(0, startTime);
    amp.gain.linearRampToValueAtTime(gain, startTime + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    osc.connect(amp).connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  },

  _play(fn) {
    if (!this.enabled) return;
    try {
      fn();
    } catch (e) {
      /* Web Audio can be blocked before any user gesture — fail silently. */
    }
  },

  click() {
    this._play(() => {
      const ctx = this._ctxRef();
      if (!ctx) return;
      this._tone(520, ctx.currentTime, 0.06, { type: 'square', gain: 0.05 });
    });
  },

  pop() {
    this._play(() => {
      const ctx = this._ctxRef();
      if (!ctx) return;
      this._tone(340, ctx.currentTime, 0.08, { type: 'triangle', gain: 0.06 });
    });
  },

  connect() {
    this._play(() => {
      const ctx = this._ctxRef();
      if (!ctx) return;
      this._tone(660, ctx.currentTime, 0.08, { type: 'sine', gain: 0.07 });
      this._tone(880, ctx.currentTime + 0.07, 0.1, { type: 'sine', gain: 0.06 });
    });
  },

  switchOn() {
    this._play(() => {
      const ctx = this._ctxRef();
      if (!ctx) return;
      this._tone(300, ctx.currentTime, 0.14, { type: 'square', gain: 0.06, glideTo: 700 });
    });
  },

  switchOff() {
    this._play(() => {
      const ctx = this._ctxRef();
      if (!ctx) return;
      this._tone(500, ctx.currentTime, 0.14, { type: 'square', gain: 0.06, glideTo: 180 });
    });
  },

  success() {
    this._play(() => {
      const ctx = this._ctxRef();
      if (!ctx) return;
      [523.25, 659.25, 783.99].forEach((f, i) => {
        this._tone(f, ctx.currentTime + i * 0.08, 0.14, { type: 'sine', gain: 0.07 });
      });
    });
  },

  buzz() {
    this._play(() => {
      const ctx = this._ctxRef();
      if (!ctx) return;
      this._tone(160, ctx.currentTime, 0.28, { type: 'sawtooth', gain: 0.05, glideTo: 90 });
    });
  },

  alarm() {
    this._play(() => {
      const ctx = this._ctxRef();
      if (!ctx) return;
      for (let i = 0; i < 3; i++) {
        this._tone(880, ctx.currentTime + i * 0.16, 0.09, { type: 'square', gain: 0.06 });
        this._tone(440, ctx.currentTime + i * 0.16 + 0.09, 0.08, { type: 'square', gain: 0.05 });
      }
    });
  },

  fanfare() {
    this._play(() => {
      const ctx = this._ctxRef();
      if (!ctx) return;
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
        this._tone(f, ctx.currentTime + i * 0.1, 0.2, { type: 'triangle', gain: 0.08 });
      });
    });
  },
};

window.Animations = Animations;
window.Sfx = Sfx;
