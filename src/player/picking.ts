/* ============================================================
   Picking — the reach, the fly to the basket, the tally
   ============================================================ */
import * as THREE from 'three';
import { APPLE_TYPES, TYPE_KEYS, BASKET_CAPACITY, BARROW_CAPACITY,
         REACH_FROM_FEET, PICKER_BONUS } from '../core/config';
import type { AppleType } from '../core/config';
import { state, save, basketTotal } from '../core/save';
import { apples } from '../world/trees';
import type { Apple } from '../world/trees';
import { APPLE_SCALE, appleMats } from '../world/geometry';
import { character, rig } from './rig';
import { toast, renderBasket } from '../ui/hud';

/** the bounce the bear gives when it reaches; the controller drains it */
export const bounce = { v: 0 };

/* ============================================================
   Reach — how high the bear can get an apple down from
   ============================================================ */
export function reachHeight(){
  return character.position.y + REACH_FROM_FEET
    + (state.equipped === 'picker' ? PICKER_BONUS : 0);
}
export function canReach(a: Apple){
  return a.worldPos.y <= reachHeight() + 0.15;
}
/** why not, in a sentence the bear would say */
export function outOfReach(a: Apple){
  if(canReach(a)) return null;
  return state.carried.includes('picker')
    ? 'That one is up in the canopy — take the pole out first (1).'
    : 'That one is up in the canopy. The picking pole is on the rack in the barn.';
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

const _dir = new THREE.Vector3();

export function startPick(a: Apple){
  _dir.subVectors(a.worldPos, character.position);
  a.anim = { phase:'reach', t:0, face:Math.atan2(_dir.x, _dir.z) };
  bounce.v = 2.1;
}

function finishPick(a: Apple){
  const where = stash(a.type);
  state.picked++;
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

const _basketWorld = new THREE.Vector3(), _target = new THREE.Vector3();

export function updatePicking(dt: number){
  for(const a of apples){
    if(!a.anim) continue;
    a.anim.t += dt;

    if(a.anim.phase === 'reach'){
      const p = Math.min(a.anim.t/0.40, 1);
      let d = a.anim.face! - character.rotation.y;
      while(d > Math.PI) d -= Math.PI*2;
      while(d < -Math.PI) d += Math.PI*2;
      character.rotation.y += d*Math.min(1, dt*10);
      rig.armR.rotation.x = -p*2.3;
      rig.head.rotation.x = -p*0.45;
      if(p >= 1){
        a.picked = true;
        a.anim = { phase:'fly', t:0, from:a.group.getWorldPosition(new THREE.Vector3()) };
      }
    } else {
      const p = Math.min(a.anim.t/0.5, 1);
      const e = 1 - Math.pow(1-p, 2.4);
      rig.basket.getWorldPosition(_basketWorld);
      _target.copy(a.anim.from!).lerp(_basketWorld, e);
      _target.y += Math.sin(p*Math.PI)*0.55;                    // arc
      a.group.position.copy(_target).sub(a.treeGroup.position);
      a.group.rotation.x += dt*7; a.group.rotation.z += dt*4;
      a.group.scale.setScalar(APPLE_SCALE*(1 - 0.55*e));
      if(p >= 1){
        a.group.visible = false; a.anim = null;
        rig.armR.rotation.x = 0; rig.head.rotation.x = 0;
        finishPick(a);
      }
    }
  }
}

/** true while an apple is mid-pick, so the controller can hold still */
export const picking = () => apples.some(a => a.anim !== null);
