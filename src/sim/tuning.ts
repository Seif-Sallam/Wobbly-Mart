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
  messClearRadius: 0.8,
  /** Seconds the Player stands on the Trash Bin before it takes Items. */
  trashHoldTime: 1.5,
  messSlowdown: 0.5,
  messRadius: 0.9,
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
    walkShare: 0.15,
    walkSpeed: 0.5,
    joltBoost: 2,
    cooldown: 1,
    dropBehind: 1.3,
    dropSide: 0.8,
  },
  looseTakeRadius: 0.8,
  /** Stocker job urgency (lower first): empty Shelf with waiting Customers 0, Shelves 1–2, then Producer inputs. */
  urgency: { inputEmpty: 2.5, inputPartial: 3, trayFull: 4, feedsUrgentShelf: 0.5, distanceWeight: 0.01 },
  stockerRethink: 0.5,
  exitPickRadius: 1.2,
  // base values Upgrades raise
  base: {
    playerSpeed: 5.5,
    stack: 8,
    safe: 3,
    checkoutTime: 2,
    stockerSpeed: 4,
    stockerCarry: 6,
  },
};
