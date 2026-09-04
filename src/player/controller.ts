/* ============================================================
   The bear's legs — walking to a tapped point, and the gait
   ============================================================ */
import * as THREE from 'three';
import { FX1, FX2, FZ1, FZ2 } from '../core/config';
import { state } from '../core/save';
import { on, emit } from '../core/bus';
import { trees } from '../world/trees';
import type { Apple } from '../world/trees';
import { groundHeightAt } from '../world/ground';
import { barnDoorPoint } from '../world/barn';
import { character, rig, bearRoot } from './rig';
import { startPick, bounce } from './picking';

export const WALK_SPEED = 3.1;
const ARRIVE_EPS = 0.14;

let moveTarget: THREE.Vector3 | null = null;
let queuedApple: Apple | null = null;
let queuedBarn = false;
let walkT = 0, hop = 0, hopV = 0;

export function walkTo(p: THREE.Vector3){
  moveTarget = p.clone();
  queuedApple = null; queuedBarn = false;
}
export function walkToApple(a: Apple){
  moveTarget = a.standPoint.clone();
  queuedApple = a; queuedBarn = false;
}
export function walkToBarn(){
  moveTarget = barnDoorPoint.clone();
  queuedApple = null; queuedBarn = true;
}

on('walk:to', ({ point }) => walkTo(point));
on('walk:barn', () => walkToBarn());

/** keep the bear from strolling through trunks, or out of the field */
function avoidTrunks(p: THREE.Vector3){
  for(const t of trees){
    const dx = p.x - t.position.x, dz = p.z - t.position.z;
    const d = Math.hypot(dx, dz);
    if(d < 0.85 && d > 1e-4){
      p.x = t.position.x + dx/d*0.85;
      p.z = t.position.z + dz/d*0.85;
    }
  }
  p.x = Math.max(FX1+1.2, Math.min(FX2-1.2, p.x));
  p.z = Math.max(FZ1+1.2, Math.min(FZ2-1.2, p.z));
}

const _tmp = new THREE.Vector3();

export function updateController(dt: number, time: number){
  let walking = false;

  if(moveTarget){
    _tmp.subVectors(moveTarget, character.position); _tmp.y = 0;
    const dist = _tmp.length();
    if(dist > ARRIVE_EPS){
      walking = true;
      _tmp.normalize();
      character.position.addScaledVector(_tmp, WALK_SPEED*dt);
      avoidTrunks(character.position);
      character.position.y = groundHeightAt(character.position.x, character.position.z);
      const ang = Math.atan2(_tmp.x, _tmp.z);
      let d = ang - character.rotation.y;
      while(d > Math.PI) d -= Math.PI*2;
      while(d < -Math.PI) d += Math.PI*2;
      character.rotation.y += d * Math.min(1, dt*9);
      walkT += dt*10;
    } else {
      character.position.x = moveTarget.x; character.position.z = moveTarget.z;
      character.position.y = groundHeightAt(moveTarget.x, moveTarget.z);
      moveTarget = null;
      if(queuedApple && !queuedApple.picked){ startPick(queuedApple); queuedApple = null; }
      if(queuedBarn){ queuedBarn = false; emit('arrive:barn'); }
    }
  }

  /* --- gait --- */
  if(walking){
    const s = Math.sin(walkT), c = Math.cos(walkT*2);
    rig.legL.rotation.x =  s*0.75;
    rig.legR.rotation.x = -s*0.75;
    rig.armR.rotation.x = -s*0.6;
    rig.armL.rotation.x = -0.30 + s*0.08;
    rig.torso.position.y = 0.52 + Math.abs(c)*0.022;
    rig.torso.rotation.z = s*0.035;
    rig.head.rotation.z = -s*0.05;
    rig.head.rotation.x = 0.04;
    rig.hat.rotation.z = -s*0.07;
    rig.basket.rotation.z = 0.16 + s*0.07;
  } else {
    const b = Math.sin(time*1.7)*0.5+0.5;
    rig.legL.rotation.x += (0 - rig.legL.rotation.x)*Math.min(1,dt*8);
    rig.legR.rotation.x += (0 - rig.legR.rotation.x)*Math.min(1,dt*8);
    rig.armL.rotation.x += (-0.30 - rig.armL.rotation.x)*Math.min(1,dt*8);
    rig.torso.position.y = 0.52 + b*0.012;
    rig.torso.rotation.z *= 0.9;
    rig.head.rotation.z *= 0.9;
    rig.head.rotation.x = 0.02 + Math.sin(time*1.1)*0.03;
    rig.hat.rotation.z *= 0.9;
    rig.basket.rotation.z += (0.16 - rig.basket.rotation.z)*Math.min(1,dt*6);
  }

  /* the little bounce the reach animation asks for */
  if(bounce.v){ hopV = bounce.v; bounce.v = 0; }
  hopV -= 9.5*dt; hop = Math.max(0, hop + hopV*dt);
  if(hop <= 0) hopV = Math.max(hopV, 0);
  bearRoot.position.y = hop*0.14;

  void state;
}
