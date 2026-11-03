// The app: title → game, saves, the HUD and panels, guidance arrows. Glue between sim, view, ui and audio.
import { INPUT_CAP } from '../../catalog/producers';
import * as THREE from 'three';
import type { SimEvent, World } from '../sim/world';
import type { MapDef } from '../sim/map';
import {
  encodeSaveCode,
  decodeSaveCode,
  voidRuns,
  snapshot,
  ticksPerFrame,
  SAVER_FRAME_CAP,
  type MapSave,
  type SaveFile,
  type Settings,
} from '../sim/save';
import { canBuyUpgrade, completion, completionOf, padRemaining, upgradeVisible, visiblePads } from '../sim/economy';
import { shelfCap, stationModel } from '../sim/map';
import { lessonAim, lessonHud, lessonHudTarget, lessonRetry, lessonTarget, type LessonDevice } from '../sim/lessons';
import { boxCentre } from '../sim/geometry';
import { FIRST_MAP, MAPS, isTutorialMap, mapById } from '../../maps';
import { lookById } from '../../catalog/looks';
import { CAP_COLOURS } from '../palette';
import { Stage } from '../view/stage';
import { loadAssets } from '../view/assets';
import { emojiUrl, iconUrl, renderThumbs } from '../view/thumbs';
import { WardrobeView } from '../view/wardrobe';
import { renderStaffIcons } from '../view/staff-icons';
import { moodOf } from '../view/receipt';
import { Input } from '../input/input';
import { insets, isTouch, layout, watchLayout } from './phone';
import { Game } from './game';
import { EditLayout } from './edit-layout';
import {
  claimTab,
  loadSave,
  loadSettings,
  markSeen,
  persistStorage,
  seen,
  storageWorks,
  wipeSave,
  writeSave,
  writeSettings,
} from './storage';
import { formatMoney } from '../format';
import { Hud, type EdgeArrow, type EventBanner, type EventCard } from '../ui/hud';
import { renderUi, type Overlay, type UiActions, type UiState } from '../ui/app';
import { Sounds } from '../audio/audio';
import { FEEL } from '../feel';
import { runTicks } from '../sim/stats';
import { TUNING } from '../sim/tuning';
import { objectiveId } from '../../catalog/objectives';
import { logbookView, objectiveInfo, progressOfSave, type MapProgress } from './logbook';
import { challengeCard } from './challenge-card';
import { API_URL } from './api';
import { Device } from './device';
import { readBoard } from './wall';
import { flushPending, submitRun, submitScore } from './submits';
import { KIND_OF, type WallTab, type WallView } from '../ui/wall';
import { dailyDay } from '../sim/daily';

const AUTOSAVE_SECONDS = 5;
const EDGE_MARGIN = 44;
const WIPE_SECONDS = 450;
const TITLE_PAN_SPEED = 0.12;
const SCENERY_PEOPLE = 4;
/** How quickly the measured screen tick follows changes (it varies with ProMotion and throttling). */
const TICK_FOLLOW = 0.05;

/** Phones play fullscreen. iPhone Safari has no Fullscreen API; Android can run the installed app standalone. */
const canFullscreen = (): boolean =>
  isTouch && !!document.documentElement.requestFullscreen && !matchMedia('(display-mode: fullscreen)').matches;

const isIos =
  /iP(hone|ad|od)/.test(navigator.userAgent) &&
  !('standalone' in navigator && (navigator as { standalone?: boolean }).standalone);

export class App {
  private stage: Stage;
  private input: Input;
  private hud: Hud;
  private game: Game | null = null;
  private save: SaveFile;
  private settings: Settings;
  private sounds = new Sounds();
  private wardrobe = new WardrobeView();
  private device = new Device();
  /** Where the online popups return to: the overlay the flow started from. */
  private onlineBack: Overlay | null = null;
  private privacyBack: Overlay | null = null;
  /** Where the Wall's ✕ returns to; joining from the Wall returns to the Wall. */
  private wallBack: Overlay | null = null;
  /** A Run reached 100% and its end screen hasn't opened yet. */
  private runEndOwed = false;
  /** No save existed at load: the Wardrobe opens by itself once the title is ready. */
  private firstRun: boolean;
  private ui: UiState;
  private uiRoot: HTMLElement;
  private sinceSave = 0;
  private officeDismissed = false;
  private exitDismissed = false;
  private lostTab = false;
  private titleTime = 0;
  private uiTimer = 0;
  private claimTab: () => void;
  private editing = false;
  private logbookAge = 0;
  private seenPads = new Set<string>();
  /** Paused game: draw one more frame (something behind the overlay changed). */
  private redraw = true;
  /** Measured time between screen ticks (ms) and ticks seen: a frame cap draws every Nth tick, evenly paced. */
  private tickMs = 1000 / 60;
  private lastTick = 0;
  private ticks = 0;
  private officeKey = '';
  /** Lesson index and phase last drawn: the card re-renders when it changes. */
  private lessonKey = '';
  private layout: EditLayout | null = null;
  /** Dev `?daily=YYYY-MM-DD`: every Play opens that day's Daily Map. */
  private devDaily: MapDef | null = null;
  /** The Inspector's warning banner, counting down until they step in. */
  private warning: EventBanner | null = null;

  constructor() {
    this.stage = new Stage(document.getElementById('scene') as HTMLCanvasElement);
    this.input = new Input(
      document.getElementById('joy') as HTMLElement,
      document.getElementById('grab-ring') as HTMLElement,
    );
    this.hud = new Hud(document.getElementById('hud') as HTMLElement);
    this.hud.visible(false);
    this.uiRoot = document.getElementById('ui') as HTMLElement;
    const loaded = loadSave(FIRST_MAP.id);
    this.save = loaded.save;
    this.firstRun = !!loaded.fresh;
    this.settings = loadSettings();
    document.documentElement.style.setProperty('--sprint-ring', String(FEEL.sprintForce));
    this.stage.viewSize = this.viewZoom();
    this.stage.batterySaver(this.settings.batterySaver);
    this.input.onTap = (x, y, double) => {
      const game = this.game;
      if (!game || this.ui.screen !== 'game' || game.paused || this.editing) return;
      if (game.world.lesson?.phase === 'card') return;
      // with a stick, floor taps never walk
      if (isTouch && this.settings.joystick !== 'off') return;
      const p = this.stage.floorAt(x, y);
      if (p) this.input.tap.start(game.world, p, double);
    };
    this.hud.onDelivery = (id) => {
      const game = this.game;
      if (!game || this.ui.screen !== 'game' || game.paused || this.editing) return;
      const tap = this.input.tap;
      if (tap.car === id) tap.sprint = true;
      else tap.startCar(game.world, id, false);
      game.report('deliveryCard');
    };
    this.input.onZoom = (k) => {
      if (this.ui.screen === 'game' && !this.editing) this.setZoom(this.zoom() * k);
    };
    addEventListener('resize', () => (this.redraw = true));
    this.ui = {
      screen: 'title',
      loading: 0,
      overlay: null,
      office: false,
      card: loaded.problem
        ? { message: `Your old save couldn't be read (${loaded.problem}). It was kept as a backup; starting fresh.` }
        : null,
      storageFailed: !storageWorks(),
      wipe: false,
      touch: isTouch,
      ios: isIos,
      maps: [],
      total: 0,
      logbook: null,
      logbookTab: 0,
      lastMap: this.save.currentMap,
      tutorialDone: this.save.tutorialDone,
      settings: this.settings,
      zoom: 0,
      screenHz: 60,
      layout: null,
      look: lookById(this.save.look).id,
      cap: this.save.cap in CAP_COLOURS ? this.save.cap : 'orange',
      online: API_URL ? { code: this.device.code, nickname: this.device.nickname, askPrivacy: false } : null,
      wall: null,
      runEnd: null,
    };
    this.ui.zoom = this.zoom();
    watchLayout(() => this.applyLayout());
    this.hud.onGear = () => this.openOverlay('pause');
    this.hud.onTrophy = () => this.openLogbook(0);
    this.hud.onLand = () => this.sounds.sfx('ding');
    this.input.onEscape = () => this.escape();
    this.claimTab = claimTab(() => {
      this.lostTab = true;
      this.ui.card = 'other-tab';
      if (this.game) this.game.paused = true;
      this.syncAudio();
      this.renderUi();
    });
    // browsers allow audio only after a gesture: the first one starts the title's music (its backdrop Map's track)
    const firstGesture = (): void => {
      this.sounds.unlock(this.settings);
      if (this.ui.screen === 'title' && this.game) this.sounds.playMusicOf(this.game.world.map);
    };
    addEventListener('pointerdown', firstGesture, { once: true });
    // a touch is a gesture only on release: the first tap anywhere goes fullscreen
    const firstTap = (): void => {
      if (canFullscreen()) void document.documentElement.requestFullscreen().catch(() => {});
    };
    addEventListener('pointerup', firstTap, { once: true });
    addEventListener('keydown', firstGesture, { once: true });
    addEventListener('visibilitychange', () => (document.hidden ? this.onHidden() : this.syncAudio()));
    addEventListener('pagehide', () => this.writeSave());
    this.renderUi();
  }

  async start(): Promise<void> {
    // the one call on page load: submits queued while offline
    if (this.device.code) void flushPending(this.device.code);
    const daily = import.meta.env.DEV ? new URLSearchParams(location.search).get('daily') : null;
    if (daily) this.devDaily = (await import('./daily-dev')).dailyDevMap(daily);
    await Promise.all([
      loadAssets((done, total) => {
        this.ui.loading = (done / total) * 0.95;
        this.renderUi();
      }),
      document.fonts.load('700 48px Fredoka'),
    ]);
    this.renderThumbs();
    const showcase = MAPS.filter((m) => !isTutorialMap(m));
    const map = showcase[Math.floor(Math.random() * showcase.length)];
    this.game = new Game(this.stage, this.input, map, showcaseSave(map));
    this.game.view.setLook(this.ui.look, this.ui.cap);
    this.applyLayout();
    this.showcase();
    this.game.onFrame = (events, dt) => this.onFrame(events, dt);
    this.layout = new EditLayout(
      this.game,
      document.getElementById('joy') as HTMLElement,
      () => {
        this.ui.layout = this.layout?.ui() ?? null;
        this.hud.visible(!this.ui.layout && this.ui.screen === 'game');
        this.renderUi();
      },
      () => this.writeSave(),
    );
    this.refreshMaps();
    this.ui.loading = 1;
    this.renderUi();
    if (this.firstRun) this.openOverlay('wardrobe');
    const loop = (now: number) => {
      requestAnimationFrame(loop);
      const game = this.game;
      if (!game) return;
      const gap = now - this.lastTick;
      this.lastTick = now;
      if (gap > 0 && gap < 100) this.tickMs += (gap - this.tickMs) * TICK_FOLLOW;
      const cap = this.settings.batterySaver ? SAVER_FRAME_CAP : this.settings.frameCap;
      const every = ticksPerFrame(1000 / this.tickMs, cap);
      if (++this.ticks % every) return;
      const still = this.ui.screen === 'game' && game.paused && !this.editing && !this.layout?.open;
      if (still && !this.redraw && !this.stage.zooming) return;
      this.redraw = false;
      game.frame(now, 1000 / (this.tickMs * every));
    };
    requestAnimationFrame(loop);
    Object.assign(window, { app: this, game: this.game });
    const params = new URLSearchParams(location.search);
    if (params.has('debug'))
      void import('./debug').then(
        (m) =>
          this.game &&
          m.openDebug(this.game, isTouch, {
            resetMap: () => {
              const map = this.game?.world.map;
              if (!map) return;
              delete this.save.maps[map.id];
              this.openMap(map);
            },
            openMaps: () => {
              this.save.visited = MAPS.map((m) => m.id);
              this.writeSave();
              this.refreshMaps();
              this.renderUi();
            },
          }),
      );
    if (import.meta.env.DEV) {
      const { installEditor } = await import('../editor/editor');
      const game = this.game;
      if (params.has('edit')) this.play(this.save.currentMap);
      setTimeout(
        () =>
          installEditor({ game, reopen: () => this.openMap(this.currentMap()), editing: (on) => (this.editing = on) }),
        params.has('edit') ? WIPE_SECONDS + 50 : 0,
      );
    }
  }

  private renderThumbs(): void {
    const items = new Set<string>();
    const stations = new Set(['register', 'office', 'trash', 'exit']);
    for (const m of MAPS) {
      for (const p of Object.values(m.products)) {
        items.add(p.model);
        stations.add(p.shelf);
      }
      for (const p of Object.values(m.producers)) stations.add(p.model);
    }
    renderThumbs([...items], [...stations], ['van', 'player']);
    renderStaffIcons();
  }

  private currentMap(): MapDef {
    if (this.devDaily) return this.devDaily;
    const picked = import.meta.env.DEV ? new URLSearchParams(location.search).get('map') : null;
    return mapById(picked ?? this.save.currentMap) ?? FIRST_MAP;
  }

  // ---------- title → game

  private play(id: string): void {
    this.save.currentMap = id;
    this.sounds.unlock(this.settings);
    this.ui.wipe = true;
    this.renderUi();
    if (canFullscreen()) void document.documentElement.requestFullscreen().catch(() => {});
    document.querySelector('.logo')?.classList.add('wobble');
    setTimeout(() => {
      this.openMap(this.currentMap());
      this.ui.screen = 'game';
      this.ui.wipe = false;
      this.syncAudio();
      this.hud.visible(true);
      this.renderUi();
    }, WIPE_SECONDS);
  }

  /** The title's look: the open Map fully stocked, paused, under the panning camera. */
  private showcase(): void {
    const game = this.game;
    if (!game) return;
    game.paused = true;
    game.view.cameraOverride = new THREE.Vector3();
    game.view.scenery(SCENERY_PEOPLE);
    const { world } = game;
    for (const st of world.stations.values()) {
      if (st.kind === 'shelf') st.items = shelfCap(world.map, st.product);
      if (st.kind !== 'producer') continue;
      const type = world.map.producers[st.type];
      st.plants.fill(0);
      st.tray = type.trayCap ?? 0;
      for (const p of type.inputs) st.input[p] = INPUT_CAP;
    }
  }

  // ---------- game → title

  /** Saves, then shows the title with the current Map as the stocked backdrop. */
  private toTitle(): void {
    const game = this.game;
    if (!game) return;
    this.writeSave();
    this.endOpening();
    this.ui.overlay = null;
    this.ui.office = false;
    this.ui.wipe = true;
    this.syncAudio();
    this.renderUi();
    setTimeout(() => {
      const map = game.world.map;
      game.open(map, showcaseSave(map));
      this.input.tap.cancel();
      this.warning = null;
      this.hud.reset(0, 0);
      this.showcase();
      this.ui.screen = 'title';
      this.ui.wipe = false;
      this.hud.visible(false);
      this.refreshMaps();
      this.renderUi();
    }, WIPE_SECONDS);
  }

  // the title keeps its showcase Map; only the cards change
  private reopen(): void {
    if (this.ui.screen === 'game') this.openMap(this.currentMap());
    else this.refreshMaps();
  }

  private openMap(map: MapDef): void {
    const game = this.game;
    if (!game) return;
    const mapSave: MapSave | null = this.save.maps[map.id] ?? null;
    if (!map.shift) {
      this.save.currentMap = map.id;
      if (!this.save.visited.includes(map.id)) this.save.visited.push(map.id);
    }
    game.open(map, mapSave);
    this.sounds.playMusicOf(map);
    this.input.tap.cancel();
    game.view.scenery(0);
    game.view.cameraOverride = null;
    game.paused = false;
    this.applyLayout();
    this.hud.reset(game.world.money, game.world.score);
    this.officeDismissed = this.exitDismissed = false;
    this.lessonKey = '';
    this.seenPads.clear();
    this.writeSave();
  }

  // ---------- per frame

  private onFrame(events: SimEvent[], dt: number): void {
    const game = this.game;
    if (!game) return;
    if (this.ui.screen === 'title') {
      this.titleFrame(dt);
      return;
    }
    // the game runs behind the Logbook, so its numbers refresh a few times a second
    if (this.ui.overlay === 'logbook' && (this.logbookAge += dt) >= FEEL.score.logbookRefresh) {
      this.logbookAge = 0;
      this.fillLogbook();
      this.renderUi();
    }
    const w = game.world;
    for (const e of events) this.onEvent(e);
    this.sounds.frame(events, w, (p) => this.onScreen(p), dt);
    this.hud.update(dt, w.money, completion(w), w.closed, w.score);
    document.documentElement.classList.toggle('sprinting', w.player.sprinting);
    document.documentElement.classList.toggle('joying', this.input.joyHeld);
    // leaving fullscreen on a phone pauses behind a "Tap to play fullscreen" card
    if (!this.ui.overlay && !this.editing && !this.layout?.open && canFullscreen() && !document.fullscreenElement)
      this.openOverlay('fullscreen');
    // Office opens on reaching the desk; after X it stays shut until the Player walks away and back.
    if (!w.atOffice) this.officeDismissed = false;
    const office = w.atOffice && !this.officeDismissed;
    if (office !== this.ui.office) {
      this.ui.office = office;
      this.renderUi();
    }
    // keep the Player clear of the Office: centred in what the panel leaves, plus the landscape shift right
    const wide = innerWidth > innerHeight;
    const side = layout.land ? FEEL.officeSide : 1 / 3;
    this.stage.nudge.set(
      (office && wide ? -side / 2 : 0) + (layout.land ? FEEL.landShift : 0),
      office && !wide ? FEEL.officeSheet / 2 : 0,
    );
    if (!w.atExit) this.exitDismissed = false;
    else if (w.owned.has('exit') && !w.lesson && !this.exitDismissed && !this.ui.overlay) {
      this.exitDismissed = true;
      this.openOverlay('maps');
    }
    this.guidance();
    this.sinceSave += dt;
    if (this.sinceSave > AUTOSAVE_SECONDS && !game.paused) this.writeSave();
    this.uiTimer += dt;
    const officeKey = office
      ? `${w.closed}|${Math.ceil(w.closedWait)}|${Math.floor(w.money)}|${w.owned.size}|${JSON.stringify(w.levels)}|${w.stockers.map((s) => s.role).join()}`
      : '';
    if (officeKey !== this.officeKey && this.uiTimer > 0.15) {
      this.officeKey = officeKey;
      this.uiTimer = 0;
      this.renderUi();
    }
  }

  private titleFrame(dt: number): void {
    const game = this.game;
    if (!game?.view.cameraOverride) return;
    this.titleTime += dt;
    const [W, H] = game.world.map.layout.size;
    const t = this.titleTime * TITLE_PAN_SPEED;
    game.view.cameraOverride.set(W / 2 + Math.sin(t) * W * 0.3, 0, H * 0.4 + Math.sin(t * 0.7) * H * 0.25);
  }

  private onEvent(e: SimEvent): void {
    const w = this.game?.world;
    if (!w) return;
    if (e.type === 'padBought' || e.type === 'upgradeBought') {
      if (e.type === 'padBought') persistStorage();
      this.writeSave();
      if (e.type === 'padBought' && e.pad === 'exit' && !isTutorialMap(w.map)) {
        setTimeout(() => this.openOverlay('maps'), 900);
        this.exitDismissed = true;
      }
    }
    if (e.type === 'tutorialDone') {
      // the closing card was dismissed: the Corner Shop is next in line on the title
      this.save.tutorialDone = true;
      this.save.currentMap = FIRST_MAP.id;
      this.toTitle();
      // finished: Play again starts from Lesson 0
      delete this.save.maps[w.map.id];
      writeSave(this.save);
      if (isIos && !seen('ios-tip')) {
        markSeen('ios-tip');
        this.ui.card = 'ios';
      }
    }
    if (e.type === 'complete') {
      this.hud.celebrate();
      this.endRun(w);
    }
    if (e.type === 'lessonReplay') this.hud.banner(iconUrl('player'), lessonRetry(w, e.lesson), 'No harm done');
    if (e.type === 'challengeStarted') {
      this.hud.stamp('CHALLENGE!');
      this.sounds.sfx('boing');
    }
    if (e.type === 'challengeWon') {
      this.hud.toast('Challenge won!', `⭐ +${e.score} · ${formatMoney(e.money)}`);
      this.sounds.sfx('powerup');
    }
    if (e.type === 'challengeFailed') this.hud.toast('Time up', '', false);
    if (e.type === 'objectiveDone') {
      const def = w.map.objectives.find((o) => objectiveId(o) === e.objective);
      if (def) {
        const { icon, name } = objectiveInfo(w.map, def);
        this.hud.objectiveDone(icon, name, TUNING.score.objective);
        this.sounds.sfx('powerup');
      }
    }
    if (e.type === 'deliveryArrived')
      this.hud.banner(iconUrl('van'), 'Delivery!', 'Bring the order to the car out back');
    if (e.type === 'thiefGrab') this.hud.banner(emojiUrl(THIEF), 'Thief!', 'Sprint and catch them before the door');
    if (e.type === 'inspectorWarning')
      this.warning = this.hud.banner(
        emojiUrl(INSPECTOR),
        'Health inspector',
        '',
        TUNING.events.inspector.warning * 1000,
      );
    if (e.type === 'inspection') this.hud.report(...inspectionReport(e, w.money < 0));
  }

  private onScreen(p: THREE.Vector3): boolean {
    const s = this.stage.toScreen(p);
    return s.x >= 0 && s.y >= 0 && s.x <= innerWidth && s.y <= innerHeight;
  }

  /** Lesson arrow, Office "!", and edge arrows toward off-screen targets. */
  private guidance(): void {
    const game = this.game;
    if (!game) return;
    const w = game.world;
    const view = game.view;
    const targets: { at: THREE.Vector3; icon: string }[] = [];
    const iconOf = (id: string) => {
      const def = w.map.pads[id]?.unlocks;
      const name = def
        ? stationModel(w.map, def)
        : stationModel(w.map, w.map.freeStations[id]?.unlocks ?? { kind: 'office' });
      return iconUrl(name ?? (def?.kind === 'exit' ? 'van' : `staff-${def?.kind}`));
    };
    view.arrowTarget = null;
    view.ringTarget = null;
    this.lessonGuidance(w, targets, iconOf);
    // edge arrow only for an affordable Pad the Player hasn't seen yet since it was revealed
    for (const id of visiblePads(w)) {
      const at = view.anchorOf(id);
      if (!at || this.seenPads.has(id)) continue;
      if (this.onScreen(at)) this.seenPads.add(id);
      else if (padRemaining(w, id) <= w.money) targets.push({ at, icon: iconOf(id) });
    }
    for (const c of w.customers) {
      if (c.state !== 'shop' || moodOf(c) < 2) continue;
      targets.push({
        at: new THREE.Vector3(c.x, 1, c.z),
        icon: iconUrl(w.map.products[c.list[c.li]?.product]?.model ?? ''),
      });
      break;
    }
    // Delivery cars: an edge arrow while off-screen, a HUD card with the timer and Items delivered
    const cards: EventCard[] = [];
    for (const st of w.stations.values()) {
      const d = st.kind === 'pickup' ? st.delivery : null;
      if (!d) continue;
      const [x, z] = boxCentre(st.box);
      targets.push({ at: new THREE.Vector3(x, 0, z), icon: iconUrl('van') });
      cards.push({
        icon: iconUrl('van'),
        text: '',
        left: 1 - d.t / d.time,
        red: d.honked,
        delivery: {
          id: st.id,
          lines: d.order.map((l) => ({
            icon: iconUrl(w.map.products[l.product]?.model ?? ''),
            got: l.got,
            want: l.want,
          })),
        },
      });
    }
    const th = w.thief;
    if (th && !th.caught && (th.state === 'grab' || th.state === 'run')) {
      targets.push({ at: new THREE.Vector3(th.x, 1, th.z), icon: emojiUrl(THIEF) });
      cards.push({ icon: emojiUrl(THIEF), text: 'Catch!', left: 1, red: true });
    }
    const ins = w.inspector;
    if (ins?.state === 'warn')
      this.warning?.line(
        `Arriving in ${Math.ceil(ins.t)} s! Mop up, then stay close.${w.badReviewStreak ? ' Ignore them again and the fine can put you in debt.' : ''}`,
      );
    else if (this.warning) {
      this.warning.close();
      this.warning = null;
    }
    if (ins && ins.state !== 'leave') {
      const at = ins.state === 'warn' ? ins.door : [ins.x, ins.z];
      targets.push({ at: new THREE.Vector3(at[0], 1, at[1]), icon: emojiUrl(INSPECTOR) });
      const I = TUNING.events.inspector;
      cards.push(
        ins.state === 'warn'
          ? { icon: emojiUrl(INSPECTOR), text: `in ${Math.ceil(ins.t)} s`, left: ins.t / I.warning, red: false }
          : {
              icon: emojiUrl(INSPECTOR),
              text: `${Math.min(ins.stop + 1, ins.stops.length)}/${ins.stops.length}`,
              left: 1 - ins.alone / I.alone,
              red: ins.alone > 0,
            },
      );
    }
    this.hud.setCards(cards);
    this.hud.setChallenge(challengeCard(w));
    const upgrade = Object.keys(w.map.upgrades).some((id) => upgradeVisible(w, id) && canBuyUpgrade(w, id));
    view.officeAlert = upgrade;
    if (upgrade) {
      const office = w.stations.get('office');
      if (office) {
        const [x, z] = boxCentre(office.box);
        targets.push({ at: new THREE.Vector3(x, 0, z), icon: iconUrl('office') });
      }
    }
    const arrows: EdgeArrow[] = [];
    const cx = innerWidth / 2;
    const cy = innerHeight / 2;
    for (const t of targets) {
      const s = this.stage.toScreen(t.at);
      if (s.x > EDGE_MARGIN && s.y > EDGE_MARGIN && s.x < innerWidth - EDGE_MARGIN && s.y < innerHeight - EDGE_MARGIN)
        continue;
      const angle = Math.atan2(s.y - cy, s.x - cx);
      const k = Math.min(
        (cx - EDGE_MARGIN) / Math.abs(Math.cos(angle) || 1e-6),
        (cy - EDGE_MARGIN) / Math.abs(Math.sin(angle) || 1e-6),
      );
      arrows.push({ x: cx + Math.cos(angle) * k, y: cy + Math.sin(angle) * k, angle, icon: t.icon });
    }
    this.hud.setArrows(arrows);
  }

  private lessonDevice(): LessonDevice {
    return { touch: isTouch, joystick: this.settings.joystick };
  }

  /** The Lesson's pill, arrow and ring on its target (an edge arrow too, when it is a Station). */
  private lessonGuidance(
    w: World,
    targets: { at: THREE.Vector3; icon: string }[],
    iconOf: (id: string) => string,
  ): void {
    const view = this.game?.view;
    if (!view) return;
    this.hud.lesson(lessonHud(w, this.lessonDevice()));
    this.hud.pointAt(lessonHudTarget(w));
    const key = w.lesson ? `${w.lesson.index}|${w.lesson.phase}` : '';
    if (key !== this.lessonKey) {
      this.lessonKey = key;
      this.renderUi();
    }
    const aim = lessonAim(w);
    if (!aim) return;
    const at = new THREE.Vector3(aim[0], 0, aim[1]);
    view.arrowTarget = view.ringTarget = at;
    const target = lessonTarget(w);
    if (typeof target === 'string') targets.push({ at, icon: iconOf(target) });
  }

  // ---------- saves

  private writeSave(): void {
    this.sinceSave = 0;
    const game = this.game;
    if (!game || game.world.map.shift || this.lostTab || this.editing || this.ui.screen !== 'game') return;
    this.save.maps[game.world.map.id] = snapshot(game.world);
    writeSave(this.save);
    this.claimTab();
  }

  private onHidden(): void {
    this.writeSave();
    this.endOpening();
    if (this.ui.screen === 'game' && (!this.ui.overlay || this.ui.overlay === 'logbook') && !this.lostTab)
      this.openOverlay('pause');
    this.syncAudio();
  }

  /** The one rule for audio: silent while the tab is hidden or taken over, or behind an in-game overlay that pauses the
   *  game. The Logbook keeps the game running and Settings keeps the music (so its sliders can be heard); the title
   *  plays on under any overlay. */
  private syncAudio(): void {
    const o = this.ui.overlay;
    const behind = this.ui.screen === 'game' && !!o && o !== 'logbook' && o !== 'settings';
    this.sounds.pause(document.hidden || this.lostTab || behind);
  }

  // ---------- overlays

  private openOverlay(o: Overlay | null): void {
    if (o === 'logbook') this.game?.report('logbookOpen');
    else if (this.ui.overlay === 'logbook') this.game?.report('logbookClosed');
    this.ui.overlay = o;
    if (o === 'maps') this.refreshMaps();
    // coming back from joining reads again with the new Device
    if (o === 'wall') void this.loadWall();
    // the Logbook alone leaves the game running
    const pause = !!o && o !== 'logbook';
    if (this.game && this.ui.screen === 'game') this.game.paused = pause || this.lostTab;
    this.ui.screenHz = Math.round(1000 / this.tickMs);
    this.redraw = true;
    this.syncAudio();
    this.renderUi();
    if (o === null) this.showRunEnd();
  }

  // a Map opens once it was visited or the Map before it has its Exit Pad bought
  private refreshMaps(): void {
    const live = this.ui.screen === 'game' ? this.game?.world : undefined;
    const exitBought = (id: string) =>
      id === live?.map.id ? live.owned.has('exit') : !!this.save.maps[id]?.owned.includes('exit');
    this.ui.maps = MAPS.map((map, i) => {
      const before = MAPS.slice(0, i)
        .filter((m) => !isTutorialMap(m))
        .pop();
      return {
        map,
        tutorial: isTutorialMap(map),
        visited: isTutorialMap(map) || !before || this.save.visited.includes(map.id) || exitBought(before.id),
        score: map.id === live?.map.id ? live.score : (this.save.maps[map.id]?.score ?? 0),
        completion:
          map.id === live?.map.id
            ? completion(live)
            : completionOf(
                map,
                new Set(this.save.maps[map.id]?.owned ?? []),
                this.save.maps[map.id]?.levels ?? {},
                new Set(this.save.maps[map.id]?.objectives ?? []),
              ),
      };
    });
    this.ui.maps.forEach((m) => {
      if (m.tutorial || !m.visited) m.score = null;
    });
    this.ui.total = this.ui.maps.reduce((t, m) => t + (m.score ?? 0), 0);
    this.ui.tutorialDone = this.save.tutorialDone;
    this.ui.lastMap = this.save.currentMap;
  }

  /** The Logbook for the open Map (the title: the last one played), on a tab; the game keeps running behind it. */
  private openLogbook(tab: number): void {
    this.fillLogbook();
    this.ui.logbookTab = tab;
    this.openOverlay('logbook');
  }

  private fillLogbook(): void {
    const live = this.ui.screen === 'game' ? this.game?.world : undefined;
    const map = live?.map ?? mapById(this.save.currentMap) ?? FIRST_MAP;
    const progress = (m: MapDef): MapProgress => (m === live?.map ? live : progressOfSave(this.save.maps[m.id]));
    // the Tutorial Map keeps no Score, so its Logbook is about this run only
    const all = isTutorialMap(map) ? [progress(map)] : MAPS.filter((m) => !isTutorialMap(m)).map(progress);
    this.ui.logbook = logbookView(map, progress(map), all);
  }

  private escape(): void {
    if (this.ui.screen !== 'game' || this.ui.overlay === 'fullscreen') return;
    if (this.layout?.open) return this.layout.escape();
    if (this.ui.overlay)
      this.openOverlay(this.ui.overlay === 'pause' || this.ui.overlay === 'logbook' ? null : 'pause');
    else if (this.ui.office) {
      this.officeDismissed = true;
    } else this.openOverlay('pause');
  }

  private actions: UiActions = {
    play: (id) => this.play(id),
    close: () => this.openOverlay(null),
    open: (o) => this.openOverlay(o),
    openLogbook: (tab) => this.openLogbook(tab),
    toTitle: () => this.toTitle(),
    closeOffice: () => {
      this.officeDismissed = true;
      this.ui.office = false;
      this.renderUi();
    },
    setClosed: (closed) => this.game?.setClosed(closed),
    buyUpgrade: (id) => this.game?.buyUpgrade(id),
    editLayout: () => {
      this.actions.closeOffice();
      this.layout?.begin();
    },
    layoutTurn: () => this.layout?.turn(),
    layoutPutBack: () => this.layout?.putBack(),
    layoutCancel: () => this.layout?.cancel(),
    layoutDone: () => this.layout?.done(),
    assign: (stocker, role) => this.game?.assign(stocker, role),
    setSetting: (key, value) => this.setSetting(key, value),
    playFullscreen: () => {
      void document.documentElement.requestFullscreen().catch(() => {});
      this.openOverlay(null);
    },
    fullscreen: () => {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void document.documentElement.requestFullscreen?.();
    },
    copySave: () => {
      this.writeSave();
      return copyText(encodeSaveCode(this.save));
    },
    pasteSave: (code) => {
      try {
        this.save = voidRuns(decodeSaveCode(code));
      } catch (e) {
        return `That code didn't work: ${(e as Error).message}`;
      }
      writeSave(this.save);
      this.applyLook();
      this.reopen();
      this.openOverlay(null);
      return null;
    },
    resetProgress: () => {
      this.save = wipeSave(FIRST_MAP.id);
      this.applyLook();
      this.reopen();
      this.openOverlay(null);
    },
    pickMap: (id) => {
      const map = mapById(id);
      if (!map) return;
      if (map.id !== this.game?.world.map.id) {
        this.writeSave();
        this.endOpening();
        this.openMap(map);
      }
      this.openOverlay(null);
    },
    lessonNext: () => {
      this.input.tap.cancel();
      this.game?.lessonNext();
    },
    skipLessons: () => this.toTitle(),
    dismissCard: () => {
      this.ui.card = null;
      this.renderUi();
    },
    icon: (name) => iconUrl(name),
    click: () => this.sounds.sfx('click'),
    wardrobe: this.wardrobe,
    wall: {
      tab: (tab) => this.changeWall({ tab }),
      map: (map) => this.changeWall({ map }),
      retry: () => void this.loadWall(),
      close: () => this.openOverlay(this.wallBack),
      join: () => this.actions.online.join(),
      play: (id) => (this.ui.screen === 'title' ? (this.openOverlay(null), this.play(id)) : this.actions.pickMap(id)),
      click: () => this.sounds.sfx('click'),
    },
    runEnd: {
      wall: () => this.openWall('speed'),
      join: () => this.actions.online.join(),
      retry: () => void this.sendRun(),
      close: () => ((this.ui.runEnd = null), this.openOverlay(null)),
      click: () => this.sounds.sfx('click'),
    },
    selectLook: (look, cap) => {
      this.save.look = look;
      this.save.cap = cap;
      writeSave(this.save);
      this.applyLook();
    },
    online: {
      openWall: () => this.openWall('today'),
      join: () => {
        if (this.device.accepted) return this.openOnline('join');
        this.setOnline({ askPrivacy: true });
        this.openOnline('privacy');
      },
      accept: () => {
        this.device.accept();
        this.setOnline({ askPrivacy: false });
        // a Device asked again after a notice bump was changing its Nickname
        this.openOverlay(this.device.code ? 'nickname' : 'join');
      },
      notNow: () => {
        this.setOnline({ askPrivacy: false });
        this.openOverlay(this.onlineBack);
      },
      showPrivacy: () => {
        this.privacyBack = this.ui.overlay;
        this.setOnline({ askPrivacy: false });
        this.openOverlay('privacy');
      },
      pickNickname: () => (this.device.accepted ? this.openOnline('nickname') : this.actions.online.join()),
      enterCode: () => this.openOnline('cloud-code'),
      back: () => this.openOverlay(this.ui.overlay === 'privacy' ? this.privacyBack : this.onlineBack),
      saveNickname: (name) =>
        this.onlineCall(this.device.code ? this.device.rename(name) : this.device.create(name), this.onlineBack),
      useCode: (code) => this.onlineCall(this.device.useCode(code), this.onlineBack),
      rotate: () => this.onlineCall(this.device.rotate()),
      remove: () => this.onlineCall(this.device.remove()),
      copyCode: () => copyText(this.device.code ?? ''),
    },
  };

  /** Sends the Map's Score when an Opening ends (leaving the Map, or the tab hidden); unranked without a Device. */
  private endOpening(): void {
    const w = this.game?.world;
    if (!w || this.ui.screen !== 'game' || isTutorialMap(w.map) || !this.device.code) return;
    void submitScore(this.device.code, w.map.id, w.score, w.stats.playTime);
  }

  /** A valid Run reached 100%: after the confetti, its end screen opens and the Run is sent. */
  private endRun(w: World): void {
    if (w.runVoid || isTutorialMap(w.map)) return;
    this.ui.runEnd = {
      mapId: w.map.id,
      mapName: w.map.name,
      ticks: runTicks(w.stats),
      openings: w.stats.openings,
      result: 'join',
      around: null,
    };
    this.runEndOwed = true;
    void this.sendRun();
    setTimeout(() => this.showRunEnd(), FEEL.score.runEndDelayMs);
  }

  /** The end screen waits for a moment with no other popup; openOverlay(null) asks again. */
  private showRunEnd(): void {
    if (!this.runEndOwed || this.ui.overlay !== null || this.ui.screen !== 'game') return;
    this.runEndOwed = false;
    this.openOverlay('run-end');
  }

  /** Queues and posts the end screen's Run; without a Device it waits in the queue. A reply for a closed screen is dropped. */
  private async sendRun(): Promise<void> {
    const run = this.ui.runEnd;
    if (!run) return;
    const code = this.device.code;
    if (code) {
      this.ui.runEnd = { ...run, result: 'sending' };
      this.renderUi();
    }
    const r = await submitRun(code, run.mapId, run.ticks);
    if (!r || this.ui.runEnd?.mapId !== run.mapId) return;
    this.ui.runEnd = {
      ...this.ui.runEnd,
      result: r.ok ? r.data : (RUN_ERROR[r.error] ?? 'refused'),
      around: r.ok ? r.data.around : null,
    };
    this.renderUi();
  }

  private openWall(tab: WallTab): void {
    const here = this.game?.world.map;
    const maps = MAPS.filter((m) => !isTutorialMap(m));
    this.ui.wall = {
      tab,
      map: here && !isTutorialMap(here) ? here.id : FIRST_MAP.id,
      maps: maps.map((m) => ({ id: m.id, name: m.name, playable: this.save.visited.includes(m.id) })),
      board: null,
      hasDevice: !!this.device.code,
    };
    this.wallBack = this.ui.overlay;
    // a queued submit that goes up now shows on a second read
    if (this.device.code)
      void flushPending(this.device.code).then((n) => {
        if (n && this.ui.overlay === 'wall') void this.loadWall();
      });
    this.openOverlay('wall');
  }

  private changeWall(change: Partial<WallView>): void {
    if (!this.ui.wall) return;
    this.ui.wall = { ...this.ui.wall, ...change };
    void this.loadWall();
  }

  /** Reads the Board the Wall shows; a reply for a tab or Map the player already left is dropped. */
  private async loadWall(): Promise<void> {
    const wall = this.ui.wall;
    if (!wall) return;
    this.ui.wall = { ...wall, board: null, hasDevice: !!this.device.code };
    this.renderUi();
    const kind = KIND_OF[wall.tab];
    const map = kind === 'daily' ? 'daily' : kind === 'streak' ? '-' : wall.map;
    const board = await readBoard(kind, map, dailyDay(Date.now()), this.device.code);
    const now = this.ui.wall;
    if (!now || now.tab !== wall.tab || now.map !== wall.map) return;
    this.ui.wall = { ...now, board: board ?? 'offline' };
    this.renderUi();
  }

  /** Opens an online popup, remembering where the flow started so ✕ and success return there. */
  private openOnline(o: Overlay): void {
    if (!ONLINE_OVERLAYS.has(this.ui.overlay)) this.onlineBack = this.ui.overlay;
    this.openOverlay(o);
  }

  private setOnline(change: { askPrivacy: boolean }): void {
    if (this.ui.online) this.ui.online = { ...this.ui.online, ...change };
  }

  /** Runs a Device call; on success shows the new Device state and, if given, leaves the popup. */
  private async onlineCall(call: Promise<string | null>, then?: Overlay | null): Promise<string | null> {
    const error = await call;
    if (this.ui.online) this.ui.online = { ...this.ui.online, code: this.device.code, nickname: this.device.nickname };
    // what was queued before the Device existed goes up now; an open end screen shows its rank
    if (!error && this.device.code)
      void (this.ui.runEnd?.result === 'join' ? this.sendRun() : flushPending(this.device.code));
    if (!error && then !== undefined) this.openOverlay(then);
    else this.renderUi();
    return error;
  }

  /** Shows the saved look and cap on the Player (an unknown id or colour falls back to the defaults). */
  private applyLook(): void {
    this.ui.look = lookById(this.save.look).id;
    this.ui.cap = this.save.cap in CAP_COLOURS ? this.save.cap : 'orange';
    this.game?.view.setLook(this.ui.look, this.ui.cap);
  }

  private setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
    this.settings = { ...this.settings, [key]: value };
    this.ui.settings = this.settings;
    writeSettings(this.settings);
    this.sounds.apply(this.settings);
    this.stage.batterySaver(this.settings.batterySaver);
    this.ui.zoom = this.zoom();
    this.applyLayout();
    this.renderUi();
  }

  /** Everything that follows the settings and the window's shape: HUD size, view, Pads. */
  private applyLayout(): void {
    this.hud.scale(this.settings.hudScale * (layout.land ? FEEL.landHudScale : 1));
    this.stage.zoomTo(this.viewZoom());
    if (this.game) {
      this.game.view.padScale = layout.land ? FEEL.landPadScale : 1;
      this.game.manualGrab = this.settings.manualGrab && (!isTouch || layout.land);
    }
    const root = document.documentElement;
    root.classList.toggle('joy-off', isTouch && this.settings.joystick === 'off');
    root.classList.toggle('joy-free', layout.land && this.settings.joystick === 'free');
    root.style.setProperty('--joy-zone', String(FEEL.joyZone));
    root.style.setProperty('--joy-size', `${FEEL.joyLandscape}px`);
    root.style.setProperty('--joy-left', `${FEEL.joyRestLeft}px`);
    root.style.setProperty('--joy-bottom', `${FEEL.joyRestBottom}px`);
    root.style.setProperty('--grab-ring', `${FEEL.grabRing}px`);
    this.input.holdGrab = layout.land && this.settings.manualGrab;
    this.input.setJoystick(this.settings.joystick, layout.land, insets());
    this.redraw = true;
  }

  /** Wanted zoom (the Settings slider): the saved one, or the device default. */
  private zoom(): number {
    return this.settings.zoom ?? (isTouch ? FEEL.zoomPhone : FEEL.zoomDesktop);
  }

  /** Metres across the short side in effect: landscape phones show landView across the height at the default. */
  private viewZoom(): number {
    return layout.land ? (this.zoom() * FEEL.landView) / FEEL.zoomPhone : this.zoom();
  }

  private setZoom(metres: number): void {
    this.setSetting('zoom', Math.min(FEEL.zoomMax, Math.max(FEEL.zoomMin, metres)));
  }

  private renderUi(): void {
    document.documentElement.classList.toggle('on-title', this.ui.screen !== 'game');
    renderUi(this.uiRoot, this.ui, this.actions, this.ui.screen === 'game' ? (this.game?.world ?? null) : null);
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** What the end screen says for a failed Run submit; a 429 retries like offline (spec §7.2). */
const RUN_ERROR: Partial<Record<string, 'offline' | 'update'>> = {
  offline: 'offline',
  slow_down: 'offline',
  update: 'update',
};

const ONLINE_OVERLAYS = new Set<Overlay | null>(['privacy', 'join', 'nickname', 'cloud-code']);

const THIEF = '🦹';
const INSPECTOR = '🧐';

/** The Inspector's report card: title, line, and whether it's good news. */
function inspectionReport(e: Extract<SimEvent, { type: 'inspection' }>, debt: boolean): [string, string, boolean] {
  const dirt = [
    e.messes ? `${e.messes} Mess${e.messes > 1 ? 'es' : ''}` : '',
    e.loose ? `${e.loose} Loose Item${e.loose > 1 ? 's' : ''}` : '',
  ]
    .filter(Boolean)
    .join(', ');
  const money = `${e.amount < 0 ? '-' : '+'}$${Math.abs(e.amount)}`;
  if (e.review)
    return [
      e.streak > 1 ? `BAD REVIEW ×${e.streak}` : 'BAD REVIEW',
      `${dirt ? `${dirt}, ` : ''}left alone: ${money}${debt ? ' · in debt' : ''}`,
      false,
    ];
  if (!dirt) return ['Spotless! ★★★', money, true];
  return ['Dirty store', `${dirt}: ${money}`, false];
}

/** The title shows the map fully built. */
function showcaseSave(map: MapDef): MapSave {
  return {
    money: 0,
    owned: [...Object.keys(map.layout.areas), ...Object.keys(map.pads)],
    paid: {},
    levels: {},
    roles: {},
  };
}
