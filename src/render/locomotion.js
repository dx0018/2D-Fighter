import { clamp, damp } from "./primitives.js";

const TAU = Math.PI * 2;

// Match the swing's speed to the planted foot at both ends. The squared sine
// lifts and lands with zero vertical speed, instead of snapping off the floor.
export function sampleStep(phase, stride = 2.3, lift = 0.23) {
  const p = (((phase / TAU) % 1) + 1) % 1,
    support = 0.5,
    half = (stride * support) / 2;
  if (p < support)
    return {
      x: half - p * stride,
      lift: 0,
      roll: -0.1 + (p / support) * 0.22,
      support: true,
      cycle: Math.floor(phase / TAU),
    };
  const t = (p - support) / (1 - support),
    t2 = t * t,
    t3 = t2 * t,
    tangent = -stride * (1 - support);
  return {
    x:
      (2 * t3 - 3 * t2 + 1) * -half +
      (t3 - 2 * t2 + t) * tangent +
      (-2 * t3 + 3 * t2) * half +
      (t3 - t2) * tangent,
    lift: Math.sin(t * Math.PI) ** 2 * lift,
    roll: 0.12 * (1 - t) - 0.1 * t - Math.sin(t * Math.PI) * 0.18,
    support: false,
    cycle: Math.floor(phase / TAU),
  };
}

export function updateGait(model, fighter, dt, walking) {
  const config = fighter.character.locomotion || {},
    distance = fighter.walkDistance || 0,
    delta = distance - (model.lastWalkDistance ?? 0);
  model.gaitCycle ??= Math.PI / 2;
  if (dt > 0) {
    if (delta < -1e-5 || delta > 3) model.gaitCycle = Math.PI / 2;
    else
      model.gaitCycle +=
        (delta * Math.sign(fighter.vx || fighter.facing) * TAU) /
        (config.stride || 2.3);
    model.lastWalkDistance = distance;
  }
  model.walkBlend = damp(
    model.walkBlend || 0,
    walking ? clamp(Math.abs(fighter.vx) / fighter.character.speed, 0, 1) : 0,
    dt,
    walking ? 18 : 22,
  );
  // This is visual weight transfer only; movement itself responds immediately.
  model.travelDirection = damp(
    model.travelDirection ?? fighter.facing,
    Math.sign(fighter.vx) || model.travelDirection || fighter.facing,
    dt,
    18,
  );
  return model.gaitCycle;
}
