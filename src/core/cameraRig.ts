/* ============================================================
   Camera — an orbit rig that follows the bear: drag to swing
   around, scroll or pinch to pull back, shift-drag to shift the
   frame, and pull in when something gets between eye and bear.
   ============================================================ */
import * as THREE from 'three';
import { camera } from './renderer';
import { state } from './save';
import { pointerDelta, look } from './input';
import { character } from '../player/rig';

export const cam = {
  yaw: 0,
  pitch: 0.56,
  dist: 14,
  distGoal: 14,
  /** where the frame has been nudged to by a pan */
  pan: new THREE.Vector3(),
};

const PITCH_MIN = -0.12, PITCH_MAX = 1.25;
const DIST_MIN = 3.6, DIST_MAX = 24;
const DRAG = 0.0055;      // radians per pixel
const KEY_TURN = 1.5;     // radians per second on the arrow keys
const HEAD_HEIGHT = 1.45;

/** what the camera is watching — trees fade against this, the sun tracks it */
export const focus = new THREE.Vector3();
/** the flat direction the camera is looking, and its right — movement is in these */
export const camForward = new THREE.Vector3(0,0,-1);
export const camRight = new THREE.Vector3(1,0,0);

const blockers: THREE.Object3D[] = [];
export function addCameraBlocker(o: THREE.Object3D){ blockers.push(o); }

/* ============================================================
   Tight framing.

   A barn is four metres to the rafters and a loft is half that; the orchard
   frame does not fit in either. These borrow a closer, flatter view for as
   long as the bear is somewhere small, and hand the player's own settings
   back untouched the moment it steps out again.
   ============================================================ */
const INDOOR_DIST = 5.6, INDOOR_PITCH = 0.34;
/** the loft is barely three metres deep and has a metre and a half of headroom:
    stand any further back and the rig is out over the barn floor, looking at
    the bear across the top of a wall */
const LOFT_DIST = 3.9, LOFT_PITCH = 0.22;
const LADDER_DIST = 4.6, LADDER_PITCH = 0.06;
/** climbing, the rig watches the bear's back rather than the top of its hat:
    a ladder indoors has a ceiling over it, and there is no height to spare */
const LADDER_AIM = 0.55;

let indoors = false, upInTheLoft = false, onLadder = false;
/** the barn says when the bear is under its roof, and when it is up in the loft */
export function setIndoors(v: boolean, loft = false){ indoors = v; upInTheLoft = v && loft; }
/** and the controller says when it is on a ladder */
export function setClimbing(v: boolean){ onLadder = v; }

/**
 * Swing round to look at the bear's back as it starts up a ladder. It faces
 * into the rungs, so behind it is the open room — the one direction with
 * anything to see from.
 */
export function frameClimb(ry: number){
  cam.yaw = ry + Math.PI;
  cam.pitch = Math.min(cam.pitch, LADDER_PITCH);
}

const target = new THREE.Vector3();
const desired = new THREE.Vector3();
const rayDir = new THREE.Vector3();
const ray = new THREE.Raycaster();
ray.near = 0.1;

target.copy(character.position); target.y += HEAD_HEIGHT;
focus.copy(target);
camera.position.set(
  target.x + Math.sin(cam.yaw)*Math.cos(cam.pitch)*cam.dist,
  target.y + Math.sin(cam.pitch)*cam.dist,
  target.z + Math.cos(cam.yaw)*Math.cos(cam.pitch)*cam.dist,
);
camera.lookAt(target);

/** point the camera behind the bear again */
export function recenterBehind(){
  cam.yaw = character.rotation.y + Math.PI;
}

export function updateCamera(dt: number){
  const invert = state.settings.invertY ? -1 : 1;

  if(pointerDelta.pan){
    /* shift/middle drag slides the frame; it eases back on its own */
    cam.pan.addScaledVector(camRight, -pointerDelta.x*0.012*cam.dist*0.1);
    cam.pan.y += pointerDelta.y*0.012*cam.dist*0.1;
  } else {
    cam.yaw   -= pointerDelta.x*DRAG;
    cam.pitch += pointerDelta.y*DRAG*invert;
  }
  cam.yaw   -= look.x*KEY_TURN*dt;
  cam.pitch -= look.y*KEY_TURN*0.6*dt*invert;
  cam.pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, cam.pitch));

  cam.distGoal = Math.max(DIST_MIN, Math.min(DIST_MAX, cam.distGoal + pointerDelta.zoom));
  cam.pan.multiplyScalar(Math.pow(0.25, dt));           // always drifting home
  if(cam.pan.lengthSq() > 36) cam.pan.setLength(6);

  /* the point the rig orbits */
  target.copy(character.position);
  target.y += onLadder ? HEAD_HEIGHT*LADDER_AIM : HEAD_HEIGHT;
  target.add(cam.pan);

  /* the frame this instant: the player's own settings, borrowed against
     whatever room the bear is actually standing in */
  let pitch = cam.pitch, goal = cam.distGoal;
  if(onLadder){
    goal = Math.min(goal, LADDER_DIST);
    pitch = Math.min(pitch, LADDER_PITCH);
  } else if(upInTheLoft){
    goal = Math.min(goal, LOFT_DIST);
    pitch = Math.min(pitch, LOFT_PITCH);
  } else if(indoors){
    goal = Math.min(goal, INDOOR_DIST);
    pitch = Math.min(pitch, INDOOR_PITCH);
  }

  /* where we would sit with nothing in the way */
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  desired.set(Math.sin(cam.yaw)*cp, sp, Math.cos(cam.yaw)*cp);

  let dist = goal;
  if(blockers.length){
    rayDir.copy(desired);
    ray.set(target, rayDir);
    ray.far = dist + 0.5;
    const hit = ray.intersectObjects(blockers, true)[0];
    if(hit && hit.distance < dist) dist = Math.max(0.55, hit.distance - 0.40);
  }
  /* pulling in snaps, easing back out is gentle — no lurching in doorways */
  cam.dist = dist < cam.dist ? dist : cam.dist + (dist - cam.dist)*Math.min(1, dt*3);
  /* Nose-to-nose with the bear helps nobody: lift the eye and look over it.
     Only for this frame — writing it back to cam.pitch ratchets the view
     upward every time the bear squeezes past something and never lets go. */
  if(cam.dist < 3.0) pitch = Math.max(pitch, 0.22 + (3.0 - cam.dist)*0.26);

  const cp2 = Math.cos(pitch), sp2 = Math.sin(pitch);
  desired.set(Math.sin(cam.yaw)*cp2, sp2, Math.cos(cam.yaw)*cp2)
    .multiplyScalar(cam.dist).add(target);

  const ease = state.settings.calm ? 0.6 : 1;
  camera.position.lerp(desired, 1 - Math.pow(0.0005, dt*ease));
  camera.lookAt(target);

  focus.copy(character.position);
  focus.y += HEAD_HEIGHT*0.6;

  /* the axes the legs walk along */
  camForward.set(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw)).normalize();
  camRight.crossVectors(camForward, new THREE.Vector3(0,1,0)).normalize();
}
