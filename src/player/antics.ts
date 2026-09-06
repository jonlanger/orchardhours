/* ============================================================
   What a bear does between trees — sitting down for a minute,
   eating one of its own apples, and hurling one down the alley.
   ============================================================ */
import * as THREE from 'three';
import { TYPE_KEYS, SACK_CAPACITY, VIG_APPLE, VIG_SIT, VIG_THROW,
         THROW_SPEED, BARN_X, BARN_Z, bounds } from '../core/config';
import type { AppleType } from '../core/config';
import { state, save } from '../core/save';
import { on } from '../core/bus';
import { pressed } from '../core/input';
import { scene } from '../core/renderer';
import { buildApple, APPLE_SCALE } from '../world/geometry';
import { groundHeightAt } from '../world/ground';
import { blocked } from '../world/collision';
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
  | { kind:'throw'; t:number; phase:'wind'|'release'|'after'; apple:THREE.Group|null; type:AppleType }
  | { kind:'gather'; t:number; phase:'stoop'|'rise'; apple:THREE.Group; from:THREE.Vector3 };

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

/* ============================================================
   Apples loose on the grass.

   Everything down here is a windfall: thrown, or fallen off a branch it hung
   on too long. Either way it has taken a knock, so it never goes back in the
   basket — it goes into the sack, and from there into the compost barrel.
   ============================================================ */
interface Fall {
  g: THREE.Group; type: AppleType;
  v: THREE.Vector3; spin: THREE.Vector3;
  rest: boolean;
}
const falls: Fall[] = [];
const MAX_FALLS = 40;
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
  trimFalls();
}

/** the oldest go back into the grass, so the row never fills up with fruit */
function trimFalls(){
  while(falls.length > MAX_FALLS){
    const old = falls.shift()!;
    scene.remove(old.g);
    if(old === handy) handy = null;
  }
}

/* ---- what is already lying in the lanes when the season opens ----
   Fruit went over long before the bear got here. These are real windfalls,
   not scenery: gather them, and the compost barrel has something in it on
   the first morning. */
{
  for(let i=0;i<16;i++){
    const x = (Math.random()-0.5)*48, z = (Math.random()-0.5)*52 + 4;
    if(Math.hypot(x - BARN_X, z - BARN_Z) < 8) continue;
    /* not inside a trunk or a fence post — the bear has to be able to reach it */
    if(blocked(x, z, groundHeightAt(x, z), 0.5)) continue;
    const type = TYPE_KEYS[Math.floor(Math.random()*3)]!;
    const g = buildApple(type);
    g.position.set(x, groundHeightAt(x, z) + APPLE_SCALE*0.72, z);
    g.rotation.set(Math.random()*3, Math.random()*3, 1.3);
    scene.add(g);
    falls.push({ g, type, rest:true, v:new THREE.Vector3(), spin:new THREE.Vector3() });
  }
}

/* ---- an apple that hung on past its best, letting go of the spur ---- */
let saidWhyFallen = false;

on('apple:fell', ({ type, at }) => {
  const g = buildApple(type);
  g.position.copy(at);
  scene.add(g);
  falls.push({
    g, type, rest:false,
    v: new THREE.Vector3((Math.random()-0.5)*0.7, 0, (Math.random()-0.5)*0.7),
    spin: new THREE.Vector3(2 + Math.random()*3, Math.random()*3, 2 + Math.random()*3),
  });
  trimFalls();

  if(!saidWhyFallen){
    saidWhyFallen = true;
    toast('One went over — it hung on past its best. Anything off the ground is bruised.');
  }
});

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

/* ============================================================
   Gathering one up.

   Two ways in, exactly like the fruit on the trees: press E next to one, or
   tap it and let the bear walk over. Both land here.
   ============================================================ */

/** the nearest apple lying in the grass, for the pick-it-up prompt */
let handy: Fall | null = null;
const _at = new THREE.Vector3();

function gatherPoint(){
  return handy ? _at.copy(handy.g.position) : character.position;
}

/** every windfall lying about, so a tap can be tested against them */
export const windfallGroups = () => falls.map(f => f.g);

/** which windfall a tapped mesh belongs to, if any */
export function windfallOwner(obj: THREE.Object3D | null): Fall | null {
  let o = obj;
  while(o){
    const f = falls.find(x => x.g === o);
    if(f) return f;
    o = o.parent;
  }
  return null;
}

/**
 * The windfall nearest a point on the grass. An apple lying twenty metres off
 * is a few pixels across, so a tap that lands on the ground beside one is
 * taken to mean that one — otherwise the bear walks over and stands there
 * looking at it, which is what everybody tries first.
 */
export function windfallNear(p: THREE.Vector3, within: number){
  let best: Fall | null = null, bestD = within;
  for(const f of falls){
    const d = Math.hypot(f.g.position.x - p.x, f.g.position.z - p.z);
    if(d < bestD){ bestD = d; best = f; }
  }
  return best;
}

/** where the bear puts its feet to stoop over one — beside it, not on it */
export function windfallStand(f: Fall, out: THREE.Vector3){
  const p = f.g.position;
  const dx = character.position.x - p.x, dz = character.position.z - p.z;
  const d = Math.hypot(dx, dz) || 1;
  return out.set(p.x + dx/d*0.62, groundHeightAt(p.x, p.z), p.z + dz/d*0.62);
}

/** why one cannot be gathered just now, or null when it can */
export function whyNotGather(){
  if(state.bruised >= SACK_CAPACITY)
    return 'The windfall sack is full. Tip it into the compost barrel in the barn.';
  return null;
}

/** said once, in full, the first time a windfall is gathered */
let saidWhatWindfallsAreFor = false;

/** stoop, take it out of the grass, and drop it in the sack */
export function gather(f: Fall){
  if(act || picking()) return false;
  const why = whyNotGather();
  if(why){ toast(why); return false; }
  const n = falls.indexOf(f);
  if(n < 0) return false;

  /* the fruit comes off the grass and into the paw; the Fall itself is done */
  falls.splice(n, 1);
  if(handy === f) handy = null;
  scene.remove(f.g);

  const apple = buildApple(f.type);
  apple.position.copy(f.g.position);
  apple.rotation.copy(f.g.rotation);
  apple.scale.setScalar(APPLE_SCALE);
  scene.add(apple);

  /* square up to it before stooping */
  character.rotation.y = Math.atan2(
    f.g.position.x - character.position.x, f.g.position.z - character.position.z);

  act = { kind:'gather', t:0, phase:'stoop', apple, from:f.g.position.clone() };
  antics.busy = true;
  return true;
}

/** the one under the bear's nose, for the E key and the touch button */
export const handyWindfall = () => handy;

addInteractable({
  id:'windfall',
  at: gatherPoint,
  range: 1.8,
  anyAngle: true,
  label: () => handy ? 'Gather the windfall' : null,
  use: () => { if(handy) gather(handy); },
});

/** what to say once it is in the sack */
function saidGathered(){
  if(!saidWhatWindfallsAreFor){
    saidWhatWindfallsAreFor = true;
    toast('Bruised where it landed — the merchant will not take it and the barrels will not keep it. There is a compost barrel in the barn.');
  } else {
    toast(`Another for the compost — ${state.bruised} in the sack.`);
  }
}

/* ============================================================
   The frame
   ============================================================ */
const lerp = (a: number, b: number, p: number) => a + (b-a)*p;
const ease = (p: number) => 1 - Math.pow(1-p, 3);
const easeIO = (p: number) => p < 0.5 ? 4*p*p*p : 1 - Math.pow(-2*p+2, 3)/2;

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
  let bestD = 1.8;
  for(const f of falls){
    if(!f.rest) continue;
    const d = Math.hypot(f.g.position.x - character.position.x, f.g.position.z - character.position.z);
    if(d < bestD){ bestD = d; handy = f; }
  }

  if(!act) return;
  act.t += dt;

  /* ---- stooping for one in the grass ---- */
  if(act.kind === 'gather'){
    if(act.phase === 'stoop'){
      /* down onto the haunches, paw out, and the apple comes up into it */
      const p = Math.min(act.t/0.46, 1), e = easeIO(p);
      rig.torso.rotation.x = lerp(0, 0.62, e);
      rig.torso.position.y = lerp(0.52, 0.40, e);
      rig.armR.rotation.x = lerp(-0.20, 0.86, e);
      rig.armR.rotation.z = lerp(0, -0.14, e);
      rig.armL.rotation.x = lerp(-0.30, 0.10, e);
      rig.head.rotation.x = lerp(0, 0.44, e);
      rig.legL.rotation.x = lerp(0, -0.26, e);
      rig.legR.rotation.x = lerp(0, -0.18, e);
      /* the last third of the reach lifts it off the ground into the paw */
      const grab = Math.max(0, (p - 0.66)/0.34);
      rig.handR.getWorldPosition(_wp);
      act.apple.position.copy(act.from).lerp(_wp, ease(grab));
      act.apple.rotation.z += dt*2.2;
      if(p >= 1){ act.phase = 'rise'; act.t = 0; }
    }
    else {
      /* up again, and it goes into the sack at the hip */
      const p = Math.min(act.t/0.44, 1), e = easeIO(p);
      rig.torso.rotation.x = lerp(0.62, 0, e);
      rig.torso.position.y = lerp(0.40, 0.52, e);
      rig.armR.rotation.x = lerp(0.86, -0.20, e);
      rig.armR.rotation.z = lerp(-0.14, 0, e);
      rig.armL.rotation.x = lerp(0.10, -0.30, e);
      rig.head.rotation.x = lerp(0.44, 0, e);
      rig.legL.rotation.x = lerp(-0.26, 0, e);
      rig.legR.rotation.x = lerp(-0.18, 0, e);
      rig.handR.getWorldPosition(_wp);
      /* the sack rides low on the off side, behind the basket */
      _mp.set(-0.24, 0.34, -0.10).applyEuler(character.rotation).add(character.position);
      act.apple.position.copy(_wp).lerp(_mp, ease(p));
      act.apple.scale.setScalar(APPLE_SCALE*(1 - 0.7*Math.max(0, (p - 0.5)/0.5)));
      if(p >= 1){
        scene.remove(act.apple);
        state.bruised++;
        renderBasket();
        save();
        saidGathered();
        act = null;
        antics.busy = false;
        rig.torso.rotation.x = 0;
        rig.torso.position.y = 0.52;
      }
    }
    return;
  }

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
  saidWhyFallen = false;
  saidWhatWindfallsAreFor = false;
}

/** how many are lying about out there, for the ledger */
export const windfallsLying = () => falls.length;
