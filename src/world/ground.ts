/* ============================================================
   Ground — gentle swells plus mown lanes between the rows
   ============================================================ */
import * as THREE from 'three';
import { GROUND_SIZE, ROWS, ROW_SPACING, PER_ROW, TREE_SPACING } from '../core/config';
import { toonSoft } from '../core/materials';
import { scene } from '../core/renderer';

export function groundHeightAt(x: number, z: number){
  return Math.sin(x*0.11)*0.22 + Math.cos(z*0.09)*0.20 + Math.sin((x+z)*0.06)*0.14;
}

/* z of each planted row */
export const rowZ: number[] = [];
for(let r=0;r<ROWS;r++) rowZ.push((r - (ROWS-1)/2) * ROW_SPACING);

function buildGround(){
  const geo = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE, 150, 150);
  geo.rotateX(-Math.PI/2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count*3);
  const grass = new THREE.Color(0x89B457);   // alley
  const mown  = new THREE.Color(0x9CC468);   // freshly cut centre of the alley
  const dirt  = new THREE.Color(0x9A8158);   // bare strip kept under the trees
  const c = new THREE.Color();
  for(let i=0;i<pos.count;i++){
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, groundHeightAt(x,z));
    let d = 1e9;
    for(const rz of rowZ) d = Math.min(d, Math.abs(z - rz));
    const inOrchard = Math.abs(x) < PER_ROW*TREE_SPACING/2 + 3.5;
    if(inOrchard && d < 1.5){
      c.copy(dirt).lerp(grass, Math.pow(d/1.5, 2.2));       // strip feathers into the grass
    } else if(inOrchard && d < 4.4){
      c.copy(mown);
      c.offsetHSL(0, 0, Math.sin(z*2.2)*0.016);             // mower stripes
    } else {
      c.copy(grass);
    }
    c.offsetHSL(0, (Math.random()-0.5)*0.035, (Math.random()-0.5)*0.045);
    colors[i*3]=c.r; colors[i*3+1]=c.g; colors[i*3+2]=c.b;
  }
  geo.computeVertexNormals();
  geo.setAttribute('color', new THREE.BufferAttribute(colors,3));
  const m = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ vertexColors:true, gradientMap:toonSoft }));
  m.receiveShadow = true;
  scene.add(m);
  return m;
}

export const groundMesh = buildGround();
