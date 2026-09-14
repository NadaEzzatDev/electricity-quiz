/**
 * components.js
 * -------------
 * Pure presentation helpers for drawing circuit components as SVG.
 * No state, no circuit logic — just "given this component and a box,
 * return SVG markup". Also holds small metadata used by the UI
 * (display names, colors, default values, slider ranges).
 */

const ComponentMeta = {
  battery: { name: 'Battery', color: '#2f7bff' },
  resistor: { name: 'Resistor', color: '#ff9f43', min: 10, max: 1000, step: 10, unit: 'Ω' },
  led: { name: 'LED', color: '#ff4d6d' },
  switch: { name: 'Switch', color: '#20c997' },
  wire: { name: 'Wire', color: '#94a3b8' },
};

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

/**
 * Draws a component symbol centered in a box [x, y, w, h] (h is the
 * "thickness" of the horizontal wire lane the component sits on).
 * Returns a <g> element. The caller positions it and can attach
 * event handlers / ids.
 */
const Components = {
  meta: ComponentMeta,

  draw(comp, box) {
    const g = svgEl('g', { class: `comp comp-${comp.type}`, 'data-id': comp.id });
    const midY = box.y;
    const leftX = box.x - box.w / 2;
    const rightX = box.x + box.w / 2;

    // Invisible hit-area so the whole component (including its leads and
    // label) is clickable, not just the thin symbol strokes.
    g.appendChild(
      svgEl('rect', {
        x: leftX - 22,
        y: midY - 36,
        width: box.w + 44,
        height: 72,
        fill: 'transparent',
        class: 'hit-rect',
      })
    );

    // Leads (stub wires connecting the symbol to the shared rail)
    g.appendChild(svgEl('line', { x1: leftX - 18, y1: midY, x2: leftX, y2: midY, class: 'lead' }));
    g.appendChild(svgEl('line', { x1: rightX, y1: midY, x2: rightX + 18, y2: midY, class: 'lead' }));

    switch (comp.type) {
      case 'battery':
        g.appendChild(this._battery(box));
        break;
      case 'resistor':
        g.appendChild(this._resistor(box));
        break;
      case 'led':
        g.appendChild(this._led(box, comp));
        break;
      case 'switch':
        g.appendChild(this._switch(box, comp));
        break;
      case 'wire':
        g.appendChild(this._wireLink(box));
        break;
    }

    const label = svgEl('text', {
      x: box.x,
      y: midY + box.labelDy || midY + 34,
      class: 'comp-label',
      'text-anchor': 'middle',
    });
    label.textContent = comp.label;
    g.appendChild(label);

    if (comp.type === 'resistor') {
      const val = svgEl('text', { x: box.x, y: midY - 22, class: 'comp-value', 'text-anchor': 'middle', id: `value-${comp.id}` });
      val.textContent = `${comp.value} Ω`;
      g.appendChild(val);
    }
    if (comp.type === 'battery') {
      const val = svgEl('text', { x: box.x, y: midY - 30, class: 'comp-value', 'text-anchor': 'middle', id: `value-${comp.id}` });
      val.textContent = `${comp.value} V`;
      g.appendChild(val);
    }

    return g;
  },

  _battery(box) {
    const g = svgEl('g');
    const midY = box.y;
    const cx = box.x;
    // Classic long-line / short-line battery symbol, drawn as two cells.
    g.appendChild(svgEl('line', { x1: cx - 14, y1: midY - 20, x2: cx - 14, y2: midY + 20, class: 'symbol-thick' }));
    g.appendChild(svgEl('line', { x1: cx - 4, y1: midY - 10, x2: cx - 4, y2: midY + 10, class: 'symbol-thin' }));
    g.appendChild(svgEl('line', { x1: cx + 6, y1: midY - 20, x2: cx + 6, y2: midY + 20, class: 'symbol-thick' }));
    g.appendChild(svgEl('line', { x1: cx + 16, y1: midY - 10, x2: cx + 16, y2: midY + 10, class: 'symbol-thin' }));
    g.appendChild(svgEl('line', { x1: box.x - box.w / 2, y1: midY, x2: cx - 14, y2: midY, class: 'lead' }));
    g.appendChild(svgEl('line', { x1: cx + 16, y1: midY, x2: box.x + box.w / 2, y2: midY, class: 'lead' }));
    const plus = svgEl('text', { x: cx - 20, y: midY - 26, class: 'polarity' });
    plus.textContent = '+';
    const minus = svgEl('text', { x: cx + 12, y: midY - 26, class: 'polarity' });
    minus.textContent = '−';
    g.appendChild(plus);
    g.appendChild(minus);
    return g;
  },

  _resistor(box) {
    const midY = box.y;
    const x0 = box.x - 30;
    const zigW = 60;
    const points = [];
    const steps = 6;
    for (let i = 0; i <= steps; i++) {
      const x = x0 + (zigW * i) / steps;
      const y = i === 0 || i === steps ? midY : midY + (i % 2 === 0 ? -12 : 12);
      points.push(`${x},${y}`);
    }
    return svgEl('polyline', { points: points.join(' '), class: 'symbol-line', fill: 'none' });
  },

  _led(box, comp) {
    const g = svgEl('g');
    const midY = box.y;
    const cx = box.x;
    const r = 16;
    const circle = svgEl('circle', { cx, cy: midY, r, class: 'led-bulb', id: `bulb-${comp.id}` });
    g.appendChild(circle);
    // simple diode triangle+bar inside
    const tri = svgEl('polygon', {
      points: `${cx - 8},${midY - 8} ${cx - 8},${midY + 8} ${cx + 6},${midY}`,
      class: 'led-diode',
    });
    const bar = svgEl('line', { x1: cx + 6, y1: midY - 8, x2: cx + 6, y2: midY + 8, class: 'led-diode' });
    g.appendChild(tri);
    g.appendChild(bar);
    // light rays (visible when glowing, controlled via CSS class on parent)
    const rays = svgEl('g', { class: 'led-rays', id: `rays-${comp.id}` });
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i;
      const x1 = cx + Math.cos(angle) * (r + 4);
      const y1 = midY + Math.sin(angle) * (r + 4);
      const x2 = cx + Math.cos(angle) * (r + 12);
      const y2 = midY + Math.sin(angle) * (r + 12);
      rays.appendChild(svgEl('line', { x1, y1, x2, y2, class: 'led-ray' }));
    }
    g.insertBefore(rays, circle);
    return g;
  },

  _switch(box, comp) {
    const g = svgEl('g', { id: `switch-${comp.id}` });
    const midY = box.y;
    const x0 = box.x - 26;
    const x1 = box.x + 26;
    g.appendChild(svgEl('circle', { cx: x0, cy: midY, r: 4, class: 'switch-pivot' }));
    g.appendChild(svgEl('circle', { cx: x1, cy: midY, r: 4, class: 'switch-pivot' }));
    const leverGroup = svgEl('g', {
      id: `lever-group-${comp.id}`,
      class: `switch-lever-group ${comp.state.on ? 'switch-on' : 'switch-off'}`,
      style: `transform-origin:${x0}px ${midY}px`,
    });
    leverGroup.appendChild(svgEl('line', { x1: x0, y1: midY, x2: x1, y2: midY, class: 'switch-lever' }));
    g.appendChild(leverGroup);
    return g;
  },

  _wireLink(box) {
    return svgEl('line', { x1: box.x - 30, y1: box.y, x2: box.x + 30, y2: box.y, class: 'symbol-line' });
  },

  /** Small icon markup used in the toolbar buttons (kept as tiny inline SVGs). */
  toolbarIcon(type) {
    const icons = {
      battery: '<svg viewBox="0 0 24 24"><line x1="3" y1="12" x2="9" y2="12"/><line x1="9" y1="6" x2="9" y2="18" stroke-width="2.5"/><line x1="13" y1="9" x2="13" y2="15"/><line x1="13" y1="12" x2="21" y2="12"/></svg>',
      resistor: '<svg viewBox="0 0 24 24"><polyline points="2,12 6,12 8,6 12,18 16,6 18,12 22,12" fill="none"/></svg>',
      led: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" fill="none"/><polygon points="9,9 9,15 14,12"/><line x1="14" y1="9" x2="14" y2="15"/></svg>',
      switch: '<svg viewBox="0 0 24 24"><circle cx="5" cy="17" r="2"/><circle cx="19" cy="17" r="2"/><line x1="5" y1="17" x2="17" y2="7"/></svg>',
      wire: '<svg viewBox="0 0 24 24"><line x1="2" y1="12" x2="22" y2="12" stroke-width="2.5"/></svg>',
    };
    return icons[type] || '';
  },
};

window.Components = Components;
window.ComponentMeta = ComponentMeta;
