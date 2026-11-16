import { english } from "./en.js";

let language = "zh";
try {
  if (localStorage.getItem("pocket-language") === "en") language = "en";
} catch {}
const originals = new WeakMap();
const attributes = ["aria-label", "alt", "title"];
export const getLanguage = () => language;

const patterns = [
  [/^确认 P(\d) 角色$/, (p) => `Confirm P${p}`],
  [/^P(\d) 获胜！$/, (p) => `P${p} WINS!`],
  [/^已选择：(.+)$/, (name) => `Selected: ${translate(name)}`],
  [/^(\d+) 处$/, (n) => `${n} props`],
  [/^(\d+) 伤害$/, (n) => `${n} damage`],
  [/^能量不足 · (\d+) EP$/, (n) => `Need ${n} EP`],
  [/^(.+) 秒$/, (n) => `${n} sec`],
  [/^(.+) (3D 预览|实景预览)$/, (name) => `${translate(name)} preview`],
  [
    /^([FJ]) 普攻也会随蹲下／空中变化：(.+)、(.+)。$/,
    (key, low, air) =>
      `${key} changes with stance: ${translate(low)} while crouching; ${translate(air)} in midair.`,
  ],
  [/^(.+) · (.+)$/, (a, b) => `${translate(a)} · ${translate(b)}`],
  [/^(\d+ — )(.+)$/, (prefix, name) => `${prefix}${translate(name)}`],
];

export function translate(source) {
  const text = String(source);
  if (language === "zh" || !/[\u3400-\u9fff？。]/.test(text)) return text;
  const value = text.trim();
  let result = Object.hasOwn(english, value) ? english[value] : null;
  // Dynamic strings keep numbers, player IDs and configuration-driven names.
  if (!result) {
    for (const [pattern, render] of patterns) {
      const match = value.match(pattern);
      if (match) {
        result = render(...match.slice(1));
        break;
      }
    }
  }
  return result ? text.replace(value, result) : text;
}

// Preserve the existing DOM, canvas, focus and match when changing language.
// Remember source strings per node, so switching back never reverse-translates.
export function localize(root) {
  function apply(node, key, read, write) {
    let entries = originals.get(node);
    if (!entries) originals.set(node, (entries = new Map()));
    const current = read();
    let entry = entries.get(key);
    if (!entry || current !== entry.output) entry = { source: current };
    entry.output = translate(entry.source);
    entries.set(key, entry);
    if (current !== entry.output) write(entry.output);
  }
  const doc = root.ownerDocument || root;
  const walker = doc.createTreeWalker(root, 1 | 4);
  let node = root;
  do {
    if (node.nodeType === 3 && !node.parentElement?.closest("script,style"))
      apply(
        node,
        "text",
        () => node.textContent,
        (text) => {
          node.textContent = text;
        },
      );
    else if (node.nodeType === 1)
      for (const name of attributes)
        if (node.hasAttribute(name))
          apply(
            node,
            name,
            () => node.getAttribute(name),
            (text) => node.setAttribute(name, text),
          );
  } while ((node = walker.nextNode()));
  root.querySelectorAll?.('[data-setting="language"]').forEach((select) => {
    select.value = language;
  });
}

export function setLanguage(next) {
  if (!["zh", "en"].includes(next)) return;
  language = next;
  try {
    localStorage.setItem("pocket-language", language);
  } catch {}
  document.documentElement.lang = language === "en" ? "en" : "zh-CN";
  document.title =
    language === "en"
      ? "Pocket Clash · Local Versus"
      : "Pocket Clash · 口袋对决";
  document
    .querySelector('meta[name="description"]')
    ?.setAttribute(
      "content",
      language === "en"
        ? "Pocket Clash: a cartoon 2.5D local versus fighting game. Share a keyboard and challenge a friend."
        : "Pocket Clash 口袋对决：与朋友同屏开战的卡通 2.5D 双人格斗游戏。",
    );
  localize(document.body);
}
