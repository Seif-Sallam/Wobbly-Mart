// PROTOTYPE (throwaway, branch prototype/boards-ui): `?boards=frames|podium` — the Wall of Fame (where the Boards
// show) and the Daily Shift, phone portrait and landscape. All rows are mock data; nothing is sent or saved.
// Round 2 after the owner picked C: one fixed-size Wall with tabs (Today / Speed / Stars / Streaks), opened from a
// 🏅 title button or the Daily ticket; the top three as Employee-of-the-Month frames or a podium; every popup blurs
// the game behind it and closes from ✕ in its header.
// Shared screens: first-online card, Nickname card (🎲, live preview, inline refusal), Cloud Code entry, Settings rows,
// Shift HUD (goal, Reset, unranked after the goal), end of Shift / Run, offline / loading / empty.
// `&gallery=1` lays every screen side by side; `&offline=1` starts offline. Bar: Wall / Shift / Goal / Run drive it.

interface AppGuts {
  ui: { screen: string; maps: { map: { id: string; name: string }; visited: boolean; tutorial: boolean }[] };
  play(id: string): void;
}

type Look = 'frames' | 'podium';
const LOOKS: Record<Look, string> = { frames: 'Employee of the Month frames', podium: 'Podium' };
type Kind = 'daily' | 'speedrun' | 'score' | 'streak';
const KINDS: Kind[] = ['daily', 'speedrun', 'score', 'streak'];
const TAB: Record<Kind, [string, string]> = {
  daily: ['📅', 'Today'],
  speedrun: ['⏱️', 'Speed'],
  score: ['⭐', 'Stars'],
  streak: ['🔥', 'Streaks'],
};
const CROWN: Record<Kind, string> = {
  daily: 'EMPLOYEE OF THE DAY',
  speedrun: 'FASTEST HANDS',
  score: 'STAR OF THE STORE',
  streak: 'NEVER LATE',
};
const HEADING: Record<Kind, string> = {
  daily: 'Shift of the Day',
  speedrun: 'Speed Legends',
  score: 'Star Collectors',
  streak: 'Never Missed a Shift',
};

const P = {
  /** What the Board fetch returned. */
  state: 'ok' as 'ok' | 'loading' | 'offline' | 'empty',
  /** This browser already has a Device (Cloud Code). */
  hasDevice: false,
  nickname: 'Wobbly Stocker',
  myRank: 37,
  boardSize: 512,
  /** Rows the Wall loads under the top three. */
  rows: 50,
  streak: 4,
  /** Neighbours shown either side of you in "Around you". */
  neighbours: 2,
  /** Backdrop blur behind every popup, px. */
  blur: 3,
  /** Wall popup size: max width px, and height as a share of the screen. */
  wallWidth: 480,
  wallHeight: 0.86,
  rowScale: 1,
  /** Rank count-up on the end screen, ms. */
  countMs: 1400,
  shiftNumber: 127,
  goal: 'Sell 60 Eggs',
};

const CSS = `
:root{--bp-blur:3px}
#ui .modal,#bp-modal{backdrop-filter:blur(var(--bp-blur));-webkit-backdrop-filter:blur(var(--bp-blur))}
#bp-bar{position:fixed;left:50%;bottom:8px;transform:translateX(-50%);z-index:95;display:flex;gap:4px;align-items:center;white-space:nowrap;
  overflow-x:auto;max-width:calc(100% - 16px);background:#222d;color:#fff;font:600 12px system-ui;padding:4px 6px;border-radius:999px;scrollbar-width:none}
#bp-bar button{background:#444;color:#fff;border:0;border-radius:999px;padding:3px 9px;font:inherit;cursor:pointer;flex:none}
.lil-gui.autoPlace{top:auto!important;bottom:44px;right:8px!important;max-height:55vh}
.bp,.bp *{box-sizing:border-box}
.bp{font-family:Fredoka,system-ui;color:var(--ink)}
.bp button{cursor:pointer;font-family:Fredoka}
#bp-modal{position:fixed;inset:0;z-index:80;display:grid;place-items:center;padding:16px;
  background:color-mix(in srgb,var(--ink) 30%,transparent);touch-action:pan-y}

/* ---- popup shell: header (title + ✕), scrolling body, footer actions */
.bp-shell{width:min(400px,100%);max-height:calc(100dvh - 32px);padding:0;gap:0;overflow:hidden;display:flex;flex-direction:column}
.bp-shell>header{display:grid;grid-template-columns:40px 1fr 40px;align-items:center;padding:12px 12px 6px}
.bp-shell>header h2{grid-column:2;margin:0;font-size:24px;text-align:center;line-height:1.1}
.bp-x{grid-column:3;width:36px;height:36px;border-radius:50%;border:3px solid var(--ink);background:var(--cream);font:700 16px Fredoka;
  display:grid;place-items:center;box-shadow:0 2px 0 var(--ink);padding:0;color:var(--ink)}
.bp-body{flex:1;min-height:0;overflow:auto;touch-action:pan-y;padding:4px 16px 12px;display:flex;flex-direction:column;gap:10px}
.bp-shell>footer{padding:10px 16px 14px;border-top:2px solid #3a24161f;display:flex;flex-direction:column;gap:8px;background:var(--cream)}
.bp-shell>footer .row{display:flex;gap:8px}
.bp-shell>footer .btn{width:100%;font-size:17px;padding:9px 12px}
.bp-shell>footer .row .btn{flex:1;font-size:15px;padding:7px 8px}
.bp-lead{margin:0;text-align:center;font-size:15px!important;line-height:1.35;opacity:.85}

/* ---- Wall of Fame: fixed size whatever the tab */
.bp-wall{width:min(var(--ww),100%);height:min(calc(100dvh - 32px),calc(var(--wh) * 100dvh),720px);max-height:none}
.bp-tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin:0 12px;padding:4px;border-radius:16px;background:#3a241614}
.bp-tabs button{border:0;background:none;border-radius:12px;padding:5px 2px 4px;display:flex;flex-direction:column;align-items:center;gap:1px;
  font:600 13px Fredoka;color:var(--ink);opacity:.7}
.bp-tabs button span{font-size:20px;line-height:1.1}
.bp-tabs button.on{background:var(--cream);opacity:1;box-shadow:0 2px 0 var(--ink)}
.bp-sec{text-align:center;display:flex;flex-direction:column;gap:2px;padding-top:6px}
.bp-sec h3{margin:0;font:700 21px Fredoka}
.bp-sec small{font-size:13px;opacity:.7}
.bp-chips{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;justify-content:safe center;flex:none;padding:2px}
.bp-chips button{flex:none;border:2px solid var(--ink);border-radius:999px;background:var(--cream);font:600 13px Fredoka;padding:3px 12px;color:var(--ink)}
.bp-chips button.on{background:var(--ink);color:var(--cream)}
.bp-h4{margin:4px 0 4px;font:600 12px Fredoka;text-transform:uppercase;letter-spacing:.5px;opacity:.55}
.bp-av{width:calc(34px * var(--rs,1));height:calc(34px * var(--rs,1));border-radius:50%;flex:none;display:grid;place-items:center;
  font:700 calc(13px * var(--rs,1)) Fredoka;color:#fff;border:2px solid var(--ink);background:var(--c)}
.bp-rows{display:flex;flex-direction:column;gap:4px}
.bp-row{display:grid;grid-template-columns:34px auto 1fr auto;align-items:center;gap:8px;padding:calc(4px * var(--rs,1)) 10px;border-radius:12px;background:#fff8e6}
.bp-row>i{font-style:normal;font-weight:700;opacity:.6;text-align:right;font-size:14px}
.bp-row>b{font-weight:600;font-size:calc(16px * var(--rs,1));white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bp-row>span{font-weight:700;font-variant-numeric:tabular-nums;font-size:calc(16px * var(--rs,1))}
.bp-row.me{background:#ffe3a0;box-shadow:inset 0 0 0 2px var(--orange)}
.bp-row.me>b{font-weight:700}
.bp-gap{text-align:center;opacity:.4;line-height:.5;font-size:20px}
.bp-join{display:grid;grid-template-columns:44px 1fr;align-items:center;gap:8px 12px;padding:12px;border-radius:16px;background:#fff1d0;border:2px dashed var(--orange)}
.bp-join .bp-av{--c:#3a241640;width:44px;height:44px;font-size:20px}
.bp-join p{margin:0;font-size:14px!important;line-height:1.3}
.bp-join p b{display:block;font-size:16px}
.bp-join .btn{grid-column:1/-1;font-size:16px;padding:7px 12px}
.bp-state{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center;padding:16px}
.bp-state>span{font-size:44px}
.bp-state b{font-size:20px}
.bp-state p{margin:0;font-size:15px!important;opacity:.75;max-width:260px}
.bp-skel{height:44px;border-radius:12px;background:linear-gradient(90deg,#3a241612,#3a24162a,#3a241612);background-size:200% 100%;animation:bp-sk 1s linear infinite}
@keyframes bp-sk{to{background-position:-200% 0}}

/* top three: Employee of the Month frames on a wooden wall */
.bp-frames{display:grid;grid-template-columns:1fr 1.18fr 1fr;align-items:end;gap:10px;padding:40px 10px 12px;border-radius:16px;flex:none;
  background:repeating-linear-gradient(90deg,#c98a55 0 22px,#bf7f4b 22px 44px);box-shadow:inset 0 -6px 0 #0002}
.bp-frame{position:relative;background:#fffdf6;border:3px solid var(--ink);border-radius:6px;padding:6px 6px 5px;display:flex;flex-direction:column;
  align-items:center;gap:2px;box-shadow:0 3px 0 var(--ink);text-align:center;min-width:0}
.bp-frame:nth-child(1){transform:rotate(-3deg)}.bp-frame:nth-child(3){transform:rotate(3deg)}
.bp-frame .pic{width:100%;aspect-ratio:1;border-radius:3px;display:grid;place-items:center;font:700 24px Fredoka;color:#fff;background:var(--c)}
.bp-frame.first .pic{font-size:30px}
.bp-frame b{font-size:12px;line-height:1.15;max-width:100%;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:2.3em}
.bp-frame span.v{font:700 14px Fredoka;font-variant-numeric:tabular-nums}
.bp-frame .medal{position:absolute;top:-14px;left:50%;transform:translateX(-50%);font-size:22px;line-height:1}
.bp-frame.first::before{content:attr(data-label);position:absolute;bottom:calc(100% + 16px);left:50%;transform:translateX(-50%);white-space:nowrap;
  font:700 10px Fredoka;letter-spacing:.5px;background:var(--orange);color:var(--cream);border:2px solid var(--ink);border-radius:999px;padding:0 8px}
/* top three: podium */
.bp-pod{display:grid;grid-template-columns:1fr 1fr 1fr;align-items:end;gap:6px;flex:none;padding-top:6px}
.bp-pod>div{display:flex;flex-direction:column;align-items:center;gap:2px;text-align:center;min-width:0}
.bp-pod .bp-av{--rs:1.3}
.bp-pod b{font-size:13px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bp-pod em{font:700 14px Fredoka;font-style:normal}
.bp-pod .step{width:100%;border:3px solid var(--ink);border-bottom:0;border-radius:12px 12px 0 0;display:grid;place-items:center;font:700 24px Fredoka;margin-top:4px}
.bp-pod .p1 .step{height:72px;background:#ffd34d}.bp-pod .p2 .step{height:52px;background:#d9dde3}.bp-pod .p3 .step{height:38px;background:#e3a36b}

/* landscape: the Wall goes wide, top three on the left, lists on the right */
html.pl .bp-wall{--ww:820px!important;height:calc(100dvh - 24px)}
html.pl .bp-wall .bp-body{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);grid-auto-rows:min-content;column-gap:16px;align-content:start}
html.pl .bp-wall .bp-body>.wide{grid-column:1/-1}
.bp-wall .bp-body>.left,.bp-wall .bp-body>.right{display:flex;flex-direction:column;gap:10px}
html.pl .bp-wall .bp-body>.left{grid-column:1}
html.pl .bp-wall .bp-body>.right{grid-column:2;grid-row:2 / span 20}
html.pl .bp-shell>header{padding-top:8px}
html.pl #bp-modal{padding:8px}
html.pl .bp-wall>header{padding:6px 10px 4px}
html.pl .bp-wall>header h2{font-size:20px}
html.pl .bp-x{width:32px;height:32px}
html.pl .bp-tabs{padding:3px}
html.pl .bp-tabs button{flex-direction:row;justify-content:center;gap:6px;padding:3px 4px;font-size:14px}
html.pl .bp-tabs button span{font-size:17px}
html.pl .bp-wall .bp-body{padding-top:6px}
html.pl .bp-wall .bp-sec{padding-top:0}
html.pl .bp-wall .bp-sec h3{font-size:18px}
html.pl .bp-frames{padding:30px 8px 8px;gap:8px}
html.pl .bp-frame .pic{aspect-ratio:2/1;font-size:18px}
html.pl .bp-wall>footer{padding:6px 12px 8px}
html.pl .bp-wall>footer .btn{font-size:15px;padding:5px 12px}
html.pl #bp-bar{left:8px;transform:none;max-width:40%}

/* ---- small cards */
.bp-field{display:flex;gap:8px;align-items:center}
.bp-field input{flex:1;min-width:0;height:48px;font:600 19px Fredoka;border:3px solid var(--ink);border-radius:14px;padding:0 12px;background:#fff;
  user-select:text;-webkit-user-select:text;color:var(--ink)}
.bp-field input.bad{border-color:var(--angry)}
.bp-field .round{width:48px;height:48px;font-size:22px;flex:none}
.bp-help{display:flex;justify-content:space-between;font-size:13px;opacity:.7;margin-top:-4px;padding:0 4px}
.bp-help.bad{color:var(--angry);opacity:1}
.bp-code{font:700 15px ui-monospace,monospace!important;letter-spacing:.5px;white-space:nowrap;text-transform:uppercase}
.bp-choice{display:flex;align-items:center;gap:12px;width:100%;text-align:left;border:3px solid var(--ink);border-radius:16px;background:#fff8e6;
  padding:10px 12px;box-shadow:0 3px 0 var(--ink);color:var(--ink)}
.bp-choice>span{font-size:30px}
.bp-choice p{margin:0;display:flex;flex-direction:column;font-size:13px!important;opacity:.8}
.bp-choice p b{font-size:17px;opacity:1}
.bp-choice.main{background:#dff3c8}
.bp-set{display:grid;grid-template-columns:1fr auto;align-items:center;gap:4px 10px;border-top:2px dashed #3a241633;padding-top:10px}
.bp-set>span{display:flex;flex-direction:column;font-size:14px;min-width:0}
.bp-set>span b{font-size:17px}
.bp-set>small{grid-column:1/-1;font-size:12px;opacity:.65}
.bp-set>div{display:flex;gap:6px}
.bp-set .btn{font-size:14px;padding:4px 12px}
.bp-big{font:700 46px Fredoka;text-align:center;line-height:1;font-variant-numeric:tabular-nums}
.bp-climb{font:800 56px Fredoka;text-align:center;color:var(--orange);-webkit-text-stroke:2px var(--ink);line-height:1}
.bp-fire{display:flex;align-items:center;justify-content:center;gap:8px;font:700 18px Fredoka;color:var(--orange)}
.bp-fire span{font-size:28px;animation:bp-flick 1s ease-in-out infinite alternate}
@keyframes bp-flick{to{transform:scale(1.15) rotate(6deg)}}
.bp-pills{display:flex;justify-content:center;gap:8px;flex-wrap:wrap}
.bp-pills span{background:#fff8e6;border-radius:999px;padding:2px 10px;font-size:14px}
.bp-warn{display:flex;gap:8px;align-items:center;justify-content:center;font-size:14px;background:#ffe1d6;border-radius:12px;padding:6px 10px}

/* ---- title + HUD */
.bp-inj{pointer-events:auto}
.bp-ticket{display:flex;align-items:stretch;background:var(--cream);border:3px solid var(--ink);border-radius:16px;box-shadow:0 4px 0 var(--ink);
  overflow:hidden;max-width:min(380px,92vw);text-align:left;padding:0;color:var(--ink)}
.bp-ticket .stub{background:var(--orange);color:var(--cream);padding:6px 10px;display:flex;flex-direction:column;align-items:center;justify-content:center;
  border-right:3px dashed var(--ink);font:700 12px Fredoka}
.bp-ticket .stub b{font-size:22px;line-height:1}
.bp-ticket .body{padding:5px 12px;display:flex;flex-direction:column;justify-content:center;font-size:13px}
.bp-ticket .body b{font-size:16px}
html.pl .bp-ticket-wrap{position:fixed;left:max(14px,env(safe-area-inset-left));bottom:14px;z-index:4}
.bp-goal{display:flex;align-items:center;gap:8px;font-size:17px;padding:2px 4px 2px 12px;pointer-events:auto;white-space:nowrap}
.bp-goal b{font-variant-numeric:tabular-nums}
.bp-goal.done{background:#dff3c8}
.bp-goal button{font:600 13px Fredoka;border:2px solid var(--ink);border-radius:999px;background:var(--cream);padding:2px 10px;color:var(--ink)}
.bp-hud{position:fixed;left:50%;top:calc(max(10px,env(safe-area-inset-top)) + 64px);transform:translateX(-50%);z-index:3}
html.pl .bp-hud{top:calc(max(8px,env(safe-area-inset-top)) + 6px)}

/* ---- gallery */
#bp-gal{position:fixed;inset:0;z-index:85;overflow:auto;background:var(--sky);padding:12px 12px 60px;touch-action:pan-y}
#bp-gal .cols{display:grid;grid-template-columns:repeat(auto-fill,380px);gap:14px;justify-content:center}
#bp-gal .cell h5{margin:0 0 4px;font:600 12px system-ui;text-transform:uppercase;opacity:.6}
#bp-gal .frame{background:#a3c94a;border:2px solid #3a241655;border-radius:12px;padding:10px;display:flex;flex-direction:column;align-items:center;gap:8px}
#bp-gal .frame .panel{width:100%;max-height:none;box-shadow:0 4px 0 var(--ink)}
#bp-gal .frame .bp-wall{height:640px}
#bp-gal .frame .bp-hud{position:static;transform:none}
`;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = ''): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};
const n = (v: number) => v.toLocaleString('en-US');
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
/** Sim ticks at 60 Hz → m:ss.cc (or h:mm:ss for long Runs). */
const clock = (ticks: number) => {
  const s = ticks / 60;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h
    ? `${h}:${String(m).padStart(2, '0')}:${String(Math.floor(sec)).padStart(2, '0')}`
    : `${m}:${sec.toFixed(2).padStart(5, '0')}`;
};

// ---------- mock data
const ADJ = [
  'Sleepy',
  'Turbo',
  'Wobbly',
  'Crispy',
  'Sneaky',
  'Jolly',
  'Fuzzy',
  'Mighty',
  'Lazy',
  'Zippy',
  'Grumpy',
  'Lucky',
];
const NOUN = [
  'Stocker',
  'Cashier',
  'Melon',
  'Trolley',
  'Pickle',
  'Bagel',
  'Mop',
  'Till',
  'Egg',
  'Crate',
  'Pizza',
  'Shelf',
];
const AV = ['#e8743b', '#4f9d4a', '#3f7fc1', '#a058b8', '#d9a21b', '#c94c6a', '#2f9c9c', '#7a6a58'];
const suggest = (seed: number) => `${ADJ[seed % ADJ.length]} ${NOUN[(seed * 7 + 3) % NOUN.length]}`;
const colourOf = (name: string) => AV[[...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 9973, 7) % AV.length];
const initials = (name: string) =>
  name
    .split(/[\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
const av = (name: string) => `<span class="bp-av" style="--c:${colourOf(name)}">${esc(initials(name))}</span>`;
const BANNED = ['poop', 'butt', 'damn'];
/** Mirrors the Worker's check: lowercase, strip, leetspeak back, any listed word as a substring. */
const refused = (name: string) => {
  const t = name
    .toLowerCase()
    .replace(/[0134578@$]/g, (c) => ({ 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's' })[c] ?? c)
    .replace(/[^a-z]/g, '');
  return BANNED.some((w) => t.includes(w));
};
const tidy = (raw: string) => raw.trim().replace(/\s+/g, ' ');
const nameError = (raw: string) => {
  const name = tidy(raw);
  if (name.length < 3) return 'At least 3 characters';
  if (!/^[A-Za-z0-9 _-]+$/.test(name)) return 'Letters, digits, space, _ and - only';
  if (refused(name)) return "That name isn't allowed, try another";
  return '';
};

interface Row {
  rank: number;
  name: string;
  value: string;
  me: boolean;
}
function rowFor(kind: Kind, rank: number): Row {
  const me = P.hasDevice && rank === P.myRank;
  const name = me ? P.nickname : suggest(rank * 13 + KINDS.indexOf(kind));
  const value = {
    daily: () => clock(60 * (380 + rank * 3.1)),
    speedrun: () => clock(60 * (5400 + rank * 47)),
    score: () => `⭐ ${n(Math.max(100, 4000 - rank * 6))}`,
    streak: () => `🔥 ${Math.max(1, 60 - rank)}`,
  }[kind]();
  return { rank, name, value, me };
}
const subtitle = (kind: Kind, mapName: string) =>
  ({
    daily: `Shift #${P.shiftNumber} · ${P.goal} · fastest to finish`,
    speedrun: `${mapName} · from a fresh start to 100%`,
    score: `${mapName} · most Stars earned`,
    streak: 'Most Daily Shifts in a row',
  })[kind];

// ---------- the Wall of Fame
const rowHtml = (r: Row) =>
  `<div class="bp-row ${r.me ? 'me' : ''}"><i>${r.rank}</i>${av(r.name)}<b>${esc(r.name)}</b><span>${r.value}</span></div>`;
function topThree(kind: Kind, look: Look): string {
  const [a, b, c] = [1, 2, 3].map((r) => rowFor(kind, r));
  if (look === 'frames') {
    const fr = (r: Row, cls: string) =>
      `<div class="bp-frame ${cls}" data-label="${CROWN[kind]}"><span class="medal">${['🥇', '🥈', '🥉'][r.rank - 1]}</span><span class="pic" style="--c:${colourOf(r.name)}">${esc(initials(r.name))}</span><b>${esc(r.name)}</b><span class="v">${r.value}</span></div>`;
    return `<div class="bp-frames">${fr(b, '')}${fr(a, 'first')}${fr(c, '')}</div>`;
  }
  const col = (r: Row, cls: string) =>
    `<div class="${cls}">${av(r.name)}<b>${esc(r.name)}</b><em>${r.value}</em><span class="step">${r.rank}</span></div>`;
  return `<div class="bp-pod">${col(b, 'p2')}${col(a, 'p1')}${col(c, 'p3')}</div>`;
}
const joinCard = () =>
  `<div class="bp-join"><span class="bp-av">?</span><p><b>You're not on the Wall yet</b>Pick a Nickname, then finish a Shift.</p><button class="btn buy" data-act="join">Pick a Nickname</button></div>`;
function aroundYou(kind: Kind): string {
  const out: string[] = [];
  const from = Math.max(4, P.myRank - P.neighbours);
  if (from > 4) out.push('<div class="bp-gap">⋮</div>');
  for (let r = from; r <= Math.min(P.boardSize, P.myRank + P.neighbours); r++) out.push(rowHtml(rowFor(kind, r)));
  return out.join('');
}
function stateBody(): string | null {
  if (P.state === 'offline')
    return `<div class="bp-state wide"><span>📡</span><b>The Wall is out of reach</b><p>Check your connection. The game plays on without it.</p><button class="btn" data-act="retry">↻ Try again</button></div>`;
  if (P.state === 'loading') return `<div class="bp-rows wide">${'<div class="bp-skel"></div>'.repeat(7)}</div>`;
  if (P.state === 'empty')
    return `<div class="bp-state wide"><span>🖼️</span><b>This wall is empty</b><p>Be the first one up here.</p></div>`;
  return null;
}
function wall(kind: Kind, mapId: string, maps: { id: string; name: string }[], look: Look): string {
  const map = maps.find((m) => m.id === mapId) ?? maps[0];
  const perMap = kind === 'speedrun' || kind === 'score';
  const tabs = `<nav class="bp-tabs">${KINDS.map((k) => `<button data-kind="${k}" class="${k === kind ? 'on' : ''}"><span>${TAB[k][0]}</span>${TAB[k][1]}</button>`).join('')}</nav>`;
  const chips = perMap
    ? `<div class="bp-chips wide">${maps.map((m) => `<button data-map="${m.id}" class="${m.id === map?.id ? 'on' : ''}">${esc(m.name)}</button>`).join('')}</div>`
    : '';
  const rest = Array.from({ length: Math.max(0, Math.min(P.rows, P.boardSize) - 3) }, (_, i) =>
    rowHtml(rowFor(kind, i + 4)),
  ).join('');
  const lists =
    stateBody() ??
    `<div class="left">${topThree(kind, look)}${P.hasDevice ? '' : joinCard()}</div>
     <div class="right">${P.hasDevice ? `<div><h4 class="bp-h4">Around you</h4><div class="bp-rows" style="--rs:${P.rowScale}">${aroundYou(kind)}</div></div>` : ''}
     <div><h4 class="bp-h4">Everyone</h4><div class="bp-rows" style="--rs:${P.rowScale}">${rest}</div></div></div>`;
  const foot =
    kind === 'daily' || kind === 'streak'
      ? `<button class="btn buy" data-act="shift">▶ Play today's Shift</button>`
      : `<button class="btn buy" data-act="play" data-id="${map?.id ?? ''}">▶ Play ${esc(map?.name ?? '')}</button>`;
  return `<div class="panel bp bp-shell bp-wall" style="--ww:${P.wallWidth}px;--wh:${P.wallHeight}">
    <header><h2>🏅 Wall of Fame</h2><button class="bp-x" data-act="close" aria-label="Close">✕</button></header>${tabs}
    <div class="bp-body" data-swipe><div class="bp-sec wide"><h3>${HEADING[kind]}</h3><small>${subtitle(kind, map?.name ?? '')}</small></div>${chips}${lists}</div>
    <footer>${foot}</footer></div>`;
}

// ---------- shared cards
const shell = (title: string, body: string, foot = '', cls = '') =>
  `<div class="panel bp bp-shell ${cls}"><header><h2>${title}</h2><button class="bp-x" data-act="close" aria-label="Close">✕</button></header>
   <div class="bp-body">${body}</div>${foot ? `<footer>${foot}</footer>` : ''}</div>`;
const firstOnline = () =>
  shell(
    '☁️ Get on the Wall',
    `<p class="bp-lead">Your Nickname and times live online, so you can carry them to another browser.</p>
     <button class="bp-choice main" data-act="new"><span>🆕</span><p><b>I'm new here</b>Pick a Nickname and go</p></button>
     <button class="bp-choice" data-act="enter-code"><span>🔑</span><p><b>I've played on another browser</b>Enter its Cloud Code</p></button>`,
  );
const enterCode = (value: string, err: string) =>
  shell(
    '🔑 Your Cloud Code',
    `<p class="bp-lead">It's in Settings on the browser you played on.</p>
     <div class="bp-field"><input class="bp-code ${err ? 'bad' : ''}" data-in="code" value="${esc(value)}" placeholder="WBLY-XXXX-XXXX-XXXX" maxlength="19" autocomplete="off" spellcheck="false"></div>
     <div class="bp-help ${err ? 'bad' : ''}"><span>${err || '16 letters and digits'}</span></div>`,
    `<div class="row"><button class="btn" data-act="back-first">Back</button><button class="btn buy" data-act="use-code">Use it</button></div>`,
  );
const nicknameCard = (value: string, err: string) =>
  shell(
    '✏️ Pick a Nickname',
    `<p class="bp-lead">This is how you'll show on the Wall.</p>
     <div class="bp-rows">${rowHtml({ rank: 37, name: tidy(value) || '???', value: '6:41.20', me: true })}</div>
     <div class="bp-field"><input class="${err ? 'bad' : ''}" data-in="nick" value="${esc(value)}" maxlength="16" autocomplete="off" spellcheck="false"><button class="round" data-act="dice" aria-label="Suggest a name">🎲</button></div>
     <div class="bp-help ${err ? 'bad' : ''}"><span data-help>${err || 'Letters, digits, space, _ and -'}</span><span data-count>${tidy(value).length}/16</span></div>`,
    `<button class="btn buy" data-act="save-nick">Save</button>`,
  );
const settingsRows = (reveal: boolean) =>
  P.hasDevice
    ? `<div class="bp-set"><span>Nickname<b>${esc(P.nickname)}</b></span><div><button class="btn" data-act="nick">Change</button></div></div>
       <div class="bp-set"><span>Cloud Code<b class="bp-code">${reveal ? 'WBLY-7F3K-9QXM-2RTA' : 'WBLY-••••-••••-2RTA'}</b></span>
         <div><button class="btn" data-act="reveal">${reveal ? 'Hide' : 'Show'}</button><button class="btn" data-act="copy">Copy</button></div>
         <small>Enter it on another browser to carry on there. Keep it secret, like a key.</small></div>`
    : `<div class="bp-set"><span>Wall of Fame<b>Not on it yet</b></span><div><button class="btn" data-act="join">Join</button></div></div>`;
const goalChip = (secs: number, done: boolean) =>
  `<div class="pill bp-goal ${done ? 'done' : ''}">📅 ${done ? '✓ Done · for fun now' : `${P.goal} · <b>32/60</b>`} <b>${clock(secs * 60)}</b><button data-act="reset">↺ Reset</button></div>`;
const ticket = () =>
  `<button class="bp-ticket"><span class="stub">SHIFT<b>#${P.shiftNumber}</b></span><span class="body">
   <b>📅 Today: ${P.goal}</b><span>${P.hasDevice ? `🔥 ${P.streak} in a row · #${P.myRank} of ${n(P.boardSize)}` : 'Same Shift for everyone · about 10 min'}</span></span></button>`;

// ---------- end of a Shift or a Run
interface Result {
  kind: 'daily' | 'speedrun';
  ticks: number;
  mapName: string;
}
function endScreen(r: Result, sent: boolean): string {
  const daily = r.kind === 'daily';
  const ranked = sent && P.hasDevice;
  const body = `
    <div class="bp-big">${ranked ? rowFor(r.kind, P.myRank).value : clock(r.ticks)}</div>
    <div class="bp-pills">${daily ? `<span>⭐ 2,140</span><span>$9,410</span>` : `<span>${esc(r.mapName)}</span><span>14 Openings</span>`}</div>
    ${ranked ? `<div class="bp-climb" data-climb="${P.myRank}">#${P.myRank}</div><p class="bp-lead">of ${n(P.boardSize)} ${daily ? 'today' : 'on this Map'}</p>` : ''}
    ${ranked && daily ? `<div class="bp-fire"><span>🔥</span>${P.streak} Shifts in a row</div>` : ''}
    ${!sent ? `<div class="bp-warn">📡 Not on the Wall yet: you're offline. <button class="btn" data-act="resend" style="font-size:13px;padding:2px 10px">Retry</button></div>` : ''}
    ${ranked ? `<div><h4 class="bp-h4">Around you</h4><div class="bp-rows">${aroundYou(r.kind)}</div></div>` : ''}`;
  const foot = daily
    ? `<button class="btn buy" data-act="board">🏅 See the Wall</button><div class="row"><button class="btn" data-act="reset">↺ Try again</button><button class="btn" data-act="keep">Keep playing</button></div>`
    : `<button class="btn buy" data-act="board">🏅 See the Wall</button><div class="row"><button class="btn" data-act="close">Keep playing</button></div>`;
  return shell(daily ? `📅 Shift #${P.shiftNumber} done!` : '⏱️ Run complete!', body, foot);
}

export function openBoardsPrototype(): void {
  const app = (window as unknown as { app: AppGuts }).app;
  const url = new URL(location.href);
  let look = (url.searchParams.get('boards') ?? 'frames').toLowerCase() as Look;
  if (!LOOKS[look]) look = 'frames';
  if (url.searchParams.has('offline')) P.state = 'offline';
  document.head.append(el('style', '', CSS));
  const setBlur = () => document.documentElement.style.setProperty('--bp-blur', `${P.blur}px`);
  setBlur();
  const stop = (e: Element) => e.addEventListener('pointerdown', (ev) => ev.stopPropagation());
  const maps = () => app.ui.maps.filter((m) => !m.tutorial).map((m) => m.map);

  // ---------- modal: one screen at a time, re-rendered from `screen`
  let kind: Kind = 'daily';
  let mapId = '';
  let reveal = false;
  let nick = P.nickname;
  let nickErr = '';
  let code = '';
  let codeErr = '';
  let after: (() => void) | null = null;
  let result: Result | null = null;
  let sent = true;
  type Screen = 'wall' | 'first' | 'code' | 'nick' | 'end' | null;
  let screen: Screen = null;
  const modal = el('div', 'bp');
  modal.id = 'bp-modal';
  stop(modal);
  const show = (s: Screen) => {
    screen = s;
    draw();
  };
  const draw = () => {
    if (!screen) return modal.remove();
    const ms = maps();
    mapId ||= ms[0]?.id ?? '';
    modal.innerHTML = {
      wall: () => wall(kind, mapId, ms, look),
      first: firstOnline,
      code: () => enterCode(code, codeErr),
      nick: () => nicknameCard(nick, nickErr),
      end: () => (result ? endScreen(result, sent) : ''),
    }[screen]();
    document.body.append(modal);
    const climb = modal.querySelector<HTMLElement>('[data-climb]');
    if (climb) {
      const to = Number(climb.dataset.climb);
      const t0 = performance.now();
      const tick = () => {
        const k = Math.min(1, (performance.now() - t0) / P.countMs);
        climb.textContent = `#${n(Math.round(P.boardSize + (to - P.boardSize) * (1 - (1 - k) ** 3)))}`;
        if (k < 1 && climb.isConnected) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  };
  // a write needs a Device: run `then` once there is one
  const needDevice = (then: () => void) => {
    if (P.hasDevice) return then();
    after = then;
    show('first');
  };
  const openWall = (k: Kind, m?: string) => {
    kind = k;
    if (m) mapId = m;
    show('wall');
  };
  const saveNick = () => {
    nickErr = nameError(nick);
    if (nickErr) return draw();
    P.nickname = tidy(nick);
    P.hasDevice = true;
    finishDevice();
  };
  const useCode = () => {
    if (!/^WBLY(-[0-9A-HJKMNP-TV-Z]{4}){3}$/.test(code)) {
      codeErr = "That doesn't look like a Cloud Code";
      return draw();
    }
    P.hasDevice = true;
    P.nickname = 'Turbo Pickle';
    finishDevice();
  };
  modal.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-act],[data-kind],[data-map]');
    if (!t) return;
    const d = t.dataset;
    if (d.kind) return openWall(d.kind as Kind);
    if (d.map) return ((mapId = d.map), draw());
    const acts: Record<string, () => void> = {
      close: () => ((after = null), show(null)),
      retry: () => {
        P.state = 'loading';
        draw();
        setTimeout(() => ((P.state = 'ok'), draw()), 900);
      },
      join: () => needDevice(() => show('wall')),
      shift: () => (show(null), startShift()),
      play: () => (show(null), app.play(d.id ?? mapId)),
      new: () => ((nick = suggest(Date.now() % 997)), (nickErr = ''), show('nick')),
      'enter-code': () => ((code = ''), (codeErr = ''), show('code')),
      'back-first': () => show('first'),
      'use-code': useCode,
      dice: () => ((nick = suggest(Math.floor(Math.random() * 997))), (nickErr = ''), draw()),
      'save-nick': saveNick,
      nick: () => ((nick = P.nickname), (nickErr = ''), show('nick')),
      reset: () => (show(null), startShift()),
      keep: () => ((shiftDone = true), show(null)),
      board: () => openWall(result?.kind ?? 'daily'),
      resend: () => ((sent = P.state !== 'offline'), draw()),
    };
    acts[d.act ?? '']?.();
  });
  // live checks without a redraw, so typing keeps focus
  modal.addEventListener('input', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.dataset.in === 'nick') {
      nick = t.value;
      nickErr = tidy(nick).length >= 3 ? nameError(nick) : '';
      t.classList.toggle('bad', !!nickErr);
      modal.querySelector('.bp-help')?.classList.toggle('bad', !!nickErr);
      const h = modal.querySelector('[data-help]');
      if (h) h.textContent = nickErr || 'Letters, digits, space, _ and -';
      const c = modal.querySelector('[data-count]');
      if (c) c.textContent = `${tidy(nick).length}/16`;
      const preview = modal.querySelector('.bp-row.me');
      if (preview) preview.outerHTML = rowHtml({ rank: 37, name: tidy(nick) || '???', value: '6:41.20', me: true });
    }
    if (t.dataset.in === 'code') {
      // WBLY-XXXX-XXXX-XXXX: dashes go in as you type
      const raw = t.value
        .toUpperCase()
        .replace(/[^0-9A-Z]/g, '')
        .slice(0, 16);
      t.value = code = raw.match(/.{1,4}/g)?.join('-') ?? '';
    }
  });
  modal.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    if (screen === 'nick') saveNick();
    if (screen === 'code') useCode();
  });
  // swipe the Wall's body sideways to change tab
  let swipeX = -1;
  modal.addEventListener('pointerdown', (e) => {
    swipeX = (e.target as HTMLElement).closest('[data-swipe]') ? e.clientX : -1;
  });
  modal.addEventListener('pointerup', (e) => {
    if (swipeX < 0 || Math.abs(e.clientX - swipeX) < 60) return;
    const i = KINDS.indexOf(kind) + (e.clientX < swipeX ? 1 : -1);
    if (i >= 0 && i < KINDS.length) openWall(KINDS[i]);
  });
  const finishDevice = () => {
    const then = after;
    after = null;
    if (then) then();
    else show(null);
    injectSettings(true);
    clearTitle();
  };

  // ---------- Shift demo: goal chip on the HUD, a fake clock, Goal ends it
  let shiftAt = -1;
  let shiftDone = false;
  const hudBox = el('div', 'bp bp-hud');
  stop(hudBox);
  hudBox.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('[data-act="reset"]')) startShift();
  });
  const startShift = () => {
    const first = app.ui.maps.find((m) => !m.tutorial && m.visited) ?? app.ui.maps[0];
    if (app.ui.screen !== 'game' && first) app.play(first.map.id);
    shiftAt = performance.now();
    shiftDone = false;
    document.body.append(hudBox);
  };
  const finish = (k: 'daily' | 'speedrun') => {
    const secs = k === 'daily' ? Math.max(1, (performance.now() - shiftAt) / 1000) + 380 : 5400 + 37 * 47;
    result = { kind: k, ticks: Math.round(secs * 60), mapName: maps()[0]?.name ?? '' };
    sent = P.state !== 'offline';
    needDevice(() => show('end'));
  };

  // ---------- injections into the real title / Settings, re-applied every frame
  const injectSettings = (force = false) => {
    const panel = [...document.querySelectorAll('#ui .panel')].find(
      (p) => p.querySelector('h2')?.textContent === 'Settings',
    );
    if (!panel) return;
    if (force) panel.querySelectorAll('.bp-inj').forEach((x) => x.remove());
    if (panel.querySelector('.bp-inj')) return;
    const box = el('div', 'bp bp-inj', settingsRows(reveal));
    box.style.cssText = 'display:flex;flex-direction:column;gap:10px';
    stop(box);
    box.onclick = (e) => {
      const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
      if (act === 'reveal') {
        reveal = !reveal;
        injectSettings(true);
      }
      if (act === 'copy') void navigator.clipboard?.writeText('WBLY-7F3K-9QXM-2RTA');
      if (act === 'nick') {
        nick = P.nickname;
        nickErr = '';
        show('nick');
      }
      if (act === 'join') needDevice(() => show(null));
    };
    panel.insertBefore(box, panel.querySelector('.back'));
  };
  const clearTitle = () => document.querySelectorAll('#ui .title .bp-inj').forEach((x) => x.remove());
  const injectTitle = () => {
    const title = document.querySelector('#ui .title');
    if (!title || title.querySelector('.bp-inj')) return;
    const corner = title.querySelector('.title-corner');
    const b = el('button', 'round bp-inj', '🏅');
    b.setAttribute('aria-label', 'Wall of Fame');
    b.onclick = () => openWall('daily');
    corner?.insertBefore(b, corner.firstChild);
    const wrap = el('div', 'bp bp-inj bp-ticket-wrap', ticket());
    stop(wrap);
    wrap.onclick = () => openWall('daily');
    title.querySelector('.plaque')?.after(wrap);
  };
  let lastHud = '';
  const frame = () => {
    injectTitle();
    injectSettings();
    if (shiftAt >= 0 && app.ui.screen === 'game') {
      const html = goalChip((performance.now() - shiftAt) / 1000, shiftDone);
      if (html !== lastHud) hudBox.innerHTML = lastHud = html;
    } else if (hudBox.isConnected && app.ui.screen !== 'game') {
      hudBox.remove();
      shiftAt = -1;
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  // ---------- gallery: every screen at once
  let gal: HTMLElement | null = null;
  const gallery = () => {
    if (gal) return (gal.remove(), (gal = null));
    const ms = maps();
    const m0 = ms[0]?.id ?? '';
    const res: Result = { kind: 'daily', ticks: 60 * 401.2, mapName: '' };
    const run: Result = { kind: 'speedrun', ticks: 60 * 7139, mapName: ms[0]?.name ?? '' };
    const keep = { ...P };
    const as = (patch: Partial<typeof P>, f: () => string) => {
      Object.assign(P, patch);
      const s = f();
      Object.assign(P, keep);
      return s;
    };
    const cells: [string, string][] = [
      [
        'Title: 🏅 button + Daily ticket',
        `<div style="display:flex;gap:8px"><span class="round">🏅</span><span class="round">👕</span><span class="round">🏆</span><span class="round">★</span></div>${ticket()}`,
      ],
      ['Wall · Today · frames · no Device', as({ hasDevice: false }, () => wall('daily', m0, ms, 'frames'))],
      ['Wall · Today · podium · with Device', as({ hasDevice: true }, () => wall('daily', m0, ms, 'podium'))],
      ['Wall · Speed (per Map)', as({ hasDevice: true }, () => wall('speedrun', m0, ms, look))],
      ['Wall · Stars (per Map)', as({ hasDevice: true }, () => wall('score', m0, ms, look))],
      ['Wall · Streaks', as({ hasDevice: true }, () => wall('streak', m0, ms, look))],
      ['Wall · offline', as({ state: 'offline' }, () => wall('daily', m0, ms, look))],
      ['Wall · loading', as({ state: 'loading' }, () => wall('daily', m0, ms, look))],
      ['First online write', firstOnline()],
      ['Pick a Nickname (refused)', nicknameCard('P00py Pants', "That name isn't allowed, try another")],
      ['Enter Cloud Code', enterCode('WBLY-7F3K', '')],
      [
        'Settings rows',
        `<div class="panel bp" style="gap:10px">${as({ hasDevice: true }, () => settingsRows(false))}${settingsRows(false)}</div>`,
      ],
      ['Shift HUD: goal + Reset, then for fun', `${goalChip(222, false)}${goalChip(401, true)}`],
      ['End of Shift', as({ hasDevice: true }, () => endScreen(res, true))],
      ['End of Run (100%)', as({ hasDevice: true }, () => endScreen(run, true))],
      ['End of Shift · offline', endScreen(res, false)],
    ];
    gal = el(
      'div',
      'bp',
      `<div class="cols">${cells.map(([h, b]) => `<div class="cell"><h5>${h}</h5><div class="frame">${b}</div></div>`).join('')}</div>`,
    );
    gal.id = 'bp-gal';
    stop(gal);
    document.body.append(gal);
  };

  // ---------- bar, panel, dump
  const bar = el('div');
  bar.id = 'bp-bar';
  stop(bar);
  const btn = (txt: string, fn: () => void) => {
    const b = el('button', '', txt);
    b.onclick = fn;
    return b;
  };
  const lookBtn = btn(`Look: ${look}`, () => {
    look = look === 'frames' ? 'podium' : 'frames';
    url.searchParams.set('boards', look);
    history.replaceState(null, '', url);
    lookBtn.textContent = `Look: ${look}`;
    if (screen) draw();
  });
  const dump = () => {
    const text = `// boards=${look} — ${LOOKS[look]}\n${JSON.stringify(P, null, 2)}`;
    void navigator.clipboard?.writeText(text);
    prompt('Values (copied):', text);
  };
  bar.append(
    lookBtn,
    btn('Wall', () => openWall('daily')),
    btn('Shift', startShift),
    btn('Goal', () => finish('daily')),
    btn('Run 100%', () => finish('speedrun')),
    btn('Forget me', () => ((P.hasDevice = false), clearTitle(), injectSettings(true), draw())),
    btn('Gallery', gallery),
    btn('Dump', dump),
  );
  document.body.append(bar);

  void import('lil-gui').then(({ default: GUI }) => {
    const gui = new GUI({ title: 'PROTOTYPE · Wall' });
    const redraw = () => (clearTitle(), injectSettings(true), draw());
    gui.add(P, 'state', ['ok', 'loading', 'offline', 'empty']).name('fetch').onChange(redraw);
    gui.add(P, 'hasDevice').name('has a Device').listen().onChange(redraw);
    gui.add(P, 'nickname').listen().onFinishChange(redraw);
    gui.add(P, 'myRank', 4, 600, 1).name('my rank').onChange(redraw);
    gui.add(P, 'boardSize', 4, 5000, 1).name('players').onChange(redraw);
    gui.add(P, 'rows', 3, 100, 1).name('rows loaded').onChange(redraw);
    gui.add(P, 'streak', 0, 60, 1).onChange(redraw);
    gui.add(P, 'neighbours', 1, 5, 1).onChange(redraw);
    gui.add(P, 'blur', 0, 12, 0.5).name('backdrop blur px').onChange(setBlur);
    gui.add(P, 'wallWidth', 340, 640, 10).name('Wall width').onChange(redraw);
    gui.add(P, 'wallHeight', 0.5, 1, 0.01).name('Wall height').onChange(redraw);
    gui.add(P, 'rowScale', 0.7, 1.5, 0.05).name('row size').onChange(redraw);
    gui.add(P, 'countMs', 200, 4000, 100).name('rank count-up ms');
    gui.add(P, 'goal').onFinishChange(redraw);
    gui.close();
  });

  if (url.searchParams.has('gallery')) setTimeout(gallery, 500);
}
