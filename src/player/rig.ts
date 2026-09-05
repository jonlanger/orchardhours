/* ============================================================
   Pom — a bear in overalls, a straw hat, and a picking basket
   ============================================================ */
import * as THREE from 'three';
import { scene } from '../core/renderer';
import { toonMat, addOutline, part, SPH, CAP, BOX, CYL } from '../core/materials';
import { APPLE_GEO, appleMats } from '../world/geometry';
import { toonSoft } from '../core/materials';
import { groundHeightAt } from '../world/ground';

export const FUR      = toonMat(0x8A5E3C, true);
export const FUR_DARK = toonMat(0x6F4930, true);
const CREAM    = toonMat(0xD9B58C, true);
const DARK     = toonMat(0x2C1C12);
const DENIM    = toonMat(0x4A6A93, true);
const DENIM_D  = toonMat(0x3B577A, true);
const STRAW    = toonMat(0xD9BE7A, true);
const BAND     = toonMat(0xC4553C);
const BRASS    = new THREE.MeshStandardMaterial({ color:0xD9A441, roughness:0.35, metalness:0.6 });
const WICKER_D = toonMat(0xA8703C, true);

export const character = new THREE.Group();

export interface Rig {
  legL: THREE.Group; legR: THREE.Group;
  torso: THREE.Group; body: THREE.Mesh;
  armL: THREE.Group; armR: THREE.Group;
  handL: THREE.Group; handR: THREE.Group;
  shoulder: THREE.Group; front: THREE.Group; pole: THREE.Group;
  mouth: THREE.Group;
  head: THREE.Group; hat: THREE.Group;
  basket: THREE.Group; basketFruit: THREE.Mesh[];
}
export const rig = {} as Rig;

/* legs (denim) + boots */
rig.legL = new THREE.Group(); rig.legL.position.set(-0.105, 0.265, 0); character.add(rig.legL);
rig.legR = new THREE.Group(); rig.legR.position.set( 0.105, 0.265, 0); character.add(rig.legR);
for(const g of [rig.legL, rig.legR]){
  part(CAP(0.075, 0.13), DENIM, 0, -0.09, 0, g);
  part(BOX(0.13, 0.075, 0.20), FUR_DARK, 0, -0.20, 0.028, g);          // boot
  part(SPH, FUR_DARK, 0, -0.20, 0.12, g).scale.set(0.065,0.037,0.05);  // toe
}

/* torso: fur barrel with denim overalls over the lower half */
rig.torso = new THREE.Group(); rig.torso.position.y = 0.52; character.add(rig.torso);
rig.body = part(CAP(0.185, 0.17), FUR, 0, 0, 0, rig.torso);
addOutline(rig.body, 1.055);
const bibLower = part(CAP(0.192, 0.055), DENIM, 0, -0.075, 0, rig.torso);
addOutline(bibLower, 1.05);
const bib = part(BOX(0.20, 0.17, 0.02), DENIM, 0, 0.045, 0.175, rig.torso);
bib.rotation.x = -0.06;
part(BOX(0.155, 0.085, 0.012), DENIM_D, 0, 0.02, 0.19, rig.torso).rotation.x = -0.06;  // pocket
for(const sx of [-1,1]){
  const strap = part(BOX(0.045, 0.30, 0.02), DENIM, sx*0.085, 0.10, 0.10, rig.torso);
  strap.rotation.set(-0.30, 0, sx*0.10);
  part(CYL(0.022,0.022,0.014,8), BRASS, sx*0.075, 0.115, 0.178, rig.torso).rotation.x = Math.PI/2;
}

/* arms — the left one is locked around the basket, the right swings */
rig.armL = new THREE.Group(); rig.armL.position.set(-0.215, 0.63, 0); character.add(rig.armL);
rig.armR = new THREE.Group(); rig.armR.position.set( 0.215, 0.63, 0); character.add(rig.armR);
for(const g of [rig.armL, rig.armR]){
  part(CAP(0.055, 0.15), FUR, 0, -0.10, 0, g);
  part(SPH, FUR_DARK, 0, -0.205, 0.01, g).scale.setScalar(0.062);
}
rig.armL.rotation.set(-0.30, 0, -0.30);

/* empty sockets a tool can be parented to */
rig.handL = new THREE.Group(); rig.handL.position.set(0, -0.225, 0.02); rig.armL.add(rig.handL);
rig.handR = new THREE.Group(); rig.handR.position.set(0, -0.225, 0.02); rig.armR.add(rig.handR);
rig.shoulder = new THREE.Group(); rig.shoulder.position.set(0.10, 0.20, -0.05); rig.torso.add(rig.shoulder);
rig.front = new THREE.Group(); rig.front.position.set(0, 0.32, 0.85); character.add(rig.front);
/* The picking pole is carried on the body rather than swung on the arm — a
   three-metre pole on a swinging shoulder joint flails. The butt sits low and
   outboard of the right hip so the shaft rises past the shoulder and clears
   the head; the paw closes on it at hip height, the way you carry a rake. */
rig.pole = new THREE.Group(); rig.pole.position.set(0.30, -0.26, 0.06); rig.torso.add(rig.pole);

/* head */
rig.head = new THREE.Group(); rig.head.position.y = 0.90; character.add(rig.head);
const skull = part(SPH, FUR, 0, 0, 0, rig.head); skull.scale.set(0.185,0.175,0.175);
addOutline(skull, 1.06);
part(SPH, CREAM, 0, -0.045, 0.145, rig.head).scale.set(0.098,0.078,0.085);
part(SPH, DARK,  0, -0.020, 0.222, rig.head).scale.set(0.034,0.026,0.026);
const GLINT = new THREE.MeshBasicMaterial({ color:0xffffff });
for(const sx of [-1,1]){
  part(SPH, DARK,  sx*0.072, 0.035, 0.152, rig.head).scale.setScalar(0.026);
  part(SPH, GLINT, sx*0.078, 0.048, 0.168, rig.head).scale.setScalar(0.009);
  const ear = part(SPH, FUR, sx*0.145, 0.125, -0.015, rig.head);
  ear.scale.set(0.072,0.070,0.030); addOutline(ear, 1.08);
  part(SPH, CREAM, sx*0.150, 0.125, 0.010, rig.head).scale.set(0.042,0.040,0.020);
}

/* where a held apple meets the snout */
rig.mouth = new THREE.Group(); rig.mouth.position.set(0, -0.045, 0.20); rig.head.add(rig.mouth);

/* straw hat */
rig.hat = new THREE.Group(); rig.hat.position.y = 0.145; rig.head.add(rig.hat);
const brim = part(CYL(0.285,0.30,0.020,20), STRAW, 0, 0, 0.012, rig.hat);
brim.rotation.x = -0.06; addOutline(brim, 1.04);
const crown = part(CYL(0.150,0.172,0.135,16), STRAW, 0, 0.075, 0.012, rig.hat);
crown.rotation.x = -0.06; addOutline(crown, 1.05);
part(CYL(0.176,0.176,0.040,16), BAND, 0, 0.030, 0.012, rig.hat).rotation.x = -0.06;

/* the picking basket, carried at the hip */
rig.basket = new THREE.Group();
rig.basket.position.set(-0.255, 0.40, 0.055);
rig.basket.rotation.set(0.10, 0.25, 0.16);
character.add(rig.basket);
const bWall = part(new THREE.CylinderGeometry(0.155,0.115,0.165,16,1,true),
  new THREE.MeshToonMaterial({ color:0xC08A4E, gradientMap:toonSoft, side:THREE.DoubleSide }),
  0, 0, 0, rig.basket);
addOutline(bWall, 1.05);
part(CYL(0.118,0.118,0.012,14), WICKER_D, 0, -0.080, 0, rig.basket);
part(new THREE.TorusGeometry(0.155, 0.017, 6, 18), WICKER_D, 0, 0.082, 0, rig.basket).rotation.x = Math.PI/2;
part(new THREE.TorusGeometry(0.138, 0.010, 5, 16), WICKER_D, 0, 0.020, 0, rig.basket).rotation.x = Math.PI/2;
part(new THREE.TorusGeometry(0.124, 0.010, 5, 16), WICKER_D, 0, -0.040, 0, rig.basket).rotation.x = Math.PI/2;
const handle = part(new THREE.TorusGeometry(0.135, 0.013, 6, 16, Math.PI), WICKER_D, 0, 0.085, 0, rig.basket);
handle.rotation.y = Math.PI/2;

/* fruit that appears in the basket as you fill it */
rig.basketFruit = [];
for(let i=0;i<7;i++){
  const a = (i/7)*Math.PI*2;
  const f = new THREE.Mesh(APPLE_GEO, appleMats.honeycrisp);
  f.position.set(Math.cos(a)*0.07, 0.055 + (i%3)*0.012, Math.sin(a)*0.07);
  f.scale.setScalar(0.062);
  f.visible = false;
  rig.basket.add(f);
  rig.basketFruit.push(f);
}

export const SPAWN = new THREE.Vector3(4, groundHeightAt(4,27), 27);
character.position.copy(SPAWN);
character.rotation.y = Math.PI;
scene.add(character);

/* a root under everything, so the whole bear can hop and squash
   without disturbing the ground point it stands on */
export const bearRoot = new THREE.Group();
while(character.children.length) bearRoot.add(character.children[0]!);
character.add(bearRoot);
