/**
 * circuit.js
 * ----------
 * Owns the CIRCUIT STRUCTURE: which components exist, what their terminals
 * are, and which terminals are wired together. Contains no electrical math
 * (that lives in simulation.js) and no DOM/SVG rendering (that lives in
 * app.js / animations.js).
 *
 * Data model
 * ----------
 * Every component has one or two "terminals". A terminal can be linked to
 * at most one other terminal (this is a simple SERIES circuit lab, so no
 * branching / parallel paths in the MVP+Stage2 build).
 *
 *   component = {
 *     id: 'R1',
 *     type: 'resistor' | 'led' | 'switch' | 'battery' | 'wire',
 *     label: 'R1',
 *     value: 100,        // resistance (Ω) for resistor/wire(0); voltage (V) for battery
 *     state: {}          // component-specific runtime state (on/off, burnt, etc.)
 *     terminals: ['a','b'] or ['pos','neg'] for battery
 *   }
 *
 *   edge = { t1: {id, terminal}, t2: {id, terminal} }
 *
 * The Circuit class exposes structural operations only:
 *   addComponent, removeComponent, connect, disconnect, freeTerminal,
 *   walkFromPositive (topology walk used by simulation.js)
 */

class Circuit {
  constructor() {
    this.components = new Map(); // id -> component
    this.edges = [];             // list of {t1:{id,terminal}, t2:{id,terminal}}
    this.nextIndex = { resistor: 1, wire: 1 };
    this._buildDefaultCircuit();
  }

  /* ---------------------------------------------------------- defaults */

  _buildDefaultCircuit() {
    this.components.clear();
    this.edges = [];
    this.nextIndex = { resistor: 1, wire: 1 };

    this._addRaw({ id: 'B1', type: 'battery', label: 'B1', value: 6, state: {}, terminals: ['pos', 'neg'] });
    this._addRaw({ id: 'R1', type: 'resistor', label: 'R1', value: 100, state: {}, terminals: ['a', 'b'] });
    this._addRaw({ id: 'LED1', type: 'led', label: 'LED1', value: 0, state: { burnt: false }, terminals: ['a', 'b'] });
    this._addRaw({ id: 'SW1', type: 'switch', label: 'SW1', value: 0, state: { on: false }, terminals: ['a', 'b'] });
    this.nextIndex.resistor = 2;

    // Battery(+) -> R1 -> LED1 -> SW1 -> Battery(-)
    this._link('B1', 'pos', 'R1', 'a');
    this._link('R1', 'b', 'LED1', 'a');
    this._link('LED1', 'b', 'SW1', 'a');
    this._link('SW1', 'b', 'B1', 'neg');
  }

  reset() {
    this._buildDefaultCircuit();
  }

  /* ---------------------------------------------------------- low level */

  _addRaw(comp) {
    this.components.set(comp.id, comp);
    return comp;
  }

  _link(id1, term1, id2, term2) {
    this.edges.push({ t1: { id: id1, terminal: term1 }, t2: { id: id2, terminal: term2 } });
  }

  _edgeAt(id, terminal) {
    return this.edges.find(
      (e) => (e.t1.id === id && e.t1.terminal === terminal) || (e.t2.id === id && e.t2.terminal === terminal)
    );
  }

  _otherEndOf(edge, id, terminal) {
    if (edge.t1.id === id && edge.t1.terminal === terminal) return edge.t2;
    return edge.t1;
  }

  isTerminalFree(id, terminal) {
    return !this._edgeAt(id, terminal);
  }

  /** Public helper: what's on the other end of this terminal, if anything. */
  whatIsConnectedTo(id, terminal) {
    const edge = this._edgeAt(id, terminal);
    if (!edge) return null;
    return this._otherEndOf(edge, id, terminal);
  }

  /** Returns the other terminal name of a two-terminal component. */
  otherTerminal(comp, terminal) {
    return comp.terminals.find((t) => t !== terminal);
  }

  /* ---------------------------------------------------------- queries */

  getComponent(id) {
    return this.components.get(id);
  }

  allComponents() {
    return Array.from(this.components.values());
  }

  getResistors() {
    return this.allComponents().filter((c) => c.type === 'resistor');
  }

  getBattery() {
    return this.allComponents().find((c) => c.type === 'battery');
  }

  getLed() {
    return this.allComponents().find((c) => c.type === 'led');
  }

  getSwitch() {
    return this.allComponents().find((c) => c.type === 'switch');
  }

  /**
   * Walks the circuit starting at the battery's positive terminal,
   * hopping through connected terminals and "through" each component
   * (component's two terminals are treated as internally joined).
   *
   * Returns:
   *   {
   *     complete: boolean,        // true if the walk reached battery negative
   *     path: [componentId...],   // components visited, in order (excludes battery)
   *     openAt: {id, terminal} | null   // terminal where the trail went cold (if !complete)
   *   }
   */
  walkFromPositive() {
    const battery = this.getBattery();
    const path = [];
    const steps = []; // {id, entryTerminal, exitTerminal}
    const visited = new Set();
    if (!battery) return { complete: false, path, steps, openAt: null };

    let current = { id: battery.id, terminal: 'pos' };

    // Step 1: find what's plugged into battery+
    let edge = this._edgeAt(current.id, current.terminal);
    if (!edge) return { complete: false, path, steps, openAt: { id: battery.id, terminal: 'pos' } };

    let cursor = this._otherEndOf(edge, current.id, current.terminal); // {id, terminal} of the component we entered

    while (true) {
      if (cursor.id === battery.id && cursor.terminal === 'neg') {
        return { complete: true, path, steps, openAt: null };
      }

      const comp = this.getComponent(cursor.id);
      if (!comp) return { complete: false, path, steps, openAt: cursor };
      if (visited.has(comp.id)) {
        // Cycle guard - shouldn't happen in a series-only model.
        return { complete: false, path, steps, openAt: cursor };
      }
      visited.add(comp.id);
      path.push(comp.id);

      // Pass through the component to its other terminal.
      const exitTerminal = this.otherTerminal(comp, cursor.terminal);
      steps.push({ id: comp.id, entryTerminal: cursor.terminal, exitTerminal });
      const exitEdge = this._edgeAt(comp.id, exitTerminal);
      if (!exitEdge) {
        return { complete: false, path, steps, openAt: { id: comp.id, terminal: exitTerminal } };
      }
      cursor = this._otherEndOf(exitEdge, comp.id, exitTerminal);
    }
  }

  /** The single free terminal at the "growing end" of the chain from B+, if any. */
  findOpenFrontier() {
    const result = this.walkFromPositive();
    if (result.complete) return null;
    return result.openAt;
  }

  /* ---------------------------------------------------------- mutation */

  generateId(type) {
    if (type === 'resistor') return `R${this.nextIndex.resistor++}`;
    if (type === 'wire') return `W${this.nextIndex.wire++}`;
    throw new Error('generateId only supports multi-instance types (resistor, wire)');
  }

  /**
   * Adds a new component and automatically splices it into the circuit
   * at a sensible default position (per spec: no manual placement).
   *
   * Placement rule:
   *  - If the chain from B+ is open-ended somewhere, extend it there and,
   *    if B- is free, close the loop by wiring the new part straight to B-.
   *  - If the chain is already a complete loop, splice the new part in
   *    right before the return to B-.
   */
  addComponent(type, opts = {}) {
    const battery = this.getBattery();
    let comp;

    if (type === 'resistor') {
      const id = this.generateId('resistor');
      comp = this._addRaw({ id, type: 'resistor', label: id, value: opts.value ?? 100, state: {}, terminals: ['a', 'b'] });
    } else if (type === 'wire') {
      const id = this.generateId('wire');
      comp = this._addRaw({ id, type: 'wire', label: id, value: 0, state: {}, terminals: ['a', 'b'] });
    } else if (type === 'led') {
      if (this.getLed()) return { error: 'LED1 is already in the circuit. Select it to edit or remove it first.' };
      comp = this._addRaw({ id: 'LED1', type: 'led', label: 'LED1', value: 0, state: { burnt: false }, terminals: ['a', 'b'] });
    } else if (type === 'switch') {
      if (this.getSwitch()) return { error: 'SW1 is already in the circuit. Select it to edit or remove it first.' };
      comp = this._addRaw({ id: 'SW1', type: 'switch', label: 'SW1', value: 0, state: { on: false }, terminals: ['a', 'b'] });
    } else if (type === 'battery') {
      return { error: 'B1 is already in the circuit. There can only be one battery.' };
    } else {
      return { error: `Unknown component type: ${type}` };
    }

    this._autoPlace(comp);
    return { component: comp };
  }

  _autoPlace(comp) {
    const battery = this.getBattery();
    if (!battery) return;

    const walk = this.walkFromPositive();

    if (walk.complete) {
      // Splice new component in right before the return to B-.
      const negEdge = this._edgeAt(battery.id, 'neg');
      const prevEnd = this._otherEndOf(negEdge, battery.id, 'neg'); // terminal that used to feed B-
      this.edges = this.edges.filter((e) => e !== negEdge);
      this._link(prevEnd.id, prevEnd.terminal, comp.id, 'a');
      this._link(comp.id, 'b', battery.id, 'neg');
      return;
    }

    // Not complete: find the open frontier terminal (or B+ itself if nothing connected yet).
    const frontier = walk.openAt; // {id, terminal}
    if (frontier) {
      this._link(frontier.id, frontier.terminal, comp.id, 'a');
      // If battery negative is free, auto-close the loop.
      if (battery.id !== frontier.id && this.isTerminalFree(battery.id, 'neg')) {
        this._link(comp.id, 'b', battery.id, 'neg');
      }
    }
  }

  /** Removes a component entirely (and any edges touching it). Battery cannot be removed. */
  removeComponent(id) {
    const comp = this.getComponent(id);
    if (!comp) return { error: 'Component not found.' };
    if (comp.type === 'battery') return { error: 'The battery cannot be removed.' };

    this.edges = this.edges.filter((e) => e.t1.id !== id && e.t2.id !== id);
    this.components.delete(id);
    return { removed: comp };
  }

  /** Disconnects a component from its neighbors without deleting it (opens the circuit there). */
  disconnectComponent(id) {
    const comp = this.getComponent(id);
    if (!comp) return { error: 'Component not found.' };
    const before = this.edges.length;
    this.edges = this.edges.filter((e) => e.t1.id !== id && e.t2.id !== id);
    if (this.edges.length === before) return { error: `${id} has no connections to remove.` };
    return { disconnected: comp };
  }

  /** Lists candidate terminals a given component could connect to (free terminals on other parts). */
  listConnectionCandidates(id) {
    const self = this.getComponent(id);
    if (!self) return [];
    const freeSelfTerminal = self.terminals.find((t) => this.isTerminalFree(id, t));
    if (freeSelfTerminal === undefined) return []; // fully connected already

    const candidates = [];
    for (const comp of this.allComponents()) {
      if (comp.id === id) continue;
      for (const t of comp.terminals) {
        if (this.isTerminalFree(comp.id, t)) {
          candidates.push({
            componentId: comp.id,
            terminal: t,
            label: this._friendlyTerminalLabel(comp, t),
            selfTerminal: freeSelfTerminal,
          });
        }
      }
    }
    return candidates;
  }

  _friendlyTerminalLabel(comp, terminal) {
    if (comp.type === 'battery') return terminal === 'pos' ? 'Battery (+)' : 'Battery (−)';
    return comp.label;
  }

  /** Connects component `id`'s free terminal to {componentId, terminal}. */
  connect(id, targetComponentId, targetTerminal) {
    const self = this.getComponent(id);
    const target = this.getComponent(targetComponentId);
    if (!self || !target) return { error: 'Component not found.' };

    const selfFree = self.terminals.find((t) => this.isTerminalFree(id, t));
    if (selfFree === undefined) return { error: `${id} has no free terminal to connect.` };
    if (!this.isTerminalFree(targetComponentId, targetTerminal)) {
      return { error: `${target.label}'s terminal is already in use.` };
    }

    this._link(id, selfFree, targetComponentId, targetTerminal);
    return { ok: true };
  }

  /* ---------------------------------------------------------- serialization (for challenges/debug) */

  snapshot() {
    return {
      components: this.allComponents().map((c) => ({ ...c, state: { ...c.state } })),
      edges: this.edges.map((e) => ({ t1: { ...e.t1 }, t2: { ...e.t2 } })),
    };
  }
}

// Exposed as a global (no build step / bundler in this project).
window.Circuit = Circuit;
