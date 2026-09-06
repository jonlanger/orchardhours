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
import { windfallGroups, windfallOwner, windfallNear, windfallStand,
         whyNotGather, gather } from './antics';
import { walkTo, walkToDo, walkToApple, walkToBarn } from './controller';
import { toast, hideHint } from '../ui/hud';

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const _stand = new THREE.Vector3();

/** how far off a windfall a tap on the grass still counts as meaning it */
const GRASS_SLOP = 1.3;

/** send the bear over to stoop for one, or say why it cannot */
function sendForWindfall(f: ReturnType<typeof windfallNear>){
  if(!f) return false;
  const why = whyNotGather();
  if(why){ toast(why); return true; }
  walkToDo(windfallStand(f, _stand), () => gather(f));
  hideHint();
  return true;
}

export function initInteraction(){
  onTap((cx, cy) => {
    ndc.x = (cx/innerWidth)*2 - 1;
    ndc.y = -(cy/innerHeight)*2 + 1;
    raycaster.setFromCamera(ndc, camera);

    const live = apples.filter(a => !a.picked).map(a => a.group);
    const hitApple = raycaster.intersectObjects(live, true)[0];
    const hitBarn  = raycaster.intersectObject(barn, true)[0];
    const hitGround = raycaster.intersectObject(groundMesh)[0];
    /* the windfalls sit on the grass, so they have to be tested before it */
    const hitFallen = raycaster.intersectObjects(windfallGroups(), true)[0];

    const dA = hitApple ? hitApple.distance : Infinity;
    const dB = hitBarn ? hitBarn.distance : Infinity;
    const dF = hitFallen ? hitFallen.distance : Infinity;

    /* one in the grass: walk over and stoop for it, the same as one on a tree */
    if(dF < dA && dF < dB && hitFallen){
      const f = windfallOwner(hitFallen.object);
      if(f && sendForWindfall(f)) return;
    }

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
    if(hitGround){
      /* a tap on the grass beside a windfall means that windfall */
      const f = windfallNear(hitGround.point, GRASS_SLOP);
      if(f && sendForWindfall(f)) return;
      walkTo(hitGround.point);
      hideHint();
    }
  });
}
