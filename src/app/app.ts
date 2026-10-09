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
import { stationModel } from '../sim/map';
import { boxCentre } from '../sim/geometry';
import { MAPS, mapById } from '../../maps';
import { Stage } from '../view/stage';
import { loadAssets } from '../view/assets';
import { emojiUrl, iconUrl, renderThumbs } from '../view/thumbs';
import { moodOf } from '../view/receipt';
import { Input } from '../input/input';
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
const COMING_SOON = 2;
const HINT_DISTANCE = 2;
const EDGE_MARGIN = 44;
const WIPE_SECONDS = 450;
const TITLE_PAN_SPEED = 0.12;
const SCENERY_PEOPLE = 4;
/** How quickly the measured screen tick follows changes (it varies with ProMotion and throttling). */
const TICK_FOLLOW = 0.05;

const isIos =
  /iP(hone|ad|od)/.test(navigator.userAgent) &&
  !('standalone' in navigator && (navigator as { standalone?: boolean }).standalone);
const isTouch = matchMedia('(pointer: coarse)').matches;

export class App {
  private stage: Stage;
  private input: Input;
  private hud: Hud;
  private game: Game | null = null;
  private save: SaveFile;
  private settings: Settings;
  private sounds = new Sounds();
  private ui: UiState;
  private uiRoot: HTMLElement;
  private sinceSave = 0;
  private officeDismissed = false;
  private exitDismissed = false;
  private hintFrom: [number, number] | null = null;
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
    this.input = new Input(document.getElementById('joy') as HTMLElement);
    this.hud = new Hud(document.getElementById('hud') as HTMLElement);
    this.hud.visible(false);
    this.uiRoot = document.getElementById('ui') as HTMLElement;
    const loaded = loadSave(MAPS[0].id);
    this.save = loaded.save;
    this.settings = loadSettings();
    this.stage.viewSize = this.zoom();
    this.stage.batterySaver(this.settings.batterySaver);
    this.input.onTap = (x, y, double) => {
      const game = this.game;
      if (!game || this.ui.screen !== 'game' || game.paused || this.editing) return;
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
      comingSoon: COMING_SOON,
      settings: this.settings,
      zoom: 0,
      screenHz: 60,
      layout: null,
    };
    this.ui.zoom = this.zoom();
    this.hud.onGear = () => this.openOverlay('pause');
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
    const map = this.currentMap();
    this.game = new Game(this.stage, this.input, map, showcaseSave(map), true);
    this.game.paused = true;
    this.game.view.cameraOverride = new THREE.Vector3();
    this.game.view.scenery(SCENERY_PEOPLE);
    for (const st of this.game.world.stations.values()) if (st.kind === 'producer') st.plants.fill(0);
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
    this.ui.loading = 1;
    this.renderUi();
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
    if (params.has('debug')) void import('./debug').then((m) => this.game && m.openDebug(this.game, isTouch));
    if (import.meta.env.DEV) {
      const { installEditor } = await import('../editor/editor');
      const game = this.game;
      if (params.has('edit')) this.play();
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
    renderThumbs([...items], [...stations], ['employee', 'van', 'player']);
  }

  private currentMap(): MapDef {
    const picked = import.meta.env.DEV ? new URLSearchParams(location.search).get('map') : null;
    return mapById(picked ?? this.save.currentMap) ?? MAPS[0];
  }

  // ---------- title → game

  private play(): void {
    this.sounds.unlock(this.settings);
    this.ui.wipe = true;
    this.renderUi();
    document.querySelector('.logo')?.classList.add('wobble');
    setTimeout(() => {
      this.openMap(this.currentMap());
      this.ui.screen = 'game';
      this.ui.wipe = false;
      this.hud.visible(true);
      this.renderUi();
    }, WIPE_SECONDS);
  }

  private openMap(map: MapDef): void {
    const game = this.game;
    if (!game) return;
    const mapSave: MapSave | null = this.save.maps[map.id] ?? null;
    this.save.currentMap = map.id;
    if (!this.save.visited.includes(map.id)) this.save.visited.push(map.id);
    game.open(map, mapSave, this.save.tutorialDone);
    this.input.tap.cancel();
    game.view.scenery(0);
    game.view.cameraOverride = null;
    game.paused = false;
    game.manualGrab = !isTouch && this.settings.manualGrab;
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
    this.hud.update(dt, w.money, completion(w));
    // Office opens on reaching the desk; after X it stays shut until the Player walks away and back.
    if (!w.atOffice) this.officeDismissed = false;
    const office = w.atOffice && !this.officeDismissed;
    if (office !== this.ui.office) {
      this.ui.office = office;
      this.renderUi();
    }
    const wide = innerWidth > innerHeight;
    this.stage.nudge.set(office && wide ? -1 / 6 : 0, office && !wide ? 0.25 : 0);
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
      ? `${Math.floor(w.money)}|${w.owned.size}|${JSON.stringify(w.levels)}|${w.stockers.map((s) => s.role).join()}`
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
    if (e.type === 'inspection') this.hud.report(...inspectionReport(e));
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
      return iconUrl(name ?? (def?.kind === 'exit' ? 'van' : 'employee'));
    };
    const step = tutorialStep(w);
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
    if (ins?.state === 'warn') this.warning?.line(`Arriving in ${Math.ceil(ins.t)} s! Mop up, then stay close`);
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
    this.save.maps[game.world.map.id] = snapshot(game.world);
    this.save.tutorialStep = tutorialStep(game.world);
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
    if (o === 'maps') {
      this.ui.maps = MAPS.map((map) => ({
        map,
        visited: this.save.visited.includes(map.id),
        completion:
          map.id === this.game?.world.map.id
            ? completion(this.game.world)
            : completionOf(map, new Set(this.save.maps[map.id]?.owned ?? []), this.save.maps[map.id]?.levels ?? {}),
      }));
    }
    if (this.game && this.ui.screen === 'game') this.game.paused = !!o || this.lostTab;
    this.ui.screenHz = Math.round(1000 / this.tickMs);
    this.redraw = true;
    this.sounds.pause(!!o);
    this.renderUi();
  }

  private escape(): void {
    if (this.ui.screen !== 'game') return;
    if (this.layout?.open) return this.layout.escape();
    if (this.ui.overlay) this.openOverlay(this.ui.overlay === 'pause' ? null : 'pause');
    else if (this.ui.office) {
      this.officeDismissed = true;
    } else this.openOverlay('pause');
  }

  private actions: UiActions = {
    play: () => this.play(),
    close: () => this.openOverlay(null),
    open: (o) => this.openOverlay(o),
    closeOffice: () => {
      this.officeDismissed = true;
      this.ui.office = false;
      this.renderUi();
    },
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
      this.openMap(this.currentMap());
      this.openOverlay(null);
      return null;
    },
    resetProgress: () => {
      this.save = wipeSave(MAPS[0].id);
      this.openMap(this.currentMap());
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
  };

  private setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
    this.settings = { ...this.settings, [key]: value };
    this.ui.settings = this.settings;
    writeSettings(this.settings);
    this.sounds.apply(this.settings);
    this.stage.batterySaver(this.settings.batterySaver);
    this.ui.zoom = this.zoom();
    this.stage.zoomTo(this.ui.zoom);
    if (this.game) this.game.manualGrab = !isTouch && this.settings.manualGrab;
    this.redraw = true;
    this.renderUi();
  }

  /** Wanted zoom: the saved one, or the device default. */
  private zoom(): number {
    return this.settings.zoom ?? (isTouch ? FEEL.zoomPhone : FEEL.zoomDesktop);
  }

  private setZoom(metres: number): void {
    this.setSetting('zoom', Math.min(FEEL.zoomMax, Math.max(FEEL.zoomMin, metres)));
  }

  private renderUi(): void {
    renderUi(this.uiRoot, this.ui, this.actions, this.ui.screen === 'game' ? (this.game?.world ?? null) : null);
  }
}

const THIEF = '🦹';
const INSPECTOR = '🧐';

/** The Inspector's report card: title, line, and whether it's good news. */
function inspectionReport(e: Extract<SimEvent, { type: 'inspection' }>): [string, string, boolean] {
  const dirt = [
    e.messes ? `${e.messes} Mess${e.messes > 1 ? 'es' : ''}` : '',
    e.loose ? `${e.loose} Loose Item${e.loose > 1 ? 's' : ''}` : '',
  ]
    .filter(Boolean)
    .join(', ');
  const money = `${e.amount < 0 ? '-' : '+'}$${Math.abs(e.amount)}`;
  if (e.review) return ['BAD REVIEW', `${dirt ? `${dirt}, ` : ''}left alone: ${money}`, false];
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
