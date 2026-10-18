// The Lesson runner (Tutorial Map): a card freezes the sim, Got it starts live play toward each step's target, a
// short "Nice!" follows, then the next card. Lessons are map data (`MapDef.lessons`); scripting runs here, in the sim.
import type { Placement, Point } from './map';
import type { Ref, World } from './world';
import { DT } from './world';
import { boxCentre } from './geometry';
import { clearMesses } from './cleaning';
import { TUNING } from './tuning';

/** What the card copy may depend on: touch screen and the current Joystick setting. */
export interface LessonDevice {
  touch: boolean;
  joystick: 'fixed' | 'free' | 'off';
}

/** What the app reports of its own screens, which pause the sim: one fact per step, in order (see `Intents.ui`). */
export type LessonUiFact = 'layoutOpen' | 'layoutClosed' | 'deliveryCard' | 'logbookOpen' | 'logbookClosed';

type ByDevice = string | ((d: LessonDevice) => string);

/** A Station or Pad id, a point, or a function giving a point (null = no target now). */
export type LessonTarget = string | Point | ((w: World) => Point | null);

export interface LessonStep {
  /** The live prompt while playing. */
  line: ByDevice;
  target: LessonTarget;
  done: (w: World) => boolean;
  /** Points at a HUD button instead of (or beside) the floor target. */
  hud?: 'trophy' | 'delivery';
  /** While Edit Layout is open: an outline where this Station could go. */
  ghost?: { station: string; spot: Placement };
  /** Runs once, on the step's first live tick (never behind a card). */
  enter?: (w: World) => void;
  /** Runs every playing step; `t` = seconds in this step. */
  tick?: (w: World, t: number) => void;
}

export interface LessonDef {
  title: string;
  /** Card paragraphs. */
  card: (d: LessonDevice) => string[];
  /** Puts the world in this Lesson's starting state (Money, stock, Customers). Runs again on a replay. */
  setup?: (w: World) => void;
  /** No steps = a card only. */
  steps: LessonStep[];
  /** The Lesson went wrong: replay its setup. */
  fail?: (w: World) => boolean;
  /** The replay banner's title (default: "Let's try that again"). */
  retry?: string;
  /** The line under "Nice!". */
  nice: string;
}

export interface LessonState {
  index: number;
  phase: 'card' | 'play' | 'nice';
  step: number;
  /** Seconds in the current step (or in "Nice!"). */
  t: number;
  /** The step's `enter` has run. */
  entered: boolean;
  /** What happened in this step: event types plus `to:<id>`, `from:<id>`, `produced:<id>`, `sprinted`, `ui:<fact>`. */
  saw: Set<string>;
}

const text = (s: ByDevice, d: LessonDevice): string => (typeof s === 'string' ? s : s(d));

const defOf = (w: World): LessonDef | null => (w.lesson ? (w.map.lessons?.[w.lesson.index] ?? null) : null);

/** Whether the Player is within the Lesson's arrive radius of a point. */
export const near = (w: World, p: Point): boolean =>
  Math.hypot(w.player.x - p[0], w.player.z - p[1]) <= TUNING.lesson.arrive;

/** Has this happened since the step began? */
export const saw = (w: World, key: string): boolean => !!w.lesson?.saw.has(key);

export function newLessons(w: World): LessonState | null {
  return w.map.lessons?.length ? { index: 0, phase: 'card', step: 0, t: 0, entered: false, saw: new Set() } : null;
}

/** Wipes what a Lesson may leave behind, so every Lesson (and replay) starts clean. */
function clearScene(w: World): void {
  for (const c of w.customers) w.events.push({ type: 'customerLeft', customer: c.id, happy: false });
  w.customers = [];
  for (const s of w.stations.values()) {
    if (s.kind === 'pickup') s.delivery = null;
    if (s.kind !== 'register') continue;
    s.queue = [];
    s.progress = 0;
    s.cash = 0;
  }
  w.thief = w.inspector = w.thiefPan = w.challenge = null;
  clearMesses(w);
  w.loose = [];
  w.drains = [];
  w.player.stack = [];
  w.player.mop = false;
}

function startStep(w: World, i: number): void {
  const L = w.lesson;
  const def = defOf(w);
  if (!L || !def) return;
  L.step = i;
  L.t = 0;
  L.entered = false;
  L.saw.clear();
}

function enter(w: World, card: boolean): void {
  const L = w.lesson;
  const def = defOf(w);
  if (!L || !def) return;
  clearScene(w);
  def.setup?.(w);
  L.phase = card ? 'card' : 'play';
  startStep(w, 0);
}

export function startLessons(w: World): void {
  w.lesson = newLessons(w);
  if (w.lesson) enter(w, true);
}

function advance(w: World): void {
  const L = w.lesson;
  if (!L) return;
  L.index++;
  if (L.index >= (w.map.lessons?.length ?? 0)) {
    w.lesson = null;
    w.events.push({ type: 'tutorialDone' });
    return;
  }
  enter(w, true);
}

/** Got it: card → live play (or straight on, for a card-only Lesson). */
export function dismissLessonCard(w: World): void {
  const L = w.lesson;
  const def = defOf(w);
  if (!L || !def || L.phase !== 'card') return;
  if (def.steps.length) L.phase = 'play';
  else advance(w);
}

const keyOf = (r: Ref): string =>
  'station' in r ? r.station : 'loose' in r ? 'loose' : 'agent' in r ? r.agent : 'customer';

function record(w: World, L: LessonState): void {
  if (w.player.sprinting) L.saw.add('sprinted');
  for (const e of w.events) {
    L.saw.add(e.type);
    if (e.type === 'transfer') {
      L.saw.add(`from:${keyOf(e.from)}`);
      L.saw.add(`to:${keyOf(e.to)}`);
    }
    if (e.type === 'produced') L.saw.add(`produced:${e.station}`);
  }
}

/** Once per sim step, after everything else moved. `ui`: a fact the app reported this step. */
export function updateLesson(w: World, ui?: LessonUiFact): void {
  const L = w.lesson;
  const def = defOf(w);
  if (!L || !def || L.phase === 'card') return;
  L.t += DT;
  if (L.phase === 'nice') {
    if (L.t >= TUNING.lesson.niceTime) advance(w);
    return;
  }
  record(w, L);
  if (ui) L.saw.add(`ui:${ui}`);
  if (def.fail?.(w)) {
    w.events.push({ type: 'lessonReplay', lesson: L.index });
    enter(w, false);
    return;
  }
  const step = def.steps[L.step];
  if (!L.entered) {
    L.entered = true;
    step.enter?.(w);
  }
  step.tick?.(w, L.t);
  if (!step.done(w)) return;
  if (L.step + 1 < def.steps.length) return startStep(w, L.step + 1);
  L.phase = 'nice';
  L.t = 0;
  w.events.push({ type: 'lessonDone', lesson: L.index });
}

// ---------- what the app shows

/** Where the current step wants the Player: an id, a point, or null. */
export function lessonTarget(w: World): string | Point | null {
  const step = w.lesson?.phase === 'play' ? defOf(w)?.steps[w.lesson.step] : null;
  if (!step) return null;
  return typeof step.target === 'function' ? step.target(w) : step.target;
}

/** The HUD button the current step points at, or null. */
export function lessonHudTarget(w: World): 'trophy' | 'delivery' | null {
  return (w.lesson?.phase === 'play' ? defOf(w)?.steps[w.lesson.step]?.hud : null) ?? null;
}

/** The outline Edit Layout shows now, or null. */
export function lessonGhost(w: World): { station: string; spot: Placement } | null {
  return (w.lesson?.phase === 'play' ? defOf(w)?.steps[w.lesson.step]?.ghost : null) ?? null;
}

/** The replay banner's title for a Lesson. */
export const lessonRetry = (w: World, lesson: number): string =>
  w.map.lessons?.[lesson]?.retry ?? 'Let’s try that again';

/** The target's spot on the floor, for the arrow and ring. */
export function lessonAim(w: World): Point | null {
  const t = lessonTarget(w);
  if (typeof t !== 'string') return t;
  const place = w.map.layout.places[t];
  return place ? boxCentre(place.box) : null;
}

export function lessonCard(w: World, d: LessonDevice): { title: string; body: string[] } | null {
  const def = defOf(w);
  return w.lesson?.phase === 'card' && def ? { title: def.title, body: def.card(d) } : null;
}

/** The HUD pill while playing: the Lesson's name and the step's prompt, or "Nice!". */
export function lessonHud(w: World, d: LessonDevice): { head: string; line: string; nice: boolean } | null {
  const L = w.lesson;
  const def = defOf(w);
  if (!L || !def || L.phase === 'card') return null;
  const head = `Lesson ${L.index} · ${def.title}`;
  return L.phase === 'nice'
    ? { head: 'Nice!', line: def.nice, nice: true }
    : { head, line: text(def.steps[L.step].line, d), nice: false };
}
