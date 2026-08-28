// ─── Procedural WebAudio: SFX + haunted ambience ────────────────────────────
class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private musicNodes: AudioNode[] = [];
  private bellTimer: number | null = null;
  unlocked = false;

  unlock() {
    if (this.unlocked) return;
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.unlocked = true;
    } catch { /* no audio */ }
  }

  private get c() { return this.ctx!; }
  private now() { return this.ctx!.currentTime; }

  private env(gain: GainNode, t0: number, peak: number, a: number, d: number) {
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(peak, t0 + a);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
  }

  private osc(type: OscillatorType, f0: number, f1: number, dur: number, peak: number, t0?: number) {
    if (!this.ctx || !this.master) return;
    const t = t0 ?? this.now();
    const o = this.c.createOscillator();
    const g = this.c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    this.env(g, t, peak, 0.008, dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(dur: number, peak: number, filterType: BiquadFilterType, f0: number, f1: number, q = 1, t0?: number) {
    if (!this.ctx || !this.master || !this.noiseBuf) return;
    const t = t0 ?? this.now();
    const s = this.c.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    const f = this.c.createBiquadFilter();
    f.type = filterType;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    f.Q.value = q;
    const g = this.c.createGain();
    this.env(g, t, peak, 0.005, dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t);
    s.stop(t + dur + 0.05);
  }

  // ── combat ──
  swing() { this.noise(0.13, 0.16, "highpass", 400, 1600, 1.2); }
  hit() {
    this.osc("square", 170, 55, 0.09, 0.22);
    this.noise(0.07, 0.14, "lowpass", 900, 300);
  }
  crit() {
    this.osc("square", 220, 60, 0.12, 0.26);
    this.osc("triangle", 1400, 900, 0.16, 0.14);
    this.noise(0.1, 0.18, "lowpass", 1400, 400);
  }
  blocked() {
    this.osc("square", 950, 700, 0.12, 0.16);
    this.osc("square", 1420, 1100, 0.14, 0.1);
  }
  hurt() { this.osc("sawtooth", 120, 48, 0.22, 0.24); this.noise(0.14, 0.1, "lowpass", 500, 150); }
  kill() {
    this.noise(0.28, 0.2, "lowpass", 1000, 120);
    this.osc("sine", 300, 55, 0.3, 0.16);
  }
  bossRoar() {
    this.osc("sawtooth", 70, 42, 0.9, 0.3);
    this.osc("sawtooth", 105, 60, 0.8, 0.18);
    this.noise(0.9, 0.16, "lowpass", 700, 100);
  }

  // ── loot / world ──
  gold() {
    this.osc("sine", 900, 900, 0.07, 0.12);
    this.osc("sine", 1350, 1350, 0.09, 0.1, this.now() + 0.06);
  }
  itemPickup() {
    this.osc("triangle", 660, 660, 0.1, 0.14);
    this.osc("triangle", 990, 990, 0.14, 0.12, this.now() + 0.08);
  }
  equipSound() { this.noise(0.08, 0.14, "lowpass", 400, 180); this.osc("square", 240, 180, 0.06, 0.08, this.now() + 0.05); }
  potion() {
    this.osc("sine", 320, 140, 0.16, 0.16);
    this.osc("sine", 500, 240, 0.14, 0.1, this.now() + 0.1);
    this.osc("triangle", 1200, 1600, 0.2, 0.06, this.now() + 0.2);
  }
  chest() {
    this.osc("sawtooth", 70, 130, 0.3, 0.14);
    this.osc("sawtooth", 90, 60, 0.25, 0.1, this.now() + 0.12);
    [523, 659, 784].forEach((f, i) => this.osc("triangle", f, f, 0.25, 0.07, this.now() + 0.3 + i * 0.07));
  }
  stairs() { this.noise(0.7, 0.2, "lowpass", 900, 90, 0.8); this.osc("sine", 200, 60, 0.7, 0.14); }
  footstep() { this.noise(0.045, 0.05, "lowpass", 380, 140); }
  error() { this.osc("square", 140, 90, 0.12, 0.1); }

  // ── UI / stingers ──
  uiOpen() { this.noise(0.18, 0.08, "bandpass", 700, 1400, 1.5); }
  uiClose() { this.noise(0.14, 0.07, "bandpass", 1200, 600, 1.5); }
  deathStinger() {
    const t = this.now();
    [73.4, 87.3, 110].forEach((f) => this.osc("sawtooth", f, f * 0.94, 2.6, 0.12, t));
    this.noise(2.4, 0.08, "lowpass", 400, 60, 0.7, t);
    this.osc("sine", 220, 55, 2.2, 0.1, t + 0.1);
  }
  victoryStinger() {
    const t = this.now();
    [146.8, 174.6, 220, 293.7, 349.2].forEach((f, i) => this.osc("triangle", f, f, 0.5, 0.12, t + i * 0.13));
    [146.8, 220, 293.7].forEach((f) => this.osc("sawtooth", f, f, 2.4, 0.05, t + 0.7));
  }

  // ── haunted ambience ──
  startMusic() {
    if (!this.ctx || !this.master || this.musicGain) return;
    const c = this.c;
    this.musicGain = c.createGain();
    this.musicGain.gain.value = 0;
    this.musicGain.gain.linearRampToValueAtTime(1, this.now() + 3);
    this.musicGain.connect(this.master);
    const bus = this.musicGain;

    // deep drone — two detuned saws through a dark lowpass
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 190;
    lp.Q.value = 0.6;
    const droneGain = c.createGain();
    droneGain.gain.value = 0.055;
    lp.connect(droneGain).connect(bus);
    [55, 55.6, 110.4].forEach((f, i) => {
      const o = c.createOscillator();
      o.type = i === 2 ? "triangle" : "sawtooth";
      o.frequency.value = f;
      o.connect(lp);
      o.start();
      this.musicNodes.push(o);
    });
    // slow breathing on the drone
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.06;
    const lfoG = c.createGain();
    lfoG.gain.value = 0.025;
    lfo.connect(lfoG).connect(droneGain.gain);
    lfo.start();
    this.musicNodes.push(lfo, lp, droneGain, lfoG);

    // cavern wind — looping noise, slow bandpass sweep
    const wind = c.createBufferSource();
    wind.buffer = this.noiseBuf;
    wind.loop = true;
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 420;
    bp.Q.value = 0.4;
    const wg = c.createGain();
    wg.gain.value = 0.016;
    const wlfo = c.createOscillator();
    wlfo.frequency.value = 0.11;
    const wlfoG = c.createGain();
    wlfoG.gain.value = 180;
    wlfo.connect(wlfoG).connect(bp.frequency);
    wind.connect(bp).connect(wg).connect(bus);
    wind.start(); wlfo.start();
    this.musicNodes.push(wind, bp, wg, wlfo, wlfoG);

    // sparse minor bell tolls through a cavernous delay
    const delay = c.createDelay(1.5);
    delay.delayTime.value = 0.46;
    const fb = c.createGain();
    fb.gain.value = 0.38;
    const damp = c.createBiquadFilter();
    damp.type = "lowpass";
    damp.frequency.value = 1200;
    delay.connect(damp).connect(fb).connect(delay);
    const bellBus = c.createGain();
    bellBus.gain.value = 0.6;
    bellBus.connect(bus);
    bellBus.connect(delay);
    delay.connect(bus);
    this.musicNodes.push(delay, fb, damp, bellBus);

    const toll = () => {
      if (!this.ctx) return;
      const t = this.now();
      const notes = [73.4, 87.3, 110, 130.8, 65.4];
      const f = notes[Math.floor(Math.random() * notes.length)] * (Math.random() < 0.3 ? 2 : 1);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.05, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 4.5);
      g.connect(bellBus);
      [1, 2.76, 5.4].forEach((m, i) => {
        const o = this.ctx!.createOscillator();
        o.type = "sine";
        o.frequency.value = f * m;
        const pg = this.ctx!.createGain();
        pg.gain.value = [1, 0.35, 0.12][i];
        o.connect(pg).connect(g);
        o.start(t);
        o.stop(t + 4.6);
      });
    };
    const scheduleBells = () => {
      toll();
      this.bellTimer = window.setTimeout(scheduleBells, 4500 + Math.random() * 6500);
    };
    this.bellTimer = window.setTimeout(scheduleBells, 2500);
  }

  stopMusic() {
    if (this.bellTimer) { clearTimeout(this.bellTimer); this.bellTimer = null; }
    this.musicNodes.forEach((n) => {
      try { (n as OscillatorNode).stop?.(); } catch { /* */ }
      try { n.disconnect(); } catch { /* */ }
    });
    this.musicNodes = [];
    if (this.musicGain) { try { this.musicGain.disconnect(); } catch { /* */ } this.musicGain = null; }
  }
}

export const sfx = new Sfx();
