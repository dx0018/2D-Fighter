// Keep 15–30 fps simulation at real speed; cap only long stalls / resumed tabs.
export const frameDelta = (seconds) =>
  Number.isFinite(seconds) ? Math.max(0, Math.min(seconds, 0.1)) : 0;
