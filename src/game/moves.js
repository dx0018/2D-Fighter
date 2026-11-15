export const contextLabels = {
  neutral: "原地",
  forward: "向前",
  backward: "后退",
  crouch: "下蹲",
  air: "空中",
};

// Directions are relative to the opponent, independent of screen side and player.
export function moveContext(fighter, input = {}, opponent, jumping = false) {
  if (!fighter.grounded || fighter.jumpStartup > 0 || jumping) return "air";
  if (input.crouch) return "crouch";
  const direction = Number(!!input.right) - Number(!!input.left);
  if (!direction) return "neutral";
  const facing =
    Math.sign((opponent?.x ?? fighter.x + fighter.facing) - fighter.x) ||
    fighter.facing;
  return direction === facing ? "forward" : "backward";
}

export function selectMove(character, key, context = "neutral") {
  const base = character.moves[key];
  const variant = base.variants?.[context];
  return {
    ...base,
    ...(variant || {}),
    context: variant ? context : "neutral",
  };
}

export function moveList(character, key = "skill") {
  return Object.keys(contextLabels)
    .filter(
      (context) =>
        context === "neutral" || character.moves[key].variants?.[context],
    )
    .map((context) => selectMove(character, key, context));
}
