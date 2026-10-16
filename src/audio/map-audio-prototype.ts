// PROTOTYPE (issue 42): a listening page to pick each Map's music track and a sound per Producer.
// Plays with plain Web Audio so loop slices and rates can be tuned live; "Dump values" prints the picks.
import GUI from 'lil-gui';
import { MAPS } from '../../maps';
import SPRITE from './sprite.json';

const BASE = import.meta.env.BASE_URL;
const P = `${BASE}proto-audio/`;
const SFX = `${BASE}audio/sfx.mp3`;
const SEAM_LEAD = 4; // seconds before a track's end the ⟲ button starts at
const FADE = 0.04; // seconds of crossfade at a loop slice's seam (the build would do the same with acrossfade)
const MACHINE_SWAP = 4; // shop mix: seconds before walking to another Machine
const ANIMAL_EVERY = 2.5;

interface Track {
  id: string;
  file: string;
  title: string;
  author: string;
  license: string;
  url: string;
  note: string;
}

const oga = (id: string, title: string, author: string, license: string, page: string, note: string): Track => ({
  id,
  file: `${P}${id}.mp3`,
  title,
  author,
  license,
  url: `https://opengameart.org/content/${page}`,
  note,
});

const MUSIC: Record<string, Track[]> = {
  'corner-shop': [
    {
      id: 'bouncy',
      file: `${BASE}audio/music.mp3`,
      title: 'Bouncy Hamster Dancing',
      author: 'cynicmusic',
      license: 'CC0',
      url: 'https://opengameart.org/content/bouncy-hamster-dancing-menu-music',
      note: 'today’s track',
    },
  ],
  'juice-bar': [
    oga('jb-tropical', 'Tropical Loop', 'wipics', 'CC0', 'tropical-loop', 'synths + conga'),
    oga(
      'jb-sicilian',
      'Sicilian sun',
      'Konrad “FeniX” Gadzina',
      'CC-BY 3.0',
      'sicilian-sun',
      'solo ukulele, 9 s loop ×4',
    ),
    oga('jb-clappy', 'Happy Clappy Loop', 'OwlishMedia', 'CC0', 'happy-clappy-loop', 'piano + claps'),
    oga('jb-atoll', 'Atoll (alt)', 'Alexandr Zhelanov', 'CC-BY 3.0', 'atoll', 'ukulele + drive guitar'),
  ],
  'dairy-farm': [
    oga('df-fishin', 'Gone Fishin’', 'Memoraphile', 'CC0', 'gone-fishin', 'banjo bluegrass'),
    oga('df-beary', 'Beary Fishy menu screen', 'Memoraphile', 'CC0', 'gone-fishin', 'calmer loop, same page'),
    oga('df-cider', 'Apple Cider', 'Zane Little Music', 'CC0', 'apple-cider', 'cozy guitar/flute, loop not stated'),
    oga('df-casual', 'Casual game track', 'Alexandr Zhelanov', 'CC-BY 3.0', 'casual-game-track', '“farm-games style”'),
    oga(
      'df-jamboree',
      'Jumping Jamboree (alt)',
      'tcarisland',
      'CC-BY 4.0',
      'jumping-jamboree',
      'banjo, xylophone, 4-bar drum intro',
    ),
  ],
  'pizza-place': [
    oga('pp-restaurant', 'restaurant (Short Looping Songs)', 'Umplix', 'CC0', 'short-looping-songs', 'accordion'),
    oga(
      'pp-heist',
      'The Italian Heist (Looping)',
      'Eric Matyas',
      'CC-BY 3.0',
      'the-italian-heist-looping',
      'sneaky; credit must be in-game',
    ),
    oga(
      'pp-accordion',
      'The Accordion Sample',
      'Spring Spring',
      'CC0',
      'the-accordion-sample',
      'accordion + synth, loop not stated',
    ),
    oga(
      'pp-aga',
      'Accordion, Guitar, Action! (alt)',
      'tapatilorenzo',
      'CC0',
      'four-original-midi-loops',
      'chiptune, “less seamless”',
    ),
  ],
};

interface Clip {
  file: string;
  start: number;
  len: number;
  label: string;
  url: string;
}

type GameSound = keyof typeof SPRITE;
const game = (n: GameSound): Clip => ({
  file: SFX,
  start: SPRITE[n][0] / 1000,
  len: SPRITE[n][1] / 1000,
  label: `${n} (in the game)`,
  url: '',
});
const fs = (id: number, label: string, start: number, len: number): Clip => ({
  file: `${P}fs-${id}.mp3`,
  start,
  len,
  label,
  url: `https://freesound.org/s/${id}/`,
});

/** Candidate clips are tunable (start/len); `game` clips are today's sprite entries and stay fixed. */
const CLIPS: Record<string, Clip> = {
  hum: game('hum'),
  moo: game('moo'),
  cluck: game('cluck'),
  pop: game('pop'),
  plop: game('plop'),
  kaching: game('kaching'),
  tick: game('tick'),
  // Dropped as too sharp (high-band energy and peaks measured with ffmpeg): leosalom blender whirr, JuanFeB juicer,
  // apintofmild coffee grinder, Orl2004 stand mixer, Fasolt oven crackle, Eneasz squishes, jsbarrett baby goat.
  juicerElectric: fs(324782, 'making juice — miguel2613', 7.2, 1.5),
  creak: fs(269722, 'wood creaks — seth-m', 1, 1.6),
  millstone: fs(430589, 'Mill stone grinding corn — PLukx', 10, 2),
  bubble: fs(456382, 'Boiling Pot of Water — monsterthing', 3.7, 3.4),
  bubbleMud: fs(343744, 'bubbling hot pot (mud) — rucisko', 5, 2),
  slosh: fs(396749, 'Water Churn — columbia23', 3, 1.5),
  mixerSlow: fs(747749, 'Stand mixer slow buildup — Fwughox_Official', 20, 2),
  bleatK: fs(581240, 'Single Goat Bleating 2x — Kinoton', 0.35, 0.8),
};

/** A sound is one or more clips layered. */
const MACHINE_SOUNDS: Record<string, string[]> = {
  hum: ['hum'],
  juicer: ['juicerElectric'],
  press: ['creak'],
  grind: ['millstone'],
  bubble: ['bubble'],
  'bubble (mud)': ['bubbleMud'],
  slosh: ['slosh'],
  mixer: ['mixerSlow'],
};
const ANIMAL_SOUNDS: Record<string, string[]> = {
  moo: ['moo'],
  cluck: ['cluck'],
  bleat: ['bleatK'],
};

interface ProducerPick {
  sound: string;
  rate: number;
  volume: number;
}
const pick = (sound: string, rate = 1): ProducerPick => ({ sound, rate, volume: 1 });

/** Research's suggestion per Producer (Corner Shop Machines start on today's hum). */
const DEFAULTS: Record<string, ProducerPick> = {
  chicken_coop: pick('cluck'),
  cow_pen: pick('moo'),
  goat_pen: pick('bleat'),
  blender: pick('hum'),
  mill: pick('hum'),
  oven: pick('hum'),
  apple_press: pick('press'),
  squeezer: pick('juicer'),
  sugar_mill: pick('grind'),
  candy_pot: pick('bubble', 1.25),
  smoothie_blender: pick('mixer', 1.3),
  butter_churn: pick('slosh'),
  cheese_press: pick('press', 0.85),
  goat_cheese_press: pick('press', 0.95),
  ice_cream_maker: pick('mixer', 0.8),
  pudding_pot: pick('bubble (mud)', 0.8),
  sauce_pot: pick('bubble'),
  dough_mixer: pick('mixer'),
  pizza_oven: pick('hum', 0.8),
  veggie_pizza_oven: pick('hum', 0.9),
};

const state = {
  title: 'own',
  music: Object.fromEntries(Object.entries(MUSIC).map(([m, ts]) => [m, ts[0].id])),
  producers: Object.fromEntries(Object.entries(DEFAULTS).map(([id, p]) => [id, { ...p }])) as Record<
    string,
    ProducerPick
  >,
  clips: Object.fromEntries(
    Object.entries(CLIPS)
      .filter(([, c]) => c.file !== SFX)
      .map(([id, c]) => [id, { start: c.start, len: c.len }]),
  ) as Record<string, { start: number; len: number }>,
  // Machines and Animals sit in the background: quiet and muffled (lowpass cutoff in Hz).
  mix: { music: 0.22, machine: 0.12, animal: 0.2, muffle: 1800, sfx: 0.8 },
};

// ---------- Web Audio ----------

const ctx = new AudioContext();
const bus = (v: number, out: AudioNode = ctx.destination): GainNode => {
  const g = ctx.createGain();
  g.gain.value = v;
  g.connect(out);
  return g;
};
const muffle = ctx.createBiquadFilter();
muffle.type = 'lowpass';
muffle.frequency.value = state.mix.muffle;
muffle.connect(ctx.destination);
const musicBus = bus(state.mix.music);
const machineBus = bus(state.mix.machine, muffle);
const animalBus = bus(state.mix.animal, muffle);
const sfxBus = bus(state.mix.sfx);

const buffers = new Map<string, Promise<AudioBuffer>>();
function load(file: string): Promise<AudioBuffer> {
  let b = buffers.get(file);
  if (!b) {
    b = fetch(file)
      .then((r) => r.arrayBuffer())
      .then((a) => ctx.decodeAudioData(a));
    buffers.set(file, b);
  }
  return b;
}

const slice = (id: string): { start: number; len: number } => state.clips[id] ?? CLIPS[id];

/** A clip's slice as its own buffer, its tail crossfaded with the audio just before the start: a seamless loop. */
function loopBuffer(buf: AudioBuffer, start: number, len: number): AudioBuffer {
  const sr = buf.sampleRate;
  const s = Math.round(start * sr);
  const n = Math.max(1, Math.min(Math.round(len * sr), buf.length - s));
  const f = Math.min(Math.round(FADE * sr), s, n >> 1);
  const src = buf.getChannelData(0);
  const out = ctx.createBuffer(1, n, sr);
  const o = out.getChannelData(0);
  for (let i = 0; i < n; i++) o[i] = src[s + i];
  for (let j = 0; j < f; j++) {
    const t = j / f;
    o[n - f + j] = o[n - f + j] * (1 - t) + src[s - f + j] * t;
  }
  return out;
}

interface Voice {
  stop(): void;
  set(rate: number, gain: number): void;
}

async function play(
  clipIds: string[],
  out: GainNode,
  opts: { loop: boolean; rate: number; gain: number },
): Promise<Voice> {
  const g = ctx.createGain();
  g.gain.value = opts.gain;
  g.connect(out);
  const sources: AudioBufferSourceNode[] = [];
  for (const id of clipIds) {
    const buf = await load(CLIPS[id].file);
    const { start, len } = slice(id);
    const src = ctx.createBufferSource();
    src.playbackRate.value = opts.rate;
    src.connect(g);
    if (opts.loop) {
      src.buffer = loopBuffer(buf, start, len);
      src.loop = true;
      src.start();
    } else {
      src.buffer = buf;
      src.start(0, start, len);
    }
    sources.push(src);
  }
  return {
    stop: () => sources.forEach((s) => s.stop()),
    set: (rate, gain) => {
      sources.forEach((s) => (s.playbackRate.value = rate));
      g.gain.value = gain;
    },
  };
}

const jitter = (): number => 1 + (Math.random() * 2 - 1) * 0.1;

// ---------- music ----------

let music: { track: string; src: AudioBufferSourceNode } | null = null;

function stopMusic(): void {
  music?.src.stop();
  music = null;
  refreshButtons();
}

async function playMusic(track: Track, seam: boolean): Promise<void> {
  stopMusic();
  const buf = await load(track.file);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.connect(musicBus);
  src.start(0, seam ? Math.max(0, buf.duration - SEAM_LEAD) : 0);
  music = { track: track.id, src };
  refreshButtons();
}

// ---------- producers ----------

const auditions = new Map<string, { voice?: Voice; timer?: number }>();
const kindOf = (id: string): string => MAPS.find((m) => m.producers[id])?.producers[id].kind ?? 'crop';
const soundsFor = (id: string): Record<string, string[]> => (kindOf(id) === 'animal' ? ANIMAL_SOUNDS : MACHINE_SOUNDS);

async function startProducer(id: string): Promise<void> {
  stopProducer(id);
  const p = state.producers[id];
  const clips = soundsFor(id)[p.sound];
  const a: { voice?: Voice; timer?: number } = {};
  auditions.set(id, a);
  if (kindOf(id) === 'animal') {
    const voice = (): void => void play(clips, animalBus, { loop: false, rate: p.rate * jitter(), gain: p.volume });
    voice();
    a.timer = window.setInterval(voice, ANIMAL_EVERY * 1000);
  } else a.voice = await play(clips, machineBus, { loop: true, rate: p.rate, gain: p.volume });
  if (auditions.get(id) !== a) a.voice?.stop();
  refreshButtons();
}

function stopProducer(id: string): void {
  const a = auditions.get(id);
  a?.voice?.stop();
  if (a?.timer) clearInterval(a.timer);
  auditions.delete(id);
  refreshButtons();
}

function restartPlaying(): void {
  for (const id of [...auditions.keys()]) void startProducer(id);
}

// ---------- shop mix: the picked track, one Machine loop at a time (as the game plays), pops, plops and voices ----------

let mix: { map: string; timers: number[]; machine?: Voice } | null = null;

function stopMix(): void {
  if (!mix) return;
  mix.timers.forEach((t) => clearInterval(t));
  mix.machine?.stop();
  mix = null;
  stopMusic();
}

function startMix(mapId: string): void {
  stopAll();
  const map = MAPS.find((m) => m.id === mapId);
  if (!map) return;
  const track = MUSIC[mapId].find((t) => t.id === state.music[mapId]) ?? MUSIC[mapId][0];
  void playMusic(track, false);
  const ids = Object.keys(map.producers);
  const machines = ids.filter((id) => map.producers[id].kind === 'machine');
  const animals = ids.filter((id) => map.producers[id].kind === 'animal');
  const m: NonNullable<typeof mix> = { map: mapId, timers: [] };
  mix = m;
  const walk = async (): Promise<void> => {
    const id = machines[Math.floor(Math.random() * machines.length)];
    const p = state.producers[id];
    const v = await play(MACHINE_SOUNDS[p.sound], machineBus, { loop: true, rate: p.rate, gain: p.volume });
    m.machine?.stop();
    if (mix !== m) return v.stop();
    m.machine = v;
    nowPlaying.textContent = `walking past: ${map.producers[id].name}`;
  };
  void walk();
  m.timers.push(window.setInterval(() => void walk(), MACHINE_SWAP * 1000));
  m.timers.push(
    window.setInterval(() => {
      const r = Math.random();
      const name = r < 0.4 ? 'pop' : r < 0.75 ? 'plop' : r < 0.9 ? 'tick' : 'kaching';
      void play([name], sfxBus, {
        loop: false,
        rate: jitter() * (name === 'plop' ? 1 + Math.random() * 0.5 : 1),
        gain: 0.8,
      });
    }, 450),
  );
  if (animals.length)
    m.timers.push(
      window.setInterval(() => {
        const id = animals[Math.floor(Math.random() * animals.length)];
        const p = state.producers[id];
        void play(ANIMAL_SOUNDS[p.sound], animalBus, { loop: false, rate: p.rate * jitter(), gain: p.volume });
      }, 3000),
    );
  refreshButtons();
}

function stopAll(): void {
  stopMix();
  stopMusic();
  for (const id of [...auditions.keys()]) stopProducer(id);
  nowPlaying.textContent = '';
}

// ---------- page ----------

const root = document.getElementById('maps') as HTMLElement;
const dumpEl = document.getElementById('dump') as HTMLElement;
const nowPlaying = document.createElement('span');
nowPlaying.className = 'meta';
document.querySelector('header')?.append(nowPlaying);

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  ...kids: (Node | string)[]
): HTMLElementTagNameMap[K] => {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...kids);
  return e;
};

function refreshButtons(): void {
  document
    .querySelectorAll<HTMLButtonElement>('[data-track]')
    .forEach((b) => b.classList.toggle('on', music?.track === b.dataset.track));
  document
    .querySelectorAll<HTMLButtonElement>('[data-prod]')
    .forEach((b) => b.classList.toggle('on', auditions.has(b.dataset.prod ?? '')));
  document
    .querySelectorAll<HTMLButtonElement>('[data-mix]')
    .forEach((b) => b.classList.toggle('on', mix?.map === b.dataset.mix));
  document.querySelectorAll<HTMLElement>('.track').forEach((t) => {
    const [m, id] = (t.dataset.key ?? '').split('/');
    t.classList.toggle('picked', state.music[m] === id);
  });
}

/** The same Producer can show in several Maps: keep every copy of its controls in step. */
function syncProducer(id: string): void {
  const p = state.producers[id];
  document.querySelectorAll<HTMLInputElement | HTMLSelectElement>(`[data-p="${id}"]`).forEach((c) => {
    const k = c.dataset.k as keyof ProducerPick;
    c.value = String(p[k]);
  });
  document.querySelectorAll<HTMLElement>(`[data-pv="${id}"]`).forEach((s) => (s.textContent = `×${p.rate.toFixed(2)}`));
}

function producerRow(id: string, name: string): HTMLElement {
  const p = state.producers[id];
  const btn = el('button', {
    textContent: '▶',
    onclick: () => (auditions.has(id) ? stopProducer(id) : void startProducer(id)),
  });
  btn.dataset.prod = id;
  const select = el('select', {
    onchange: () => ((p.sound = select.value), syncProducer(id), auditions.has(id) && void startProducer(id)),
  });
  for (const s of Object.keys(soundsFor(id))) select.append(el('option', { value: s, textContent: s }));
  select.value = p.sound;
  select.dataset.p = id;
  select.dataset.k = 'sound';
  const range = (k: 'rate' | 'volume', min: number, max: number): HTMLInputElement => {
    const r = el('input', { type: 'range', min: String(min), max: String(max), step: '0.05', value: String(p[k]) });
    r.dataset.p = id;
    r.dataset.k = k;
    r.oninput = () => {
      p[k] = Number(r.value);
      syncProducer(id);
      auditions.get(id)?.voice?.set(p.rate, p.volume);
    };
    return r;
  };
  const rateLabel = el('span', { textContent: `×${p.rate.toFixed(2)}` });
  rateLabel.dataset.pv = id;
  return el(
    'div',
    { className: 'prod' },
    el('b', {}, name, ' ', el('span', { className: 'meta', textContent: kindOf(id) })),
    btn,
    el('div', { className: 'ctl' }, select, 'rate', range('rate', 0.5, 2), rateLabel, 'vol', range('volume', 0, 1.5)),
  );
}

function trackRow(mapId: string, t: Track): HTMLElement {
  const playBtn = el('button', {
    textContent: '▶',
    title: 'Play from the start',
    onclick: () => (music?.track === t.id ? stopMusic() : void playMusic(t, false)),
  });
  playBtn.dataset.track = t.id;
  const seam = el('button', {
    textContent: '⟲',
    title: `Hear the loop seam (starts ${SEAM_LEAD} s before the end)`,
    onclick: () => void playMusic(t, true),
  });
  const radio = el('input', {
    type: 'radio',
    name: `music-${mapId}`,
    checked: state.music[mapId] === t.id,
    title: 'Pick for this Map',
  });
  radio.onchange = () => ((state.music[mapId] = t.id), refreshButtons());
  const row = el(
    'div',
    { className: 'track' },
    playBtn,
    el(
      'div',
      {},
      el('div', { className: 'name', textContent: t.title }),
      el(
        'div',
        { className: 'meta' },
        `${t.author} · ${t.license} · ${t.note} · `,
        el('a', { href: t.url, target: '_blank', textContent: 'page' }),
      ),
    ),
    seam,
    radio,
  );
  row.dataset.key = `${mapId}/${t.id}`;
  return row;
}

for (const map of MAPS) {
  const ids = Object.keys(map.producers);
  const crops = ids.filter((id) => map.producers[id].kind === 'crop');
  const mixBtn = el('button', {
    textContent: '▶ Shop mix',
    title: 'The picked track, Machines walked past one at a time, pops and voices',
    onclick: () => (mix?.map === map.id ? stopAll() : startMix(map.id)),
  });
  mixBtn.dataset.mix = map.id;
  root.append(
    el(
      'section',
      {},
      el('h2', {}, map.name, mixBtn),
      el('h3', { textContent: 'Music — pick one' }),
      ...MUSIC[map.id].map((t) => trackRow(map.id, t)),
      el('h3', { textContent: 'Animals and Machines' }),
      ...ids.filter((id) => map.producers[id].kind !== 'crop').map((id) => producerRow(id, map.producers[id].name)),
      el('p', {
        className: 'crops',
        textContent: `Crops keep the pick-up pop: ${crops.map((id) => map.producers[id].name).join(', ')}`,
      }),
    ),
  );
}

document.getElementById('stop')?.addEventListener('click', stopAll);
document
  .querySelectorAll<HTMLInputElement>('input[name=title]')
  .forEach((r) => (r.onchange = () => (state.title = r.value)));
document.addEventListener('pointerdown', () => void ctx.resume(), { once: true });
refreshButtons();

// ---------- tuning panel ----------

const gui = new GUI({ title: 'Tuning' });
const mixF = gui.addFolder('Mix volumes');
mixF.add(state.mix, 'music', 0, 1, 0.01).onChange((v: number) => (musicBus.gain.value = v));
mixF.add(state.mix, 'machine', 0, 1, 0.01).onChange((v: number) => (machineBus.gain.value = v));
mixF.add(state.mix, 'animal', 0, 1, 0.01).onChange((v: number) => (animalBus.gain.value = v));
mixF.add(state.mix, 'muffle', 400, 12000, 50).onChange((v: number) => (muffle.frequency.value = v));
mixF.add(state.mix, 'sfx', 0, 1, 0.01).onChange((v: number) => (sfxBus.gain.value = v));
const clipF = gui.addFolder('Clip slices (s)').close();
for (const [id, s] of Object.entries(state.clips)) {
  const f = clipF.addFolder(id).close();
  void load(CLIPS[id].file).then((b) => {
    f.add(s, 'start', 0, Math.max(0, b.duration - 0.2), 0.01).onFinishChange(restartPlaying);
    f.add(s, 'len', 0.2, Math.min(6, b.duration), 0.01).onFinishChange(restartPlaying);
  });
}
gui
  .add(
    {
      dump: () => {
        const picks = {
          title: state.title,
          music: state.music,
          producers: state.producers,
          clips: Object.fromEntries(
            Object.entries(state.clips)
              .filter(([id]) =>
                Object.values(state.producers).some((p) =>
                  ({ ...MACHINE_SOUNDS, ...ANIMAL_SOUNDS })[p.sound].includes(id),
                ),
              )
              .map(([id, s]) => [id, { ...s, url: CLIPS[id].url }]),
          ),
          mix: state.mix,
        };
        const text = JSON.stringify(picks, null, 2);
        dumpEl.textContent = text;
        dumpEl.style.display = 'block';
        dumpEl.scrollIntoView();
        void navigator.clipboard?.writeText(text);
      },
    },
    'dump',
  )
  .name('Dump values (copies)');
