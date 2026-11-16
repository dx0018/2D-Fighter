// Throttle noncritical HUD text updates independently of animation and input.
export class FramePacer {
  constructor(fps = 60) {
    this.interval = 1 / fps;
    this.tolerance = Math.min(0.00075, this.interval * 0.05);
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
    if (seconds >= this.interval * 1.5) {
      this.reset();
      return true;
    }
    this.elapsed += seconds;
    if (this.elapsed + this.tolerance < this.interval) return false;
    // Preserve the fractional frame (including a small early-frame debt).
    // 16.5 / 16.8ms is a normal 60Hz cadence, not a reason to skip every other
    // frame. Large stalls above are discarded instead of queued for catch-up.
    this.elapsed -= this.interval;
    return true;
  }
}
