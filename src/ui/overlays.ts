/* ============================================================
   Overlays — the pause menu, and the barn's paper record:
   almanac, ledger, settings, about
   ============================================================ */
import { APPLE_TYPES, TYPE_KEYS, CRATE_CAPACITY, ROWS, PER_ROW } from '../core/config';
import type { AppleType } from '../core/config';
import { state, save, resetSeason, basketTotal, storedTotal, varietiesFound } from '../core/save';
import { emit } from '../core/bus';
import { apples, regrowAll } from '../world/trees';
import { SPAWN } from '../player/rig';
import { updateBasketFruit } from '../player/picking';
import { applySettings } from '../core/settings';
import { $, renderBasket, toast } from './hud';

export const overlayOpen = () => document.querySelector('.overlay.on') !== null;

function openOverlay(id: string){ $(id).classList.add('on'); }
export function closeOverlays(){
  document.querySelectorAll('.overlay').forEach(o => o.classList.remove('on'));
}

type BarnTab = 'almanac' | 'ledger' | 'settings' | 'about';
let barnTab: BarnTab = 'almanac';

export function openBarn(tab: BarnTab = 'almanac'){
  barnTab = tab;
  openOverlay('barnOverlay');
  document.querySelectorAll<HTMLElement>('#barnTabs .tab')
    .forEach(t => t.classList.toggle('on', t.dataset.tab === barnTab));
  renderBarn();
}

export function openMenu(){
  $('menuBarnHint').textContent = `${storedTotal()} apples stored`;
  openOverlay('menuOverlay');
}

const LORE = [
  { title:'Why the rows run straight', need:()=>true,
    body:'Orchards are planted in rows so every tree gets the same light and the same air. Rows set north to south give both sides of a tree an even share of the sun, and the gap between them — the alley — is sized for whatever has to drive down it.' },
  { title:'Every apple is a clone', need:()=> state.picked >= 8,
    body:'Plant a seed from a Honeycrisp and you get something else entirely; apples do not come true from seed. Every Honeycrisp on earth is a cutting from one 1960s seedling, grafted onto other roots.' },
  { title:'Taking fruit off on purpose', need:()=> state.picked >= 20,
    body:'Growers thin the young fruit in early summer, pulling off perfectly good apples. Left alone a tree over-crops, sizes everything down, and exhausts itself into bearing only every other year.' },
  { title:'Two trees, or none', need:()=> varietiesFound() >= 3,
    body:'Most apples cannot pollinate themselves. A block of one variety sets almost nothing, so orchards interplant a second variety that blooms at the same time, and keep bees within flying distance of both.' },
  { title:'Sleeping through the winter', need:()=> state.deposited >= 20,
    body:'Cold storage slows an apple down; controlled-atmosphere storage nearly stops it, dropping the oxygen until the fruit barely breathes. It is why an apple picked in October is crisp the following June.' },
];

export function renderBarn(){
  if(!$('barnOverlay').classList.contains('on')) return;
  const body = $('barnBody'), head = $('barnSub');

  if(barnTab === 'almanac'){
    head.textContent = 'What the orchard teaches, a page at a time';
    let html = '<p class="lede">Varieties open as you pick them. The longer pages open as the season goes on.</p><div class="cards">';
    for(const k of TYPE_KEYS){
      const def = APPLE_TYPES[k], seen = state.discovered[k];
      html += `<div class="card${seen?'':' locked'}">
        <h3><span class="dot" style="background:${def.crate}"></span>${seen?def.label:'Not yet picked'}</h3>
        <p>${seen?def.note:'Pick one from the rows to open this page.'}</p></div>`;
    }
    for(const l of LORE){
      const ok = l.need();
      html += `<div class="card${ok?'':' locked'}"><h3>❦ ${ok?l.title:'A page still folded'}</h3>
        <p>${ok?l.body:'Keep picking and storing; this page opens later in the season.'}</p></div>`;
    }
    body.innerHTML = html + '</div>';
  }

  else if(barnTab === 'ledger'){
    head.textContent = 'The season so far';
    const barrels = TYPE_KEYS.map(k => {
      const def = APPLE_TYPES[k];
      const pct = Math.round(Math.min(1, state.stored[k]/CRATE_CAPACITY)*100);
      return `<div class="stat"><b>${state.stored[k]}</b><span>${state.discovered[k]?def.label:'Unlabelled'}</span>
        <div class="bar"><i style="width:${pct}%;background:${def.crate}"></i></div></div>`;
    }).join('');
    body.innerHTML = `<div class="stat-grid">
      <div class="stat"><b>${state.picked}</b><span>Picked</span></div>
      <div class="stat"><b>${storedTotal()}</b><span>In the barrels</span></div>
      <div class="stat"><b>${basketTotal()}</b><span>In hand</span></div>
      <div class="stat"><b>${varietiesFound()}/${TYPE_KEYS.length}</b><span>Varieties</span></div>
      <div class="stat"><b>${state.prunedTrees.length}</b><span>Trees pruned</span></div>
      <div class="stat"><b>${state.day}</b><span>Day</span></div>
    </div>
    <p class="lede" style="margin:16px 0 10px">The barrels along the barn wall:</p>
    <div class="stat-grid">${barrels}</div>
    <p class="lede" style="margin-top:16px">${ROWS} rows of ${PER_ROW} trees, ${apples.length} apples set this season. ${apples.filter(a=>!a.picked).length} still on the branch.</p>`;
  }

  else if(barnTab === 'settings'){
    head.textContent = 'Quality and comfort';
    const sw = (k: keyof typeof state.settings, label: string, desc: string) =>
      `<div class="toggle"><div>${label}<div style="font-size:11.5px;color:var(--ink-soft)">${desc}</div></div>
      <div class="sw${state.settings[k]?' on':''}" data-set="${k}"><i></i></div></div>`;
    body.innerHTML =
      sw('shadows','Cast shadows','Softer light, heavier on older machines') +
      sw('outlines','Ink outlines','The drawn-in-pen look around every shape') +
      sw('petals','Drifting petals','Blossom and leaves on the breeze') +
      sw('calm','Calm motion','Slows the sway, the wind, and the camera') +
      sw('map','Show the plan','The orchard map in the corner') +
      sw('invertY','Invert the drag','Pull down to look down') +
      `<div class="row-actions"><button class="btn" id="resetSeason">Start a fresh season</button></div>`;
    body.querySelectorAll<HTMLElement>('.sw').forEach(el => el.onclick = ()=>{
      const k = el.dataset.set as keyof typeof state.settings;
      state.settings[k] = !state.settings[k];
      applySettings(); save(); renderBarn();
    });
    $('resetSeason').onclick = ()=>{
      resetSeason();
      renderBasket(); updateBasketFruit(); renderBarn();
      toast('A fresh season. The trees have set new fruit.');
      regrowAll();
    };
  }

  else {
    head.textContent = 'About';
    body.innerHTML = `<p class="lede">Orchard Hours is a small, slow game about picking apples in a planted orchard and putting them away properly.</p>
      <div class="cards">
        <div class="card"><h3>Walking about</h3><p><b>W A S D</b> to walk, <b>Shift</b> to hurry, <b>Space</b> to hop. Drag to swing the camera around Pom, scroll or pinch to pull back. The arrow keys nudge the view too.</p></div>
        <div class="card"><h3>Picking</h3><p>Tap an apple and Pom walks over and picks it. Tap the ground to wander there. Anything high in the canopy needs the picking pole.</p></div>
        <div class="card"><h3>Tools</h3><p><b>1</b>–<b>5</b> take a tool out, <b>X</b> puts it away, <b>E</b> uses whatever is in front of you. Tools live on the rack inside the barn.</p></div>
        <div class="card"><h3>The barn</h3><p>Walk in through the doors. Tip the basket into the barrels along the wall, read the chalkboard, and take what you need off the rack. <b>M</b> opens the plan, <b>Esc</b> the menu.</p></div>
      </div>`;
  }
}

/* ---- wiring ---- */
export function initOverlays(){
  $('btnMenu').onclick = openMenu;
  $('menuClose').onclick = closeOverlays;
  $('btnBarn').onclick = ()=> openBarn('almanac');
  $('barnClose').onclick = closeOverlays;

  document.querySelectorAll('.overlay').forEach(o =>
    o.addEventListener('pointerdown', e => { if(e.target === o) closeOverlays(); }));

  document.querySelectorAll<HTMLElement>('#barnTabs .tab')
    .forEach(t => t.onclick = ()=> openBarn(t.dataset.tab as BarnTab));

  document.querySelectorAll<HTMLElement>('#menuOverlay .menu-item').forEach(b => b.onclick = ()=>{
    const act = b.dataset.act;
    closeOverlays();
    if(act === 'barn')     emit('walk:barn');
    if(act === 'settings') openBarn('settings');
    if(act === 'about')    openBarn('about');
    if(act === 'recenter') emit('walk:to', { point: SPAWN.clone() });
  });
}

/** tip the basket into the barrels; the barn interior calls this */
export function deposit(only: AppleType | null){
  let moved = 0;
  for(const k of TYPE_KEYS){
    if(only && k !== only) continue;
    moved += state.basket[k];
    state.stored[k] += state.basket[k];
    state.basket[k] = 0;
  }
  if(!moved) return 0;
  state.deposited += moved;
  renderBasket(); updateBasketFruit(); renderBarn(); save();
  toast(`${moved} ${moved===1?'apple':'apples'} into the ${only ? APPLE_TYPES[only].label + ' barrel' : 'barrels'}`);
  return moved;
}
