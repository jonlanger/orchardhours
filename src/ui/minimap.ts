/* ============================================================
   The orchard plan — a drawn map in the corner, and the same
   thing full size when you want to read it properly.
   ============================================================ */
import * as THREE from 'three';
import { FX1, FX2, FZ1, FZ2, ROWS, PER_ROW, TREE_SPACING, BARN_W, BARN_D, BARN_ROT } from '../core/config';
import { state } from '../core/save';
import { pressed } from '../core/input';
import { apples, trees } from '../world/trees';
import { rowZ } from '../world/ground';
import { barn, barnDoorPoint } from '../world/barn';
import { character } from '../player/rig';
import { emit } from '../core/bus';
import { $ } from './hud';

/* the plan covers the fenced field with a little air around it */
const PAD = 3;
const X0 = FX1 - PAD, X1 = FX2 + PAD, Z0 = FZ1 - PAD, Z1 = FZ2 + PAD;
const SPAN_X = X1 - X0, SPAN_Z = Z1 - Z0;

const INK   = '#6B533F';
const INK_2 = 'rgba(107,83,63,0.42)';
const PAPER = '#F6EBD3';
const ALLEY = '#E4DBBE';
const LEAF  = '#8CA75C';
const BARE  = 'rgba(140,167,92,0.30)';
const RED   = '#9E3F2B';

/** the static half of the drawing: fence, alleys, rows, barn */
let base: HTMLCanvasElement | null = null;
let baseW = 0, baseH = 0;

function drawBase(w: number, h: number){
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  const sx = w/SPAN_X, sz = h/SPAN_Z;
  const px = (x: number) => (x - X0)*sx;
  const pz = (z: number) => (z - Z0)*sz;

  g.fillStyle = PAPER; g.fillRect(0,0,w,h);

  /* the mown alleys, one band per planted row */
  g.fillStyle = ALLEY;
  const halfRow = PER_ROW*TREE_SPACING/2 + 3.5;
  for(const rz of rowZ){
    g.fillRect(px(-halfRow), pz(rz - 4.2), (halfRow*2)*sx, 8.4*sz);
  }

  /* the fence */
  g.strokeStyle = INK; g.lineWidth = 1.6;
  g.setLineDash([5, 3]);
  g.strokeRect(px(FX1), pz(FZ1), (FX2-FX1)*sx, (FZ2-FZ1)*sz);
  g.setLineDash([]);

  /* the barn, drawn as its actual footprint */
  g.save();
  g.translate(px(barn.position.x), pz(barn.position.z));
  g.rotate(-BARN_ROT);
  g.fillStyle = RED;
  g.fillRect(-BARN_W/2*sx, -BARN_D/2*sz, BARN_W*sx, BARN_D*sz);
  g.strokeStyle = INK; g.lineWidth = 1.2;
  g.strokeRect(-BARN_W/2*sx, -BARN_D/2*sz, BARN_W*sx, BARN_D*sz);
  g.restore();

  base = c; baseW = w; baseH = h;
}

interface Marks { x: number; z: number; kind: 'ladder' | 'barrow' | 'door' }

function draw(canvas: HTMLCanvasElement, big: boolean){
  const w = canvas.width, h = canvas.height;
  if(!base || baseW !== w || baseH !== h) drawBase(w, h);
  const g = canvas.getContext('2d')!;
  const sx = w/SPAN_X, sz = h/SPAN_Z;
  const px = (x: number) => (x - X0)*sx;
  const pz = (z: number) => (z - Z0)*sz;

  g.clearRect(0,0,w,h);
  g.drawImage(base!, 0, 0);

  /* the trees: filled while they still carry fruit, hollow once picked out */
  const left = new Map<THREE.Group, number>();
  for(const a of apples) if(!a.picked) left.set(a.treeGroup, (left.get(a.treeGroup) ?? 0) + 1);
  const r = big ? 5.5 : 3.0;
  for(const t of trees){
    const n = left.get(t) ?? 0;
    g.beginPath();
    g.arc(px(t.position.x), pz(t.position.z), r, 0, 6.283);
    if(n){
      g.fillStyle = LEAF; g.globalAlpha = 0.45 + Math.min(1, n/10)*0.55;
      g.fill(); g.globalAlpha = 1;
      g.strokeStyle = INK_2; g.lineWidth = 1; g.stroke();
    } else {
      g.fillStyle = BARE; g.fill();
      g.strokeStyle = INK_2; g.setLineDash([2,2]); g.lineWidth = 1; g.stroke(); g.setLineDash([]);
    }
  }

  /* things you have left lying about */
  const marks: Marks[] = [{ x:barnDoorPoint.x, z:barnDoorPoint.z, kind:'door' }];
  if(state.ladder) marks.push({ x:state.ladder.x, z:state.ladder.z, kind:'ladder' });
  if(state.barrow && !state.carried.includes('barrow'))
    marks.push({ x:state.barrow.x, z:state.barrow.z, kind:'barrow' });

  for(const m of marks){
    const X = px(m.x), Z = pz(m.z);
    g.strokeStyle = m.kind === 'door' ? RED : INK;
    g.lineWidth = 1.6;
    if(m.kind === 'ladder'){
      g.beginPath(); g.moveTo(X-3, Z-4); g.lineTo(X-3, Z+4); g.moveTo(X+3, Z-4); g.lineTo(X+3, Z+4);
      for(let i=-3;i<=3;i+=3){ g.moveTo(X-3, Z+i); g.lineTo(X+3, Z+i); }
      g.stroke();
    } else if(m.kind === 'barrow'){
      g.beginPath(); g.arc(X, Z, 3.2, 0, 6.283); g.stroke();
      g.beginPath(); g.moveTo(X, Z-4.6); g.lineTo(X, Z+4.6); g.stroke();
    } else {
      g.beginPath(); g.arc(X, Z, big ? 4 : 2.6, 0, 6.283); g.fillStyle = RED; g.fill();
    }
  }

  /* the bear, an arrow pointing where it is looking */
  const bx = px(character.position.x), bz = pz(character.position.z);
  const a = character.rotation.y;
  const len = big ? 11 : 7;
  g.save();
  g.translate(bx, bz);
  g.rotate(-a);                        // +z is down the page, and rotation.y turns from +z
  g.beginPath();
  g.moveTo(0, -len*0.62);
  g.lineTo(len*0.40, len*0.42);
  g.lineTo(0, len*0.18);
  g.lineTo(-len*0.40, len*0.42);
  g.closePath();
  g.fillStyle = RED; g.fill();
  g.strokeStyle = '#FDF7EA'; g.lineWidth = 1.4; g.stroke();
  g.restore();
}

/* ---- the corner map ---- */
const mini = document.createElement('canvas');
mini.className = 'minimap panel';
mini.width = 150; mini.height = 150 * (SPAN_Z/SPAN_X);
$('ui').appendChild(mini);

/* ---- the full plan ---- */
const sheet = document.createElement('div');
sheet.className = 'overlay';
sheet.id = 'mapOverlay';
sheet.innerHTML = `
  <div class="sheet panel" style="width:min(620px,94vw)">
    <div class="sheet-head">
      <svg class="mark" viewBox="0 0 40 40" aria-hidden="true">
        <path d="M8 9h24v22H8z" fill="none" stroke="#9E3F2B" stroke-width="2" stroke-dasharray="4 3"/>
        <circle cx="16" cy="18" r="3" fill="#8CA75C"/><circle cx="26" cy="24" r="3" fill="#8CA75C"/>
      </svg>
      <div><h2>The Orchard Plan</h2><p id="mapSub"></p></div>
      <button class="btn x" id="mapClose">Close</button>
    </div>
    <div class="map-body">
      <canvas id="bigmap"></canvas>
      <div class="legend">
        <span><i style="background:#8CA75C"></i> fruit still on the tree</span>
        <span><i style="background:rgba(140,167,92,0.30);border:1px dashed #6B533F"></i> picked out</span>
        <span><i style="background:#9E3F2B"></i> the barn door, and you</span>
      </div>
      <p class="lede" style="margin:12px 0 0">Tap the plan to send Pom walking there.</p>
    </div>
  </div>`;
document.body.appendChild(sheet);

const big = sheet.querySelector<HTMLCanvasElement>('#bigmap')!;
big.width = 560; big.height = Math.round(560 * (SPAN_Z/SPAN_X));

sheet.querySelector<HTMLElement>('#mapClose')!.onclick = () => closeMap();
sheet.addEventListener('pointerdown', e => { if(e.target === sheet) closeMap(); });

big.addEventListener('click', e => {
  const r = big.getBoundingClientRect();
  const fx = (e.clientX - r.left)/r.width, fz = (e.clientY - r.top)/r.height;
  const x = X0 + fx*SPAN_X, z = Z0 + fz*SPAN_Z;
  if(x < FX1 || x > FX2 || z < FZ1 || z > FZ2) return;
  emit('walk:to', { point: new THREE.Vector3(x, 0, z) });
  closeMap();
});

export const mapOpen = () => sheet.classList.contains('on');
export function openMap(){
  sheet.classList.add('on');
  $('mapSub').textContent =
    `${apples.filter(a=>!a.picked).length} apples still on the branch · day ${state.day}`;
  draw(big, true);
}
export function closeMap(){ sheet.classList.remove('on'); }

let acc = 0;
export function updateMinimap(dt: number){
  if(pressed('map')) mapOpen() ? closeMap() : openMap();

  mini.style.display = state.settings.map ? '' : 'none';
  acc += dt;
  if(acc < 0.1) return;
  acc = 0;
  if(state.settings.map) draw(mini, false);
  if(mapOpen()) draw(big, true);
}

/** the trees change, so the base drawing outlives nothing but the geometry */
export function invalidateMap(){ base = null; }

void ROWS;
