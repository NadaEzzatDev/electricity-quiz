/**
 * challenges.js
 * -------------
 * Challenge Mode content: each challenge knows how to set up its starting
 * circuit and how to check whether the student has solved it. Also holds
 * the rotating hint suggestions used in Free Experiment mode.
 *
 * A challenge's `setup(circuit)` runs right after circuit.reset(), and can
 * further rearrange components using the same public Circuit API the UI
 * uses (disconnectComponent, connect, removeComponent, addComponent) —
 * nothing here reaches into Circuit internals.
 *
 * `check(circuit, sim, baseline)` returns true once solved. `baseline` is
 * a snapshot of the electrical state captured the moment the challenge
 * started, useful for relative goals like "make the current smaller".
 */

const Challenges = {
  list: [
    {
      id: 'turn-it-on',
      title: 'Challenge 1 · Turn It On',
      goal: 'Make the LED turn ON.',
      hint: 'The switch is currently OFF. Click it to close the circuit.',
      setup(circuit) {
        circuit.reset(); // default: B1-R1-LED1-SW1, switch OFF
      },
      check(circuit, sim) {
        return sim.status === 'closed' && sim.ledBrightness > 0;
      },
    },
    {
      id: 'fix-the-break',
      title: 'Challenge 2 · Fix the Broken Circuit',
      goal: 'The circuit has a break in it. Reconnect it so current can flow.',
      hint: 'Select LED1 and use "Connect" to link it back into the circuit.',
      setup(circuit) {
        circuit.reset();
        const sw = circuit.getSwitch();
        if (sw) sw.state.on = true; // remove the switch as a variable for this challenge
        circuit.disconnectComponent('LED1');
      },
      check(circuit, sim) {
        return sim.status === 'closed';
      },
    },
    {
      id: 'dim-the-led',
      title: 'Challenge 3 · Dim the LED',
      goal: 'Make the LED noticeably dimmer than it is right now — without turning it off.',
      hint: 'Try increasing R1’s resistance with its slider, or lowering the battery voltage.',
      setup(circuit) {
        circuit.reset();
        const sw = circuit.getSwitch();
        if (sw) sw.state.on = true;
      },
      check(circuit, sim, baseline) {
        if (!baseline || baseline.ledBrightness <= 0) return false;
        return sim.status === 'closed' && sim.ledBrightness > 0 && sim.ledBrightness < baseline.ledBrightness * 0.75;
      },
    },
    {
      id: 'shrink-the-current',
      title: 'Challenge 4 · Shrink the Current',
      goal: 'Reduce the current flowing through the circuit, while keeping it closed.',
      hint: 'More resistance means less current. Try raising R1, or add another resistor.',
      setup(circuit) {
        circuit.reset();
        const sw = circuit.getSwitch();
        if (sw) sw.state.on = true;
      },
      check(circuit, sim, baseline) {
        if (!baseline || !baseline.current) return false;
        return sim.status === 'closed' && sim.current !== null && sim.current < baseline.current * 0.75;
      },
    },
    {
      id: 'protect-the-led',
      title: 'Challenge 5 · Protect the LED',
      goal: 'A spare resistor is disconnected nearby. Wire it back in to protect the LED, then turn the circuit on.',
      hint: 'Select R1, choose Connect, and wire it between the battery and the LED.',
      setup(circuit) {
        circuit.reset();
        // Pull R1 out and leave exactly one gap (battery+ <-> LED1) for it to
        // fill back in — solvable with two straightforward "Connect" taps on
        // R1, with no other free terminal anywhere to make it ambiguous.
        circuit.disconnectComponent('R1');
      },
      check(circuit, sim) {
        const resistorsInPath = sim.path
          .map((id) => circuit.getComponent(id))
          .filter((c) => c && c.type === 'resistor');
        return sim.status === 'closed' && resistorsInPath.length > 0 && sim.ledBrightness > 0 && !sim.ledBurnt;
      },
    },
    {
      id: 'series-twins',
      title: 'Challenge 6 · Series Twins',
      goal: 'Add a second resistor in series with R1.',
      hint: 'Click "+ Resistor" in the toolbar — it will wire itself into the circuit automatically.',
      setup(circuit) {
        circuit.reset();
      },
      check(circuit, sim) {
        const resistorsInPath = sim.path
          .map((id) => circuit.getComponent(id))
          .filter((c) => c && c.type === 'resistor');
        return resistorsInPath.length >= 2;
      },
    },
  ],

  getById(id) {
    return this.list.find((c) => c.id === id);
  },

  /** Suggestions rotated through in Free Experiment mode. */
  suggestions: [
    'Try increasing the voltage.',
    'What happens if you add another resistor?',
    'Can you make the LED dimmer?',
    'What happens if you remove R1 while the LED is connected?',
    'Try turning the switch off — what changes on the dashboard?',
    'Add a second resistor. Does the LED get brighter or dimmer?',
    'Lower the resistance all the way — watch the current climb.',
  ],

  randomSuggestion(excludeText) {
    const pool = this.suggestions.filter((s) => s !== excludeText);
    return pool[Math.floor(Math.random() * pool.length)];
  },

  /** Predict -> Experiment -> Observe -> Understand prompts, keyed by control. */
  predictions: {
    voltage: {
      predict: 'Predict: if you raise the voltage, what will happen to the current?',
      confirm: 'Exactly! Current increased because voltage increased (resistance stayed the same).',
    },
    resistance: {
      predict: 'Predict: if you raise the resistance, what will happen to the current?',
      confirm: 'Exactly! Current decreased because resistance increased.',
    },
  },
};

window.Challenges = Challenges;
