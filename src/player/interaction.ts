/* ============================================================
   Pointing at the world — tap an apple, the barn, or the ground
   ============================================================ */
import * as THREE from 'three';
import { camera } from '../core/renderer';

import { onTap } from '../core/input';
import { apples } from '../world/trees';
import { groundMesh } from '../world/ground';
import { barn } from '../world/barn';
import { ownerApple, roomForMore, readyFor } from './picking';
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
      const a = ownerApple(hitApple.object);
      if(!a) return;
      if(!roomForMore()){
        toast('The basket will not hold another — take it to the barn');
        return;
      }
      const why = readyFor(a);
      if(why){ toast(why); return; }
      walkToApple(a); hideHint();
      return;
    }
    if(dB < dA && hitBarn){ walkToBarn(); hideHint(); return; }
    if(hitGround){ walkTo(hitGround.point); hideHint(); }
  });
}
