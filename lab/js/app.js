/**
 * app.js
 * ------
 * The main controller. Wires up the toolbar, the SVG circuit workspace,
 * the dashboard, the component side panel, and Free Experiment / Challenge
 * modes. Delegates structure to circuit.js, math to simulation.js, drawing
 * to components.js, and motion/feedback to animations.js.
 */

const App = {
  circuit: null,
  mode: 'free', // 'free' | 'challenge'
  selectedId: null,
  connectPickerFor: null,
  lastStatusKey: null,
  ledOverloadPlaying: false,
  terminalPos: {},
  currentChallenge: null,
  challengeBaseline: null,
  completedChallenges: new Set(),
  suggestionText: '',
  studentName: '',

  /* ---------------------------------------------------------- boot */

  init() {
    this.circuit = new Circuit();
    this.el = {
      svg: document.getElementById('circuit-svg'),
      dashV: document.getElementById('stat-voltage'),
      dashI: document.getElementById('stat-current'),
      dashR: document.getElementById('stat-resistance'),
      dashP: document.getElementById('stat-power'),
      statusBadge: document.getElementById('status-badge'),
      toastLayer: document.getElementById('toast-layer'),
      sidePanel: document.getElementById('side-panel'),
      sidePanelBody: document.getElementById('side-panel-body'),
      sidePanelClose: document.getElementById('side-panel-close'),
      modeFreeBtn: document.getElementById('mode-free-btn'),
      modeChallengeBtn: document.getElementById('mode-challenge-btn'),
      freePanel: document.getElementById('free-panel'),
      challengePanel: document.getElementById('challenge-panel'),
      suggestionText: document.getElementById('suggestion-text'),
      newSuggestionBtn: document.getElementById('new-suggestion-btn'),
      challengeList: document.getElementById('challenge-list'),
      challengeGoal: document.getElementById('challenge-goal'),
      challengeHintBtn: document.getElementById('challenge-hint-btn'),
      challengeHintText: document.getElementById('challenge-hint-text'),
      challengeResetBtn: document.getElementById('challenge-reset-btn'),
      modeTabSlider: document.getElementById('mode-tab-slider'),
      scoreValue: document.getElementById('score-value'),
      scoreBadge: document.querySelector('.score-badge'),
      soundToggle: document.getElementById('sound-toggle'),
      levelupOverlay: document.getElementById('levelup-overlay'),
      mascot: document.getElementById('mascot'),
      deviceHint: document.getElementById('device-hint'),
      deviceHintClose: document.getElementById('device-hint-close'),
      onboarding: document.getElementById('onboarding'),
      onboardingStepName: document.getElementById('onboarding-step-name'),
      onboardingStepWelcome: document.getElementById('onboarding-step-welcome'),
      onboardingNameForm: document.getElementById('onboarding-name-form'),
      onboardingNameInput: document.getElementById('student-name-input'),
      onboardingHello: document.getElementById('onboarding-hello'),
      onboardingEnterBtn: document.getElementById('onboarding-enter-btn'),
      playerBadge: document.getElementById('player-badge'),
      playerName: document.getElementById('player-name'),
      brandSub: document.querySelector('.brand-sub'),
    };

    this._bindToolbar();
    this._bindSidePanel();
    this._bindModes();
    this._bindSvgClicks();
    this._bindSound();
    this._bindDeviceHint();
    this._bindOnboarding();

    this._newSuggestion();
    this._buildChallengeList();
    this.renderLayout();
  },

  /* ---------------------------------------------------------- onboarding */

  _bindOnboarding() {
    const el = this.el;
    if (!el.onboarding) return;

    el.onboardingNameForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const raw = el.onboardingNameInput.value.trim();
      this.studentName = raw ? raw.slice(0, 24) : 'Explorer';
      Sfx.click();
      el.onboardingHello.textContent = `Hello, ${this.studentName}! 👋`;
      el.onboardingStepName.hidden = true;
      el.onboardingStepWelcome.hidden = false;
    });

    el.onboardingEnterBtn.addEventListener('click', () => {
      Sfx.fanfare();
      el.onboarding.classList.add('onboarding-hidden');
      this._applyStudentName();
      this._toast(`Welcome, ${this.studentName}! ⚡`, 'Your circuit is waiting — try flipping that switch.', 'success');
    });
  },

  _applyStudentName() {
    const name = this.studentName || 'Explorer';
    if (this.el.playerBadge) {
      this.el.playerName.textContent = name;
      this.el.playerBadge.hidden = false;
      this.el.playerBadge.classList.remove('pulse');
      void this.el.playerBadge.offsetWidth;
      this.el.playerBadge.classList.add('pulse');
    }
    if (this.el.brandSub) {
      this.el.brandSub.textContent = `Hey ${name}! Build it. Break it. Figure out why. ✨`;
    }
  },

  /* ---------------------------------------------------------- device hint */

  _bindDeviceHint() {
    if (!this.el.deviceHint || !this.el.deviceHintClose) return;
    this.el.deviceHintClose.addEventListener('click', () => {
      Sfx.click();
      this.el.deviceHint.classList.add('dismissed');
    });
  },

  /* ---------------------------------------------------------- sound */

  _bindSound() {
    this.el.soundToggle.addEventListener('click', () => {
      const next = !Sfx.enabled;
      Sfx.setEnabled(next);
      this.el.soundToggle.textContent = next ? '🔊' : '🔇';
      if (next) Sfx.click();
    });
  },

  /* ---------------------------------------------------------- toolbar */

  _bindToolbar() {
    document.querySelectorAll('.toolbar-btn[data-add]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.add;
        const result = this.circuit.addComponent(type);
        if (result.error) {
          Sfx.pop();
          this._toast('Can’t add that', result.error, 'warning');
          return;
        }
        Sfx.connect();
        this.renderLayout();
        this._toast(`${result.component.label} added`, this._addedMessage(type), 'success');
      });
    });
  },

  _addedMessage(type) {
    switch (type) {
      case 'resistor':
        return 'It was wired in automatically — total resistance just went up.';
      case 'led':
        return 'Remember: an LED needs a resistor in series to stay safe.';
      case 'switch':
        return 'Use it to open and close the circuit.';
      case 'wire':
        return 'A plain wire has no resistance of its own.';
      default:
        return '';
    }
  },

  /* ---------------------------------------------------------- modes */

  _bindModes() {
    this.el.modeFreeBtn.addEventListener('click', () => this._setMode('free'));
    this.el.modeChallengeBtn.addEventListener('click', () => this._setMode('challenge'));
    this.el.newSuggestionBtn.addEventListener('click', () => {
      Sfx.click();
      this._newSuggestion();
    });
    this.el.challengeHintBtn.addEventListener('click', () => {
      Sfx.click();
      this.el.challengeHintText.hidden = !this.el.challengeHintText.hidden;
    });
    this.el.challengeResetBtn.addEventListener('click', () => {
      Sfx.click();
      if (this.currentChallenge) this._startChallenge(this.currentChallenge.id);
    });
  },

  _setMode(mode) {
    this.mode = mode;
    Sfx.click();
    this.el.modeFreeBtn.classList.toggle('active', mode === 'free');
    this.el.modeChallengeBtn.classList.toggle('active', mode === 'challenge');
    this.el.modeTabSlider.classList.toggle('pos-1', mode === 'challenge');
    this.el.freePanel.hidden = mode !== 'free';
    this.el.challengePanel.hidden = mode !== 'challenge';

    if (mode === 'challenge' && !this.currentChallenge) {
      this._startChallenge(Challenges.list[0].id);
    } else if (mode === 'free') {
      this.circuit.reset();
      this.selectedId = null;
      this._closeSidePanel();
      this.renderLayout();
    }
  },

  _newSuggestion() {
    this.suggestionText = Challenges.randomSuggestion(this.suggestionText);
    this.el.suggestionText.textContent = this.suggestionText;
  },

  /* ---------------------------------------------------------- challenges */

  _buildChallengeList() {
    this.el.challengeList.innerHTML = '';
    Challenges.list.forEach((ch, i) => {
      const btn = document.createElement('button');
      btn.className = 'challenge-pill';
      btn.dataset.id = ch.id;
      btn.innerHTML = `<span class="pill-num">${i + 1}</span><span class="pill-check">✓</span><span class="pill-lock">🔒</span>`;
      btn.title = ch.title;
      btn.addEventListener('click', () => this._startChallenge(ch.id));
      this.el.challengeList.appendChild(btn);
    });
    this._refreshChallengeLocks();
  },

  /** A level unlocks once every level before it is solved — classic game-map progression. */
  _isUnlocked(index) {
    if (index === 0) return true;
    return this.completedChallenges.has(Challenges.list[index - 1].id);
  },

  _refreshChallengeLocks() {
    this.el.challengeList.querySelectorAll('.challenge-pill').forEach((p, i) => {
      const unlocked = this._isUnlocked(i);
      p.classList.toggle('locked', !unlocked);
      p.classList.toggle('done', this.completedChallenges.has(p.dataset.id));
    });
  },

  _startChallenge(id) {
    const index = Challenges.list.findIndex((c) => c.id === id);
    if (index === -1 || !this._isUnlocked(index)) {
      Sfx.pop();
      this._toast('Locked 🔒', 'Finish the level before this one first.', 'warning');
      return;
    }
    const challenge = Challenges.getById(id);
    this.currentChallenge = challenge;
    Sfx.click();
    this.circuit.reset();
    challenge.setup(this.circuit);
    this.selectedId = null;
    this._closeSidePanel();
    this.el.challengeGoal.textContent = challenge.goal;
    this.el.challengeHintText.textContent = challenge.hint;
    this.el.challengeHintText.hidden = true;
    this._refreshChallengeLocks();
    this.el.challengeList.querySelectorAll('.challenge-pill').forEach((p) => {
      p.classList.toggle('active', p.dataset.id === id);
    });
    this.renderLayout();
    // Capture baseline AFTER first render so brightness/current reflect the actual starting point.
    this.challengeBaseline = Simulation.evaluate(this.circuit);
  },

  _checkChallenge(sim) {
    if (this.mode !== 'challenge' || !this.currentChallenge) return;
    if (this.completedChallenges.has(this.currentChallenge.id)) return;
    const solved = this.currentChallenge.check(this.circuit, sim, this.challengeBaseline);
    if (solved) {
      this.completedChallenges.add(this.currentChallenge.id);
      const pill = this.el.challengeList.querySelector(`[data-id="${this.currentChallenge.id}"]`);
      if (pill) pill.classList.add('done');
      this._refreshChallengeLocks();
      this._updateScore();
      Sfx.fanfare();
      Animations.celebrate(document.getElementById('workspace-wrap'));
      const cheer = this.studentName ? `🎉 Nice one, ${this.studentName}!` : '🎉 Challenge Complete!';
      this._toast(cheer, 'Great experimenting — try the next one.', 'success');

      if (this.completedChallenges.size === Challenges.list.length) {
        window.setTimeout(() => this._showLevelUpOverlay(), 900);
      }
    }
  },

  _updateScore() {
    this.el.scoreValue.textContent = this.completedChallenges.size;
    this.el.scoreBadge.classList.remove('pulse');
    void this.el.scoreBadge.offsetWidth;
    this.el.scoreBadge.classList.add('pulse');
  },

  _showLevelUpOverlay() {
    const overlay = this.el.levelupOverlay;
    const name = this.studentName || 'Explorer';
    overlay.innerHTML = `
      <div class="levelup-card">
        <span class="levelup-trophy">🏆</span>
        <h2>You did it, ${name}!</h2>
        <p>You cleared every quest and earned all 6 stars. You really understand how circuits work now. ⚡</p>
        <div class="levelup-stars">⭐⭐⭐⭐⭐⭐</div>
        <button class="levelup-close">Awesome, thanks!</button>
      </div>
    `;
    overlay.hidden = false;
    overlay.querySelector('.levelup-close').addEventListener('click', () => {
      overlay.hidden = true;
    });
  },

  /* ---------------------------------------------------------- side panel */

  _bindSidePanel() {
    this.el.sidePanelClose.addEventListener('click', () => this._closeSidePanel());
  },

  _bindSvgClicks() {
    this.el.svg.addEventListener('click', (e) => {
      const g = e.target.closest('.comp');
      if (g) this._selectComponent(g.dataset.id);
    });
  },

  _closeSidePanel() {
    this.selectedId = null;
    this.connectPickerFor = null;
    this.el.sidePanel.classList.remove('open');
    this._highlightSelected(null);
  },

  _selectComponent(id) {
    Sfx.click();
    this.selectedId = id;
    this.connectPickerFor = null;
    this._highlightSelected(id);
    this.el.sidePanel.classList.add('open');
    this._renderSidePanel();
  },

  _highlightSelected(id) {
    this.el.svg.querySelectorAll('.comp').forEach((g) => g.classList.toggle('selected', g.dataset.id === id));
  },

  _renderSidePanel() {
    const comp = this.circuit.getComponent(this.selectedId);
    const body = this.el.sidePanelBody;
    body.innerHTML = '';
    if (!comp) {
      this._closeSidePanel();
      return;
    }

    const title = document.createElement('h3');
    title.textContent = `${ComponentMeta[comp.type].name} ${comp.label}`;
    body.appendChild(title);

    if (comp.type === 'resistor') {
      body.appendChild(this._sliderControl({
        label: 'Resistance',
        min: ComponentMeta.resistor.min,
        max: ComponentMeta.resistor.max,
        step: ComponentMeta.resistor.step,
        value: comp.value,
        unit: 'Ω',
        onInput: (v) => this._changeResistance(comp, v),
        onChange: (oldV, newV) => this._explainResistanceChange(oldV, newV),
      }));
    }

    if (comp.type === 'battery') {
      body.appendChild(this._sliderControl({
        label: 'Battery Voltage',
        min: 1,
        max: 12,
        step: 1,
        value: comp.value,
        unit: 'V',
        onInput: (v) => this._changeVoltage(comp, v),
        onChange: (oldV, newV) => this._explainVoltageChange(oldV, newV),
      }));
    }

    if (comp.type === 'switch') {
      const row = document.createElement('div');
      row.className = 'panel-row';
      const btn = document.createElement('button');
      btn.className = `switch-toggle-btn ${comp.state.on ? 'is-on' : 'is-off'}`;
      btn.textContent = comp.state.on ? 'ON — click to open' : 'OFF — click to close';
      btn.addEventListener('click', () => {
        comp.state.on = !comp.state.on;
        comp.state.on ? Sfx.switchOn() : Sfx.switchOff();
        btn.textContent = comp.state.on ? 'ON — click to open' : 'OFF — click to close';
        btn.className = `switch-toggle-btn ${comp.state.on ? 'is-on' : 'is-off'}`;
        this.updateElectrical();
      });
      row.appendChild(btn);
      body.appendChild(row);
    }

    if (comp.type === 'led') {
      const info = document.createElement('p');
      info.className = 'panel-info';
      info.textContent = comp.state.burnt
        ? 'This LED has burned out.'
        : 'Brightness depends on the current flowing through it.';
      body.appendChild(info);
      if (comp.state.burnt) {
        const replaceBtn = document.createElement('button');
        replaceBtn.className = 'panel-btn primary';
        replaceBtn.textContent = 'Replace LED';
        replaceBtn.addEventListener('click', () => {
          Sfx.connect();
          this.circuit.removeComponent(comp.id);
          const added = this.circuit.addComponent('led');
          this.renderLayout();
          if (added.component) this._selectComponent(added.component.id);
        });
        body.appendChild(replaceBtn);
      }
    }

    // Universal actions
    const actions = document.createElement('div');
    actions.className = 'panel-actions';

    if (comp.type !== 'battery') {
      const removeBtn = document.createElement('button');
      removeBtn.className = 'panel-btn danger';
      removeBtn.textContent = 'Remove';
      removeBtn.addEventListener('click', () => {
        Sfx.pop();
        this.circuit.removeComponent(comp.id);
        this._closeSidePanel();
        this.renderLayout();
      });
      actions.appendChild(removeBtn);

      const disconnectBtn = document.createElement('button');
      disconnectBtn.className = 'panel-btn';
      disconnectBtn.textContent = 'Disconnect';
      disconnectBtn.addEventListener('click', () => {
        const r = this.circuit.disconnectComponent(comp.id);
        if (r.error) {
          Sfx.pop();
          this._toast('Nothing to disconnect', r.error, 'info');
        } else {
          Sfx.pop();
        }
        this.renderLayout();
      });
      actions.appendChild(disconnectBtn);
    }

    const connectBtn = document.createElement('button');
    connectBtn.className = 'panel-btn primary';
    connectBtn.textContent = 'Connect';
    connectBtn.addEventListener('click', () => this._toggleConnectPicker(comp.id));
    actions.appendChild(connectBtn);

    body.appendChild(actions);

    if (this.connectPickerFor === comp.id) {
      body.appendChild(this._connectPicker(comp.id));
    }
  },

  _sliderControl({ label, min, max, step, value, unit, onInput, onChange }) {
    const wrap = document.createElement('div');
    wrap.className = 'panel-row';
    const labelRow = document.createElement('div');
    labelRow.className = 'slider-label-row';
    const labelEl = document.createElement('span');
    labelEl.textContent = label;
    const valueEl = document.createElement('span');
    valueEl.className = 'slider-value';
    valueEl.textContent = `${value} ${unit}`;
    labelRow.appendChild(labelEl);
    labelRow.appendChild(valueEl);
    wrap.appendChild(labelRow);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = min;
    slider.max = max;
    slider.step = step;
    slider.value = value;
    slider.className = 'slider';

    let startValue = value;
    slider.addEventListener('mousedown', () => (startValue = Number(slider.value)));
    slider.addEventListener('touchstart', () => (startValue = Number(slider.value)));
    slider.addEventListener('input', () => {
      const v = Number(slider.value);
      valueEl.textContent = `${v} ${unit}`;
      onInput(v);
    });
    slider.addEventListener('change', () => {
      const v = Number(slider.value);
      onChange(startValue, v);
    });

    wrap.appendChild(slider);
    return wrap;
  },

  _toggleConnectPicker(id) {
    this.connectPickerFor = this.connectPickerFor === id ? null : id;
    this._renderSidePanel();
  },

  _connectPicker(id) {
    const wrap = document.createElement('div');
    wrap.className = 'connect-picker';
    const heading = document.createElement('p');
    heading.className = 'panel-info';
    heading.textContent = `Connect ${id} to:`;
    wrap.appendChild(heading);

    const candidates = this.circuit.listConnectionCandidates(id);
    if (candidates.length === 0) {
      const none = document.createElement('p');
      none.className = 'panel-info';
      none.textContent = 'No free terminals available right now.';
      wrap.appendChild(none);
      return wrap;
    }

    candidates.forEach((cand) => {
      const btn = document.createElement('button');
      btn.className = 'panel-btn candidate-btn';
      btn.textContent = cand.label;
      btn.addEventListener('click', () => {
        Sfx.connect();
        this.circuit.connect(id, cand.componentId, cand.terminal);
        this.connectPickerFor = null;
        this.renderLayout();
        this._renderSidePanel();
      });
      wrap.appendChild(btn);
    });
    return wrap;
  },

  /* ---------------------------------------------------------- electrical reactions */

  _changeResistance(comp, newValue) {
    comp.value = newValue;
    const valueLabel = document.getElementById(`value-${comp.id}`);
    if (valueLabel) valueLabel.textContent = `${newValue} Ω`;
    this.updateElectrical();
  },

  _changeVoltage(comp, newValue) {
    comp.value = newValue;
    const valueLabel = document.getElementById(`value-${comp.id}`);
    if (valueLabel) valueLabel.textContent = `${newValue} V`;
    this.updateElectrical();
  },

  _explainResistanceChange(oldV, newV) {
    if (oldV === newV) return;
    const lines = Simulation.explainResistanceChange(oldV, newV);
    if (lines.length) this._toast(lines[0], lines[1], 'info');
  },

  _explainVoltageChange(oldV, newV) {
    if (oldV === newV) return;
    const lines = Simulation.explainVoltageChange(oldV, newV);
    if (lines.length) this._toast(lines[0], '', 'info');
  },

  /* ---------------------------------------------------------- rendering: layout */

  renderLayout() {
    const svg = this.el.svg;
    svg.innerHTML = '';
    this.terminalPos = {};

    const battery = this.circuit.getBattery();
    const walk = this.circuit.walkFromPositive();
    const railY = 150;
    const trayY = 300;
    const startX = 110;
    const spacing = 140;
    const boxW = 64;

    const wireLayer = svgNode('g', { class: 'wire-layer' });
    const compLayer = svgNode('g', { class: 'comp-layer' });
    svg.appendChild(wireLayer);
    svg.appendChild(compLayer);

    // ---- place battery
    const batX = startX;
    this.terminalPos[`${battery.id}:neg`] = { x: batX - boxW / 2 - 18, y: railY };
    this.terminalPos[`${battery.id}:pos`] = { x: batX + boxW / 2 + 18, y: railY };
    compLayer.appendChild(Components.draw(battery, { x: batX, y: railY, w: boxW }));

    // ---- place main chain (steps)
    walk.steps.forEach((step, i) => {
      const comp = this.circuit.getComponent(step.id);
      const x = startX + spacing * (i + 1);
      const leftX = x - boxW / 2 - 18;
      const rightX = x + boxW / 2 + 18;
      this.terminalPos[`${comp.id}:${step.entryTerminal}`] = { x: leftX, y: railY };
      this.terminalPos[`${comp.id}:${step.exitTerminal}`] = { x: rightX, y: railY };
      compLayer.appendChild(Components.draw(comp, { x, y: railY, w: boxW }));
    });

    // ---- place tray (disconnected / floating components)
    const inChainIds = new Set(walk.steps.map((s) => s.id));
    const trayComponents = this.circuit
      .allComponents()
      .filter((c) => c.type !== 'battery' && !inChainIds.has(c.id))
      .sort((a, b) => a.id.localeCompare(b.id));

    if (trayComponents.length) {
      const trayLabel = svgNode('text', { x: startX, y: trayY - 40, class: 'tray-label' });
      trayLabel.textContent = 'Disconnected parts';
      compLayer.appendChild(trayLabel);
    }

    trayComponents.forEach((comp, i) => {
      const x = startX + spacing * i;
      const leftX = x - boxW / 2 - 18;
      const rightX = x + boxW / 2 + 18;
      this.terminalPos[`${comp.id}:${comp.terminals[0]}`] = { x: leftX, y: trayY };
      this.terminalPos[`${comp.id}:${comp.terminals[1]}`] = { x: rightX, y: trayY };
      compLayer.appendChild(Components.draw(comp, { x, y: trayY, w: boxW }));
    });

    // ---- size the viewBox to fit however many parts are on the board
    const chainSlots = walk.steps.length + 1; // +1 for the battery
    const maxSlots = Math.max(chainSlots, trayComponents.length, 1);
    const contentWidth = startX + spacing * (maxSlots - 1) + boxW / 2 + 18 + 70;
    const totalW = Math.max(680, contentWidth);
    const totalH = trayComponents.length ? 380 : 300;
    svg.setAttribute('viewBox', `0 0 ${totalW} ${totalH}`);

    // ---- wires: battery+ -> first step
    const wireEls = [];
    const posPt = this.terminalPos[`${battery.id}:pos`];
    const negPt = this.terminalPos[`${battery.id}:neg`];

    if (walk.steps.length > 0) {
      const firstEntry = this.terminalPos[`${walk.steps[0].id}:${walk.steps[0].entryTerminal}`];
      wireEls.push(this._line(wireLayer, posPt, firstEntry));

      for (let i = 0; i < walk.steps.length - 1; i++) {
        const a = this.terminalPos[`${walk.steps[i].id}:${walk.steps[i].exitTerminal}`];
        const b = this.terminalPos[`${walk.steps[i + 1].id}:${walk.steps[i + 1].entryTerminal}`];
        wireEls.push(this._line(wireLayer, a, b));
      }

      const last = walk.steps[walk.steps.length - 1];
      const lastExit = this.terminalPos[`${last.id}:${last.exitTerminal}`];

      if (walk.complete) {
        wireEls.push(this._returnPath(wireLayer, lastExit, negPt, railY + 90));
      } else {
        // dangling stub + open marker
        const stubEnd = { x: lastExit.x + 26, y: lastExit.y };
        wireEls.push(this._line(wireLayer, lastExit, stubEnd));
        Animations.highlightOpenPoint(svg, stubEnd.x, stubEnd.y);
      }
    } else if (walk.complete) {
      // battery+ wired directly to battery- (dead short right at the terminals)
      wireEls.push(this._returnPath(wireLayer, posPt, negPt, railY + 90));
    } else {
      Animations.highlightOpenPoint(svg, posPt.x, posPt.y);
    }

    // ---- wires among tray-only components (isolated islands)
    const trayIds = new Set(trayComponents.map((c) => c.id));
    this.circuit.edges.forEach((edge) => {
      if (trayIds.has(edge.t1.id) && trayIds.has(edge.t2.id)) {
        const a = this.terminalPos[`${edge.t1.id}:${edge.t1.terminal}`];
        const b = this.terminalPos[`${edge.t2.id}:${edge.t2.terminal}`];
        if (a && b) wireEls.push(this._line(wireLayer, a, b, true));
      }
    });

    this.wireEls = wireEls;

    // Re-bind selection highlight after full rebuild
    this._highlightSelected(this.selectedId);
    if (this.selectedId && !this.circuit.getComponent(this.selectedId)) {
      this._closeSidePanel();
    } else if (this.selectedId) {
      this._renderSidePanel();
    }

    this.updateElectrical();
  },

  _line(layer, a, b, dashed) {
    const el = svgNode('line', {
      x1: a.x,
      y1: a.y,
      x2: b.x,
      y2: b.y,
      class: dashed ? 'wire-segment wire-dashed' : 'wire-segment',
    });
    layer.appendChild(el);
    return el;
  },

  _returnPath(layer, from, to, bottomY) {
    const d = `M ${from.x} ${from.y} L ${from.x} ${bottomY} L ${to.x} ${bottomY} L ${to.x} ${to.y}`;
    const el = svgNode('path', { d, class: 'wire-segment', fill: 'none' });
    layer.appendChild(el);
    return el;
  },

  /* ---------------------------------------------------------- rendering: electrical */

  updateElectrical() {
    const sim = Simulation.evaluate(this.circuit);
    const led = this.circuit.getLed();
    const sw = this.circuit.getSwitch();

    // Dashboard (only "pop" a stat when its displayed text actually changes,
    // so the dashboard doesn't jitter on every re-render).
    this._setStatIfChanged(this.el.dashV, `${sim.voltage.toFixed(0)} V`);
    this._setStatIfChanged(this.el.dashI, sim.current === null ? '⚠ very high' : Simulation.formatAmps(sim.current));
    this._setStatIfChanged(this.el.dashR, `${sim.totalResistance} Ω`);
    this._setStatIfChanged(this.el.dashP, sim.power ? `${sim.power.toFixed(2)} W` : '0 W');

    this._setStatusBadge(sim.status);

    // Switch visuals
    if (sw) Animations.setSwitchState(sw.id, sw.state.on);

    // LED visuals
    if (led) {
      if (sim.status === 'overload' && !led.state.burnt && !this.ledOverloadPlaying) {
        this.ledOverloadPlaying = true;
        Sfx.alarm();
        Animations.playLedOverload(led.id, () => {
          led.state.burnt = true;
          this.ledOverloadPlaying = false;
          this._toast(sim.messages[0] || 'Oops! 💥', sim.messages[1] || '', 'danger');
          this.updateElectrical();
        });
      } else if (led.state.burnt) {
        Animations.setLedBurnt(led.id, true);
      } else {
        Animations.setLedBrightness(led.id, sim.ledBrightness);
      }
    }

    // Wire flow animation
    const flowAmps = sim.status === 'closed' ? sim.current : sim.status === 'short' ? null : 0;
    Animations.setWireFlow(this.wireEls || [], flowAmps);

    // Open-point highlight already placed during layout for the open case;
    // clear it when the circuit is actually complete.
    if (sim.status !== 'open' && sim.status !== 'switch-off') {
      Animations.clearOpenHighlight(this.el.svg);
    }

    // Status-change toast + sound (skip while the overload flash is still
    // playing — that path shows its own toast/sound once the burn animation
    // finishes).
    const statusKey = `${sim.status}:${sim.ledBurnt}`;
    if (statusKey !== this.lastStatusKey && !this.ledOverloadPlaying) {
      this.lastStatusKey = statusKey;
      this._toastForStatus(sim);
      this._sfxForStatus(sim.status);
    }

    this._checkChallenge(sim);
  },

  _setStatIfChanged(el, text) {
    if (el.textContent === text) return;
    el.textContent = text;
    Animations.pulseStat(el);
  },

  _sfxForStatus(status) {
    if (status === 'closed') Sfx.success();
    else if (status === 'short') Sfx.alarm();
    else if (status === 'open' || status === 'switch-off') Sfx.buzz();
    // 'overload' plays its own sound via the burn animation callback.
  },

  _setStatusBadge(status) {
    const labels = {
      open: '🔌 Open Circuit',
      'switch-off': '⏻ Switch Off',
      closed: '✅ Current Flowing',
      short: '⚡ Short Circuit',
      overload: '💥 Overload',
    };
    const badge = this.el.statusBadge;
    badge.textContent = labels[status] || status;
    badge.className = `status-badge status-${status}`;
  },

  _toastForStatus(sim) {
    if (sim.status === 'overload') return; // handled after the burn animation
    const type = { open: 'info', 'switch-off': 'info', closed: 'success', short: 'danger' }[sim.status] || 'info';
    if (sim.messages.length) this._toast(sim.messages[0], sim.messages[1] || '', type);
  },

  _toast(title, subtitle, type) {
    Animations.showToast(this.el.toastLayer, { title, subtitle, type });
    if (this.el.mascot) {
      this.el.mascot.classList.remove('mascot-react');
      void this.el.mascot.offsetWidth;
      this.el.mascot.classList.add('mascot-react');
    }
  },
};

function svgNode(tag, attrs) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

document.addEventListener('DOMContentLoaded', () => App.init());
