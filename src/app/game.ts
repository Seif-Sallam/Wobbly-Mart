// The running game: fixed-timestep sim, the 3D view, input and the bits of glue between them.
import type { Intents, SimEvent, StockerRole, World } from '../sim/world';
import { createWorld, DT, step } from '../sim/world';
import type { MapDef } from '../sim/map';
import type { MapSave } from '../sim/save';
import { Stage } from '../view/stage';
import { WorldView } from '../view/world-view';
import { Input } from '../input/input';

const MAX_STEPS_PER_FRAME = 240;

export class Game {
  world: World;
  readonly view: WorldView;
  paused = false;
  /** Sim speed multiplier (debug cheat). */
  speed = 1;
  manualGrab = false;
  private acc = 0;
  private last = performance.now();
  private commands: Partial<Intents> = {};
  /** Every frame, after the sim stepped: events of this frame. */
  onFrame: (events: SimEvent[], dt: number) => void = () => {};

  constructor(
    readonly stage: Stage,
    readonly input: Input,
    map: MapDef,
    save: MapSave | null,
    tutorialDone: boolean,
  ) {
    this.world = createWorld(map, save, seed(), tutorialDone);
    this.view = new WorldView(stage, this.world);
  }

  /** Fresh Opening of a map (reload, map switch, reset). */
  open(map: MapDef, save: MapSave | null, tutorialDone: boolean): void {
    this.world = createWorld(map, save, seed(), tutorialDone);
    this.view.reset(this.world);
  }

  buyUpgrade(id: string): void {
    this.commands.buyUpgrade = id;
  }

  assign(stocker: string, role: StockerRole): void {
    this.commands.assign = { stocker, role };
  }

  /** One drawn frame; `fps` is the frame cap it runs under. */
  frame(now: number, fps: number): void {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.stage.watchFrame(dt, fps);
    const events: SimEvent[] = [];
    if (!this.paused) {
      this.acc += dt * this.speed;
      let steps = 0;
      while (this.acc >= DT && steps < MAX_STEPS_PER_FRAME) {
        // the view blends between the last two steps, however many run this frame
        this.view.beforeSteps();
        step(this.world, {
          move: this.input.move(this.world),
          grab: this.input.grab,
          sprint: this.input.sprint,
          manualGrab: this.manualGrab,
          ...this.commands,
        });
        this.commands = {};
        events.push(...this.world.events);
        this.acc -= DT;
        steps++;
      }
      if (steps === MAX_STEPS_PER_FRAME) this.acc = 0;
    }
    this.view.walkTarget = this.input.tap.target;
    this.view.update(dt, this.acc / DT, events);
    this.onFrame(events, dt);
    this.stage.render(dt);
  }
}

// The sim's RNG is seeded from outside the sim: different every Opening.
const seed = (): number => Math.floor(Math.random() * 2 ** 31);
