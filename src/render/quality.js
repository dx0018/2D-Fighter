export class RenderQuality {
  constructor(mode = "auto", software = false) {
    this.mode = mode;
    this.software = software;
    this.slowFrames = 0;
    this.samples = 0;
    this.average = 1 / 60;
    this.degraded = software;
  }
  get profile() {
    const low =
        this.mode === "performance" || (this.mode === "auto" && this.degraded),
      high = this.mode === "high";
    return {
      level: low ? "performance" : high ? "high" : "balanced",
      pixelRatio: low ? 0.75 : high ? 1.5 : 1.25,
      shadows: !low,
      shadowSamples: low ? 1 : 4,
      shadowSize: high ? 1024 : 512,
    };
  }
  setMode(mode) {
    this.mode = mode;
    this.degraded = this.software;
    this.slowFrames = 0;
    this.samples = 0;
    this.average = 1 / 60;
  }
  sample(seconds) {
    if (this.mode !== "auto" || this.degraded || seconds <= 0 || seconds > 0.5)
      return false;
    this.samples++;
    this.average += (seconds - this.average) * 0.08;
    if (this.samples < 20) return false;
    this.slowFrames =
      this.average > 1 / 52
        ? this.slowFrames + 1
        : Math.max(0, this.slowFrames - 1);
    if (this.slowFrames >= 16) {
      this.degraded = true;
      return true;
    }
    return false;
  }
}
