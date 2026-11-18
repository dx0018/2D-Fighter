import { MathUtils } from "three";

// Use simulation time to keep windup, contact and recovery aligned with the move.
export function sampleSkillMotion(cast) {
  const { windup, active, recovery } = cast.move;
  const elapsed = cast.elapsed ?? 0;
  const activeEnd = windup + active;
  const releaseStart = windup * 0.56;
  const weight = MathUtils.smoothstep(elapsed, 0, windup * 0.52) *
    (1 - MathUtils.smoothstep(elapsed, activeEnd, activeEnd + recovery));
  const strike = MathUtils.smoothstep(elapsed, releaseStart, windup);
  return {
    weight,
    strike,
    recoil: MathUtils.smoothstep(elapsed, windup, windup + active * 0.4) *
      (1 - MathUtils.smoothstep(elapsed, activeEnd, activeEnd + recovery)),
    sweep: MathUtils.smoothstep(elapsed, releaseStart, windup + active * 0.65),
  };
}

// Targets are [lateral offset, height, forward reach] in the model's stance.
export const skillPoses = {
  jab: { lead: [[.54, 1.45, .06], [.38, 1.53, .92]], support: [[.52, 1.35, .15], [.48, 1.4, .36]], lean: .12 },
  "ninja-jab": { lead: [[.48, 1.70, -.02], [.26, 1.87, 1.03]], support: [[.22, 1.88, .38], [.43, 1.76, .23]], lean: .19, twist: .28 },
  palm: { lead: [[.65, 1.52, -.18], [.28, 1.5, .88]], support: [[.52, 1.42, .22], [.65, 1.32, .08]], twist: .28 },
  cannon: { lead: [[.54, 1.45, .04], [.64, 1.75, .88]], support: [[.54, 1.28, .15], [.37, 1.56, .45]], lean: .1 },
  "retreat-cannon": { lead: [[.56, 1.5, .03], [.60, 1.72, .85]], support: [[.52, 1.38, .16], [.72, 1.32, -.18]], lean: -.13 },
  "low-cannon": { lead: [[.55, 1.17, .12], [.53, .53, .63]], support: [[.52, 1.38, .2], [.65, 1.19, .28]], lean: .23 },
  "air-cannon": { lead: [[.54, 1.47, .07], [.55, 1.4, .73]], support: [[.60, 1.62, .24], [.76, 1.44, -.16]], lean: .23 },
  "future-beam": { lead: [[.38, 1.42, .35], [.43, 1.38, .9]], support: [[.23, 1.39, .35], [.25, 1.34, .68]], lean: .16 },
  "antenna-beam": { lead: [[.24, 1.92, .35], [.44, 1.84, .73]], support: [[.24, 1.92, .35], [.44, 1.84, .73]], lean: .25 },
  "po-rush": { lead: [[.28, 1.72, .35], [.58, 1.33, -.15]], support: [[.27, 1.66, .34], [.60, 1.37, -.16]], lean: .34, step: .24 },
  rush: { lead: [[.48, 1.43, .05], [.25, 1.48, .96]], support: [[.43, 1.42, .24], [.62, 1.24, -.22]], lean: .26, step: .25 },
  "retreat-pulse": { lead: [[.19, 1.55, .43], [.82, 1.53, .03]], support: [[.24, 1.45, .43], [.78, 1.4, -.06]], lean: -.22, twist: .34, step: -.18 },
  pulse: { lead: [[.22, 1.24, .44], [.91, 1.78, .1]], support: [[.22, 1.24, .44], [.91, 1.78, .1]], lean: -.15, drop: .1 },
  sweep: { lead: [[.32, 1.38, .28], [.72, 1.41, .13]], support: [[.40, 1.49, .31], [.61, 1.36, -.19]], lean: .18, twist: .28, step: .48 },
  slide: { lead: [[.35, 1.42, .29], [.60, 1.3, -.15]], support: [[.38, 1.4, .2], [.76, 1.24, -.22]], lean: -.18, step: .54 },
  "air-kick": { lead: [[.38, 1.65, .42], [.58, 1.47, -.12]], support: [[.42, 1.62, .28], [.65, 1.40, -.03]], lean: -.22, step: .70 },
  "air-spin": { lead: [[.21, 1.56, .36], [.82, 1.48, .08]], support: [[.22, 1.56, .36], [.77, 1.44, .05]], lean: .14, step: .46, spin: true },
  rasengan: { lead: [[.34, 1.65, .34], [.32, 1.67, .99]], support: [[.10, 1.61, .44], [.59, 1.49, -.15]], lean: .22, twist: .24, step: .28, drop: .09 },
  "rasengan-rush": { lead: [[.51, 1.45, -.04], [.28, 1.68, 1.03]], support: [[.14, 1.62, .29], [.63, 1.43, -.25]], lean: .30, twist: .20, step: .25 },
  "low-rasengan": { lead: [[.29, 1.22, .3], [.31, .79, .93]], support: [[.12, 1.23, .33], [.57, 1.10, -.08]], lean: .27, step: .18 },
  "air-rasengan": { lead: [[.36, 1.87, .26], [.28, .98, .90]], support: [[.13, 1.72, .4], [.71, 1.52, -.16]], lean: .33, step: .24 },
  kunai: { lead: [[.48, 2.25, -.18], [.30, 1.36, .98]], support: [[.33, 1.56, .32], [.65, 1.36, -.09]], lean: -.08, twist: .36, step: -.17 },
  bijuu: { lead: [[.32, 1.64, .44], [.31, 1.83, 1.05]], support: [[.27, 1.65, .47], [.31, 1.82, 1.02]], lean: .21, drop: .08 },
};

export function externalSkill(cast, type) {
  if (!cast) return null;
  const name = cast.move.animation ?? (type === "po" ? "pulse" : "future-beam");
  const pose = skillPoses[name === "rush" && type === "po" ? "po-rush" : name];
  return pose && { pose, ...sampleSkillMotion(cast) };
}
