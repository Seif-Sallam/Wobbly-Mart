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
  viewSize: 20,
  followSharpness: 9,
  lookAhead: 0.44,
  // stack
  itemSpacing: 0.31,
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
  doorOpenRadius: 2.5,
};
