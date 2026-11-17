/** Shared bow sockets and shot geometry, in game units. No renderer dependency. */
export const SUSANOO_ARCHERY = Object.freeze({
  bodyBack: 0.85,
  bodyDepth: -1.8,
  ground: 0.015,
  grip: Object.freeze([0.15, 3.85, 0.85]),
  arrowScale: 0.65,
  arrowTail: 2.85,
  drawStart: 0.55,
  drawEnd: 1.15,
  limbLength: 1.3,
});

export function susanooArchery(fighter, opponent, move = fighter.currentMove?.move) {
  const cfg = SUSANOO_ARCHERY;
  const facing = opponent ? Math.sign(opponent.x - fighter.x) || fighter.facing || 1 : fighter.facing || 1;
  const root = {
    x: fighter.x - facing * cfg.bodyBack,
    y: cfg.ground,
    z: cfg.bodyDepth + facing * cfg.grip[0],
  };
  const grip = {x: fighter.x, y: cfg.grip[1] + cfg.ground, z: cfg.bodyDepth};
  const target = {
    x: opponent?.x ?? fighter.x + facing * 8,
    y: (opponent?.y || 0) + (opponent?.crouching ? 2.3 : 2.6) * 0.65,
    z: 0,
  };
  const dx = target.x - grip.x, dy = target.y - grip.y, dz = target.z - grip.z;
  const length = Math.max(0.001, Math.hypot(dx, dy, dz));
  const direction = {x: dx / length, y: dy / length, z: dz / length};
  // Project world up into the bow plane. Its limbs remain upright while aiming.
  const upLength = Math.max(0.001, Math.hypot(-direction.x * direction.y, 1 - direction.y ** 2, -direction.z * direction.y));
  const up = {x: -direction.x * direction.y / upLength, y: (1 - direction.y ** 2) / upLength, z: -direction.z * direction.y / upLength};
  const shoulder = {x: root.x, y: root.y + 4.58, z: root.z + facing * 0.9};
  const ax = grip.x - shoulder.x, ay = grip.y - shoulder.y, az = grip.z - shoulder.z;
  const along = ax * direction.x + ay * direction.y + az * direction.z;
  const discriminant = along ** 2 + 2.54 ** 2 - (ax ** 2 + ay ** 2 + az ** 2);
  const drawEnd = Math.min(cfg.drawEnd, Math.max(cfg.drawStart, along + Math.sqrt(Math.max(0, discriminant)) - 0.005));
  const restOffset = cfg.arrowTail * cfg.arrowScale - drawEnd;
  const origin = {
    x: grip.x + direction.x * restOffset,
    y: grip.y + direction.y * restOffset,
    z: grip.z + direction.z * restOffset,
  };
  const speed = move?.projectileSpeed || 25;
  return {root, grip, target, direction, up, origin, facing, drawEnd,
    vx: direction.x * speed, vy: direction.y * speed, vz: direction.z * speed};
}
