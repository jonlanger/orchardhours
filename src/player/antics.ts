/* ============================================================
   What a bear does between trees — sitting down for a minute,
   eating one of its own apples, and hurling one down the alley.
   ============================================================ */
import * as THREE from 'three';
import { TYPE_KEYS, BASKET_CAPACITY, VIG_APPLE, VIG_SIT, VIG_THROW, THROW_SPEED,
         bounds } from '../core/config';
import type { AppleType } from '../core/config';
import { state, save, basketTotal } from '../core/save';
import { pressed } from '../core/input';
import { scene } from '../core/renderer';
import { buildApple, APPLE_SCALE } from '../world/geometry';
import { groundHeightAt } from '../world/ground';
import { character, rig } from './rig';
import { addInteractable } from './interact';
import { drain, refill, vigour, tirednessNote } from './vigour';
import { picking, updateBasketFruit } from './picking';
import { toast, renderBasket } from '../ui/hud';

/* ============================================================
   State the rest of the bear reads
   ============================================================ */
export const antics = {
  /** the bear has sat down; the legs are out of the argument */
  sitting: false,
  /** 0..1, how far into the sit it is — the controller poses from this */
  sit: 0,
  /** mid-bite or mid-throw: hold still */
  busy: false,
};

type Act =
  | { kind:'eat'; t:number; phase:'take'|'bite'|'after'; bites:number; apple:THREE.Group; type:AppleType }
  | { kind:'throw'; t:number; phase:'wind'|'release'|'after'; apple:THREE.Group|null; type:AppleType };

let act: Act | null = null;

/* ============================================================
   Taking one out of the basket
   ============================================================ */
/** whichever variety there is most of — a bear saves the russets for the barrel */
function pickFromBasket(keepRare = true): AppleType | null {
  let best: AppleType | null = null;
  for(const k of TYPE_KEYS){
    if(!state.basket[k]) continue;
    if(keepRare && k === 'rare') continue;
    if(!best || state.basket[k] > state.basket[best]) best = k;
  }
  if(best) return best;
  return TYPE_KEYS.find(k => state.basket[k] > 0) ?? null;
}
function takeFromBasket(type: AppleType){
  state.basket[type]--;
  renderBasket();
  updateBasketFruit();
  save();
}

function inPaw(type: AppleType){
  const g = buildApple(type);
  g.position.set(0.01, -0.07, 0.06);
  g.scale.setScalar(APPLE_SCALE*0.90);
  rig.handR.add(g);
  return g;
}
/** an apple on its way out of the basket, still in world space */
function loose(type: AppleType){
  const g = buildApple(type);
  rig.basket.getWorldPosition(_wp);
  g.position.copy(_wp);
  g.scale.setScalar(APPLE_SCALE*0.86);
  scene.add(g);
  return g;
}

/* ============================================================
   Sitting
   ============================================================ */
export function sitDown(){
  if(antics.sitting) return;
  antics.sitting = true;
  toast('Pom sits down in the grass. It gets its wind back faster like this.');
}
export function standUp(){
  if(!antics.sitting) return;
  antics.sitting = false;
}
export function toggleSit(){ antics.sitting ? standUp() : sitDown(); }

/* ============================================================
   Eating
   ============================================================ */
export function eat(){
  if(act || picking()) return;
  if(vigour() > 0.985){ toast('Pom is not hungry yet.'); return; }
  const type = pickFromBasket();
  if(!type){ toast('Nothing in the basket to eat. Pick one first.'); return; }
  takeFromBasket(type);
  act = { kind:'eat', t:0, phase:'take', bites:0, apple:loose(type), type };
  antics.busy = true;
}

/* ============================================================
   Throwing
   ============================================================ */
export function hurl(){
  if(act || picking()) return;
  const type = pickFromBasket(false);
  if(!type){ toast('Nothing in the basket to throw.'); return; }
  takeFromBasket(type);
  act = { kind:'throw', t:0, phase:'wind', apple:inPaw(type), type };
  antics.busy = true;
}

/* ---- apples loose on the grass ---- */
interface Fall {
  g: THREE.Group; type: AppleType;
  v: THREE.Vector3; spin: THREE.Vector3;
  rest: boolean;
}
const falls: Fall[] = [];
const MAX_FALLS = 14;
const GRAV = 17;

const _wp = new THREE.Vector3(), _mp = new THREE.Vector3();

function release(type: AppleType, from: THREE.Vector3){
  const g = buildApple(type);
  g.position.copy(from);
  scene.add(g);
  const face = character.rotation.y;
  const speed = THROW_SPEED * (0.75 + vigour()*0.25);
  const f = {
    g, type, rest:false,
    v: new THREE.Vector3(Math.sin(face)*speed*0.86, speed*0.46, Math.cos(face)*speed*0.86),
    spin: new THREE.Vector3(6 + Math.random()*5, Math.random()*4, 3 + Math.random()*4),
  };
  falls.push(f);
  while(falls.length > MAX_FALLS){
    const old = falls.shift()!;
    scene.remove(old.g);
  }
}

function updateFalls(dt: number){
  for(const f of falls){
    if(f.rest) continue;
    f.v.y -= GRAV*dt;
    f.g.position.addScaledVector(f.v, dt);
    f.g.rotation.x += f.spin.x*dt;
    f.g.rotation.y += f.spin.y*dt;
    f.g.rotation.z += f.spin.z*dt;

    /* the fence turns one back rather than letting it sail off the farm */
    const p = f.g.position;
    if(p.x < bounds.x1 || p.x > bounds.x2){ p.x = Math.min(bounds.x2, Math.max(bounds.x1, p.x)); f.v.x *= -0.35; }
    if(p.z < bounds.z1 || p.z > bounds.z2){ p.z = Math.min(bounds.z2, Math.max(bounds.z1, p.z)); f.v.z *= -0.35; }

    const floor = groundHeightAt(p.x, p.z) + APPLE_SCALE*0.72;
    if(p.y <= floor){
      p.y = floor;
      f.v.y = -f.v.y*0.38;
      f.v.x *= 0.62; f.v.z *= 0.62;
      f.spin.multiplyScalar(0.5);
      if(f.v.lengthSq() < 0.5){
        f.rest = true;
        f.v.set(0,0,0);
        f.g.rotation.set(Math.random()*3, Math.random()*3, 1.3);
      }
    }
  }
}

/** the nearest apple lying in the grass, for the pick-it-up prompt */
let handy: Fall | null = null;
const _at = new THREE.Vector3();

function gatherPoint(){
  return handy ? _at.copy(handy.g.position) : character.position;
}

addInteractable({
  id:'windfall',
  at: gatherPoint,
  range: 1.5,
  anyAngle: true,
  label: () => handy ? 'Pick it up out of the grass' : null,
  use: () => {
    const f = handy;
    if(!f) return;
    if(basketTotal() >= BASKET_CAPACITY){ toast('The basket will not hold another.'); return; }
    state.basket[f.type]++;
    scene.remove(f.g);
    falls.splice(falls.indexOf(f), 1);
    handy = null;
    renderBasket(f.type);
    updateBasketFruit();
    save();
  },
});

/* ============================================================
   The frame
   ============================================================ */
const lerp = (a: number, b: number, p: number) => a + (b-a)*p;
const ease = (p: number) => 1 - Math.pow(1-p, 3);

const BITES = 3;

export function updateAntics(dt: number){
  if(pressed('sit') && !picking()) toggleSit();
  if(pressed('eat')) eat();
  if(pressed('throw')) hurl();

  antics.sit += ((antics.sitting ? 1 : 0) - antics.sit) * Math.min(1, dt*7);

  /* a sitting bear gets its wind back */
  if(antics.sitting) refill(VIG_SIT*dt);

  /* and it says so the first time it notices it is flagging */
  const note = tirednessNote();
  if(note) toast(note);

  updateFalls(dt);

  /* whichever loose apple is closest to hand */
  handy = null;
  let bestD = 1.5;
  for(const f of falls){
    if(!f.rest) continue;
    const d = Math.hypot(f.g.position.x - character.position.x, f.g.position.z - character.position.z);
    if(d < bestD){ bestD = d; handy = f; }
  }

  if(!act) return;
  act.t += dt;

  if(act.kind === 'eat'){
    if(act.phase === 'take'){
      /* up out of the basket and in to the snout */
      const p = Math.min(act.t/0.40, 1), e = ease(p);
      rig.armR.rotation.x = lerp(-0.20, -2.32, e);
      rig.armR.rotation.z = lerp(0, 0.42, e);
      rig.head.rotation.x = lerp(0, 0.12, e);
      rig.mouth.getWorldPosition(_mp);
      _mp.y += 0.02;
      rig.basket.getWorldPosition(_wp);
      act.apple.position.copy(_wp).lerp(_mp, e);
      act.apple.position.y += Math.sin(p*Math.PI)*0.10;
      act.apple.rotation.y += dt*3;
      if(p >= 1){
        act.phase = 'bite'; act.t = 0;
        /* from here it rides at the snout, so every bite lands in the mouth */
        rig.mouth.add(act.apple);
        act.apple.position.set(0.075, 0.005, 0.055);
        act.apple.rotation.set(0.2, 0.4, -0.25);
      }
    }
    else if(act.phase === 'bite'){
      const p = Math.min(act.t/0.52, 1);
      /* in to the snout, a bite, then a chew */
      const lean = Math.sin(Math.min(1, p/0.5)*Math.PI)*0.10;
      rig.armR.rotation.x = -2.32 - lean;
      rig.armR.rotation.z = 0.42;
      rig.head.rotation.x = 0.12 + lean*1.2 + (p > 0.45 ? Math.sin(p*46)*0.035 : 0);
      rig.hat.rotation.z = Math.sin(p*30)*0.02;
      if(p >= 1){
        act.bites++;
        act.apple.scale.multiplyScalar(0.62);
        act.apple.rotation.z += 0.7;
        act.t = 0;
        if(act.bites >= BITES){
          act.phase = 'after';
          act.apple.parent?.remove(act.apple);
          refill(VIG_APPLE);
          save();
          toast('One less to carry, and a good deal more life in the legs.');
        }
      }
    }
    else {
      const p = Math.min(act.t/0.34, 1), e = ease(p);
      rig.armR.rotation.x = lerp(-2.32, -0.20, e);
      rig.armR.rotation.z = lerp(0.42, 0, e);
      rig.head.rotation.x = lerp(0.12, 0, e);
      if(p >= 1){ act = null; antics.busy = false; }
    }
    return;
  }

  /* ---- the throw ---- */
  if(act.phase === 'wind'){
    const p = Math.min(act.t/0.34, 1), e = ease(p);
    rig.armR.rotation.x = lerp(-0.20, 0.95, e);        // back behind the shoulder
    rig.armR.rotation.z = lerp(0, -0.20, e);
    rig.torso.rotation.y = lerp(0, -0.26, e);
    rig.head.rotation.x = lerp(0, -0.16, e);
    if(p >= 1){ act.phase = 'release'; act.t = 0; }
  }
  else if(act.phase === 'release'){
    const p = Math.min(act.t/0.16, 1), e = ease(p);
    rig.armR.rotation.x = lerp(0.95, -2.05, e);
    rig.torso.rotation.y = lerp(-0.26, 0.20, e);
    if(p >= 0.62 && act.apple){
      act.apple.getWorldPosition(_wp);
      act.apple.parent?.remove(act.apple);
      act.apple = null;
      release(act.type, _wp);
    }
    if(p >= 1){ act.phase = 'after'; act.t = 0; drain(VIG_THROW); }
  }
  else {
    const p = Math.min(act.t/0.36, 1), e = ease(p);
    rig.armR.rotation.x = lerp(-2.05, -0.20, e);
    rig.armR.rotation.z = lerp(-0.20, 0, e);
    rig.torso.rotation.y = lerp(0.20, 0, e);
    rig.head.rotation.x = lerp(-0.16, 0, e);
    if(p >= 1){ act = null; antics.busy = false; rig.torso.rotation.y = 0; }
  }
}

/** everything loose on the grass, cleared when the season restarts */
export function clearFalls(){
  for(const f of falls) scene.remove(f.g);
  falls.length = 0;
  handy = null;
}
