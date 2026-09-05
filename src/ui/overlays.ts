/* ============================================================
   Overlays — the pause menu, and the barn's paper record:
   almanac, ledger, settings, about
   ============================================================ */
import { APPLE_TYPES, TYPE_KEYS, CRATE_CAPACITY, GOODS, GOOD_KEYS } from '../core/config';
import type { AppleType } from '../core/config';
import { state, save, resetSeason, basketTotal, storedTotal, varietiesFound } from '../core/save';
import { emit, on } from '../core/bus';
import { isTouch } from '../core/input';
import { apples, trees, regrowAll } from '../world/trees';
import { SPAWN } from '../player/rig';
import { updateBasketFruit } from '../player/picking';
import { clearFalls } from '../player/antics';
import { renderCatalogue } from './catalogue';
import { applySettings } from '../core/settings';
import { $, renderBasket, toast } from './hud';
import { openMap } from './minimap';

export const overlayOpen = () => document.querySelector('.overlay.on') !== null;

function openOverlay(id: string){ $(id).classList.add('on'); }
export function closeOverlays(){
  document.querySelectorAll('.overlay').forEach(o => o.classList.remove('on'));
}

type BarnTab = 'almanac' | 'ledger' | 'catalogue' | 'settings' | 'about';
const TAB_NAME: Record<BarnTab, string> = {
  almanac:'Almanac', ledger:'Ledger', catalogue:'Catalogue',
  about:'How to play', settings:'Settings',
};
let barnTab: BarnTab = 'almanac';
/** how you got here, so there is a way back to it */
let cameFrom: 'menu' | null = null;

export function openBarn(tab: BarnTab = 'almanac', from: 'menu' | null = null){
  barnTab = tab;
  cameFrom = from;
  openOverlay('barnOverlay');
  document.querySelectorAll<HTMLElement>('#barnTabs .tab')
    .forEach(t => t.classList.toggle('on', t.dataset.tab === barnTab));
  renderCrumbs();
  renderBarn();
}

/** a trail back to wherever this sheet was opened from */
function renderCrumbs(){
  const el = $('barnCrumbs');
  if(!cameFrom){ el.innerHTML = ''; return; }
  el.innerHTML = `<button class="crumb" id="crumbBack">‹ Menu</button>
    <span class="sep">/</span><span>${TAB_NAME[barnTab]}</span>`;
  $('crumbBack').onclick = () => { closeOverlays(); openMenu(); };
}

const KEYS: [string, string][] = [
  ['W A S D','walk'], ['Shift','hurry'], ['Space','hop'], ['E','use'],
  ['1–5','tools'], ['X','put away'], ['F','eat'], ['C','sit'], ['R','throw'],
  ['M','the plan'], ['B','the almanac'],
];

export function openMenu(){
  $('menuBarnHint').textContent = `${storedTotal()} apples stored`;
  $('menuKeys').innerHTML = isTouch
    ? `<span>Tap an apple and Pom walks over and picks it. Tap the ground to wander.
       The stick walks, <b>E</b> uses what is in front of you, and the small buttons
       eat, sit and throw.</span>`
    : KEYS.map(([k,what]) => `<span><b>${k}</b> ${what}</span>`).join('')
      + `<span class="wide">Tap an apple to send Pom over to pick it · drag to swing the camera</span>`;
  openOverlay('menuOverlay');
}

const LORE = [
  { title:'Why the rows run straight', need:()=>true,
    body:'Orchards are planted in rows so every tree gets the same light and the same air. Rows set north to south give both sides of a tree an even share of the sun, and the gap between them — the alley — is sized for whatever has to drive down it.' },
  { title:'How an apple is taken off', need:()=> state.picked >= 3,
    body:'Never pull down on fruit. Cup the apple in your palm with a finger on the stem, roll it upwards until the calyx — the dry star on the bottom — is pointing at the top of the tree, and give it a small twist. A ripe one comes away stem and all. Yank it and the fruiting spur comes with it, and that spur is where next year\'s apples were going to be.' },
  { title:'Every apple is a clone', need:()=> state.picked >= 8,
    body:'Plant a seed from a Honeycrisp and you get something else entirely; apples do not come true from seed. Every Honeycrisp on earth is a cutting from one 1960s seedling, grafted onto other roots.' },
  { title:'Taking fruit off on purpose', need:()=> state.picked >= 20,
    body:'Growers thin the young fruit in early summer, pulling off perfectly good apples. Left alone a tree over-crops, sizes everything down, and exhausts itself into bearing only every other year.' },
  { title:'Two trees, or none', need:()=> varietiesFound() >= 3,
    body:'Most apples cannot pollinate themselves. A block of one variety sets almost nothing, so orchards interplant a second variety that blooms at the same time, and keep bees within flying distance of both.' },
  { title:'Where a new tree comes from', need:()=> state.saplings > 0 || state.growing.length > 0,
    body:'A nursery sapling is two trees at once: a rootstock chosen for how big it will let the tree get, and a scion of the variety you actually want, grafted on above it. Buy a dwarfing rootstock and the tree bears in three years and stays inside a ladder\'s reach; buy a vigorous one and you will be picking off the top of a long pole for a generation.' },
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
      <div class="stat"><b>${state.purse}</b><span>Shillings</span></div>
      <div class="stat"><b>${state.sold}</b><span>Earned this season</span></div>
      <div class="stat"><b>${Math.round(state.vigour*100)}%</b><span>Vigour left</span>
        <div class="bar"><i style="width:${Math.round(state.vigour*100)}%;background:${
          state.vigour < 0.13 ? '#9E3F2B' : state.vigour < 0.36 ? '#D9A441' : '#8FBF4F'}"></i></div></div>
    </div>
    <p class="lede" style="margin:16px 0 10px">The barrels along the barn wall:</p>
    <div class="stat-grid">${barrels}</div>
    ${GOOD_KEYS.some(g => state.goods[g]) ? `
      <p class="lede" style="margin:16px 0 10px">On the shelf, made from what the barrels held:</p>
      <div class="stat-grid">${GOOD_KEYS.filter(g => state.goods[g]).map(g =>
        `<div class="stat"><b>${state.goods[g]}</b><span>${GOODS[g].plural}</span></div>`).join('')}</div>` : ''}
    <p class="lede" style="margin-top:16px">${trees.length} trees, ${apples.length} apples set this season. ${apples.filter(a=>!a.picked).length} still on the branch${state.growing.length ? `, and ${state.growing.length} young ${state.growing.length===1?'tree':'trees'} coming on` : ''}.</p>`;
  }

  else if(barnTab === 'catalogue'){
    renderCatalogue(body, head);
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
      renderBasket(); updateBasketFruit(); renderBarn(); clearFalls();
      regrowAll();
      /* the orchard itself has to be built again — trees planted from saplings,
         machines in the barn and a fence that moved all came out of the save */
      toast('A fresh season. Laying the orchard out again…');
      setTimeout(() => location.reload(), 1200);
    };
  }

  else {
    head.textContent = 'What to do out there';
    body.innerHTML = `<p class="lede">Orchard Hours is a small, slow game about picking apples in a planted orchard and putting them away properly. There is nothing to lose and no clock to beat.</p>
      <div class="cards">
        <div class="card"><h3>Where to start</h3><p>Tap an apple within reach and Pom walks over and picks it. When the basket is full, walk into the barn and tip it into the barrels. The tools on the rack inside open up everything else — take the pole first.</p></div>
        <div class="card"><h3>Walking about</h3><p><b>W A S D</b> to walk, <b>Shift</b> to hurry, <b>Space</b> to hop. Drag to swing the camera around Pom, scroll or pinch to pull back. The arrow keys nudge the view too.</p></div>
        <div class="card"><h3>Picking</h3><p>Tap an apple and Pom walks over and picks it — cupped, rolled upwards and twisted off, the way it is done in a real orchard. Tap the ground to wander there. Anything high in the canopy needs the picking pole.</p></div>
        <div class="card"><h3>Resting up</h3><p>Reaching all day is work, and the meter under the buttons is what Pom has left. <b>F</b> eats an apple out of the basket, <b>C</b> sits down in the grass, and a night's sleep puts it all back. <b>R</b> throws one down the alley, for no reason at all.</p></div>
        <div class="card"><h3>Tools</h3><p><b>1</b>–<b>5</b> take a tool out, <b>X</b> puts it away, <b>E</b> uses whatever is in front of you. Tools live on the rack inside the barn.</p></div>
        <div class="card"><h3>The catalogue</h3><p>There is a writing desk in the barn with a merchant's catalogue on it. Sell fruit out of the barrels, and the cider, jelly and dried rings the barn makes from it. Everything ordered — a press, a kettle, a rack, saplings, or the deed to the next field — comes with the following morning's post.</p></div>
        <div class="card"><h3>The barn</h3><p>Walk in through the doors. Tip the basket into the barrels along the wall, read the chalkboard, and take what you need off the rack. <b>M</b> opens the plan, <b>Esc</b> the menu.</p></div>
      </div>`;
  }
}

/* ---- wiring ---- */
export function initOverlays(){
  on('menu:open', () => openMenu());
  on('barn:render', () => renderBarn());
  on('catalogue:open', () => openBarn('catalogue'));
  $('btnMenu').onclick = openMenu;
  $('menuClose').onclick = closeOverlays;
  $('btnBarn').onclick = ()=> openBarn('almanac');
  $('btnMap').onclick = () => openMap();
  $('barnClose').onclick = closeOverlays;

  document.querySelectorAll('.overlay').forEach(o =>
    o.addEventListener('pointerdown', e => { if(e.target === o) closeOverlays(); }));

  document.querySelectorAll<HTMLElement>('#barnTabs .tab')
    .forEach(t => t.onclick = ()=> openBarn(t.dataset.tab as BarnTab, cameFrom));

  document.querySelectorAll<HTMLElement>('#menuOverlay .menu-item').forEach(b => b.onclick = ()=>{
    const act = b.dataset.act;
    closeOverlays();
    if(act === 'barn')     emit('walk:barn');
    if(act === 'settings') openBarn('settings', 'menu');
    if(act === 'help')     openBarn('about', 'menu');
    if(act === 'map')      openMap('menu');
    if(act === 'recenter') emit('walk:to', { point: SPAWN.clone() });
  });
}

/**
 * Tip the basket — and the barrow, if it is standing there too — into the
 * barrels. The barn interior calls this when you press E at one.
 */
export function deposit(only: AppleType | null, includeBarrow = false){
  let moved = 0;
  for(const k of TYPE_KEYS){
    if(only && k !== only) continue;
    moved += state.basket[k];
    state.stored[k] += state.basket[k];
    state.basket[k] = 0;
    if(includeBarrow && state.barrow){
      moved += state.barrow.load[k];
      state.stored[k] += state.barrow.load[k];
      state.barrow.load[k] = 0;
    }
  }
  if(!moved) return 0;
  state.deposited += moved;
  renderBasket(); updateBasketFruit(); renderBarn(); save();
  toast(`${moved} ${moved===1?'apple':'apples'} into the ${only ? APPLE_TYPES[only].label + ' barrel' : 'barrels'}`);
  return moved;
}
