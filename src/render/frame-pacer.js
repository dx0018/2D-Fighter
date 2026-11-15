// Keep input and simulation sampling at the display rate, but avoid rendering
// more than 60 frames per second on high-refresh displays.
export class FramePacer {
  constructor(fps = 60) {
    this.interval = 1 / fps;
    this.elapsed = 0;
  }

  reset() {
    this.elapsed = 0;
  }

  ready(seconds, force = false) {
    if (force) {
      this.reset();
      return true;
    }
    if (!Number.isFinite(seconds) || seconds <= 0) return false;
    // Slow displays still render once per browser frame; never queue catch-up
    // renders after a stall.
    if (seconds >= this.interval) {
      this.reset();
      return true;
    }
    this.elapsed += seconds;
    if (this.elapsed + 1e-12 < this.interval) return false;
    this.elapsed = Math.max(0, this.elapsed - this.interval);
    return true;
  }
}
