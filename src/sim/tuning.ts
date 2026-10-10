// Gameplay numbers the sim reads that are not per-map data.
export const TUNING = {
  tickRate: 60,
  playerRadius: 0.4,
  characterRadius: 0.3,
  reach: 0.6,
  pickInterval: [0.25, 0.5] as const,
  dropInterval: 0.25,
  dropSpeedup: 0.85,
  dropIntervalMin: 0.06,
  padDrainTime: 1.5,
  padHalfSize: 0.8,
  cashPileOffset: 0.7,
  cashPileRadius: 0.8,
  /** Mopping reaches a Mess this far away (m). */
  messClearRadius: 0.8,
  /** Seconds the Player stands on the Trash Bin before it takes Items. */
  trashHoldTime: 1.5,
  /** Within messRadius of a waiting Mess: Customers walk at messSlowdown, the Player and Staff at messSlowdownStaff, and
   * Customers lose patience messPatience × faster. */
  messSlowdown: 0.5,
  messSlowdownStaff: 0.7,
  messPatience: 1.5,
  messRadius: 0.9,
  /** Sideways slide (m per step) for a walker stepping around a Mess. */
  messSkirt: 0.03,
  /** Cleaner: flat walk speeds (m/s), clean time × the Player's, wander spots snapped to this grid (m), show mopping (s). */
  cleaner: { wanderSpeed: 2, rushSpeed: 4, cleanFactor: 1.5, wanderGrid: 4, showMop: [2, 4] as const },
  playerCheckoutTime: 1.5,
  customerSpeed: 2.6,
  customerTakeTime: 0.6,
  arrivalInterval: 1.5,
  capBase: 2,
  capCashierFactor: 1.3,
  /** Shopping List weights: Product count 1–4, then units 1–4 by Product count. */
  listProducts: [30, 35, 25, 10],
  listUnits: [
    [5, 15, 25, 55],
    [10, 25, 55, 10],
    [10, 70, 18, 2],
    [15, 80, 4, 1],
  ],
  patienceAngry: [45, 90] as const,
  patienceLeave: 15,
  neverGiveUp: 0.25,
  /** Least clear distance between any two Station or Pad footprints (m): standing halfway between is out of reach of both (0.75 m > 0.6 m reach). */
  clearance: 1.5,
  /** Edit Layout: nothing may stand this close to a door (m); each bought Area adds this many Moves. */
  doorKeepClear: 1.5,
  movesPerArea: 3,
  queueGap: 0.8,
  queueFirstOffset: 0.6,
  shelfSpotOffset: 0.7,
  shelfSpotGap: 0.9,
  shelfCap: 10,
  navCell: 0.5,
  /** Agents count as at a Station within this share of reach, at a point within this distance (m). */
  arriveReachShare: 0.9,
  arrivePoint: 0.05,
  /** Distance-field seeds: reach ring padding and point radius, in grid cells. */
  seedReachCells: 0.6,
  seedPointCells: 0.75,
  /** The front Customer must stand this close to Queue Spot 1 to be checked out (m). */
  queueFrontTolerance: 0.1,
  /** Extra reach for working the Register and for opening the Office panel (m). */
  registerReachExtra: 0.2,
  officeReachExtra: 0.3,
  /** Push-out slack before a move is rejected as stuck in a wall (m). */
  collisionSlack: 0.05,
  /** Money one bill stands for, in Cash Pile and drain counts. */
  billValue: 5,
  fullStackSlowdown: 0.25,
  sprint: { speed: 1.5 },
  /**
   * Tipping above the safe count: drops/s = maxRate × share × (1 + joltBoost × min(1, jolt)) × k^curve,
   * k = (Stack − safe) / (cap − safe); share 1 sprinting, walkShare above walkSpeed m/s, else 0.
   */
  tip: {
    maxRate: 0.3,
    curve: 1.2,
    walkShare: 0.12,
    walkSpeed: 0.5,
    joltBoost: 2,
    cooldown: 1,
    dropBehind: 1.3,
    dropSide: 0.8,
  },
  looseTakeRadius: 0.8,
  /** Stocker job tiers are tierGap apart, so fill and distance (× distanceWeight per m) only order within one. */
  urgency: { tierGap: 10, distanceWeight: 0.01 },
  /** Seconds a Stocker holds a whole Stack of leftovers before putting them back on a Tray or in the Trash. */
  leftoverTime: 10,
  stockerRethink: 0.5,
  exitPickRadius: 1.2,
  /**
   * Events: none in the first quietStart s of an Opening. Deliveries: the next car every deliveryGap s; one waits at a
   * time unless the Stocker counts in carStockers allow a 2nd / 3rd, and then only by extraCarChance (the extra car
   * comes extraCarGap s after the last one parked). Up to orderProducts Products per order, Items by Areas bought; timer deliveryTime + deliveryPerItem s per Item, honk at honkAt s left;
   * a full order pays deliveryPay × Sale Price, plus up to tipMax of that, falling to 0 at half the timer.
   */
  events: {
    quietStart: 180,
    deliveryGap: [180, 240] as const,
    carStockers: [1, 3],
    extraCarChance: 0.3,
    extraCarGap: [30, 90] as const,
    orderProducts: 3,
    deliveryItems: [
      [3, 6],
      [5, 9],
      [7, 12],
    ] as const,
    deliveryTime: 90,
    deliveryPerItem: 10,
    honkAt: 15,
    deliveryPay: 1.5,
    tipMax: 0.25,
    /** Robbery and the Health Inspector: one at a time, this many s apart. */
    visitGap: [180, 300] as const,
    /** Thief: takes up to `items` from the fullest Shelf over grabTime s, freezes the game `freeze` s (Thief Pan),
     * walks off at `speed` m/s (weighed down) to the nearest customer door and is gone; the Player catches them within
     * catchRadius m. */
    robbery: { items: 5, grabTime: 2, freeze: 2, speed: 2.5, catchRadius: 0.8 },
    /** Inspector: warning s, stops (count range, s each), escort radius m, s alone before a bad review, a stop's ✗ when
     * a Mess or Loose Item is within dirtRadius m; steps around Messes until skirtUntil m from a stop; storms out at
     * stormSpeed m/s after a bad review. */
    inspector: {
      warning: 15,
      stops: [4, 6] as const,
      stopTime: 5,
      escort: 5,
      alone: 15,
      dirtRadius: 4,
      skirtUntil: 1.5,
      stormSpeed: 4.5,
    },
  },
  // base values Upgrades raise
  base: {
    playerSpeed: 5.5,
    stack: 8,
    safe: 3,
    checkoutTime: 2,
    stockerSpeed: 4,
    stockerCarry: 6,
    cleanTime: 2,
  },
};
