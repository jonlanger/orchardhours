/* ============================================================
   Renderer / scene / camera
   ============================================================ */
import * as THREE from 'three';

export const renderer = new THREE.WebGLRenderer({ antialias:true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);

export const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xBFDCE8, 52, 165);

export const camera = new THREE.PerspectiveCamera(45, innerWidth/innerHeight, 0.1, 220);

export function updateCameraFov(){
  const a = innerWidth/innerHeight;
  camera.aspect = a;
  camera.fov = a < 0.8 ? 56 : 44;
  camera.updateProjectionMatrix();
}
updateCameraFov();

addEventListener('resize', ()=>{
  updateCameraFov();
  renderer.setSize(innerWidth, innerHeight);
});
