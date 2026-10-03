// Feel and juice constants. Starting points from the movement prototype (variant B); tuned by play-testing.
export const FEEL = {
  // movement
  accelTime: 0.31,
  stopTime: 0.3,
  turnSpeed: 10,
  walkBob: 0.05,
  fullStackSlowdown: 0.25,
  // camera
  cameraYawDeg: 45,
  cameraPitchDeg: 41,
  viewSize: 20,
  followSharpness: 9,
  lookAhead: 0.44,
  // stack
  itemSpacing: 0.31,
  stackForward: 0.55,
  stackBase: 0.9,
  sway: 2,
  swayStiffness: 51,
  swayDamping: 20,
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
  doorOpenRadius: 2.5,
};
