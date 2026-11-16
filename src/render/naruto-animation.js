import { spinChakraOrb } from "./ninja-effects.js";

export function narutoMovePose(cast, face, w, power, released) {
  const style = cast.move.animation || "",
    front = face > 0 ? 1 : 0,
    back = 1 - front;
  const hands = [
    [-0.65, 1.3, 0.4],
    [0.65, 1.3, 0.4],
  ];
  if (style.includes("rasengan")) {
    const low = style.includes("low"),
      air = style.includes("air");
    const extension = released ? power : w * 0.3;
    const y = low ? 0.48 : air ? 0.75 : 1.3;
    hands[front] = [
      face * (0.45 + 0.8 * extension),
      y,
      released ? -0.05 : 0.42,
    ];
    hands[back] = released
      ? [-face * 0.25, 1.3, 0.5]
      : [face * 0.3, y + 0.22, 0.58];
    return {
      hands,
      lean: -face * (released ? 0.25 * power : 0.07 * w),
      twist: face * 0.7,
      bodyY: -0.035 * (released ? power : w),
      squash: 1 - 0.07 * w,
    };
  }
  if (style === "bijuu") {
    hands[front] = [face * (0.6 + 0.5 * (released ? power : w)), 1.5, 0.1];
    hands[back] = [face * (0.4 + 0.45 * (released ? power : w)), 1.5, 0.65];
    return {
      hands,
      lean: face * (released ? 0.16 * power : -0.08 * w),
      twist: face * 0.4,
      bodyY: -0.05 * w,
      squash: 1 - 0.1 * w,
    };
  }
  if (style === "kunai") {
    hands[front] = [
      face * (released ? 1.15 : 0.1),
      released ? 1.55 : 1.95,
      0.1,
    ];
    hands[back] = [-face * 0.65, 1.1, 0.3];
    return {
      hands,
      lean: face * 0.12 * (released ? power : w),
      twist: face * 0.8,
      bodyY: 0,
      squash: 1,
    };
  }
  return null;
}
export function animateNarutoDetails(m, f, time) {
  const cast = f.currentMove,
    visual = cast?.move.visual,
    face = f.facing || 1;
  const elapsed = cast?.elapsed || 0,
    windup = cast?.move.windup || 1;
  m.headbandTies.rotation.z = Math.sin(time * 7) * 0.07 + (f.vx || 0) * 0.015;
  m.rasengan.visible =
    visual === "rasengan" && elapsed < windup + cast.move.active;
  if (m.rasengan.visible) {
    const hand = m.arms[face > 0 ? 1 : 0].hand;
    if (m.rasengan.parent !== hand) hand.add(m.rasengan);
    m.rasengan.position.set(face * 0.2, 0, 0);
    spinChakraOrb(
      m.rasengan,
      time * 2,
      0.11 + 0.23 * Math.min(1, elapsed / windup),
    );
  }
  m.bijuu.visible = visual === "bijuu" && elapsed < windup;
  m.chakraCloak.visible = visual === "bijuu";
  if (m.bijuu.visible) {
    const yaw = m.root.rotation.y;
    m.bijuu.position.set(
      Math.cos(yaw) * face * 1.4,
      1.5,
      Math.sin(yaw) * face * 1.4,
    );
    spinChakraOrb(m.bijuu, time, 0.12 + 0.53 * Math.min(1, elapsed / windup));
    m.chakraCloak.material.opacity = 0.035 + (elapsed / windup) * 0.055;
  }
}
