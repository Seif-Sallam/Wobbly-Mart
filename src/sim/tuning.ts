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
  messSlowdown: 0.5,
  messRadius: 0.9,
  playerCheckoutTime: 1.5,
  customerSpeed: 2.6,
  customerTakeTime: 0.6,
  arrivalInterval: 1.5,
  capBase: 2,
  capCashierFactor: 1.3,
  listMaxProducts: 4,
  listMaxUnits: 4,
  patienceAngry: 20,
  patienceLeave: 10,
  queueGap: 0.8,
  queueFirstOffset: 0.6,
  shelfSpotOffset: 0.7,
  shelfSpotGap: 0.9,
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
  /** Stocker job urgency (lower first): empty Shelf with waiting Customers 0, Shelves 1–2, then Producer inputs. */
  urgency: { inputEmpty: 2.5, inputPartial: 3, trayFull: 4, feedsUrgentShelf: 0.5, distanceWeight: 0.01 },
  stockerRethink: 0.5,
  exitPickRadius: 1.2,
  // base values Upgrades raise
  base: {
    playerSpeed: 5.5,
    stack: 16,
    shelfCap: 8,
    checkoutTime: 2,
    stockerSpeed: 4,
    stockerCarry: 6,
  },
};
