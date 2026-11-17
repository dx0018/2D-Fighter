import { drawNaruto } from "./naruto-fallback.js";
export function drawFallback(state) {
  const c = this.ctx,
    w = this.canvas.width,
    h = this.canvas.height;
  c.clearRect(0, 0, w, h);
  c.fillStyle = this.map.colors?.sky || "#d9e6dc";
  c.fillRect(0, 0, w, h);
  const xs = state.fighters.map((f) => f.x),
    worldW = Math.max(
      this.map.camera?.minWidth || 23,
      Math.max(...xs) - Math.min(...xs) + 8,
    ),
    scale = w / worldW,
    center = (Math.max(...xs) + Math.min(...xs)) / 2,
    base = h * 0.75;
  c.fillStyle = this.map.theme === "moon" ? "#84999b" : "#b3c4aa";
  c.fillRect(0, h * 0.5, w, h * 0.5);
  c.fillStyle = this.map.colors?.ground || "#d4c2a3";
  c.fillRect(0, base, w, h - base);
  for (let i = 0; i < 12; i++) {
    c.fillStyle = i % 2 ? "#d4c4a7" : "#e4d6b8";
    c.fillRect((i * w) / 12, h * 0.27, w / 12 - 5, h * 0.28);
    c.fillStyle = "#789399";
    c.fillRect((i * w) / 12 + 12, h * 0.34, w / 30, h * 0.08);
  }
  const px = (x) => w / 2 + (x - center) * scale;
  for (const o of state.objects || []) {
    if (o.destroyed) continue;
    const ow = (o.width || 1.2) * scale,
      oh = (o.height || 1.2) * scale;
    c.save();
    c.translate(px(o.x), base);
    c.rotate(Math.sin(this.clock * 25) * (o.shake || 0) * 0.2);
    if (o.type === "crate") {
      c.fillStyle = o.color || "#ba8753";
      c.fillRect(-ow / 2, -oh, ow, oh);
      c.strokeStyle = "#e6bd85";
      c.lineWidth = scale * 0.07;
      c.strokeRect(-ow * 0.46, -oh * 0.95, ow * 0.92, oh * 0.9);
      c.beginPath();
      c.moveTo(-ow * 0.4, -oh * 0.1);
      c.lineTo(ow * 0.4, -oh * 0.9);
      c.stroke();
    } else {
      const boardH = Math.min(oh * 0.36, ow * 0.4);
      c.fillStyle = "#806d54";
      c.fillRect(
        -scale * 0.04,
        -oh + boardH / 2,
        scale * 0.08,
        oh - boardH / 2,
      );
      c.fillStyle = o.color || "#6c9686";
      c.fillRect(-ow / 2, -oh, ow, boardH);
    }
    c.restore();
  }
  const ellipse = (x, y, rx, ry, color) => {
    c.fillStyle = color;
    c.beginPath();
    c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    c.fill();
  };
  state.fighters.forEach((f, i) => {
    if (["ninja", "sasuke"].includes(f.character.bodyStyle)) {
      drawNaruto(c, px(f.x), base - f.y * scale, scale, f, this.clock);
      return;
    }
    const x = px(f.x),
      y = base - f.y * scale,
      s = scale,
      po = f.character?.id === "po" || this.characters[i].id === "po",
      color = po ? "#ee5558" : "#149cdd";
    c.save();
    c.translate(x, y);
    if (f.crouching) c.scale(1, 0.68);
    ellipse(0, 0, s * 0.65, s * 0.12, "#64705b44");
    ellipse(0, -s * 1.05, s * 0.69, s * 0.82, color);
    ellipse(0, -s * 2.1, s * (po ? 0.71 : 0.86), s * 0.72, color);
    ellipse(0, -s * 2.13, s * 0.56, s * 0.49, po ? "#f1c7a6" : "#fff9ef");
    if (po) {
      c.strokeStyle = color;
      c.lineWidth = s * 0.08;
      c.beginPath();
      c.arc(0, -s * 3.0, s * 0.16, 0, Math.PI * 2);
      c.stroke();
      c.fillStyle = color;
      c.fillRect(-s * 0.04, -s * 2.95, s * 0.08, s * 0.25);
      ellipse(0, -s * 1.1, s * 0.4, s * 0.4, "#bcd7cd");
    } else {
      ellipse(0, -s * 1.03, s * 0.5, s * 0.53, "#fff9ef");
      c.fillStyle = "#e94343";
      c.fillRect(-s * 0.6, -s * 1.65, s * 1.2, s * 0.09);
      ellipse(0, -s * 1.57, s * 0.11, s * 0.12, "#ffd15b");
      ellipse(0, -s * 2.17, s * 0.11, s * 0.1, "#e83b42");
    }
    [-1, 1].forEach((d) => {
      ellipse(d * s * 0.19, -s * 2.29, s * 0.045, s * 0.07, "#253b46");
      ellipse(
        d * s * 0.38,
        -s * 0.12,
        s * 0.34,
        s * 0.18,
        po ? color : "#faf9ef",
      );
      ellipse(
        d * s * 0.75,
        -s * 1.08,
        s * 0.25,
        s * 0.27,
        po ? color : "#faf9ef",
      );
    });
    c.strokeStyle = "#68474b";
    c.lineWidth = s * 0.025;
    c.beginPath();
    c.arc(0, -s * 2.15, s * 0.26, 0.25, Math.PI - 0.25);
    c.stroke();
    c.restore();
  });
  for (const p of state.projectiles || [])
    ellipse(
      px(p.x),
      base - p.y * scale,
      scale * (p.radius || 0.3),
      scale * (p.radius || 0.3),
      p.color || "#a5eaff",
    );
  for (const e of state.effects || []) {
    const a = 1 - e.life / (e.maxLife || 0.6);
    if (e.type === "beam") {
      c.save();
      c.translate(px(e.x), base - e.y * scale);
      c.rotate(-(e.angle || 0) * (e.direction || 1));
      c.fillStyle = e.color || "#b2edff";
      c.globalAlpha = (1 - a) * 0.65;
      c.fillRect(
        0,
        -(e.radius || 0.35) * scale,
        (e.direction || 1) * (e.range || 12) * scale,
        (e.radius || 0.35) * 2 * scale,
      );
      c.globalAlpha = 1;
      c.restore();
    }
    c.strokeStyle = e.color || "#ffe8af";
    c.lineWidth = scale * 0.06 * (1 - a);
    c.beginPath();
    c.arc(
      px(e.x),
      base - (e.y || 1) * scale,
      Math.max(0.02, a) * scale,
      0,
      Math.PI * 2,
    );
    c.stroke();
  }
}
