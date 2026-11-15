export class GameAudio {
  constructor() {
    this.enabled = true;
    try {
      this.enabled = localStorage.getItem("pocket-sound") !== "off";
    } catch {}
    this.context = null;
  }
  unlock() {
    try {
      if (!this.context) {
        this.context = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.context.createGain();
        this.master.gain.value = 0.52;
        const limiter = this.context.createDynamicsCompressor();
        limiter.threshold.value = -18;
        limiter.knee.value = 12;
        limiter.ratio.value = 5;
        this.master.connect(limiter);
        limiter.connect(this.context.destination);
        const n = this.context.sampleRate;
        this.noise = this.context.createBuffer(1, n, this.context.sampleRate);
        const data = this.noise.getChannelData(0);
        for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
      }
      if (this.context.state === "suspended")
        this.context.resume().catch(() => {});
    } catch {}
  }
  toggle() {
    this.enabled = !this.enabled;
    try {
      localStorage.setItem("pocket-sound", this.enabled ? "on" : "off");
    } catch {}
    this.unlock();
    return this.enabled;
  }
  tone(from, to, duration, volume, type = "sine", delay = 0) {
    const ctx = this.context,
      t = ctx.currentTime + delay,
      o = ctx.createOscillator(),
      g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(25, to), t + duration);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(volume, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + duration + 0.01);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }
  noiseBurst(duration, frequency, volume, delay = 0) {
    const ctx = this.context,
      t = ctx.currentTime + delay,
      s = ctx.createBufferSource(),
      f = ctx.createBiquadFilter(),
      g = ctx.createGain();
    s.buffer = this.noise;
    f.type = "bandpass";
    f.frequency.setValueAtTime(frequency, t);
    f.frequency.exponentialRampToValueAtTime(
      Math.max(80, frequency * 0.25),
      t + duration,
    );
    f.Q.value = 0.6;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(volume, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    s.connect(f);
    f.connect(g);
    g.connect(this.master);
    s.start(t);
    s.stop(t + duration + 0.01);
    s.onended = () => {
      s.disconnect();
      f.disconnect();
      g.disconnect();
    };
  }
  play(e) {
    if (!this.enabled || !this.context || this.context.state !== "running")
      return;
    if (e.type === "hit") {
      this.tone(
        e.heavy ? 110 : 180,
        42,
        e.heavy ? 0.27 : 0.13,
        e.heavy ? 0.42 : 0.28,
        "triangle",
      );
      this.noiseBurst(e.heavy ? 0.28 : 0.13, e.heavy ? 1700 : 2600, 0.25);
      if (e.heavy) this.tone(60, 28, 0.35, 0.32);
      return;
    }
    if (e.type === "cast") {
      const duration = Math.max(0.07, e.duration ?? 0.2);
      if (e.kind === "melee") {
        this.noiseBurst(0.12, 2100, 0.09);
        return;
      }
      if (e.kind === "projectile") {
        this.tone(280, 720, 0.16, 0.1);
      }
      if (e.kind === "dash") {
        this.noiseBurst(duration, 1000, 0.06);
      }
      if (e.kind === "beam") {
        this.tone(
          e.ultimate ? 140 : 480,
          e.ultimate ? 850 : 1400,
          duration,
          0.1,
          "triangle",
        );
        this.tone(
          e.ultimate ? 210 : 720,
          e.ultimate ? 1275 : 2100,
          duration,
          0.05,
        );
      }
      if (e.kind === "pulse") {
        [196, 247, 294].forEach((n, i) =>
          this.tone(n, n * 2, duration, 0.07, "sine", i * 0.025),
        );
      }
    } else if (e.type === "release") {
      if (e.kind === "projectile") {
        this.noiseBurst(0.2, 1800, 0.17);
        this.tone(230, 70, 0.2, 0.14);
      }
      if (e.kind === "dash") {
        this.noiseBurst(0.27, 1400, 0.16);
        this.tone(160, 60, 0.23, 0.16, "triangle");
      }
      if (e.kind === "beam") {
        this.noiseBurst(
          e.ultimate ? 0.5 : 0.22,
          3100,
          e.ultimate ? 0.23 : 0.12,
        );
        this.tone(
          e.ultimate ? 620 : 1300,
          e.ultimate ? 95 : 300,
          e.ultimate ? 0.55 : 0.25,
          e.ultimate ? 0.24 : 0.09,
          "sawtooth",
        );
        if (e.ultimate) this.tone(80, 35, 0.35, 0.25);
      }
      if (e.kind === "pulse") {
        this.tone(
          95,
          28,
          e.ultimate ? 0.45 : 0.24,
          e.ultimate ? 0.4 : 0.18,
          "triangle",
        );
        this.noiseBurst(
          e.ultimate ? 0.34 : 0.18,
          1500,
          e.ultimate ? 0.25 : 0.12,
        );
        [392, 494, 587].forEach((n, i) =>
          this.tone(n, n * 0.6, 0.5, 0.06, "sine", i * 0.04),
        );
      }
    } else if (e.type === "break") {
      this.noiseBurst(0.35, 1800, 0.24);
      this.tone(150, 45, 0.2, 0.19, "triangle");
    } else if (e.type === "objectHit") {
      this.noiseBurst(0.09, 1000, 0.14);
      this.tone(180, 90, 0.09, 0.14, "triangle");
    } else if (e.type === "end") {
      [523, 659, 784, 1047].forEach((n, i) =>
        this.tone(n, n, 0.3, 0.13, "sine", i * 0.12),
      );
    } else if (e.type === "countdown" || e.type === "start") {
      this.tone(
        e.type === "start" ? 880 : 440,
        e.type === "start" ? 880 : 440,
        0.14,
        0.12,
      );
    }
  }
}
