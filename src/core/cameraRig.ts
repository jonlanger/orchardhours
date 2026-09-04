/* ============================================================
   Camera — for now, the original fixed follow
   ============================================================ */
import * as THREE from 'three';
import { camera } from './renderer';
import { state } from './save';
import { character } from '../player/rig';

const camOffset = new THREE.Vector3(0, 9.6, 15.2);
const CAM_AIM = new THREE.Vector3(0, 1.8, -2.6);
const camLook = new THREE.Vector3();
const _desired = new THREE.Vector3();

camera.position.copy(character.position).add(camOffset);
camLook.copy(character.position).add(CAM_AIM);

/** what the camera is watching — trees fade against this, the sun tracks it */
export const focus = new THREE.Vector3().copy(character.position);

export function updateCamera(dt: number){
  focus.copy(character.position);
  _desired.copy(character.position).add(camOffset);
  camera.position.lerp(_desired, 1 - Math.pow(0.001, dt*(state.settings.calm?0.6:1)));
  camLook.lerp(_desired.copy(character.position).add(CAM_AIM), 1 - Math.pow(0.002, dt));
  camera.lookAt(camLook);
}
