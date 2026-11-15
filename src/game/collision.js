// Swept segment against an expanded rectangle: fast diagonal shots cannot tunnel.
export function segmentHitsBox(ax, ay, bx, by, radius, x, width, y, height) {
  let enter = 0,
    leave = 1;
  for (const [start, delta, low, high] of [
    [ax, bx - ax, x - width / 2 - radius, x + width / 2 + radius],
    [ay, by - ay, y - radius, y + height + radius],
  ]) {
    if (Math.abs(delta) < 1e-9) {
      if (start < low || start > high) return false;
    } else {
      const a = (low - start) / delta,
        b = (high - start) / delta;
      enter = Math.max(enter, Math.min(a, b));
      leave = Math.min(leave, Math.max(a, b));
      if (enter > leave) return false;
    }
  }
  return true;
}

export const fighterHeight = (fighter) => (fighter.crouching ? 2.3 : 2.6);
