/* ============================================================
   The orchard plan — a drawn map in the corner, and the same
   thing full size when you want to read it properly.
   ============================================================ */
import * as THREE from 'three';
import { bounds, ROWS, PER_ROW, TREE_SPACING, BARN_W, BARN_D, BARN_ROT } from '../core/config';
import { state } from '../core/save';
import { pressed } from '../core/input';
import { apples, trees } from '../world/trees';
import { rowZ } from '../world/ground';
import { barn, barnDoorPoint } from '../world/barn';
import { character } from '../player/rig';
import { emit } from '../core/bus';
import { $ } from './hud';

/* the plan covers the fenced field with a little air around it, and the field
   grows — so these are worked out again whenever a plot is bought */
const PAD = 3;
let X0 = bounds.x1 - PAD, Z0 = bounds.z1 - PAD;
let SPAN_X = (bounds.x2 + PAD) - X0, SPAN_Z = (bounds.z2 + PAD) - Z0;

const INK    = '#5C4630';
const INK_2  = 'rgba(92,70,48,0.50)';
const PAPER  = '#F7EDD6';
const FIELD  = '#E9E4C4';
const ALLEY  = '#DED5B0';
const MOWN   = 'rgba(120,140,80,0.16)';
const LEAF   = '#7FA24C';
const LEAF_D = '#5E7C34';
const BARE   = 'rgba(120,140,80,0.22)';
const RED    = '#9E3F2B';
const CREAM  = '#FDF7EA';

/* a canvas on a phone is a quarter of the pixels it looks like it has */
const DPR = Math.min(2, Math.max(1, window.devicePixelRatio || 1));

/** the static half of the drawing: field, alleys, fence, barn */
let base: HTMLCanvasElement | null = null;
let baseW = 0, baseH = 0;

function drawBase(w: number, h: number){
  const c = document.createElement('canvas');
  c.width = Math.round(w*DPR); c.height = Math.round(h*DPR);
  const g = c.getContext('2d')!;
  g.scale(DPR, DPR);
  const sx = w/SPAN_X, sz = h/SPAN_Z;
  const px = (x: number) => (x - X0)*sx;
  const pz = (z: number) => (z - Z0)*sz;

  g.fillStyle = PAPER; g.fillRect(0,0,w,h);

  /* the grass inside the ring fence, so the margin reads as paper */
  g.fillStyle = FIELD;
  g.fillRect(px(bounds.x1), pz(bounds.z1), (bounds.x2-bounds.x1)*sx, (bounds.z2-bounds.z1)*sz);

  /* the mown alleys, one band per planted row, with the mower's stripes */
  const halfRow = PER_ROW*TREE_SPACING/2 + 3.5;
  for(const rz of rowZ){
    const y = pz(rz - 4.2), bh = 8.4*sz;
    g.fillStyle = ALLEY;
    g.fillRect(px(-halfRow), y, (halfRow*2)*sx, bh);
    g.strokeStyle = MOWN; g.lineWidth = 1;
    for(let x = -halfRow; x < halfRow; x += 3.2){
      g.beginPath(); g.moveTo(px(x), y); g.lineTo(px(x), y + bh); g.stroke();
    }
  }

  /* the headland the barn stands on */
  g.fillStyle = 'rgba(150,124,84,0.10)';
  g.fillRect(px(bounds.x1), pz(bounds.z1), (bounds.x2-bounds.x1)*sx, 9*sz);

  /* the fence, with a post every few metres */
  g.strokeStyle = INK; g.lineWidth = 1.4;
  g.setLineDash([4, 3]);
  g.strokeRect(px(bounds.x1), pz(bounds.z1), (bounds.x2-bounds.x1)*sx, (bounds.z2-bounds.z1)*sz);
  g.setLineDash([]);
  g.fillStyle = INK;
  const postR = Math.max(0.9, 1.5*(w/560));
  for(let x = bounds.x1; x <= bounds.x2; x += 8){
    for(const z of [bounds.z1, bounds.z2]){ g.beginPath(); g.arc(px(x), pz(z), postR, 0, 6.283); g.fill(); }
  }
  for(let z = bounds.z1; z <= bounds.z2; z += 8){
    for(const x of [bounds.x1, bounds.x2]){ g.beginPath(); g.arc(px(x), pz(z), postR, 0, 6.283); g.fill(); }
  }

  /* the barn, drawn as its actual footprint, with a ridge and a door */
  g.save();
  g.translate(px(barn.position.x), pz(barn.position.z));
  g.rotate(-BARN_ROT);
  const bw = BARN_W*sx, bd = BARN_D*sz;
  g.fillStyle = 'rgba(60,38,18,0.18)';
  g.fillRect(-bw/2 + 1.5, -bd/2 + 1.5, bw, bd);
  g.fillStyle = RED;
  g.fillRect(-bw/2, -bd/2, bw, bd);
  g.strokeStyle = INK; g.lineWidth = 1.2;
  g.strokeRect(-bw/2, -bd/2, bw, bd);
  g.strokeStyle = 'rgba(253,247,234,0.55)'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(0, -bd/2); g.lineTo(0, bd/2); g.stroke();      // the ridge
  g.fillStyle = CREAM;
  g.fillRect(-bw*0.20, bd/2 - 2, bw*0.40, 2.6);                          // the sliding doors
  g.restore();

  base = c; baseW = w; baseH = h;
}

interface Marks { x: number; z: number; kind: 'ladder' | 'barrow' | 'door' }

/** a soft paper disc, so an ink mark reads over grass as well as over paper */
function halo(g: CanvasRenderingContext2D, x: number, y: number, r: number, a = 0.72){
  g.save();
  g.globalAlpha = a;
  g.fillStyle = CREAM;
  g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill();
  g.restore();
}

function draw(canvas: HTMLCanvasElement, big: boolean){
  const w = canvas.width/DPR, h = canvas.height/DPR;
  if(!base || baseW !== w || baseH !== h) drawBase(w, h);
  const g = canvas.getContext('2d')!;
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
  const sx = w/SPAN_X, sz = h/SPAN_Z;
  const px = (x: number) => (x - X0)*sx;
  const pz = (z: number) => (z - Z0)*sz;

  g.clearRect(0,0,w,h);
  g.drawImage(base!, 0, 0, w, h);

  /* the trees: full while they still carry fruit, hollow once picked out */
  const left = new Map<THREE.Group, number>();
  for(const a of apples) if(!a.picked) left.set(a.treeGroup, (left.get(a.treeGroup) ?? 0) + 1);
  const r = big ? 6.2 : 3.6;
  for(let i=0;i<trees.length;i++){
    const t = trees[i]!;
    const n = left.get(t) ?? 0;
    const X = px(t.position.x), Z = pz(t.position.z);

    g.fillStyle = 'rgba(60,38,18,0.20)';                       // a little shadow, south-east
    g.beginPath(); g.arc(X + r*0.22, Z + r*0.24, r, 0, 6.283); g.fill();

    g.beginPath(); g.arc(X, Z, r, 0, 6.283);
    if(n){
      g.fillStyle = LEAF; g.globalAlpha = 0.55 + Math.min(1, n/10)*0.45;
      g.fill(); g.globalAlpha = 1;
      g.strokeStyle = LEAF_D; g.lineWidth = 1.2; g.stroke();
    } else {
      g.fillStyle = BARE; g.fill();
      g.strokeStyle = INK_2; g.setLineDash([2,2]); g.lineWidth = 1; g.stroke(); g.setLineDash([]);
    }
    /* what is left on it, once the plan is open big enough to read */
    if(big && n){
      g.fillStyle = CREAM;
      g.font = '600 8px Georgia, serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(String(n), X, Z + 0.5);
    }
    /* a pruned tree keeps a ring, so you can see what you have been through */
    if(state.prunedTrees.includes(i)){
      g.strokeStyle = 'rgba(158,63,43,0.75)'; g.lineWidth = 1;
      g.setLineDash([2,2]);
      g.beginPath(); g.arc(X, Z, r + 2.4, 0, 6.283); g.stroke();
      g.setLineDash([]);
    }
  }

  /* things you have left lying about */
  const marks: Marks[] = [{ x:barnDoorPoint.x, z:barnDoorPoint.z, kind:'door' }];
  if(state.ladder) marks.push({ x:state.ladder.x, z:state.ladder.z, kind:'ladder' });
  if(state.barrow && !state.carried.includes('barrow'))
    marks.push({ x:state.barrow.x, z:state.barrow.z, kind:'barrow' });

  const ms = big ? 1.25 : 1;
  for(const m of marks){
    const X = px(m.x), Z = pz(m.z);
    halo(g, X, Z, 6.5*ms, 0.78);
    g.strokeStyle = m.kind === 'door' ? RED : INK;
    g.lineWidth = 1.7;
    if(m.kind === 'ladder'){
      g.beginPath();
      g.moveTo(X-3*ms, Z-4.4*ms); g.lineTo(X-3*ms, Z+4.4*ms);
      g.moveTo(X+3*ms, Z-4.4*ms); g.lineTo(X+3*ms, Z+4.4*ms);
      for(let i=-3;i<=3;i+=3){ g.moveTo(X-3*ms, Z+i*ms); g.lineTo(X+3*ms, Z+i*ms); }
      g.stroke();
    } else if(m.kind === 'barrow'){
      g.beginPath(); g.arc(X, Z + 1.4*ms, 2.9*ms, 0, 6.283); g.stroke();
      g.beginPath(); g.moveTo(X - 3.4*ms, Z - 3.6*ms); g.lineTo(X + 3.4*ms, Z - 3.6*ms);
      g.lineTo(X + 1.6*ms, Z + 1.2*ms); g.lineTo(X - 1.6*ms, Z + 1.2*ms); g.closePath(); g.stroke();
    } else {
      g.beginPath(); g.arc(X, Z, (big ? 4 : 2.8), 0, 6.283); g.fillStyle = RED; g.fill();
      g.strokeStyle = CREAM; g.lineWidth = 1.4; g.stroke();
    }
  }

  /* ---- the bear, and the way it is looking ---- */
  const bx = px(character.position.x), bz = pz(character.position.z);
  const a = character.rotation.y;
  const len = big ? 17 : 11;

  g.save();
  g.translate(bx, bz);
  /* The plan draws +z down the page, so a bear facing +z (rotation.y 0) must
     point down it. The mark is drawn nose-up, hence the half turn. */
  g.rotate(Math.PI - a);

  /* the arc of what is in front of it */
  g.beginPath();
  g.moveTo(0,0);
  g.arc(0, 0, len*2.0, -Math.PI/2 - 0.52, -Math.PI/2 + 0.52);
  g.closePath();
  g.fillStyle = 'rgba(158,63,43,0.20)';
  g.fill();
  g.strokeStyle = 'rgba(158,63,43,0.40)'; g.lineWidth = 1;
  g.setLineDash([3,3]); g.stroke(); g.setLineDash([]);

  /* a paper disc under it, so the mark reads over grass as well as over paper */
  halo(g, 0, 0, len*0.64, 0.92);

  /* the mark itself: a wide cream edge, an ink edge inside it, then the fill.
     Stroking before filling keeps the whole triangle its own colour. */
  g.beginPath();
  g.moveTo(0, -len*0.64);
  g.lineTo(len*0.44, len*0.46);
  g.lineTo(0, len*0.18);
  g.lineTo(-len*0.44, len*0.46);
  g.closePath();
  g.lineJoin = 'round';
  g.strokeStyle = CREAM; g.lineWidth = big ? 4.2 : 3.2; g.stroke();
  g.strokeStyle = '#5C2A1C'; g.lineWidth = big ? 2.0 : 1.5; g.stroke();
  g.fillStyle = RED; g.fill();
  g.restore();

  if(big){
    g.fillStyle = INK;
    g.font = 'italic 12px Georgia, serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('Pom', bx, bz + 27);

    /* north, and something to measure by */
    g.strokeStyle = INK; g.fillStyle = INK; g.lineWidth = 1.4;
    const nx = w - 26, ny = 26;
    g.beginPath(); g.moveTo(nx, ny + 11); g.lineTo(nx, ny - 11); g.stroke();
    g.beginPath(); g.moveTo(nx, ny - 13); g.lineTo(nx - 4, ny - 5); g.lineTo(nx + 4, ny - 5); g.closePath(); g.fill();
    g.font = '10px Georgia, serif';
    g.fillText('N', nx, ny + 20);
    const bar = 10*sx;                                    // ten metres
    g.beginPath(); g.moveTo(18, h - 18); g.lineTo(18 + bar, h - 18);
    g.moveTo(18, h - 21); g.lineTo(18, h - 15);
    g.moveTo(18 + bar, h - 21); g.lineTo(18 + bar, h - 15);
    g.stroke();
    g.textAlign = 'left';
    g.fillText('10 m', 18, h - 27);
  }
}

/* ---- the corner map ---- */
const mini = document.createElement('canvas');
mini.className = 'minimap panel';
/* the backing store is drawn at device resolution; CSS still owns the size */
mini.width = Math.round(150*DPR); mini.height = Math.round(150*(SPAN_Z/SPAN_X)*DPR);
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
      <div><div class="crumbs" id="mapCrumbs"></div>
        <h2>The Orchard Plan</h2><p id="mapSub"></p></div>
      <button class="btn x" id="mapClose">Close</button>
    </div>
    <div class="map-body">
      <canvas id="bigmap"></canvas>
      <div class="legend">
        <span><i style="background:#7FA24C"></i> fruit still on the tree</span>
        <span><i style="background:rgba(120,140,80,0.22);border:1px dashed #5C4630"></i> picked out</span>
        <span><i style="background:transparent;border:1px dashed #9E3F2B"></i> pruned</span>
        <span><i style="background:#9E3F2B"></i> the barn door</span>
        <span><i style="background:#9E3F2B;border:2px solid #FDF7EA"></i> Pom, and what it faces</span>
      </div>
      <p class="lede" style="margin:12px 0 0">Tap the plan to send Pom walking there.</p>
    </div>
  </div>`;
document.body.appendChild(sheet);

const big = sheet.querySelector<HTMLCanvasElement>('#bigmap')!;
big.width = Math.round(560*DPR); big.height = Math.round(560*(SPAN_Z/SPAN_X)*DPR);

sheet.querySelector<HTMLElement>('#mapClose')!.onclick = () => closeMap();
sheet.addEventListener('pointerdown', e => { if(e.target === sheet) closeMap(); });

big.addEventListener('click', e => {
  const r = big.getBoundingClientRect();
  const fx = (e.clientX - r.left)/r.width, fz = (e.clientY - r.top)/r.height;
  const x = X0 + fx*SPAN_X, z = Z0 + fz*SPAN_Z;
  if(x < bounds.x1 || x > bounds.x2 || z < bounds.z1 || z > bounds.z2) return;
  emit('walk:to', { point: new THREE.Vector3(x, 0, z) });
  closeMap();
});

export const mapOpen = () => sheet.classList.contains('on');

/** opened from the pause menu, so the plan keeps a way back to it */
export function openMap(from: 'menu' | null = null){
  sheet.classList.add('on');
  const crumbs = sheet.querySelector<HTMLElement>('#mapCrumbs')!;
  crumbs.innerHTML = from
    ? `<button class="crumb" id="mapBack">‹ Menu</button><span class="sep">/</span><span>The plan</span>`
    : '';
  if(from) sheet.querySelector<HTMLElement>('#mapBack')!.onclick = () => {
    closeMap();
    emit('menu:open');
  };
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

/** the farm grew: work the extent out again and resize both drawings to it */
export function syncMapExtent(){
  X0 = bounds.x1 - PAD; Z0 = bounds.z1 - PAD;
  SPAN_X = (bounds.x2 + PAD) - X0; SPAN_Z = (bounds.z2 + PAD) - Z0;
  mini.height = Math.round(150*(SPAN_Z/SPAN_X)*DPR);
  big.height  = Math.round(560*(SPAN_Z/SPAN_X)*DPR);
  invalidateMap();
}

void ROWS;
