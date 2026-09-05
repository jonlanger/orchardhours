/* ============================================================
   Picking — how an apple actually comes off a tree.

   Growers do not pull down on fruit: a yank takes the fruiting spur
   with it and costs next year's crop. The apple is cupped in the palm
   with a finger on the stem, rolled upwards until the calyx points at
   the sky, and given a small twist; a ripe one lets go, stem and all.
   The pole does the same thing from underneath — hoop under the fruit,
   push up, turn — and catches it in the bag.
   ============================================================ */
import * as THREE from 'three';
import { APPLE_TYPES, TYPE_KEYS, BASKET_CAPACITY, BARROW_CAPACITY,
         REACH_FROM_FEET, PICKER_BONUS, VIG_PICK, VIG_PICK_POLE } from '../core/config';
import type { AppleType } from '../core/config';
import { state, save, basketTotal } from '../core/save';
import { apples } from '../world/trees';
import type { Apple, PickPhase } from '../world/trees';
import { APPLE_SCALE, appleMats } from '../world/geometry';
import { character, rig } from './rig';
import { aimPole, poleHoop, poleBag, poleGrip, pole, isEquipped, carrying, equip,
         POLE_REST_LEN, POLE_REST_PITCH, POLE_REST_ROLL } from './tools';
import { drain, spent, tirednessNote } from './vigour';
import { toast, renderBasket } from '../ui/hud';

/** the bounce the bear gives when it reaches; the controller drains it */
export const bounce = { v: 0 };
/** how far the bear is up on its toes for a high one; the controller adds it in */
export const stretch = { y: 0 };

/* ============================================================
   Reach — how high the bear can get an apple down from.

   Measured from wherever it will be standing when it gets there, not from
   where it happens to be standing now: the rows roll, and a tap should not
   fail because the bear is in a dip on the far side of the orchard.
   ============================================================ */
const footing = (a: Apple) => Math.max(character.position.y, a.standPoint.y);

/** what a bear can take in its paw, by drawing the limb down to itself */
export const byHand = (a: Apple) => a.worldPos.y <= footing(a) + REACH_FROM_FEET + 0.15;
/** and what it can hook off with the pole */
export const byPole = (a: Apple) =>
  a.worldPos.y <= footing(a) + REACH_FROM_FEET + PICKER_BONUS + 0.15;

export function reachHeight(){
  return character.position.y + REACH_FROM_FEET
    + (isEquipped('picker') ? PICKER_BONUS : 0);
}
export function canReach(a: Apple){
  return isEquipped('picker') ? byPole(a) : byHand(a);
}

/**
 * Whatever has to be in the bear's paws before it walks over. A pole that is
 * already on the bear is simply taken out — being told to press 1 when you are
 * carrying the thing is not a puzzle worth having. Returns the reason it
 * cannot be done, or null once it can.
 */
export function readyFor(a: Apple): string | null {
  if(canReach(a)) return null;

  if(byPole(a)){
    if(!carrying('picker'))
      return 'That one is up in the canopy. The picking pole is on the rack in the barn.';
    equip('picker');
    toast('Pole out — that one is above head height.');
    return null;
  }

  if(state.ladder || carrying('ladder'))
    return 'Too high even on the pole. Lean the ladder against this tree and climb it.';
  return 'Too high even on the pole. The ladder on the barn rack would put you level with it.';
}

/* ============================================================
   Where a picked apple goes
   ============================================================ */
export const barrowTotal = () => {
  const b = state.barrow;
  return b ? TYPE_KEYS.reduce((n,k)=> n + b.load[k], 0) : 0;
};
/** the barrow only takes fruit if it is being pushed, or parked close by */
export function barrowHandy(){
  const b = state.barrow;
  if(!b) return false;
  if(state.carried.includes('barrow')) return true;
  return Math.hypot(b.x - character.position.x, b.z - character.position.z) < 4.5;
}
export function roomForMore(){
  return basketTotal() < BASKET_CAPACITY
    || (barrowHandy() && barrowTotal() < BARROW_CAPACITY);
}
function stash(type: AppleType): 'basket' | 'barrow' | null {
  if(basketTotal() < BASKET_CAPACITY){ state.basket[type]++; return 'basket'; }
  if(barrowHandy() && barrowTotal() < BARROW_CAPACITY){ state.barrow!.load[type]++; return 'barrow'; }
  return null;
}

export function ownerApple(obj: THREE.Object3D | null): Apple | null {
  let o = obj;
  while(o){
    const found = apples.find(a => a.group === o);
    if(found) return found;
    o = o.parent;
  }
  return null;
}

/* ============================================================
   The reach itself
   ============================================================ */
/** how long each leg of the movement takes, in seconds */
const D: Record<PickPhase, number> = {
  reach:0.52, cup:0.38, twist:0.20, carry:0.48,       // by hand
  aim:0.55, hook:0.44, bag:0.26, lower:0.52, tip:0.34, // on the pole
};

const _dir = new THREE.Vector3(), _v = new THREE.Vector3(), _w = new THREE.Vector3();
const _grip = new THREE.Vector3(), _hand = new THREE.Vector3(), _basket = new THREE.Vector3();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const _sh = new THREE.Vector3(), _d2 = new THREE.Vector3();
const UP = new THREE.Vector3(0,1,0);

const ease   = (p: number) => 1 - Math.pow(1-p, 3);
const easeIO = (p: number) => p < 0.5 ? 4*p*p*p : 1 - Math.pow(-2*p+2, 3)/2;
const step   = (a: number, b: number, p: number) => Math.max(0, Math.min(1, (p-a)/(b-a)));
const lerp   = (a: number, b: number, p: number) => a + (b-a)*p;
const to = (o: THREE.Object3D, axis: 'x'|'y'|'z', v: number, k: number) => {
  o.rotation[axis] += (v - o.rotation[axis]) * Math.min(1, k);
};

/* every tree is planted at a random turn of its own, so world and local are
   not a subtraction apart — go through the tree's matrix both ways */
const _tmp = new THREE.Vector3(), _tq = new THREE.Quaternion();

/** the world position an apple currently occupies */
function world(a: Apple, out: THREE.Vector3){
  return a.group.getWorldPosition(out);
}
function place(a: Apple, at: THREE.Vector3){
  a.group.position.copy(a.treeGroup.worldToLocal(_tmp.copy(at)));
}

/** how far a bear can draw a limb down towards itself before it is the pole's job */
const LIMB_DRAW = 1.35;
/** shoulder to the middle of the paw, plus the half-width of an apple */
const PAW = 0.30;

export function startPick(a: Apple){
  const hung = world(a, new THREE.Vector3());
  const at = hung.clone();
  _dir.subVectors(at, character.position);
  /* the pole is for what the paw cannot reach; a bear holding one does not
     kneel down to a knee-high apple with it */
  const usePole = isEquipped('picker') && at.y > character.position.y + 2.0;

  /* Fruit above the paw is not jumped at: the limb is drawn down along the line
     of the reach until the apple is in the hand. Anything still out of reach
     after a metre and a third of that is the pole's job. */
  const lift = usePole ? 0 : liftFor(hung.y);
  if(!usePole){
    const face = Math.atan2(_dir.x, _dir.z);
    const rx = Math.cos(face), rz = -Math.sin(face);
    _sh.set(character.position.x + rx*0.215,
            character.position.y + 0.63 + lift,
            character.position.z + rz*0.215);
    _d2.subVectors(hung, _sh);
    const len = _d2.length();
    if(len > PAW){
      _d2.divideScalar(len);
      const pull = Math.min(len - PAW, LIMB_DRAW);
      at.copy(_sh).addScaledVector(_d2, len - pull);
    }
  }

  /* the fruit rolls about the line across the reach, so the calyx comes up */
  const axis = new THREE.Vector3(_dir.z, 0, -_dir.x);
  if(axis.lengthSq() < 1e-5) axis.set(1,0,0);
  axis.normalize();

  a.anim = {
    phase: usePole ? 'aim' : 'reach',
    t: 0,
    face: Math.atan2(_dir.x, _dir.z),
    pole: usePole,
    q0: a.group.getWorldQuaternion(new THREE.Quaternion()),
    axis,
    at,
    from: hung,
    lift,
    len: POLE_REST_LEN,
  };
  if(!usePole) bounce.v = 2.1;
  if(usePole) pole.aiming = true;
}

function next(a: Apple, phase: PickPhase){
  const an = a.anim!;
  an.phase = phase;
  an.t = 0;
  world(a, an.from);
}

/** put the fruit at `p`, rolled by `roll` about its axis and `turn` about its stem */
function pose(a: Apple, p: THREE.Vector3, roll: number, turn: number){
  const an = a.anim!;
  place(a, p);
  _q.setFromAxisAngle(an.axis, roll);
  _q2.setFromAxisAngle(UP, turn);
  a.treeGroup.getWorldQuaternion(_tq).invert();
  a.group.quaternion.copy(_tq).multiply(_q).multiply(_q2).multiply(an.q0);
}

function finishPick(a: Apple){
  const usedPole = a.anim?.pole ?? false;
  const where = stash(a.type);
  state.picked++;
  drain(usedPole ? VIG_PICK_POLE : VIG_PICK);
  if(!state.discovered[a.type]){
    state.discovered[a.type] = true;
    toast(`A new variety — ${APPLE_TYPES[a.type].label}. The almanac has a page on it.`);
  } else if(a.type === 'rare'){
    toast('An Amber Russet. Rough-skinned and worth more than it looks.');
  }
  renderBasket(a.type);
  updateBasketFruit();
  save();
  if(where === 'barrow' && barrowTotal() === 1) toast('Basket full — the overflow is going into the barrow');
  else if(where === null) toast('Nothing left to put it in. Empty the basket at the barrels.');
  else if(where === 'basket' && basketTotal() >= BASKET_CAPACITY && !barrowHandy())
    toast('Basket full — the barn is expecting you');
  else {
    const note = tirednessNote();
    if(note) toast(note);
  }
}

export function updateBasketFruit(){
  const n = basketTotal();
  const order: string[] = [];
  for(const k of TYPE_KEYS) for(let i=0;i<state.basket[k];i++) order.push(k);
  rig.basketFruit.forEach((f,i)=>{
    const show = i < Math.min(7, n);
    f.visible = show;
    if(show){
      const key = order[Math.floor(i*order.length/Math.min(7,n))] ?? 'honeycrisp';
      f.material = appleMats[key as keyof typeof appleMats];
    }
  });
}

/** the angle the right arm needs to point the paw at a world point */
function armAngleTo(at: THREE.Vector3){
  const shoulderY = character.position.y + 0.63 + stretch.y;
  const h = Math.hypot(at.x - character.position.x, at.z - character.position.z);
  const a = -(Math.PI/2) - Math.atan2(at.y - shoulderY, Math.max(0.12, h));
  return Math.max(-3.02, Math.min(-0.10, a));
}

/** a bear picking overhead goes up on its toes; anything higher is the pole's job */
function stretchFor(want: number){
  stretch.y += (want - stretch.y) * 0.35;
}
/** how far up on its toes a bear goes for fruit at this height */
function liftFor(y: number){
  return Math.max(0, Math.min(1, (y - (character.position.y + 1.05))/1.2)) * 0.26;
}

/** everything a reach borrowed, handed back */
function restPose(){
  stretch.y = 0;
  rig.torso.rotation.x = 0;
  rig.armR.rotation.z = 0;
  rig.armL.rotation.z = -0.30;
  rig.head.rotation.x = 0;
  pole.aiming = false;
}

export function updatePicking(dt: number){
  /* a reach cut short — a fresh season, say — should not leave the pole aimed */
  if(pole.aiming && !picking()) restPose();

  for(const a of apples){
    const an = a.anim;
    if(!an) continue;
    /* a worn-out bear works slower, and it shows */
    an.t += dt * (spent() ? 0.72 : 1);
    const p = Math.min(an.t / D[an.phase], 1);

    /* square up to the work */
    let d = an.face - character.rotation.y;
    while(d > Math.PI) d -= Math.PI*2;
    while(d < -Math.PI) d += Math.PI*2;
    character.rotation.y += d*Math.min(1, dt*10);

    rig.basket.getWorldPosition(_basket);

    switch(an.phase){
      /* ---------- by hand ---------- */
      case 'reach': {
        const e = ease(p);
        /* the paw goes up and the limb comes down to meet it */
        _v.copy(an.from).lerp(an.at, easeIO(p));
        place(a, _v);
        stretchFor(an.lift*e);
        to(rig.armR, 'x', armAngleTo(_v), dt*14);
        rig.armR.rotation.z = lerp(0, -0.12, e);
        rig.armL.rotation.x = lerp(-0.30, -1.00, e);   // the free paw steadies the limb
        rig.armL.rotation.z = lerp(-0.30, -0.10, e);
        rig.head.rotation.x = -0.42*e;
        rig.torso.rotation.x = -0.06*e;
        if(p >= 1) next(a, 'cup');
        break;
      }
      case 'cup': {
        /* roll it up: the calyx swings towards the top of the tree */
        const e = easeIO(p);
        stretchFor(an.lift);
        _v.copy(an.at).addScaledVector(UP, 0.085*e);
        _v.x += (character.position.x - an.at.x)*0.05*e;
        _v.z += (character.position.z - an.at.z)*0.05*e;
        pose(a, _v, 1.45*e, 0);
        to(rig.armR, 'x', armAngleTo(_v), dt*12);
        if(p >= 1) next(a, 'twist');
        break;
      }
      case 'twist': {
        /* and the little turn that parts the stem from the spur */
        const e = ease(p);
        stretchFor(an.lift);
        _v.copy(an.at).addScaledVector(UP, 0.085 - 0.03*e);
        pose(a, _v, 1.45, 0.95*e);
        a.group.scale.setScalar(APPLE_SCALE*(1 + Math.sin(p*Math.PI)*0.06));
        if(p >= 1){
          a.picked = true;
          next(a, 'carry');
        }
        break;
      }
      case 'carry': {
        /* down to the basket in the paw, not dropped */
        const e = easeIO(p);
        to(rig.armR, 'x', lerp(armAngleTo(an.from), -0.22, e), dt*16);
        rig.armR.rotation.z = lerp(-0.12, 0.66, e);
        rig.armL.rotation.x = lerp(-1.00, -0.30, e);
        rig.armL.rotation.z = lerp(-0.10, -0.30, e);
        rig.head.rotation.x = -0.42*(1-e) + 0.18*e;
        rig.torso.rotation.x = -0.06*(1-e);
        stretchFor(an.lift*(1 - e));
        rig.handR.getWorldPosition(_hand);
        _hand.y -= 0.03;
        /* an apple picked overhead comes down into the paw before it travels */
        const grab = step(0, 0.36, p);
        const drop = step(0.72, 1, p);
        _v.copy(an.from).lerp(_hand, grab);
        _v.lerp(_basket, drop);
        pose(a, _v, 1.45, 0.95);
        a.group.scale.setScalar(APPLE_SCALE*(1 - 0.55*drop));
        if(p >= 1){
          a.group.visible = false;
          a.anim = null;
          restPose();
          finishPick(a);
        }
        break;
      }

      /* ---------- on the end of the pole ---------- */
      case 'aim': {
        const e = ease(p);
        poleGrip(_grip);
        _w.subVectors(an.at, _grip);
        const h = Math.hypot(_w.x, _w.z);
        const pitch = Math.atan2(h, _w.y);
        an.len = _w.length();
        aimPole(lerp(POLE_REST_PITCH, pitch, e), lerp(POLE_REST_LEN, an.len, e),
                0, lerp(POLE_REST_ROLL, 0, e));
        rig.armR.rotation.x = lerp(-0.20, -1.30 - pitch*0.28, e);
        rig.armL.rotation.x = lerp(-0.30, -1.05 - pitch*0.22, e);
        rig.armL.rotation.z = lerp(-0.30, 0.16, e);
        rig.head.rotation.x = -0.52*e;
        rig.torso.rotation.x = -0.14*e;
        if(p >= 1) next(a, 'hook');
        break;
      }
      case 'hook': {
        /* the hoop goes under the fruit, lifts, and turns */
        const e = easeIO(p);
        poleGrip(_grip);
        _w.subVectors(an.at, _grip);
        const h = Math.hypot(_w.x, _w.z);
        aimPole(Math.atan2(h, _w.y), an.len + 0.10*e, Math.sin(p*Math.PI)*0.60, 0);
        poleHoop(_v);
        _v.lerpVectors(an.at, _v, step(0, 0.30, p));   // settle into the hoop, no jump
        pose(a, _v, 1.5*e, 0.9*e);
        if(p >= 1){
          a.picked = true;
          next(a, 'bag');
        }
        break;
      }
      case 'bag': {
        poleHoop(_v);
        poleBag(_w);
        const e = ease(p);
        _v.lerp(_w, e);
        _v.y -= Math.sin(p*Math.PI)*0.02;
        pose(a, _v, 1.5, 0.9);
        if(p >= 1) next(a, 'lower');
        break;
      }
      case 'lower': {
        const e = easeIO(p);
        poleGrip(_grip);
        _w.subVectors(an.at, _grip);
        const pitch = Math.atan2(Math.hypot(_w.x, _w.z), _w.y);
        aimPole(lerp(pitch, POLE_REST_PITCH, e), lerp(an.len + 0.10, POLE_REST_LEN, e),
                0, lerp(0, POLE_REST_ROLL, e));
        rig.armR.rotation.x = lerp(-1.30 - pitch*0.28, -0.20, e);
        rig.armL.rotation.x = lerp(-1.05 - pitch*0.22, -0.30, e);
        rig.armL.rotation.z = lerp(0.16, -0.30, e);
        rig.head.rotation.x = -0.52*(1-e);
        rig.torso.rotation.x = -0.14*(1-e);
        poleBag(_v);
        pose(a, _v, 1.5, 0.9);
        if(p >= 1) next(a, 'tip');
        break;
      }
      case 'tip': {
        /* and tipped out of the bag into the basket */
        const e = ease(p);
        _w.copy(an.from).lerp(_basket, e);
        _w.y += Math.sin(p*Math.PI)*0.18;
        pose(a, _w, 1.5, 0.9);
        a.group.scale.setScalar(APPLE_SCALE*(1 - 0.55*e));
        if(p >= 1){
          a.group.visible = false;
          a.anim = null;
          restPose();
          finishPick(a);
        }
        break;
      }
    }
  }
}

/** true while an apple is mid-pick, so the controller can hold still */
export const picking = () => apples.some(a => a.anim !== null);
