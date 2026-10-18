// The app: title → game, saves, the HUD and panels, guidance arrows. Glue between sim, view, ui and audio.
import * as THREE from 'three';
import type { SimEvent } from '../sim/world';
import type { MapDef } from '../sim/map';
import {
  encodeSaveCode,
  decodeSaveCode,
  snapshot,
  ticksPerFrame,
  SAVER_FRAME_CAP,
  type MapSave,
  type SaveFile,
  type Settings,
} from '../sim/save';
import {
  canBuyUpgrade,
  completion,
  completionOf,
  padRemaining,
  tutorialStep,
  upgradeVisible,
  visiblePads,
} from '../sim/economy';
import { shelfCap, stationModel } from '../sim/map';
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
import { Hud, type EdgeArrow, type EventBanner, type EventCard } from '../ui/hud';
import { renderUi, type Overlay, type UiActions, type UiState } from '../ui/app';
import { Sounds } from '../audio/audio';
import { FEEL } from '../feel';
import { TUNING } from '../sim/tuning';

const AUTOSAVE_SECONDS = 5;
const HINT_DISTANCE = 2;
const EDGE_MARGIN = 44;
const WIPE_SECONDS = 450;
const TITLE_PAN_SPEED = 0.12;
const SCENERY_PEOPLE = 4;
/** How quickly the measured screen tick follows changes (it varies with ProMotion and throttling). */
const TICK_FOLLOW = 0.05;

/** Phones play fullscreen. iPhone Safari has no Fullscreen API, and an installed app already is. */
const canFullscreen = (): boolean =>
  isTouch &&
  !!document.documentElement.requestFullscreen &&
  !matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;

const tutorKey = (map: string, step: number): string => `tutor.${map}.${step}`;

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
  /** No save existed at load: the Wardrobe opens by itself once the title is ready. */
  private firstRun: boolean;
  private ui: UiState;
  private uiRoot: HTMLElement;
  private sinceSave = 0;
  private officeDismissed = false;
  private exitDismissed = false;
  private hintFrom: [number, number] | null = null;
  /** The tutorial step whose pop-up the Player closed with OK (also kept in storage, for reloads). */
  private tutorNexted = -1;
  private lostTab = false;
  private titleTime = 0;
  private uiTimer = 0;
  private claimTab: () => void;
  private editing = false;
  private seenPads = new Set<string>();
  /** Paused game: draw one more frame (something behind the overlay changed). */
  private redraw = true;
  /** Measured time between screen ticks (ms) and ticks seen: a frame cap draws every Nth tick, evenly paced. */
  private tickMs = 1000 / 60;
  private lastTick = 0;
  private ticks = 0;
  private officeKey = '';
  private layout: EditLayout | null = null;
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
      // with a stick, floor taps never walk
      if (isTouch && this.settings.joystick !== 'off') return;
      const p = this.stage.floorAt(x, y);
      if (p) this.input.tap.start(game.world, p, double);
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
      lastMap: this.save.currentMap,
      tutorialDone: this.save.tutorialDone,
      settings: this.settings,
      zoom: 0,
      screenHz: 60,
      layout: null,
      look: lookById(this.save.look).id,
      cap: this.save.cap in CAP_COLOURS ? this.save.cap : 'orange',
    };
    this.ui.zoom = this.zoom();
    watchLayout(() => this.applyLayout());
    this.hud.onGear = () => this.openOverlay('pause');
    this.hud.onTutorNext = () => {
      if (!this.game) return;
      this.tutorNexted = tutorialStep(this.game.world);
      markSeen(tutorKey(this.game.world.map.id, this.tutorNexted));
    };
    this.hud.onTutorSkip = () => this.game?.skipTutorial();
    this.input.onEscape = () => this.escape();
    this.claimTab = claimTab(() => {
      this.lostTab = true;
      this.ui.card = 'other-tab';
      if (this.game) this.game.paused = true;
      this.renderUi();
    });
    addEventListener('visibilitychange', () => (document.hidden ? this.onHidden() : this.sounds.pause(false)));
    addEventListener('pagehide', () => this.writeSave());
    this.renderUi();
  }

  async start(): Promise<void> {
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
    this.game = new Game(this.stage, this.input, map, showcaseSave(map), true);
    this.game.paused = true;
    this.game.view.setLook(this.ui.look, this.ui.cap);
    this.applyLayout();
    this.game.view.cameraOverride = new THREE.Vector3();
    this.game.view.scenery(SCENERY_PEOPLE);
    const { world } = this.game;
    for (const st of world.stations.values()) {
      if (st.kind === 'shelf') st.items = shelfCap(world.map, st.product);
      if (st.kind !== 'producer') continue;
      const type = world.map.producers[st.type];
      st.plants.fill(0);
      st.tray = type.trayCap ?? 0;
      for (const p of type.inputs) st.input[p] = type.inputCap ?? 0;
    }
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
      this.hud.visible(true);
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
    this.save.currentMap = map.id;
    if (!this.save.visited.includes(map.id)) this.save.visited.push(map.id);
    game.open(map, mapSave, this.save.tutorialDone);
    this.sounds.playMusicOf(map.id);
    this.input.tap.cancel();
    game.view.scenery(0);
    game.view.cameraOverride = null;
    game.paused = false;
    this.applyLayout();
    this.hud.resetMoney(game.world.money);
    this.officeDismissed = this.exitDismissed = false;
    this.seenPads.clear();
    this.hintFrom = game.world.tutorial.done ? null : [game.world.player.x, game.world.player.z];
    this.hud.showHint(this.hintFrom ? (this.input.firstKind ?? (isTouch ? 'touch' : 'keys')) : null);
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
    const w = game.world;
    for (const e of events) this.onEvent(e);
    this.sounds.frame(events, w, (p) => this.onScreen(p), dt);
    this.hud.update(dt, w.money, completion(w), w.closed);
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
    else if (w.owned.has('exit') && !this.exitDismissed && !this.ui.overlay) {
      this.exitDismissed = true;
      this.openOverlay('maps');
    }
    if (this.hintFrom && Math.hypot(w.player.x - this.hintFrom[0], w.player.z - this.hintFrom[1]) > HINT_DISTANCE) {
      this.hintFrom = null;
      this.hud.showHint(null);
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
      if (e.type === 'padBought' && e.pad === 'exit' && isTutorialMap(w.map)) this.save.tutorialDone = true;
      if (e.type === 'padBought' && e.pad === 'exit') {
        setTimeout(() => this.openOverlay('maps'), 900);
        this.exitDismissed = true;
      }
    }
    if (e.type === 'tutorialDone') {
      this.save.tutorialDone = true;
      this.writeSave();
      if (isIos && !seen('ios-tip')) {
        markSeen('ios-tip');
        this.ui.card = 'ios';
        this.renderUi();
      }
    }
    if (e.type === 'complete') this.hud.celebrate();
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

  /** Bouncing tutorial arrow, Office "!", and edge arrows toward off-screen targets. */
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
    const step = tutorialStep(w);
    const closed = step === this.tutorNexted || seen(tutorKey(w.map.id, step));
    const text = step >= 0 && !closed ? w.map.tutorial[step].text : undefined;
    this.hud.tutorial(text ?? null, step + 1, w.map.tutorial.length);
    view.arrowTarget = null;
    if (step >= 0) {
      const s = w.map.tutorial[step];
      const id = s.pad ?? s.station ?? '';
      const at = view.anchorOf(id);
      if (at) {
        view.arrowTarget = at;
        targets.push({ at, icon: iconOf(id) });
      }
    }
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
      const got = d.order.reduce((n, l) => n + l.got, 0);
      const want = d.order.reduce((n, l) => n + l.want, 0);
      const left = 1 - d.t / d.time;
      cards.push({ icon: iconUrl('van'), text: `${got}/${want}`, left, red: d.time - d.t <= TUNING.events.honkAt });
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

  // ---------- saves

  private writeSave(): void {
    this.sinceSave = 0;
    const game = this.game;
    if (!game || this.lostTab || this.editing || this.ui.screen !== 'game') return;
    if (!isTutorialMap(game.world.map)) {
      this.save.maps[game.world.map.id] = snapshot(game.world);
      this.save.tutorialStep = tutorialStep(game.world);
    }
    writeSave(this.save);
    this.claimTab();
  }

  private onHidden(): void {
    this.writeSave();
    this.sounds.pause(true);
    if (this.ui.screen === 'game' && !this.ui.overlay && !this.lostTab) this.openOverlay('pause');
  }

  // ---------- overlays

  private openOverlay(o: Overlay | null): void {
    this.ui.overlay = o;
    if (o === 'maps') this.refreshMaps();
    if (this.game && this.ui.screen === 'game') this.game.paused = !!o || this.lostTab;
    this.ui.screenHz = Math.round(1000 / this.tickMs);
    this.redraw = true;
    this.sounds.pause(!!o);
    this.renderUi();
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
        completion:
          map.id === live?.map.id
            ? completion(live)
            : completionOf(map, new Set(this.save.maps[map.id]?.owned ?? []), this.save.maps[map.id]?.levels ?? {}),
      };
    });
    this.ui.tutorialDone = this.save.tutorialDone;
    this.ui.lastMap = this.save.currentMap;
  }

  private escape(): void {
    if (this.ui.screen !== 'game' || this.ui.overlay === 'fullscreen') return;
    if (this.layout?.open) return this.layout.escape();
    if (this.ui.overlay) this.openOverlay(this.ui.overlay === 'pause' ? null : 'pause');
    else if (this.ui.office) {
      this.officeDismissed = true;
    } else this.openOverlay('pause');
  }

  private actions: UiActions = {
    play: (id) => this.play(id),
    close: () => this.openOverlay(null),
    open: (o) => this.openOverlay(o),
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
    copySave: async () => {
      this.writeSave();
      try {
        await navigator.clipboard.writeText(encodeSaveCode(this.save));
        return true;
      } catch {
        return false;
      }
    },
    pasteSave: (code) => {
      try {
        this.save = decodeSaveCode(code);
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
        this.openMap(map);
      }
      this.openOverlay(null);
    },
    dismissCard: () => {
      this.ui.card = null;
      this.renderUi();
    },
    icon: (name) => iconUrl(name),
    click: () => this.sounds.sfx('click'),
    wardrobe: this.wardrobe,
    selectLook: (look, cap) => {
      this.save.look = look;
      this.save.cap = cap;
      writeSave(this.save);
      this.applyLook();
    },
  };

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
