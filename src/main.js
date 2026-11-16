import "./style.css";
import "@fontsource/barlow-condensed/latin-600.css";
import "@fontsource/barlow-condensed/latin-700.css";
import "@fontsource/barlow-condensed/latin-800.css";
import { characters, maps } from "./config/content.js";
import { Game } from "./game/engine.js";
import { ComputerPlayer } from "./game/computer.js";
import { frameDelta } from "./game/frame-time.js";
import { contextLabels, selectMove, moveList } from "./game/moves.js";
import { Input } from "./game/input.js";
import { GameAudio } from "./game/audio.js";
import { ArenaRenderer } from "./render/arena.js";
import { FramePacer } from "./render/frame-pacer.js";
import { createPortrait, mapArt } from "./render/portraits.js";
import { getLanguage, setLanguage, localize, translate } from "./i18n/index.js";

const app = document.querySelector("#app");
const audio = new GameAudio();
let opponent = "human", computer = null;
let page = "home",
  selected = [0, 1],
  ready = [false, false],
  selectedMap = 0,
  game = null,
  arena = null,
  preview = null,
  paused = false,
  helpOpen = false,
  finishedHandled = false,
  homeTick = 0,
  hudElapsed = 0,
  lastHudPhase = null,
  last = performance.now();
// Draw with the display's native cadence. Throttle text updates independently;
// forcing 60 draws onto 90/144Hz produces uneven motion even on a fast GPU.
const hudPacer = new FramePacer(30);
const previewPacer = new FramePacer(30);
const input = new Input(() => togglePause());
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const getChars = () => selected.map((i) => characters[i]);
let graphicsMode = "auto";
try {
  const saved = localStorage.getItem("pocket-graphics");
  if (["auto", "high", "performance"].includes(saved)) graphicsMode = saved;
} catch {}
const hudNodes = new Map();
const hudNode = (selector) => {
  if (!hudNodes.has(selector))
    hudNodes.set(selector, document.querySelector(selector));
  return hudNodes.get(selector);
};
function hudText(selector, text) {
  const node = hudNode(selector);
  text = translate(text);
  if (node.textContent !== text) node.textContent = text;
}
function hudStyle(selector, key, value) {
  const node = hudNode(selector);
  if (node.style[key] !== value) node.style[key] = value;
}
function qualityControl() {
  return `<label class="quality-control"><span>画质</span><select aria-label="画面质量" data-setting="quality">${[
    ["auto", "自动"],
    ["high", "精细"],
    ["performance", "流畅"],
  ]
    .map(
      ([value, label]) =>
        `<option value="${value}" ${graphicsMode === value ? "selected" : ""}>${label}</option>`,
    )
    .join("")}</select></label>`;
}

function languageControl() {
  return `<label class="quality-control language-control"><select data-setting="language" aria-label="Language / 语言"><option value="zh" ${getLanguage() === "zh" ? "selected" : ""}>中文</option><option value="en" ${getLanguage() === "en" ? "selected" : ""}>English</option></select></label>`;
}

function renderPage(markup) {
  app.innerHTML = markup;
  localize(app);
}

function header() {
  return `<header class="site-header"><button class="brand" data-action="home" aria-label="口袋对决主页"><span class="brand-mark">p<span>c</span><i></i></span><span>POCKET<span>CLASH<span class="brand-dot">.</span></span></span></button><span class="header-caption">小小英雄，无限可能</span><nav><button class="text-button" data-action="help" aria-label="操作说明"><span class="key-symbol">?</span><span>操作说明</span></button>${qualityControl()}${languageControl()}<button class="icon-button sound" data-action="sound" aria-label="${audio.enabled ? "关闭" : "开启"}音效" aria-pressed="${audio.enabled}">${audio.enabled ? "♫" : "♩"}</button><span class="local-pill"><i></i> ${opponent === "computer" ? "对战电脑" : "本地双人"}</span></nav></header>`;
}
function footer() {
  return `<footer class="site-footer"><span>POCKET CLASH <b>© 2026</b></span><span>两位玩家 · 一台键盘 · 无数次再来一局</span><button class="footer-credits" data-action="credits">模型来源与授权</button><span class="footer-right">MADE FOR FRIENDLY RIVALRIES <i>✳</i></span></footer>`;
}
function steps(active) {
  return `<div class="steps" aria-label="游戏流程">${["选择角色", "选择场地", "准备开战"].map((x, i) => `<span class="${active === i ? "current" : active > i ? "done" : ""}"><b>${active > i ? "✓" : `0${i + 1}`}</b>${x}</span>${i < 2 ? "<i></i>" : ""}`).join("")}</div>`;
}
function teardown() {
  hudNodes.clear();
  homeTick = 0;
  hudElapsed = 0;
  lastHudPhase = null;
  hudPacer.reset();
  previewPacer.reset();
  computer = null;
  arena?.dispose();
  arena = null;
  preview = null;
  input.enabled = false;
  input.clear();
  paused = false;
  helpOpen = false;
  document.querySelector(".modal-root")?.remove();
}
function showHome() {
  teardown();
  page = "home";
  game = null;
  renderPage(
    `${header()}<main class="home"><div class="hero-topline"><span><i></i> THE COUCH IS YOUR ARENA</span><span>VOL. 01 / 好朋友，来一场</span></div><div class="hero-grid"><section class="hero-copy"><div class="eyebrow"><span class="tiny-star">✳</span> 口袋对决 · 2.5D 格斗俱乐部</div><h1>小小英雄。<br><span>大大对决。</span><sup>✦</sup></h1><p>熟悉的伙伴，意想不到的对手。<br>和身边的朋友，共享一场热热闹闹的对决。</p><div class="hero-actions"><button class="button primary large" data-action="start">开始游戏 <span>↗</span></button><button class="button ghost" data-action="start-computer">对战电脑 <span>↗</span></button><button class="button ghost" data-action="help">怎么玩 <span>→</span></button></div><div class="hero-notes"><span><b>${String(characters.length).padStart(2, "0")}</b> 位首发英雄</span><i></i><span><b>${String(maps.length).padStart(2, "0")}</b> 个冒险场地</span><i></i><span>无需下载，即刻开战</span></div></section><section class="hero-preview" aria-label="卡通对战场景预览"><div class="preview-top"><span><i></i> LIVE FROM THE NEIGHBORHOOD</span><span>01 — ${esc(maps[0].name)}</span></div><div id="home-arena" class="home-arena"></div><div class="hero-versus"><span><b class="p1">P1</b> 哆啦A梦</span><i>VS</i><span>天线宝宝 · 小波 <b class="p2">P2</b></span></div><span class="preview-sticker">READY,<br>SET, <em>PLAY!</em></span><div class="preview-bottom"><span>一场友好的较量</span><span>ROUND 01 <i>↗</i></span></div></section></div><section class="feature-strip"><article><span class="feature-number">01</span><div><h3>选你的快乐搭子</h3><p>经典伙伴，各有拿手绝活</p></div><span>↗</span></article><article><span class="feature-number">02</span><div><h3>把街角变成擂台</h3><p>木箱能打碎，招牌会摇晃</p></div><span>↗</span></article><article><span class="feature-number">03</span><div><h3>同屏开打，快乐加倍</h3><p>双人键盘，随时再来一局</p></div><span>↗</span></article></section></main>${footer()}`,
  );
  try {
    preview = new Game({
      characters: [characters[0], characters[1]],
      map: maps[0],
    });
    preview.state.fighters[0].x = -3.5;
    preview.state.fighters[1].x = 3.5;
    arena = new ArenaRenderer(document.querySelector("#home-arena"), {
      map: maps[0],
      characters: [characters[0], characters[1]],
      quality: graphicsMode,
      onError: rendererWarning,
    });
  } catch (e) {
    rendererWarning(e);
  }
}
function showCharacters(reset = false) {
  teardown();
  page = "characters";
  game = null;
  if (reset) ready = [false, opponent === "computer"];
  renderPage(
    `${header()}<main class="flow-main">${steps(0)}<div class="section-heading"><div><div class="eyebrow">CHOOSE YOUR FIGHTER</div><h1>今天，谁来出招<span>？</span></h1><p>${opponent === "computer" ? "选择你的角色与电脑对手，确认 P1 后即可继续。" : "为两位玩家选择角色，然后分别确认。也可以选择同一位英雄。"}</p></div><span class="section-counter">${String(characters.length).padStart(2, "0")} <small>FIGHTERS</small></span></div><div class="opponent-choice"><label for="opponent-select">P2 控制</label><select id="opponent-select" data-setting="opponent"><option value="human" ${opponent === "human" ? "selected" : ""}>本地玩家</option><option value="computer" ${opponent === "computer" ? "selected" : ""}>电脑对手</option></select><span>${opponent === "computer" ? "P2 由电脑自动操作，你也可以为它选择角色。" : "两位玩家共用一台键盘。"}</span></div><div class="player-select-grid">${[
      0, 1,
    ]
      .map(
        (p) =>
          `<section class="player-panel player-${p + 1}"><div class="player-panel-heading"><span class="player-label p${p + 1}">PLAYER 0${p + 1}${p === 1 && opponent === "computer" ? " · CPU" : ""}</span><span class="status ${ready[p] ? "confirmed" : ""}">${ready[p] ? "✓ 已准备" : "选择你的英雄"}</span></div><div class="fighter-choices">${characters.map((c, i) => `<button class="fighter-card ${selected[p] === i ? "selected" : ""}" data-action="choose-character" data-player="${p}" data-index="${i}" aria-pressed="${selected[p] === i}" style="--fighter-color:${c.color}"><span class="fighter-no">${String(i + 1).padStart(2, "0")}</span><div class="portrait">${createPortrait(c)}</div><span class="fighter-caption"><b>${esc(c.name)}</b><small>${esc(c.englishName)}</small></span><span class="selection-check">${selected[p] === i ? "✓" : "＋"}</span></button>`).join("")}</div><div class="fighter-detail"><div><h3>${esc(characters[selected[p]].name)}</h3><span>${esc(characters[selected[p]].tagline)}</span></div><p>${esc(characters[selected[p]].description)}</p><div class="stat-row">${[
            ["power", "力量"],
            ["speed", "速度"],
            ["range", "射程"],
          ]
            .map(
              ([k, n]) =>
                `<span>${n}<i>${Array.from({ length: 5 }, (_, j) => `<b class="${j < characters[selected[p]].stats[k] ? "filled" : ""}"></b>`).join("")}</i></span>`,
            )
            .join(
              "",
            )}</div></div><button class="button ${ready[p] ? "ready-button" : "confirm-button"} full" data-action="ready" data-player="${p}" ${p === 1 && opponent === "computer" ? "disabled" : ""}>${p === 1 && opponent === "computer" ? "电脑已就绪" : ready[p] ? "✓ 准备完成 · 点击取消" : `确认 P${p + 1} 角色`} <span>${ready[p] ? "✓" : "→"}</span></button><div class="player-keys">${p === 1 && opponent === "computer" ? "电脑自动移动、躲避与出招" : p === 0 ? "<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><span>移动</span><kbd>F</kbd><kbd>G</kbd><kbd>H</kbd><span>招式</span>" : "<kbd>↑</kbd><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd><span>移动</span><kbd>J</kbd><kbd>K</kbd><kbd>L</kbd><span>招式</span>"}</div></section>`,
      )
      .join(
        "",
      )}</div><div class="flow-bottom"><button class="back-button" data-action="home">← 返回主页</button><span class="selection-hint">${ready.every(Boolean) ? "双方已准备，选择你们的战场。" : "等待双方确认角色"}</span><button class="button primary" data-action="to-maps" ${ready.every(Boolean) ? "" : "disabled"}>选择场地 <span>→</span></button></div></main>${footer()}`,
  );
}
function showMaps() {
  teardown();
  page = "maps";
  renderPage(
    `${header()}<main class="flow-main">${steps(1)}<div class="section-heading"><div><div class="eyebrow">PICK YOUR PLAYGROUND</div><h1>找个地方，过两招<span>。</span></h1><p>每一处街角，都有不一样的故事。</p></div><button class="button ghost" data-action="random">⚄ 随机选图</button></div><div class="map-layout"><div class="map-list">${maps.map((m, i) => `<button class="map-card ${selectedMap === i ? "selected" : ""}" data-action="choose-map" data-index="${i}" aria-pressed="${selectedMap === i}"><div class="map-thumb">${mapArt(m)}<span>${m.tag || "LOCAL ARENA"}</span></div><div class="map-caption"><span><small>STAGE 0${i + 1}</small><b>${esc(m.name)}</b></span><i>${selectedMap === i ? "✓" : "↗"}</i></div></button>`).join("")}</div><aside class="map-detail"><div class="eyebrow">YOUR NEXT DESTINATION</div><h2>${esc(maps[selectedMap].name)}</h2><p>${esc(maps[selectedMap].description)}</p><div class="map-properties"><span>场地跨度 <b>${maps[selectedMap].bounds.right - maps[selectedMap].bounds.left} m</b></span><span>互动机关 <b>${maps[selectedMap].objects.length} 处</b></span><span>对战规则 <b>99 秒 · 一局定胜负</b></span></div><div class="map-matchup">${getChars()
      .map(
        (c, p) =>
          `<div><div class="mini-portrait">${createPortrait(c)}</div><span class="p${p + 1}">P${p + 1}<b>${esc(c.name)}</b></span></div>`,
      )
      .join(
        "<i>VS</i>",
      )}</div><p class="map-tip">✦ 木箱可击碎，招牌可摇晃。<br>试试用不同招式与场景互动。</p></aside></div><div class="flow-bottom"><button class="back-button" data-action="back-characters">← 重新选人</button><span class="selection-hint" aria-live="polite">已选择：${esc(maps[selectedMap].name)}</span><button class="button primary" data-action="fight">准备开战 <span>↗</span></button></div></main>${footer()}`,
  );
}
function hudPlayer(c, p) {
  return `<div class="hud-player hud-p${p + 1}"><div class="hud-name"><span class="p${p + 1}">${p === 1 && opponent === "computer" ? "P2 · 电脑" : `P${p + 1}`}</span><b>${esc(c.name)}</b><span id="hp-text-${p}">100 / 100</span></div><div class="health-track"><div id="hp-lag-${p}" class="health-lag"></div><div id="hp-${p}" class="health-fill"></div></div><div class="energy-row"><div class="energy-track"><div id="energy-${p}" class="energy-fill"></div></div><span id="energy-text-${p}">100 EP</span></div></div>`;
}
function skillTray(c, p) {
  return `<div class="skill-tray p${p + 1}"><span class="tray-player">P${p + 1}</span>${["attack", "skill", "ultimate"].map((k, i) => `<div class="skill-slot" id="slot-${p}-${k}"><kbd>${p === 1 && opponent === "computer" ? "CPU" : (p ? ["J", "K", "L"] : ["F", "G", "H"])[i]}</kbd><span><b id="move-name-${p}-${k}">${esc(c.moves[k].name)}</b><small id="cooldown-${p}-${k}">${c.moves[k].cost || 0} EP</small></span><i class="cooldown-cover" id="cover-${p}-${k}"></i></div>`).join("")}</div>`;
}
function skillGuide(cs) {
  return `<details class="move-guide"><summary>方向招式表 <span>G / K 随方向和姿态变化</span></summary><p class="move-guide-note">前＝朝敌人移动，后＝远离敌人，两人换边后会自动对应。空中优先于下蹲与方向；跳跃＋技能可同时按。所有方向技能共用冷却，大招仍是独立的 H / L。</p><div class="move-guide-grid">${cs
    .map(
      (c, p) =>
        `<section><h3><b class="p${p + 1}">P${p + 1}</b> ${esc(c.name)} <kbd>${p ? "K" : "G"}</kbd></h3>${moveList(
          c,
        )
          .map(
            (move) =>
              `<article><span class="move-context">${contextLabels[move.context]}</span><div><b>${esc(move.name)}</b><p>${esc(move.description)}</p><small>${move.cost} EP · ${move.cooldown.toFixed(1)} 秒</small></div></article>`,
          )
          .join(
            "",
          )}<p class="move-basic-note">${p ? "J" : "F"} 普攻也会随蹲下／空中变化：${esc(selectMove(c, "attack", "crouch").name)}、${esc(selectMove(c, "attack", "air").name)}。</p></section>`,
    )
    .join(
      "",
    )}</div><p class="move-guide-note">胸口高度空气炮可用跳跃避开；蹲下可躲天线光线，跳跃也能越过贴地弹和扫腿。招式落空后有收招时间，留意对手的动作再反击。</p></details>`;
}
function touchPad(p) {
  if (p === 1 && opponent === "computer") return "";
  return `<div class="touch-pad"><b class="p${p + 1}">P${p + 1}</b>${[
    ["left", "←"],
    ["jump", "↑"],
    ["crouch", "↓"],
    ["right", "→"],
    ["attack", "攻"],
    ["skill", "技"],
    ["ultimate", "必"],
  ]
    .map(
      ([action, label]) =>
        `<button data-touch="${p}:${action}" aria-label="P${p + 1} ${action}">${label}</button>`,
    )
    .join("")}</div>`;
}
function startFight() {
  teardown();
  page = "fight";
  finishedHandled = false;
  const cs = getChars(),
    map = maps[selectedMap];
  game = new Game({ characters: cs, map, onEvent: (e) => audio.play(e) });
  computer = opponent === "computer" ? new ComputerPlayer() : null;
  renderPage(
    `${header()}<main class="battle-main"><div class="battle-heading"><span><i></i> LIVE MATCH <b>${esc(map.name)}</b></span><div><button class="text-button" data-action="help">? 操作</button><button class="text-button" data-action="fullscreen">⛶ 全屏</button><button class="button compact" data-action="pause">Ⅱ 暂停 <kbd>ESC</kbd></button></div></div><section class="battle-shell" id="battle-shell" aria-label="双人格斗场"><div id="battle-arena" class="battle-arena"></div><div class="battle-hud">${hudPlayer(cs[0], 0)}<div class="round-timer"><small>ROUND 01</small><b id="timer">99</b><span>ONE GOOD FIGHT</span></div>${hudPlayer(cs[1], 1)}</div><div id="impact-vignette" class="impact-vignette"></div><div class="combat-callouts">${[0, 1].map((p) => `<div id="super-${p}" class="super-callout super-p${p + 1}"><small>PLAYER 0${p + 1} · ULTIMATE</small><b></b></div><div id="combo-${p}" class="combo-callout combo-p${p + 1}"><b></b><small></small></div>`).join("")}</div><div class="battle-overlay" id="battle-overlay" aria-live="polite"></div><div class="arena-location"><span>STAGE 0${selectedMap + 1}</span><b>${esc(map.englishName)}</b></div><div id="feedback" class="battle-feedback" aria-live="polite"></div></section><div class="battle-bottom">${skillTray(cs[0], 0)}<span class="battle-center-label">POCKET<br><b>CLASH.</b></span>${skillTray(cs[1], 1)}</div><div class="battle-controls-note"><span><b class="p1">P1</b> WASD 移动 / 跳跃 / 蹲下</span><span>靠近对手出招 · 命中回复能量 · 大招消耗 70 EP</span><span><b class="p2">P2</b> ${opponent === "computer" ? "电脑自动操作" : "方向键 移动 / 跳跃 / 蹲下"}</span></div><details class="touch-controls"><summary>屏幕操作面板 <span>适合触屏体验；双人推荐键盘</span></summary>${touchPad(0)}${touchPad(1)}</details></main>${footer()}`,
  );
  try {
    arena = new ArenaRenderer(document.querySelector("#battle-arena"), {
      map,
      characters: cs,
      quality: graphicsMode,
      onError: rendererWarning,
    });
  } catch (e) {
    rendererWarning(e);
  }
  document
    .querySelector(".touch-controls")
    .insertAdjacentHTML("beforebegin", skillGuide(cs));
  document.querySelector(
    ".battle-controls-note > span:nth-child(2)",
  ).textContent = "G / K 随方向变招 · 前／后以敌人位置为准";
  localize(document.querySelector(".battle-main"));
  input.enabled = true;
  updateHud();
}
function rendererWarning(error) {
  console.warn("Renderer fallback", error);
  showFeedback("已启用兼容画面，游戏操作保持可用");
}
function showFeedback(text) {
  const target = document.querySelector("#feedback");
  if (target) {
    target.textContent = text;
    localize(target);
  }
}
function updateHud(dt = 1 / 60) {
  if (!game || page !== "fight") return;
  const s = game.state;
  s.fighters.forEach((f, p) => {
    const max = f.character.maxHp || 100,
      energyMax = f.character.maxEnergy || 100,
      percent = Math.max(0, (f.hp / max) * 100),
      lag = hudNode(`#hp-lag-${p}`),
      old = Number(lag.dataset.percent ?? 100);
    const trail =
      old < percent ? percent : old + (percent - old) * (1 - Math.exp(-dt * 3));
    lag.dataset.percent = trail;
    lag.style.width = `${trail}%`;
    const cast = f.currentMove,
      showSuper =
        cast?.key === "ultimate" && cast.elapsed < cast.move.windup + 0.2;
    hudNode(`#super-${p}`).classList.toggle("active", !!showSuper);
    if (showSuper) hudText(`#super-${p} b`, cast.move.name);
    hudNode(`#combo-${p}`).classList.toggle(
      "active",
      f.combo >= 2 && f.comboWindow > 0,
    );
    if (f.combo >= 2) {
      hudText(`#combo-${p} b`, `${f.combo} HITS`);
      hudText(`#combo-${p} small`, `${f.comboDamage} 伤害`);
    }
    hudStyle(`#hp-${p}`, "width", `${percent}%`);
    hudText(`#hp-text-${p}`, `${Math.ceil(f.hp)} / ${max}`);
    hudStyle(`#energy-${p}`, "width", `${(f.energy / energyMax) * 100}%`);
    hudText(`#energy-text-${p}`, `${Math.floor(f.energy)} EP`);
    for (const key of ["attack", "skill", "ultimate"]) {
      const move =
          cast?.key === key
            ? cast.move
            : selectMove(f.character, key, f.inputContext),
        cd = f.cooldowns[key] || 0,
        cost = move.cost || 0;
      hudText(`#move-name-${p}-${key}`, move.name);
      const slot = hudNode(`#slot-${p}-${key}`);
      if (slot.dataset.context !== move.context)
        slot.dataset.context = move.context;
      const title = translate(
        `${contextLabels[move.context]} · ${move.description}`,
      );
      if (slot.title !== title) slot.title = title;
      hudText(
        `#cooldown-${p}-${key}`,
        cd > 0.05
          ? `${cd.toFixed(1)} 秒`
          : f.energy < cost
            ? `能量不足 · ${cost} EP`
            : cost
              ? `${key === "ultimate" ? "大招" : contextLabels[move.context]} · ${cost} EP`
              : "就绪",
      );
      slot.classList.toggle("unavailable", cd > 0.05 || f.energy < cost);
      hudStyle(
        `#cover-${p}-${key}`,
        "transform",
        `scaleY(${Math.min(1, cd / (f.cooldownTotals[key] || 1))})`,
      );
    }
  });
  hudText("#timer", String(Math.max(0, Math.ceil(s.time))).padStart(2, "0"));
  hudNode("#timer").classList.toggle("urgent", s.time < 15);
  hudStyle(
    "#impact-vignette",
    "opacity",
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "0"
      : String((s.impactPulse || 0) * 0.5),
  );
  const overlay = hudNode("#battle-overlay");
  if (!paused && s.phase !== "finished") {
    const markup =
      s.phase === "countdown"
        ? `<div class="countdown"><span>准备好了吗？</span><b>${s.countdown > 0.7 ? Math.ceil(s.countdown) : "开战！"}</b><small>${esc(getChars()[0].name)} <i>VS</i> ${esc(getChars()[1].name)}</small></div>`
        : "";
    if (overlay.dataset.phaseMarkup !== markup) {
      overlay.innerHTML = markup;
      overlay.dataset.phaseMarkup = markup;
      localize(overlay);
    }
  }
  if (s.phase === "finished" && !finishedHandled) {
    finishedHandled = true;
    input.enabled = false;
    input.clear();
    showResults();
  }
}
function showResults() {
  const winner = game.state.winner,
    draw = winner === "draw" || winner === null;
  const c = draw ? null : getChars()[winner];
  document.querySelector("#battle-overlay").innerHTML =
    `<div class="result-card"><div class="eyebrow">${draw ? "A MATCH TO REMEMBER" : "THAT WAS A GOOD FIGHT"}</div><h2>${draw ? "势均力敌！" : `P${winner + 1} 获胜！`}</h2>${c ? `<div class="result-portrait">${createPortrait(c)}</div><h3>${esc(c.name)}</h3>` : '<div class="draw-symbol">VS</div>'}<p>${draw ? "这次不分高下，再来一场？" : opponent === "computer" ? "再挑战一次电脑，试试不同的招式吧。" : "漂亮的一战，和朋友再切磋一回吧。"}</p><div class="result-summary">${getChars()
      .map(
        (c, p) =>
          `<span><b class="p${p + 1}">P${p + 1}</b> ${esc(c.name)} <small>${Math.ceil(game.state.fighters[p].hp)} HP</small></span>`,
      )
      .join(
        "<i>·</i>",
      )}</div><button class="button primary full" data-action="rematch">再战一次 <span>↻</span></button><div class="result-links"><button data-action="reselect">重新选人</button><button data-action="home">返回主页</button></div></div>`;
  localize(document.querySelector("#battle-overlay"));
}
function togglePause(force) {
  if (page !== "fight" || game?.state.phase === "finished" || helpOpen) return;
  paused = typeof force === "boolean" ? force : !paused;
  game.paused = paused;
  input.clear();
  input.enabled = !paused;
  const overlay = document.querySelector("#battle-overlay");
  if (paused) {
    overlay.innerHTML = `<div class="pause-card"><div class="eyebrow">TAKE A LITTLE BREATHER</div><h2>稍作休息<span>。</span></h2><p>对战已暂停，准备好后继续。</p><button class="button primary full" data-action="pause">继续对战 <span>▶</span></button><button class="button ghost full" data-action="rematch">重新开始本局 ↻</button><div class="result-links"><button data-action="reselect">重新选人</button><button data-action="home">返回主页</button></div></div>`;
  } else {
    overlay.innerHTML = "";
    delete overlay.dataset.phaseMarkup;
    updateHud();
  }
  localize(overlay);
}
function showHelp() {
  if (helpOpen) return;
  helpOpen = true;
  const resume = page === "fight" && !paused && game.state.phase !== "finished";
  if (resume) {
    game.paused = true;
    input.enabled = false;
    input.clear();
  }
  const el = document.createElement("div");
  el.className = "modal-root";
  el.innerHTML = `<section class="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title"><button class="modal-close" data-action="close-help" aria-label="关闭操作说明">×</button><div class="eyebrow">A QUICK FIELD GUIDE</div><h2 id="help-title">快乐开打指南<span>。</span></h2><p>同一台电脑，两位玩家。先选角色与场地，倒数结束即可出招。</p><div class="help-players">${[
    0, 1,
  ]
    .map(
      (p) =>
        `<div><h3 class="p${p + 1}">PLAYER 0${p + 1}</h3>${[
          ["左右移动", p ? "← →" : "A D"],
          ["跳跃 / 蹲下", p ? "↑ ↓" : "W S"],
          ["普通攻击", p ? "J" : "F"],
          ["角色技能", p ? "K" : "G"],
          ["专属大招", p ? "L" : "H"],
        ]
          .map(([n, k]) => `<div><span>${n}</span><kbd>${k}</kbd></div>`)
          .join("")}</div>`,
    )
    .join(
      "",
    )}</div><div class="help-rules"><p><b>打出你的节奏</b>普攻近距离生效；技能与大招具有不同范围。每次按下触发一次招式，观察下方冷却与能量提示。</p><p><b>99 秒，一局定胜负</b>生命归零即结束；时间耗尽比较剩余生命比例，同时归零或生命比例相同为平局。木箱可破坏，招牌会响应攻击。</p><p><b>暂停与声音</b>按 Esc 暂停。切换窗口会自动暂停。右上角音符可开关合成音效。</p></div><button class="button primary full" data-action="close-help">明白了，出发！ <span>→</span></button></section>`;
  el.dataset.resume = String(resume);
  el.querySelector(".help-rules").insertAdjacentHTML(
    "beforebegin",
    skillGuide(getChars()),
  );
  document.body.append(el);
  localize(el);
  el.querySelector(".modal-close").focus();
}
function closeHelp() {
  const el = document.querySelector(".modal-root");
  if (!el) return;
  const resume = el.dataset.resume === "true";
  el.remove();
  helpOpen = false;
  if (resume && game) {
    game.paused = false;
    input.enabled = true;
  }
  document.querySelector('[data-action="help"]')?.focus();
}
function showCredits() {
  if (helpOpen) return;
  helpOpen = true;
  const resume = page === "fight" && !paused && game.state.phase !== "finished";
  if (resume) {
    game.paused = true;
    input.enabled = false;
    input.clear();
  }
  const el = document.createElement("div");
  el.className = "modal-root";
  el.innerHTML = `<section class="help-modal model-credits" role="dialog" aria-modal="true" aria-labelledby="model-credits-title"><button class="modal-close" data-action="close-credits" aria-label="关闭模型授权">×</button><div class="eyebrow">MODEL CREDITS · CC BY 4.0</div><h2 id="model-credits-title">模型来源与授权<span>。</span></h2><p>鸣人、哆啦A梦和小波的模型由以下创作者提供，依照 CC BY 4.0 保留署名。九尾与尾兽玉模型由玩家 dx0018 提供。部分模型为本游戏调整了比例、颜色、骨架和配件。</p><div class="model-credit-list"><article><h3>哆啦A梦 · Doraemon</h3><p>模型作者：<a href="https://sketchfab.com/satriek" target="_blank" rel="noreferrer">satriek</a></p><a href="https://sketchfab.com/3d-models/doraemon-b11372b0c29a4ef4b9691180d05870ec" target="_blank" rel="noreferrer">查看原始模型 ↗</a><span>CC BY 4.0 · 已重新绑定游戏骨架并调整比例</span></article><article><h3>天线宝宝小波 · Teletubby Po</h3><p>模型作者：@falterize</p><a href="https://github.com/falterize/katsa-engine" target="_blank" rel="noreferrer">查看模型来源 ↗</a><span>CC BY 4.0 · 已调整颜色并补充天线和屏幕</span></article><article><h3>漩涡鸣人 · Naruto Rigged (HatchXR)</h3><p>模型作者：<a href="https://sketchfab.com/nitwit.friends" target="_blank" rel="noreferrer">nitwit.friends</a></p><a href="https://sketchfab.com/3d-models/naruto-rigged-hatchxr-b03f67238a654141b61720d214ef1b44" target="_blank" rel="noreferrer">查看原始模型 ↗</a><span>CC BY 4.0 · 保留原骨骼和动作并接入战斗招式</span></article><article><h3>九尾狐 · Kurama Fox Head</h3><p>九尾与尾兽玉：dx0018 创建并提供。</p><span>已拆分尾兽玉、调整比例与材质并接入大招</span></article></div><a class="model-license-link" href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">查看 CC BY 4.0 完整许可条款 ↗</a><button class="button primary full" data-action="close-credits">返回游戏</button></section>`;
  el.dataset.resume = String(resume);
  document.body.append(el);
  localize(el);
  el.querySelector(".modal-close").focus();
}
app.addEventListener("click", handleClick);
app.addEventListener("change", (event) => {
  if (event.target.dataset.setting === "language") {
    setLanguage(event.target.value);
    updateHud(0);
    if (arena) arena.needsRender = true;
    event.target.blur();
    return;
  }
  if (event.target.dataset.setting === "opponent" && page === "characters") {
    opponent = event.target.value === "computer" ? "computer" : "human";
    ready[1] = opponent === "computer";
    showCharacters();
    return;
  }
  if (event.target.dataset.setting !== "quality") return;
  graphicsMode = event.target.value;
  try {
    localStorage.setItem("pocket-graphics", graphicsMode);
  } catch {}
  arena?.setQuality(graphicsMode);
  event.target.blur();
});
document.body.addEventListener("click", (e) => {
  if (e.target.closest(".modal-root")) handleClick(e);
});
function handleClick(e) {
  const button = e.target.closest("[data-action]");
  if (!button || button.disabled) return;
  audio.unlock();
  const a = button.dataset.action,
    p = Number(button.dataset.player),
    i = Number(button.dataset.index);
  switch (a) {
    case "home":
      showHome();
      break;
    case "start":
      opponent = "human";
      showCharacters(true);
      break;
    case "start-computer":
      opponent = "computer";
      showCharacters(true);
      break;
    case "help":
      showHelp();
      break;
    case "credits":
      showCredits();
      break;
    case "close-help":
    case "close-credits":
      closeHelp();
      break;
    case "sound":
      audio.toggle();
      document.querySelectorAll(".sound").forEach((x) => {
        x.textContent = audio.enabled ? "♫" : "♩";
        x.setAttribute("aria-pressed", audio.enabled);
        x.setAttribute("aria-label", `${audio.enabled ? "关闭" : "开启"}音效`);
        localize(x);
      });
      break;
    case "choose-character":
      selected[p] = i;
      ready[p] = p === 1 && opponent === "computer";
      showCharacters();
      break;
    case "ready":
      if (p === 1 && opponent === "computer") break;
      ready[p] = !ready[p];
      showCharacters();
      break;
    case "to-maps":
      if (ready.every(Boolean)) showMaps();
      break;
    case "choose-map":
      selectedMap = i;
      showMaps();
      break;
    case "random":
      selectedMap =
        (selectedMap + 1 + Math.floor(Math.random() * (maps.length - 1))) %
        maps.length;
      showMaps();
      break;
    case "back-characters":
      showCharacters();
      break;
    case "fight":
    case "rematch":
      startFight();
      break;
    case "reselect":
      showCharacters(true);
      break;
    case "pause":
      togglePause();
      break;
    case "fullscreen": {
      const shell = document.querySelector(".battle-main");
      if (document.fullscreenElement) document.exitFullscreen?.();
      else
        shell?.requestFullscreen?.().catch(() => {
          showFeedback("当前浏览器不支持全屏，可使用浏览器全屏模式。");
        });
      break;
    }
  }
}
app.addEventListener("pointerdown", (e) => {
  const b = e.target.closest("[data-touch]");
  if (!b || !input.enabled) return;
  e.preventDefault();
  b.setPointerCapture(e.pointerId);
  input.touch.add(b.dataset.touch);
  input.pendingTouch.add(b.dataset.touch);
  b.classList.add("pressed");
});
for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
  app.addEventListener(event, (e) => {
    const b = e.target.closest("[data-touch]");
    if (b) {
      input.touch.delete(b.dataset.touch);
      b.classList.remove("pressed");
    }
  });
window.addEventListener("blur", () => {
  input.clear();
  if (page === "fight" && !paused && !helpOpen) togglePause(true);
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    input.clear();
    if (page === "fight" && !paused && !helpOpen) togglePause(true);
  }
});
document.addEventListener("keydown", (e) => {
  if (helpOpen && e.code === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    closeHelp();
  }
  if (helpOpen && e.code === "Tab") {
    const nodes = [...document.querySelectorAll(".modal-root button")],
      first = nodes[0],
      last = nodes.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
});
function frame(now) {
  const elapsed = Math.max(0, (now - last) / 1000);
  const dt = frameDelta(elapsed);
  last = now;
  try {
    if (page === "fight" && game) {
      const controls = input.read();
      if (computer) controls[1] = computer.read(game, dt);
      game.step(dt, controls);
      if (game.paused) {
        hudElapsed = 0;
      } else {
        hudElapsed += dt;
      }
      if (hudPacer.ready(dt, lastHudPhase !== game.state.phase)) {
        updateHud(hudElapsed);
        hudElapsed = 0;
        lastHudPhase = game.state.phase;
      }
      if (!game.paused || arena?.needsRender)
        arena?.update(game.state, game.paused ? 0 : dt);
      if (!game.paused) arena?.sampleFrame(elapsed);
    } else if (preview && arena) {
      homeTick += dt;
      if (previewPacer.ready(dt, arena.needsRender)) {
        arena.update(preview.state, homeTick);
        homeTick = 0;
      }
      arena.sampleFrame(elapsed);
    }
  } catch (error) {
    console.error(error);
    if (page === "fight") {
      input.enabled = false;
      showFeedback("运行出现问题，请重新开始本局。");
    }
  }
  requestAnimationFrame(frame);
}
if (import.meta.env.DEV)
  window.__POCKET__ = {
    get game() {
      return game;
    },
    get page() {
      return page;
    },
    get arena() {
      return arena;
    },
  };
// Missing preview files fall back to local SVG art without blocking selection.
document.addEventListener(
  "error",
  (event) => {
    const element = event.target;
    const character = characters.find(
      (c) => c.id === element.dataset?.characterPreview,
    );
    const map = maps.find((m) => m.id === element.dataset?.mapPreview);
    if (character || map) {
      const parent = element.parentElement;
      element.outerHTML = character
        ? createPortrait(character, true)
        : mapArt(map, true);
      localize(parent);
    }
  },
  true,
);
showHome();
setLanguage(getLanguage());
requestAnimationFrame(frame);
