// Feel and juice constants. Starting points from the movement prototype (variant B); tuned by play-testing.
export const FEEL = {
  // movement
  accelTime: 0.31,
  stopTime: 0.3,
  turnSpeed: 10,
  /** Touch: joystick force past its ring that sprints. */
  sprintForce: 1.4,
  sprintPuffGap: 0.12,
  walkBob: 0.05,
  // camera
  cameraYawDeg: 45,
  cameraPitchDeg: 41,
  /** Zoom: metres across the screen's short side; defaults per device, slider range, wheel / + − step, ease (1/s). */
  zoomPhone: 14,
  zoomDesktop: 18,
  zoomMin: 10,
  zoomMax: 26,
  zoomSlider: 0.5,
  zoomStep: 0.08,
  zoomEase: 10,
  /** Joystick stays off this long after a pinch (s). */
  pinchQuiet: 0.15,
  followSharpness: 9,
  lookAhead: 0.44,
  // stack
  itemSpacing: 0.435,
  stackForward: 0.55,
  stackBase: 0.9,
  /** Bottom Items that never bend; above them each follows the lean by bendGain × (height above)^bendPower. */
  stackRigid: 2,
  bendPower: 1.3,
  bendGain: 0.9,
  sway: 2.5,
  swayStiffness: 45,
  swayDamping: 16,
  leanMax: 0.8,
  jiggle: 0.02,
  jiggleSpeed: 3,
  flyTime: 0.3,
  flyArc: 1.5,
  // Area Pan
  panGlide: 0.6,
  panHold: 0.8,
  // juice
  floatRise: 1,
  floatLife: 0.8,
  floatMerge: 0.3,
  cashDrainMin: 0.6,
  cashDrainMax: 1,
  cashBillsMax: 20,
  springOvershoot: 1.7,
  stationBounce: 0.12,
  // Producers
  millSpin: 3,
  millIdleSpin: 0.4,
  ovenGlow: 1.5,
  ovenPulse: 0.5,
  ovenGlowIdle: 0.15,
  // Customer receipt card: patience tells at these seconds waiting, Item pop, finished-line fade
  moodTells: [12, 30] as const,
  receiptPop: 0.35,
  receiptDoneAlpha: 0.35,
  // Customer hand baskets: who carries one, size, Items inside, tower spacing, wobble and idle sway
  basketChance: 0.6,
  basketHeight: 0.4,
  basketItemScale: 0.6,
  basketInside: 2,
  basketTowerGap: 0.6,
  basketLean: 2.2,
  basketSway: 0.55,
  basketSwaySpeed: 2.2,
  basketTiltItems: 6,
  basketFade: 1.5,
  // checkout
  beltSpeed: 0.6,
  laneLightIdle: 0.4,
  laneLightScan: 1.6,
  doorOpenRadius: 2.5,
};
