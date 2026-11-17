export function narutoPortrait(name) {
  return `<svg viewBox="0 0 280 300" role="img" aria-label="${name}" xmlns="http://www.w3.org/2000/svg"><ellipse cx="140" cy="278" rx="64" ry="10" fill="#102734" opacity=".2"/><path d="M114 225v40m52-40v40" stroke="#ef882c" stroke-width="30" stroke-linecap="round"/><path d="M107 272h22m26 0h22" stroke="#28374e" stroke-width="22" stroke-linecap="round"/><rect x="95" y="165" width="90" height="82" rx="26" fill="#f4902d"/><path d="M106 181h68" stroke="#28374e" stroke-width="25"/><path d="M101 185l-27 30m105-30 27 30" stroke="#f4902d" stroke-width="24" stroke-linecap="round"/><path d="M140 179v64" stroke="#28374e" stroke-width="3"/><g fill="#f2c99d"><circle cx="73" cy="216" r="12"/><circle cx="207" cy="216" r="12"/><ellipse cx="140" cy="108" rx="64" ry="65"/></g><path d="M77 85L68 48l29 14-2-38 30 26 16-35 15 34 28-28-2 38 30-10-18 40Z" fill="#ffd34c"/><path d="M79 77h122" stroke="#28374e" stroke-width="23"/><rect x="101" y="65" width="78" height="24" rx="5" fill="#b8cbd5"/><path d="M125 80q-1-14 12-11 14 3 7 11-6 6-9-1-1-5 6-4m-16 4-7 2 3-7" fill="none" stroke="#43556b" stroke-width="2"/><g fill="#fff"><ellipse cx="118" cy="105" rx="14" ry="9"/><ellipse cx="162" cy="105" rx="14" ry="9"/></g><g fill="#279ed7"><ellipse cx="121" cy="105" rx="6" ry="8"/><ellipse cx="159" cy="105" rx="6" ry="8"/></g><path d="M90 119l24 3m-24 8 23 1m-21 9 21-1m77-20-24 3m24 8-23 1m21 9-21-1m-42 8q15 13 30 0" stroke="#986c4d" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`;
}
export function drawNaruto(c, x, y, s, f, clock) {
  const sasuke = f.character?.id === "sasuke";
  c.save();
  c.translate(x, y);
  c.scale(s, s * (f.crouching ? 0.72 : 1));
  const oval = (x, y, rx, ry, color) => {
    c.fillStyle = color;
    c.beginPath();
    c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    c.fill();
  };
  const step =
    f.action === "walk"
      ? Math.sin(((f.walkDistance || 0) * Math.PI * 2) / 2.6) * 0.12
      : 0;
  for (const side of [-1, 1]) {
    oval(side * (0.25 + step), -0.4, 0.19, 0.42, sasuke ? "#303341" : "#ef882c");
    oval(side * (0.27 + step), -0.13, 0.27, 0.16, "#28374e");
    oval(side * 0.64, -1.25, 0.16, 0.18, "#f2c99d");
  }
  oval(0, -1.25, 0.44, 0.58, sasuke ? "#b9bdca" : "#f4902d");
  c.fillStyle = "#28374e";
  c.fillRect(-0.42, -1.72, 0.84, 0.27);
  c.fillRect(-0.015, -1.65, 0.03, 0.94);
  oval(0, -2.22, 0.61, 0.64, "#f2c99d");
  c.fillStyle = sasuke ? "#18202c" : "#ffd34c";
  c.beginPath();
  c.moveTo(-0.6, -2.6);
  for (let i = 0; i < 9; i++)
    c.lineTo(-0.67 + i * 0.17, -2.8 - (i % 2 ? 0.3 : 0));
  c.lineTo(0.61, -2.6);
  c.fill();
  c.fillStyle = "#28374e";
  c.fillRect(-0.61, -2.66, 1.22, 0.2);
  c.fillStyle = "#b8cbd5";
  c.fillRect(-0.39, -2.67, 0.78, 0.19);
  for (const side of [-1, 1]) {
    oval(side * 0.2, -2.3, 0.13, 0.08, "#fff");
    oval(side * 0.2, -2.3, 0.055, 0.07, sasuke ? "#bd334e" : "#279ed7");
    c.strokeStyle = "#986c4d";
    c.lineWidth = 0.018;
    for (let i = 0; i < (sasuke ? 0 : 3); i++) {
      c.beginPath();
      c.moveTo(side * 0.27, -2.13 + i * 0.08);
      c.lineTo(side * 0.5, -2.11 + i * 0.08);
      c.stroke();
    }
  }
  if(sasuke){
    c.strokeStyle="#9463b7";c.lineWidth=.12;c.beginPath();c.moveTo(-.43,-.85);c.lineTo(.43,-.85);c.stroke();
    const visual=f.currentMove?.move.visual;
    if(visual?.startsWith("susanoo")){
      c.strokeStyle="#ba88edaa";c.lineWidth=.07;
      for(let i=0;i<6;i++){c.beginPath();c.ellipse(0,-2.15-i*.20,.75,.15,0,0,Math.PI*2);c.stroke();}
      oval(0,-3.65,.32,.36,"#b183e8aa");
    }
  }
  const cast = f.currentMove;
  if (
    cast &&
    ["rasengan", "bijuu"].includes(cast.move.visual) &&
    cast.elapsed < cast.move.windup + cast.move.active
  ) {
    const dark = cast.move.visual === "bijuu",
      r = dark
        ? 0.2 + 0.45 * Math.min(1, cast.elapsed / cast.move.windup)
        : 0.3,
      ox = f.facing * (dark ? 1.4 : 1.1),
      oy = -(cast.move.height ?? cast.move.hitY ?? 1.3);
    oval(ox, oy, r, r, dark ? "#20142f" : "#67d8ff");
    c.strokeStyle = dark ? "#d08cff" : "#e0ffff";
    c.lineWidth = 0.035;
    for (let i = 0; i < (sasuke ? 0 : 3); i++) {
      c.beginPath();
      c.ellipse(ox, oy, r * 1.08, r * 0.45, clock * 4 + i, 0, Math.PI * 2);
      c.stroke();
    }
  }
  c.restore();
}
