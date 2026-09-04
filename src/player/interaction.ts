/* ============================================================
   Pointing at the world — tap an apple, the barn, or the ground
   ============================================================ */
import * as THREE from 'three';
import { BASKET_CAPACITY } from '../core/config';
import { camera } from '../core/renderer';
import { basketTotal } from '../core/save';
import { onTap } from '../core/input';
import { apples } from '../world/trees';
import { groundMesh } from '../world/ground';
import { barn } from '../world/barn';
import { ownerApple } from './picking';
import { walkTo, walkToApple, walkToBarn } from './controller';
import { toast, hideHint } from '../ui/hud';

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();

export function initInteraction(){
  onTap((cx, cy) => {
    ndc.x = (cx/innerWidth)*2 - 1;
    ndc.y = -(cy/innerHeight)*2 + 1;
    raycaster.setFromCamera(ndc, camera);

    const live = apples.filter(a => !a.picked).map(a => a.group);
    const hitApple = raycaster.intersectObjects(live, true)[0];
    const hitBarn  = raycaster.intersectObject(barn, true)[0];
    const hitGround = raycaster.intersectObject(groundMesh)[0];

    const dA = hitApple ? hitApple.distance : Infinity;
    const dB = hitBarn ? hitBarn.distance : Infinity;

    if(dA < dB && hitApple){
      if(basketTotal() >= BASKET_CAPACITY){
        toast('The basket will not hold another — take it to the barn');
        return;
      }
      const a = ownerApple(hitApple.object);
      if(a){ walkToApple(a); hideHint(); }
      return;
    }
    if(dB < dA && hitBarn){ walkToBarn(); hideHint(); return; }
    if(hitGround){ walkTo(hitGround.point); hideHint(); }
  });
}
