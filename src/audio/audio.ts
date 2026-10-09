// Cartoony toy sounds from one MP3 sprite, plus the music loop (loaded after Play). Events → sounds.
import { Howl, Howler } from 'howler';
import * as THREE from 'three';
import type { SimEvent, World } from '../sim/world';
import { DEFAULT_SETTINGS, type Settings } from '../sim/save';
import { boxCentre } from '../sim/geometry';
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

export class Sounds {
  private sfxHowl: Howl | null = null;
  private music: Howl | null = null;
  private hum: number | null = null;
  private settings: Settings = { ...DEFAULT_SETTINGS };
  private playing = new Map<string, number[]>();
  private dropStreak = 0;
  private sinceDrop = 0;
  private sinceTick = 0;
  private paused = false;

  /** Called from the Play tap: browsers only allow audio after a gesture. */
  unlock(settings: Settings): void {
    this.settings = settings;
    const base = import.meta.env.BASE_URL;
    const sprite: Record<string, [number, number]> = {};
    for (const [k, v] of Object.entries(SPRITE)) sprite[k] = [v[0], v[1]];
    this.sfxHowl = new Howl({ src: [`${base}audio/sfx.mp3`], sprite, volume: 0.8 });
    this.music = new Howl({ src: [`${base}audio/music.mp3`], loop: true, volume: MUSIC_VOLUME, html5: true });
    this.apply(settings);
  }

  apply(settings: Settings): void {
    this.settings = settings;
    if (!this.music) return;
    if (settings.music && !this.paused) {
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
    if (!h || !this.settings.sounds || this.paused) return;
    const live = (this.playing.get(name) ?? []).filter((id) => h.playing(id));
    if (live.length >= MAX_COPIES) return;
    const id = h.play(name);
    h.rate((opts.rate ?? 1) * (1 + (Math.random() * 2 - 1) * PITCH_JITTER), id);
    h.volume(opts.volume ?? 1, id);
    live.push(id);
    this.playing.set(name, live);
  }

  /** Music dips under a jingle. */
  private jingle(name: SoundName): void {
    this.sfx(name);
    const m = this.music;
    if (!m || !m.playing()) return;
    m.fade(MUSIC_VOLUME, MUSIC_DIP, 200);
    setTimeout(() => m.fade(MUSIC_DIP, MUSIC_VOLUME, 600), 1600);
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
          this.sfx('tick', { rate: 0.8 + k * 1.2, volume: 0.6 });
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
            setTimeout(() => this.sfx('bill', { rate: 0.9 + i * 0.05, volume: 0.7 }), (i / n) * e.duration * 1000);
          break;
        }
        case 'produced': {
          const st = w.stations.get(e.station);
          if (st?.kind !== 'producer') break;
          const type = w.map.producers[st.type];
          if (type.kind === 'animal' && Math.random() < 0.5)
            this.sfx(type.output === 'milk' ? 'moo' : 'cluck', { volume: at(e.station) * 0.7 });
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
        case 'complete':
          this.jingle('fanfare');
          setTimeout(() => this.sfx('horn'), 700);
          break;
      }
    }
    this.machineHum(w, at);
  }

  /** One quiet loop while any Machine works; quieter when they're all off-screen. */
  private machineHum(w: World, at: (id: string) => number): void {
    const h = this.sfxHowl;
    if (!h) return;
    let volume = 0;
    for (const st of w.stations.values()) {
      if (st.kind === 'producer' && st.work > 0 && w.map.producers[st.type].kind === 'machine')
        volume = Math.max(volume, at(st.id));
    }
    const on = volume > 0 && this.settings.sounds && !this.paused;
    if (on && this.hum === null) {
      this.hum = h.play('hum');
      h.loop(true, this.hum);
    }
    if (this.hum !== null) {
      if (!on) {
        h.stop(this.hum);
        this.hum = null;
      } else h.volume(0.25 * volume, this.hum);
    }
  }
}
