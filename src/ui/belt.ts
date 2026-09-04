/* ============================================================
   The tool belt strip — five slots, five number keys
   ============================================================ */
import { $ } from './hud';

export interface BeltItem {
  id: string;
  label: string;
  slot: number;
  icon: string;
  /** 'held' | 'carried' | 'away' — how the slot should read */
  status: () => 'held' | 'carried' | 'away';
}

let items: BeltItem[] = [];
let onPick: (id: string) => void = () => {};

export function initBelt(list: BeltItem[], pick: (id: string) => void){
  items = list;
  onPick = pick;
  renderBelt();
}

export function renderBelt(){
  const el = $('belt');
  if(!items.length) return;
  el.innerHTML = items.map(i => {
    const s = i.status();
    return `<div class="slot ${s === 'held' ? 'on' : s === 'away' ? 'away' : ''}"
      data-tool="${i.id}" title="${i.label}">${i.icon}<i>${i.slot}</i></div>`;
  }).join('');
  el.querySelectorAll<HTMLElement>('.slot').forEach(s =>
    s.onclick = () => onPick(s.dataset.tool!));
}
