/* ============================================================
   HUD — the basket panel, the toast, the one-line hint
   ============================================================ */
import { APPLE_TYPES, TYPE_KEYS, BASKET_CAPACITY } from '../core/config';
import { state, basketTotal } from '../core/save';

export const $ = (id: string) => document.getElementById(id)!;

const RING_C = 2*Math.PI*15;

export function renderBasket(bumpKey?: string){
  const n = basketTotal(), frac = Math.min(n/BASKET_CAPACITY, 1);
  let rows = '';
  for(const k of TYPE_KEYS){
    const def = APPLE_TYPES[k], seen = state.discovered[k];
    const hex = '#'+def.color.toString(16).padStart(6,'0');
    rows += `<div class="basket-row${seen?'':' dim'}">
      <span class="dot" style="background:${hex}"></span>
      <span>${seen ? def.label : '· · ·'}</span>
      <span class="count${bumpKey===k?' bump':''}">${state.basket[k]}</span></div>`;
  }
  $('basketPanel').innerHTML = `
    <div class="basket-head">
      <svg class="ring" viewBox="0 0 40 40">
        <circle class="bg" cx="20" cy="20" r="15"/>
        <circle class="fg" cx="20" cy="20" r="15" transform="rotate(-90 20 20)"
          stroke-dasharray="${RING_C}" stroke-dashoffset="${RING_C*(1-frac)}"/>
      </svg>
      <div><b>Basket</b><span>${n} of ${BASKET_CAPACITY}</span></div>
    </div><div class="rows">${rows}</div>`;
}

/* ---- the purse ---- */
export function renderPurse(){
  const el = document.getElementById('purse');
  if(!el) return;
  el.textContent = String(state.purse);
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(msg: string){
  const t = $('toast');
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> t.classList.remove('on'), 3400);
}


/* ---- the interaction prompt ---- */
let promptText: string | null = null;
export function setPrompt(text: string | null){
  if(text === promptText) return;
  promptText = text;
  const el = $('prompt');
  if(text){ el.innerHTML = `<b>E</b> ${text}`; el.classList.add('on'); hideHint(); }
  else el.classList.remove('on');
}

let hintShown = true;
export function hideHint(){
  if(hintShown){ $('hint').style.opacity = '0'; hintShown = false; }
}
export function setHint(text: string){
  const h = $('hint');
  h.textContent = text; h.style.opacity = '1'; hintShown = true;
}
export const hintIsShown = () => hintShown;
