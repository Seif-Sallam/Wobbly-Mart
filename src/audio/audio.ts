// Cartoony toy sounds from one MP3 sprite, plus each Map's music loop (loaded after Play). Events → sounds.
import { Howl, Howler } from 'howler';
import * as THREE from 'three';
import type { SimEvent, World } from '../sim/world';
import type { MapDef } from '../sim/map';
import { DEFAULT_SETTINGS, type Settings } from '../sim/save';
import { boxCentre } from '../sim/geometry';
import type { ProducerType } from '../../catalog/producers';
import { stackCap } from '../sim/economy';
import SPRITE from './sprite.json';

type SoundName = keyof typeof SPRITE;

const PITCH_JITTER = 0.1;
const MAX_COPIES = 4;
const OFFSCREEN_VOLUME = 0.3;
const MUSIC_VOLUME = 0.22;
const MUSIC_DIP = 0.06;
const TICK_GAP = 0.07;
const CRESCENDO_RESET = 0.6;
/** The mix: build-audio.sh levels every clip, so these are the only volumes. Frequent sounds stay subtle,
 *  rewards a little louder; Animals and Machine loops sit in the background (their clips are also muffled). */
const LEVEL: Record<SoundName, number> = {
  pop: 0.45,
  plop: 0.45,
  tick: 0.35,
  bill: 0.3,
  kaching: 0.3,
  click: 0.5,
  bonk: 0.45,
  swish: 0.45,
  splat: 0.45,
  grumble: 0.45,
  horn: 0.3,
  honk: 0.25,
  ding: 0.55,
  boing: 0.45,
  powerup: 0.55,
  jingle: 0.65,
  fanfare: 0.65,
  cluck: 0.4,
  moo: 0.4,
  bleat: 0.4,
  hum: 0.15,
  press: 0.15,
  grind: 0.15,
  bubble: 0.15,
  bubble_mud: 0.15,
  slosh: 0.15,
  mixer: 0.15,
};

export class Sounds {
  private sfxHowl: Howl | null = null;
  private music: Howl | null = null;
  private musicMap = '';
  private machine: { sound: SoundName; rate: number; id: number } | null = null;
  private settings: Settings = { ...DEFAULT_SETTINGS };
  private playing = new Map<string, number[]>();
  private dropStreak = 0;
  private sinceDrop = 0;
  private sinceTick = 0;
  private paused = false;

  /** Called from the Play tap: browsers only allow audio after a gesture. */
  unlock(settings: Settings): void {
    this.settings = settings;
    if (this.sfxHowl) return;
    const base = import.meta.env.BASE_URL;
    const sprite: Record<string, [number, number]> = {};
    for (const [k, v] of Object.entries(SPRITE)) sprite[k] = [v[0], v[1]];
    this.sfxHowl = new Howl({ src: [`${base}audio/sfx.mp3`], sprite, volume: 0.8 });
  }

  /** Swaps to the Map's track; does nothing before unlock. */
  playMusicOf(map: MapDef): void {
    const track = map.music ?? map.id;
    if (!this.sfxHowl || track === this.musicMap) return;
    this.musicMap = track;
    this.music?.unload();
    const base = import.meta.env.BASE_URL;
    this.music = new Howl({
      src: [`${base}audio/music-${track}.mp3`],
      loop: true,
      volume: this.musicLevel(),
      html5: true,
    });
    this.apply(this.settings);
  }

  private musicLevel(): number {
    return MUSIC_VOLUME * this.settings.musicVolume;
  }

  apply(settings: Settings): void {
    this.settings = settings;
    if (!this.music) return;
    this.music.volume(this.musicLevel());
    if (settings.musicVolume > 0 && !this.paused) {
      if (!this.music.playing()) this.music.play();
    } else this.music.pause();
  }

  pause(on: boolean): void {
    this.paused = on;
    Howler.mute(on);
    if (this.music) {
      if (on) this.music.pause();
      else this.apply(this.settings);
    }
  }

  sfx(name: SoundName, opts: { rate?: number; volume?: number } = {}): void {
    const h = this.sfxHowl;
    if (!h || !this.settings.soundVolume || this.paused) return;
    const live = (this.playing.get(name) ?? []).filter((id) => h.playing(id));
    if (live.length >= MAX_COPIES) return;
    const id = h.play(name);
    h.rate((opts.rate ?? 1) * (1 + (Math.random() * 2 - 1) * PITCH_JITTER), id);
    h.volume(LEVEL[name] * (opts.volume ?? 1) * this.settings.soundVolume, id);
    live.push(id);
    this.playing.set(name, live);
  }

  /** Music dips under a jingle. */
  private jingle(name: SoundName): void {
    this.sfx(name);
    const m = this.music;
    if (!m || !m.playing()) return;
    const level = this.musicLevel();
    const dip = level * (MUSIC_DIP / MUSIC_VOLUME);
    m.fade(level, dip, 200);
    setTimeout(() => m.fade(dip, this.musicLevel(), 600), 1600);
  }

  frame(events: SimEvent[], w: World, onScreen: (p: THREE.Vector3) => boolean, dt: number): void {
    this.sinceDrop += dt;
    this.sinceTick += dt;
    const at = (id: string): number => {
      const st = w.stations.get(id);
      const box = st?.box ?? w.map.layout.places[id]?.box;
      if (!box) return 1;
      const [x, z] = boxCentre(box);
      return onScreen(new THREE.Vector3(x, 0, z)) ? 1 : OFFSCREEN_VOLUME;
    };
    for (const e of events) {
      switch (e.type) {
        case 'transfer':
          if ('agent' in e.to && e.to.agent === 'player')
            this.sfx('pop', { rate: 1.1 - 0.25 * (w.player.stack.length / stackCap(w)) });
          else if ('agent' in e.from && e.from.agent === 'player' && 'station' in e.to) {
            if (this.sinceDrop > CRESCENDO_RESET) this.dropStreak = 0;
            this.sinceDrop = 0;
            this.sfx('plop', { rate: Math.min(2, 1 + this.dropStreak++ * 0.06) });
          } else if ('loose' in e.to) this.sfx('bonk', { rate: 1.4 });
          break;
        case 'trashed':
          this.sfx('plop', { rate: 0.7 });
          break;
        case 'padPaying': {
          if (this.sinceTick < TICK_GAP) break;
          this.sinceTick = 0;
          const k = (w.paid[e.pad] ?? 0) / (w.map.pads[e.pad]?.cost ?? 1);
          this.sfx('tick', { rate: 0.8 + k * 1.2 });
          break;
        }
        case 'padBought':
          this.sfx('ding');
          this.sfx('boing');
          if (e.pad === 'exit') setTimeout(() => this.sfx('honk'), 300);
          break;
        case 'areaBought':
          this.jingle('jingle');
          break;
        case 'upgradeBought':
          this.sfx('powerup');
          break;
        case 'paid':
          this.sfx('kaching', { volume: at(e.register) });
          break;
        case 'cashCollect': {
          const n = Math.min(12, Math.ceil(e.amount / 5));
          for (let i = 0; i < n; i++)
            setTimeout(() => this.sfx('bill', { rate: 0.9 + i * 0.05 }), (i / n) * e.duration * 1000);
          break;
        }
        case 'produced': {
          const st = w.stations.get(e.station);
          if (st?.kind !== 'producer') break;
          const type = w.map.producers[st.type];
          if (type.kind === 'animal' && type.sound && Math.random() < 0.5)
            this.sfx(type.sound, { rate: type.soundRate, volume: at(e.station) });
          break;
        }
        case 'mess':
          if (e.customer >= 0) this.sfx('grumble');
          this.sfx('splat');
          break;
        case 'messCleared':
          this.sfx('swish');
          break;
        case 'stackFull':
          this.sfx('bonk');
          break;
        case 'deliveryArrived':
          this.sfx('horn', { volume: at(e.station) });
          break;
        case 'deliveryHonk':
          this.sfx('honk', { volume: at(e.station) });
          break;
        case 'deliveryDone':
          if (e.amount) this.sfx('kaching', { volume: at(e.station) });
          if (e.tip) setTimeout(() => this.sfx('ding'), 250);
          break;
        case 'thiefGrab':
          this.sfx('boing', { rate: 0.7 });
          this.sfx('grumble', { rate: 1.3 });
          break;
        case 'robberyDone':
          this.sfx(e.caught ? 'bonk' : 'grumble');
          if (e.caught) setTimeout(() => this.sfx('kaching'), 300);
          break;
        case 'inspectorWarning':
          this.sfx('ding', { rate: 0.8 });
          break;
        case 'inspectorMark':
          this.sfx(e.clean ? 'tick' : 'bonk', { rate: e.clean ? 1.4 : 1.2 });
          break;
        case 'inspection':
          if (e.amount > 0) this.sfx('powerup');
          else this.sfx(e.review ? 'bonk' : 'grumble', { rate: e.review ? 0.6 : 1 });
          break;
        case 'complete':
          this.jingle('fanfare');
          setTimeout(() => this.sfx('horn'), 700);
          break;
      }
    }
    this.machineLoop(w, at);
  }

  /** One quiet loop while any Machine works: the loudest working Machine's own sound; quieter when all are off-screen. */
  private machineLoop(w: World, at: (id: string) => number): void {
    const h = this.sfxHowl;
    if (!h) return;
    let volume = 0;
    let type: ProducerType | null = null;
    for (const st of w.stations.values()) {
      if (st.kind !== 'producer' || st.work <= 0) continue;
      const t = w.map.producers[st.type];
      const v = at(st.id);
      if (t.kind === 'machine' && t.sound && v > volume) [volume, type] = [v, t];
    }
    const want = type?.sound && this.settings.soundVolume > 0 && !this.paused ? type : null;
    const m = this.machine;
    if (m && (want?.sound !== m.sound || (want.soundRate ?? 1) !== m.rate)) {
      h.stop(m.id);
      this.machine = null;
    }
    if (!want?.sound) return;
    if (!this.machine) {
      const id = h.play(want.sound);
      h.loop(true, id);
      h.rate(want.soundRate ?? 1, id);
      this.machine = { sound: want.sound, rate: want.soundRate ?? 1, id };
    }
    h.volume(LEVEL[this.machine.sound] * volume * this.settings.soundVolume, this.machine.id);
  }
}
