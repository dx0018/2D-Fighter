import { clamp } from "./primitives.js";

// Zero velocity and acceleration at every key pose. Contact still occurs at
// the configured windup, so smooth animation never postpones the hit window.
const smooth = (t) => {
  t = clamp(t, 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
};

export function sampleMelee(move, elapsed) {
  const prepareEnd = move.windup * (move.motion?.prepare || 0.35),
    returnStart = move.windup + move.active * 0.22,
    end = move.windup + move.active + move.recovery,
    prepare =
      elapsed < prepareEnd
        ? smooth(elapsed / prepareEnd)
        : 1 - smooth((elapsed - prepareEnd) / (move.windup - prepareEnd)),
    extension =
      elapsed <= prepareEnd
        ? 0
        : elapsed < move.windup
          ? smooth((elapsed - prepareEnd) / (move.windup - prepareEnd))
          : 1 - smooth((elapsed - returnStart) / (end - returnStart));
  return {
    prepare,
    extension,
    weight: Math.max(prepare, extension),
  };
}
