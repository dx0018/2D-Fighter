const bindings = [
  {
    left: "KeyA",
    right: "KeyD",
    jump: "KeyW",
    crouch: "KeyS",
    attack: "KeyF",
    skill: "KeyG",
    ultimate: "KeyH",
  },
  {
    left: "ArrowLeft",
    right: "ArrowRight",
    jump: "ArrowUp",
    crouch: "ArrowDown",
    attack: "KeyJ",
    skill: "KeyK",
    ultimate: "KeyL",
  },
];
export class Input {
  constructor(onPause) {
    this.keys = new Set();
    this.touch = new Set();
    this.pending = new Set();
    this.pendingTouch = new Set();
    this.enabled = false;
    this.down = (e) => {
      if (e.target.closest?.("input,textarea,select")) return;
      if (e.code === "Escape") {
        e.preventDefault();
        if (!e.repeat) onPause();
        return;
      }
      if (!this.enabled) return;
      if (bindings.some((b) => Object.values(b).includes(e.code))) {
        e.preventDefault();
        this.keys.add(e.code);
        if (!e.repeat) this.pending.add(e.code);
      }
    };
    this.up = (e) => this.keys.delete(e.code);
    window.addEventListener("keydown", this.down);
    window.addEventListener("keyup", this.up);
  }
  read() {
    const result = bindings.map((b, p) =>
      Object.fromEntries(
        Object.entries(b).map(([a, k]) => [
          a,
          this.enabled &&
            (this.keys.has(k) ||
              this.pending.has(k) ||
              this.touch.has(`${p}:${a}`) ||
              this.pendingTouch.has(`${p}:${a}`)),
        ]),
      ),
    );
    this.pending.clear();
    this.pendingTouch.clear();
    return result;
  }
  clear() {
    this.keys.clear();
    this.touch.clear();
    this.pending.clear();
    this.pendingTouch.clear();
  }
}
