/* ============================================================
   The bear's legs — walk, run, jump, and the gait that sells it.
   Two ways in: the keys (camera-relative) or a tapped point.
   ============================================================ */
import * as THREE from 'three';
import { state } from '../core/save';
import { on, emit } from '../core/bus';
import { move as moveAxis, held, pressed } from '../core/input';
import { takeTouchJump } from '../ui/touch';
import { camForward, camRight } from '../core/cameraRig';
import type { Apple } from '../world/trees';
import { surfaceAt, resolve } from '../world/collision';
import { barnDoorPoint } from '../world/barn';
import { character, rig, bearRoot } from './rig';
import { startPick, bounce, picking, stretch, canReach } from './picking';
import { antics, standUp } from './antics';
import { updateVigour, pace, spent, tired } from './vigour';

export const WALK_SPEED = 3.1;
export const RUN_SPEED  = 5.0;
const ACCEL = 16, BRAKE = 20;
const GRAVITY = 15, JUMP_V = 5.6;
const BODY_RADIUS = 0.34;
const ARRIVE_EPS = 0.14;

export type Mode = 'ground' | 'air' | 'ladder';

export const player = {
  vel: new THREE.Vector3(),   // horizontal only
  vy: 0,
  grounded: true,
  mode: 'ground' as Mode,
  speed: 0,
};

/* ---- up a ladder ---- */
interface Climb { x: number; z: number; base: number; top: number; ry: number }
let climb: Climb | null = null;
const CLIMB_SPEED = 1.9;

export const climbing = () => climb !== null;
export function startClimb(x: number, z: number, base: number, top: number, ry: number){
  climb = { x, z, base, top, ry };
  stopWalking();
  player.vel.set(0,0,0);
  player.vy = 0;
  player.grounded = false;
  character.position.y = Math.max(character.position.y, base);
}
export function stopClimb(hop = false){
  if(!climb) return;
  climb = null;
  player.vy = hop ? 3.0 : 0;
  player.grounded = false;
}

let moveTarget: THREE.Vector3 | null = null;
let queuedApple: Apple | null = null;
let queuedBarn = false;
let walkT = 0, rungT = 0, squash = 0, hop = 0, hopV = 0;

export function walkTo(p: THREE.Vector3){
  moveTarget = p.clone();
  queuedApple = null; queuedBarn = false;
}
export function walkToApple(a: Apple){
  /* up a ladder there is no walking to be done — reach from where you are */
  if(climb){
    if(canReach(a)) startPick(a);
    return;
  }
  moveTarget = a.standPoint.clone();
  queuedApple = a; queuedBarn = false;
}
export function walkToBarn(){
  moveTarget = barnDoorPoint.clone();
  queuedApple = null; queuedBarn = true;
}
export function stopWalking(){ moveTarget = null; queuedApple = null; queuedBarn = false; }

on('walk:to', ({ point }) => walkTo(point));
on('walk:barn', () => walkToBarn());

const _want = new THREE.Vector3(), _tmp = new THREE.Vector3();

export function updateController(dt: number, time: number){
  const busy = picking() || antics.busy;
  const running = held('run') && !spent();

  if(climb){
    updateClimb(dt);
    animate(dt, time);
    return;
  }

  /* ---- what the bear is being asked to do ---- */
  _want.set(0,0,0);
  if(moveAxis.lengthSq() > 0.0004 || (moveTarget && antics.sitting)) standUp();
  if(!busy && !antics.sitting && moveAxis.lengthSq() > 0.0004){
    stopWalking();
    _want.copy(camForward).multiplyScalar(moveAxis.y)
         .addScaledVector(camRight, moveAxis.x);
    if(_want.lengthSq() > 1) _want.normalize();
    _want.multiplyScalar((running ? RUN_SPEED : WALK_SPEED) * pace());
  } else if(moveTarget && !busy && !antics.sitting){
    _tmp.subVectors(moveTarget, character.position); _tmp.y = 0;
    const dist = _tmp.length();
    if(dist > ARRIVE_EPS){
      _want.copy(_tmp).divideScalar(dist).multiplyScalar(Math.min(WALK_SPEED*pace(), dist*4));
    } else {
      character.position.x = moveTarget.x;
      character.position.z = moveTarget.z;
      moveTarget = null;
      player.vel.set(0,0,0);
      if(queuedApple && !queuedApple.picked){ startPick(queuedApple); queuedApple = null; }
      if(queuedBarn){ queuedBarn = false; emit('arrive:barn'); }
    }
  }

  /* ---- accelerate toward it ---- */
  const rate = _want.lengthSq() > 0 ? ACCEL : BRAKE;
  player.vel.x += (_want.x - player.vel.x) * Math.min(1, rate*dt);
  player.vel.z += (_want.z - player.vel.z) * Math.min(1, rate*dt);
  if(player.vel.lengthSq() < 0.0004) player.vel.set(0,0,0);
  player.speed = player.vel.length();

  character.position.x += player.vel.x*dt;
  character.position.z += player.vel.z*dt;
  resolve(character.position, BODY_RADIUS);

  /* ---- up and down ---- */
  if((pressed('jump') || takeTouchJump()) && antics.sitting){ standUp(); }
  else if((pressed('jump') || takeTouchJump()) && player.grounded && !busy){
    player.vy = JUMP_V;
    player.grounded = false;
    squash = -0.7;                                   // a stretch off the ground
  }
  player.vy -= GRAVITY*dt;
  character.position.y += player.vy*dt;

  const floor = surfaceAt(character.position.x, character.position.z, character.position.y);
  if(character.position.y <= floor){
    if(!player.grounded && player.vy < -3.5) squash = Math.min(1, -player.vy/9);
    character.position.y = floor;
    player.vy = 0;
    player.grounded = true;
  } else if(character.position.y > floor + 0.06){
    player.grounded = false;
  }
  player.mode = player.grounded ? 'ground' : 'air';
  updateVigour(dt, player.speed, player.mode, running);

  /* ---- which way it is looking ---- */
  if(!busy && player.speed > 0.15){
    const ang = Math.atan2(player.vel.x, player.vel.z);
    let d = ang - character.rotation.y;
    while(d > Math.PI) d -= Math.PI*2;
    while(d < -Math.PI) d += Math.PI*2;
    character.rotation.y += d * Math.min(1, dt*11);
  }

  animate(dt, time);
}

function updateClimb(dt: number){
  const c = climb!;
  const p = character.position;

  p.y += moveAxis.y*CLIMB_SPEED*dt;
  if(p.y > c.top){ p.y = c.top; }
  if(p.y <= c.base + 0.02 && moveAxis.y < 0){
    p.y = c.base;
    stopClimb();
    return;
  }
  if(pressed('jump')){ stopClimb(true); return; }

  p.x += (c.x - p.x)*Math.min(1, dt*8);
  p.z += (c.z - p.z)*Math.min(1, dt*8);

  let d = c.ry - character.rotation.y;
  while(d > Math.PI) d -= Math.PI*2;
  while(d < -Math.PI) d += Math.PI*2;
  character.rotation.y += d*Math.min(1, dt*8);

  player.mode = 'ladder';
  player.speed = Math.abs(moveAxis.y)*CLIMB_SPEED;
  player.vel.set(0,0,0);
}

/* ============================================================
   Pose
   ============================================================ */
const lerp = (a: number, b: number, p: number) => a + (b-a)*p;

function animate(dt: number, time: number){
  const gaitAmt = Math.min(1.25, player.speed / WALK_SPEED);
  const pushing = state.carried.includes('barrow');
  const droop = tired() ? 1 - Math.max(0, (state.vigour - 0)/0.36) : 0;

  if(climb){
    /* hand over hand, one rung at a time */
    rungT += player.speed*dt*2.6;
    const s = Math.sin(rungT);
    rig.armR.rotation.x = -2.1 + s*0.5;
    rig.armL.rotation.x = -2.1 - s*0.5;
    ease(rig.legL, 'x', -0.5 + s*0.35, dt*10);
    ease(rig.legR, 'x', -0.5 - s*0.35, dt*10);
    rig.torso.rotation.z *= 0.9;
    rig.head.rotation.x += (0.18 - rig.head.rotation.x)*Math.min(1, dt*6);
    rig.basket.rotation.z += (0.05 - rig.basket.rotation.z)*Math.min(1, dt*6);
    bearRoot.position.y = 0;
    bearRoot.scale.set(1,1,1);
    return;
  }

  if(!player.grounded){
    /* tucked in the air, arms lifted */
    const rise = Math.max(-1, Math.min(1, player.vy/4));
    ease(rig.legL, 'x', -0.55 - rise*0.25, dt*12);
    ease(rig.legR, 'x', -0.30 + rise*0.20, dt*12);
    rig.armR.rotation.x += (-1.5 - rise*0.5 - rig.armR.rotation.x)*Math.min(1, dt*10);
    rig.armL.rotation.x += (-1.1 - rig.armL.rotation.x)*Math.min(1, dt*10);
    rig.torso.rotation.z *= 0.9;
    rig.head.rotation.x += (-0.10*rise - rig.head.rotation.x)*Math.min(1, dt*8);
    rig.hat.rotation.z += (0.12 - rig.hat.rotation.z)*Math.min(1, dt*6);
    rig.basket.rotation.z += (0.30 - rig.basket.rotation.z)*Math.min(1, dt*6);
  }
  else if(gaitAmt > 0.05){
    walkT += dt*10*Math.max(0.55, gaitAmt);
    const s = Math.sin(walkT), c = Math.cos(walkT*2);
    rig.legL.rotation.x =  s*0.75*gaitAmt;
    rig.legR.rotation.x = -s*0.75*gaitAmt;
    rig.armR.rotation.x = -s*0.6*gaitAmt;
    rig.armL.rotation.x = -0.30 + s*0.08*gaitAmt;
    rig.torso.position.y = 0.52 + Math.abs(c)*0.022*gaitAmt;
    rig.torso.rotation.z = s*0.035*gaitAmt;
    rig.head.rotation.z = -s*0.05*gaitAmt;
    rig.head.rotation.x = 0.04;
    rig.hat.rotation.z = -s*0.07*gaitAmt;
    rig.basket.rotation.z = 0.16 + s*0.07*gaitAmt;
  }
  else {
    const b = Math.sin(time*1.7)*0.5+0.5;
    ease(rig.legL, 'x', 0, dt*8);
    ease(rig.legR, 'x', 0, dt*8);
    rig.armL.rotation.x += (-0.30 - rig.armL.rotation.x)*Math.min(1,dt*8);
    rig.torso.position.y = 0.52 + b*0.012;
    rig.torso.rotation.z *= 0.9;
    rig.head.rotation.z *= 0.9;
    rig.head.rotation.x = 0.02 + Math.sin(time*1.1)*0.03;
    rig.hat.rotation.z *= 0.9;
    rig.basket.rotation.z += (0.16 - rig.basket.rotation.z)*Math.min(1,dt*6);
  }

  /* both paws on the handles while the barrow is out in front */
  if(pushing && !climb && player.grounded){
    const k = Math.min(1, dt*9);
    ease(rig.armR, 'x', -1.02 + Math.sin(walkT)*0.05*gaitAmt, k);
    ease(rig.armL, 'x', -1.02 - Math.sin(walkT)*0.05*gaitAmt, k);
    ease(rig.armR, 'z', -0.16, k);
    ease(rig.armL, 'z',  0.16, k);
    rig.torso.rotation.x += (0.12 - rig.torso.rotation.x)*k;
  }

  /* the paw closes on the pole instead of swinging through it */
  if(state.equipped === 'picker' && !picking() && !climb){
    const k = Math.min(1, dt*8);
    ease(rig.armR, 'x', -0.15 + Math.sin(walkT)*0.10*gaitAmt, k);
    ease(rig.armR, 'z', 0.32, k);
  }

  /* a tired bear stoops, and its head goes down */
  if(droop > 0.02 && !climb){
    rig.head.rotation.x += (0.22*droop - rig.head.rotation.x)*Math.min(1, dt*4);
    rig.torso.rotation.x += (0.10*droop - rig.torso.rotation.x)*Math.min(1, dt*3);
  }

  /* sitting down in the grass */
  const sit = antics.sit;
  if(sit > 0.002){
    rig.legL.rotation.x = lerp(rig.legL.rotation.x, -1.34, sit);
    rig.legR.rotation.x = lerp(rig.legR.rotation.x, -1.28, sit);
    rig.legL.rotation.z = lerp(rig.legL.rotation.z, -0.14, sit);
    rig.legR.rotation.z = lerp(rig.legR.rotation.z,  0.14, sit);
    rig.torso.rotation.x = lerp(rig.torso.rotation.x, 0.16, sit);
    rig.torso.rotation.z = lerp(rig.torso.rotation.z, 0, sit);
    rig.torso.position.y = lerp(rig.torso.position.y, 0.50 + Math.sin(time*1.4)*0.008, sit);
    rig.armR.rotation.x = lerp(rig.armR.rotation.x, -0.62, sit);
    rig.armL.rotation.x = lerp(rig.armL.rotation.x, -0.58, sit);
    rig.armR.rotation.z = lerp(rig.armR.rotation.z, -0.22, sit);
    rig.armL.rotation.z = lerp(rig.armL.rotation.z, -0.10, sit);
    rig.head.rotation.x = lerp(rig.head.rotation.x, -0.06, sit);
    rig.hat.rotation.z = lerp(rig.hat.rotation.z, 0.10, sit);
    rig.basket.rotation.z = lerp(rig.basket.rotation.z, 0.30, sit);
  }

  /* the bounce the reach animation asks for, and the landing squash */
  if(bounce.v){ hopV = bounce.v; bounce.v = 0; }
  hopV -= 9.5*dt; hop = Math.max(0, hop + hopV*dt);
  if(hop <= 0) hopV = Math.max(hopV, 0);
  bearRoot.position.y = hop*0.14 + stretch.y - 0.26*antics.sit;

  squash += (0 - squash)*Math.min(1, dt*9);
  const sy = 1 - squash*0.30, sxz = 1 + squash*0.18;
  bearRoot.scale.set(sxz, sy, sxz);
}

function ease(o: THREE.Object3D, axis: 'x'|'y'|'z', to: number, k: number){
  o.rotation[axis] += (to - o.rotation[axis]) * Math.min(1, k);
}
