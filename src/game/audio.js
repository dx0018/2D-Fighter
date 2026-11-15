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
      this.context ||= new (window.AudioContext || window.webkitAudioContext)();
      this.context.resume();
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
  play(event) {
    if (!this.enabled || !this.context) return;
    const type = event.type;
    const ctx = this.context,
      now = ctx.currentTime;
    const casts = {
      projectile: [420, 840],
      dash: [150, 220, 330],
      beam: [110, 220, 440, 880],
      pulse: [196, 247, 294, 392],
      melee: [210, 120],
    };
    const patterns =
      type === "end"
        ? [523, 659, 784, 1047]
        : type === "break"
          ? [180, 100, 55]
          : type === "hit"
            ? [180, 60]
            : type === "cast"
              ? casts[event.kind] || [330, 660]
              : [540];
    patterns.forEach((frequency, i) => {
      const osc = ctx.createOscillator(),
        gain = ctx.createGain();
      osc.type = type === "hit" || type === "break" ? "triangle" : "sine";
      osc.frequency.setValueAtTime(frequency, now + i * 0.065);
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(30, frequency * 0.5),
        now + i * 0.065 + 0.13,
      );
      gain.gain.setValueAtTime(0.0001, now + i * 0.065);
      gain.gain.exponentialRampToValueAtTime(0.065, now + i * 0.065 + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.065 + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.065);
      osc.stop(now + i * 0.065 + 0.2);
    });
  }
}
