/**
 * simulation.js
 * -------------
 * The electrical engine. Pure functions of a Circuit (see circuit.js) that
 * compute voltage / current / resistance / power and classify the circuit's
 * state (open, closed, short, LED overload). No DOM access here — app.js
 * and animations.js consume this module's output to update the page.
 *
 * Educational model (deliberately simplified for Grade 7-8):
 *   - Series DC circuit only: I = V / R_total   (Ohm's Law)
 *   - Power: P = V * I
 *   - An LED is modelled as a small fixed internal resistance while it is
 *     healthy, so it needs a real resistor in series to be safe. If it is
 *     wired straight to the battery with no resistor anywhere in the path,
 *     or if the current would be far higher than its rating, it "burns
 *     out" — a simple, non-realistic teaching moment, not a real SPICE
 *     model of diode behavior.
 */

const SIM_CONSTANTS = {
  LED_INTERNAL_OHMS: 15, // small forward resistance while healthy
  LED_RATED_AMPS: 0.02, // current at which the LED is at "full" brightness
  LED_MAX_SAFE_AMPS: 0.06, // current above which the LED is considered overloaded
  SHORT_RESISTANCE_THRESHOLD: 1, // ohms; a closed loop below this (with no LED) reads as a short
};

const Simulation = {
  constants: SIM_CONSTANTS,

  /**
   * Computes the full electrical state of the circuit right now.
   */
  evaluate(circuit) {
    const battery = circuit.getBattery();
    const sw = circuit.getSwitch();
    const led = circuit.getLed();
    const walk = circuit.walkFromPositive();

    const result = {
      status: 'open', // 'open' | 'switch-off' | 'closed' | 'short' | 'overload'
      voltage: battery ? battery.value : 0,
      current: 0,
      totalResistance: 0,
      power: 0,
      ledBrightness: 0,
      path: walk.path,
      openAt: walk.openAt,
      messages: [],
      switchOn: !!(sw && sw.state.on),
      ledBurnt: !!(led && led.state.burnt),
    };

    if (!battery) {
      result.messages.push('No battery in the circuit.');
      return result;
    }

    if (!walk.complete) {
      result.status = 'open';
      result.messages.push('The circuit is open! 🔌', 'Current needs a complete path to flow.');
      return result;
    }

    // Path is topologically complete. Gather the parts along it.
    const resistorsInPath = walk.path
      .map((id) => circuit.getComponent(id))
      .filter((c) => c.type === 'resistor');
    const totalResistorOhms = resistorsInPath.reduce((sum, r) => sum + r.value, 0);
    const ledInPath = walk.path.includes(led && led.id);
    const switchInPath = walk.path.some((id) => circuit.getComponent(id).type === 'switch');

    result.totalResistance = totalResistorOhms;

    if (switchInPath && sw && !sw.state.on) {
      result.status = 'switch-off';
      result.messages.push('The switch is OFF.', 'Turn it on to let current flow.');
      return result;
    }

    if (ledInPath && led.state.burnt) {
      result.status = 'open';
      result.messages.push('This LED has burned out.', 'Remove it and add a fresh one to keep experimenting.');
      return result;
    }

    if (ledInPath) {
      if (totalResistorOhms <= 0) {
        // Unsafe: LED wired directly to the battery with nothing to limit current.
        result.status = 'overload';
        result.current = null; // "very large" - not a meaningful finite number for a teaching sim
        result.messages.push('Oops! 💥 Too much current!', 'A resistor helps limit current and protect the LED.');
        return result;
      }
      const rTotal = totalResistorOhms + SIM_CONSTANTS.LED_INTERNAL_OHMS;
      const current = result.voltage / rTotal;
      if (current > SIM_CONSTANTS.LED_MAX_SAFE_AMPS) {
        result.status = 'overload';
        result.current = current;
        result.messages.push('Oops! 💥 Too much current!', 'A resistor helps limit current and protect the LED.');
        return result;
      }
      result.status = 'closed';
      result.current = current;
      result.power = result.voltage * current;
      result.ledBrightness = Math.max(0, Math.min(1, current / SIM_CONSTANTS.LED_RATED_AMPS));
      result.messages.push('Great! 🎉 The circuit is complete and current is flowing.');
      return result;
    }

    // No LED in path: pure resistive (or bare-wire) loop.
    if (totalResistorOhms < SIM_CONSTANTS.SHORT_RESISTANCE_THRESHOLD) {
      result.status = 'short';
      result.current = null;
      result.messages.push('Careful! ⚡', 'This path has almost no resistance, so the current can become very large.');
      return result;
    }

    result.status = 'closed';
    result.current = result.voltage / totalResistorOhms;
    result.power = result.voltage * result.current;
    result.messages.push('Great! 🎉 The circuit is complete and current is flowing.');
    return result;
  },

  /** Human-friendly explanation for a resistance change, given old/new totals. */
  explainResistanceChange(oldR, newR) {
    if (newR > oldR) return ['Resistance increased.', 'Less current is flowing through the circuit.'];
    if (newR < oldR) return ['Resistance decreased.', 'More current is flowing through the circuit.'];
    return [];
  },

  /** Human-friendly explanation for a voltage change (resistance held constant). */
  explainVoltageChange(oldV, newV) {
    if (newV > oldV) return ['Voltage increased → Current increased.'];
    if (newV < oldV) return ['Voltage decreased → Current decreased.'];
    return [];
  },

  formatAmps(amps) {
    if (amps === null || amps === undefined || Number.isNaN(amps)) return '—';
    if (amps >= 1) return `${amps.toFixed(2)} A`;
    return `${(amps * 1000).toFixed(1)} mA`;
  },
};

window.Simulation = Simulation;
