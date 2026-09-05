/* ============================================================
   Sky dome, lighting, and the hour of the day
   ============================================================ */
import * as THREE from 'three';
import { scene, camera } from '../core/renderer';
import { state, save } from '../core/save';
import { DAY_LENGTH } from '../core/config';

const skyUniforms = {
  uTop:    { value:new THREE.Color(0x6FA9CE) },
  uHorizon:{ value:new THREE.Color(0xD8E6EC) },
  uGround: { value:new THREE.Color(0xC8BFA4) },
  uSunDir: { value:new THREE.Vector3(0.5,0.6,0.4).normalize() },
  uSunCol: { value:new THREE.Color(0xFFF0CE) },
};

const sky = new THREE.Mesh(
  new THREE.SphereGeometry(280, 32, 20),
  new THREE.ShaderMaterial({
    side:THREE.BackSide, depthWrite:false, fog:false, uniforms:skyUniforms,
    vertexShader:`varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader:`
      varying vec3 vP;
      uniform vec3 uTop,uHorizon,uGround,uSunDir,uSunCol;
      void main(){
        vec3 d = normalize(vP);
        float h = d.y;
        vec3 col = mix(uHorizon, uTop, clamp(pow(max(h,0.0),0.55),0.0,1.0));
        col = mix(col, uGround, clamp(-h*3.0,0.0,1.0));
        float sun = max(dot(d, normalize(uSunDir)), 0.0);
        col += uSunCol * (pow(sun, 220.0)*0.9 + pow(sun, 8.0)*0.22);
        gl_FragColor = vec4(col,1.0);
      }`,
  })
);
sky.frustumCulled = false;
scene.add(sky);

/* ---- lighting ---- */
export const key = new THREE.DirectionalLight(0xfff1d8, 2.5);
key.position.set(14, 20, 11);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
const SH = 26;
key.shadow.camera.left=-SH; key.shadow.camera.right=SH;
key.shadow.camera.top=SH;  key.shadow.camera.bottom=-SH;
key.shadow.camera.near=1;  key.shadow.camera.far=70;
key.shadow.bias = -0.0006;
key.shadow.normalBias = 0.02;
scene.add(key, key.target);

export const hemi = new THREE.HemisphereLight(0xffe9c7, 0x6b8f5a, 0.72);
scene.add(hemi);
const bounce = new THREE.DirectionalLight(0xBFD8E8, 0.5);
bounce.position.set(-9, 5, -8);
scene.add(bounce);
scene.add(new THREE.AmbientLight(0xE8F0DC, 0.28));   // keeps the shade under the canopies readable

/* ---- the hour ---- */
interface Phase { t:number; name:string; top:number; hor:number; sun:number; key:number; ki:number; hemi:number }
const PHASES: Phase[] = [
  { t:0.00, name:'Early morning', top:0x7FA8C9, hor:0xF0DCC4, sun:0xFFD9A6, key:0xFFD2A0, ki:1.7, hemi:0.62 },
  { t:0.26, name:'Morning',       top:0x6FA9CE, hor:0xDCEAF0, sun:0xFFF0CE, key:0xFFF1D8, ki:2.5, hemi:0.72 },
  { t:0.52, name:'Midday',        top:0x5D9FD4, hor:0xD9E9F2, sun:0xFFFBEE, key:0xFFFAEC, ki:2.9, hemi:0.80 },
  { t:0.74, name:'Afternoon',     top:0x6DA3C6, hor:0xEADFC8, sun:0xFFE7B4, key:0xFFE3B6, ki:2.4, hemi:0.70 },
  { t:0.90, name:'Golden hour',   top:0x7E9AC0, hor:0xF3CFA0, sun:0xFFC98A, key:0xFFC488, ki:2.0, hemi:0.58 },
  { t:1.00, name:'Early morning', top:0x7FA8C9, hor:0xF0DCC4, sun:0xFFD9A6, key:0xFFD2A0, ki:1.7, hemi:0.62 },
];

const _cA = new THREE.Color(), _cB = new THREE.Color();
const _sd = new THREE.Vector3();

/** how far through the day we are, and whether the lantern should be lit */
export const hour = { name: 'Morning', dark: 0 };

export type DayRollover = (day: number) => void;
const rollovers: DayRollover[] = [];
export function onNewDay(fn: DayRollover){ rollovers.push(fn); }

export function updateDay(dt: number, focus: THREE.Vector3){
  state.dayT += dt/DAY_LENGTH * (state.settings.calm ? 0.6 : 1);
  if(state.dayT >= 1){
    state.dayT -= 1; state.day++;
    rollovers.forEach(fn => fn(state.day));
    save();
  }
  const t = state.dayT;
  let i = 0; while(i < PHASES.length-2 && t > PHASES[i+1]!.t) i++;
  const a = PHASES[i]!, b = PHASES[i+1]!;
  const f = (t - a.t) / Math.max(1e-4, b.t - a.t);
  const mix = (ka: number, kb: number) => _cA.setHex(ka).lerp(_cB.setHex(kb), f);

  skyUniforms.uTop.value.copy(mix(a.top,b.top));
  skyUniforms.uHorizon.value.copy(mix(a.hor,b.hor));
  skyUniforms.uSunCol.value.copy(mix(a.sun,b.sun));
  (scene.fog as THREE.Fog).color.copy(skyUniforms.uHorizon.value);

  const elev = Math.sin(t*Math.PI)*0.86 + 0.12;
  const az = (t - 0.5) * 2.1;
  _sd.set(Math.sin(az)*0.9, Math.max(elev,0.08), Math.cos(az)*0.55).normalize();
  skyUniforms.uSunDir.value.copy(_sd);
  key.position.copy(_sd).multiplyScalar(30).add(focus);
  key.target.position.copy(focus);
  key.color.copy(mix(a.key,b.key));
  key.intensity = a.ki + (b.ki - a.ki)*f;
  hemi.intensity = a.hemi + (b.hemi - a.hemi)*f;

  hour.name = a.name;
  hour.dark = t > 0.88 ? Math.min(1, (t - 0.88)/0.10) : (t < 0.06 ? 1 - t/0.06 : 0);
}

/** keep the dome centred on the eye so it never clips */
export function followCamera(){ sky.position.copy(camera.position); }
