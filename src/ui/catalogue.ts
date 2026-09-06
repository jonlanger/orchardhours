/* ============================================================
   The catalogue — a merchant's page kept in the barn desk.

   Everything on it is settled at the desk: fruit and goods go out, and
   machines, saplings and deeds come back with the next morning's post.
   ============================================================ */
import { APPLE_TYPES, TYPE_KEYS, APPLE_PRICE, GOODS, GOOD_KEYS,
         MACHINES, MACHINE_KEYS, PLOTS, PLOT_KEYS, UPGRADES, UPGRADE_KEYS,
         SAPLING_PRICE, CRATE_CAPACITY, EXTRA_BAY_CAPACITY, SILO_CAPACITY } from '../core/config';
import type { GoodId, MachineId, PlotId, UpgradeId } from '../core/config';
import { state, basketTotal, storedTotal, storeCap } from '../core/save';
import { emit } from '../core/bus';
import * as economy from '../core/economy';
import { atDesk } from '../world/desk';
import { $ } from './hud';

const money = (n: number) => `${n}<i class="sh">sh</i>`;

/** the whole barrel, valued at today's prices */
function barrelWorth(){
  return TYPE_KEYS.reduce((n, k) => n + state.stored[k]*APPLE_PRICE[k], 0);
}

function sellRow(label: string, held: number, unit: number, act: string, key: string){
  const dim = held ? '' : ' empty';
  return `<div class="crate${dim}">
    <div class="crate-top"><b style="font-weight:400">${label}</b>
      <span class="waiting" style="margin-left:auto"><b>${held}</b></span></div>
    <div class="row-actions" style="margin-top:0">
      ${held ? `<button class="btn sm" data-${act}="${key}" data-n="10">Sell 10</button>
                <button class="btn sm" data-${act}="${key}" data-n="all">Sell all</button>`
             : '<span class="lede" style="margin:0">none in the barn</span>'}
    </div>
    <div class="crate-foot"><span>${money(unit)} each</span><span>${money(held*unit)}</span></div>
  </div>`;
}

export function renderCatalogue(body: HTMLElement, head: HTMLElement){
  head.textContent = 'Ordered by post, settled at the desk';
  const open = atDesk();

  const apples = TYPE_KEYS.map(k => sellRow(
    state.discovered[k] ? APPLE_TYPES[k].label : 'Unlabelled',
    state.stored[k], APPLE_PRICE[k], 'sell', k)).join('');

  const goods = GOOD_KEYS.map(g => sellRow(
    GOODS[g].plural.replace(/^./, c => c.toUpperCase()),
    state.goods[g], GOODS[g].price, 'sellgood', g)).join('');

  /**
   * One line of the order page. The price is always on it, whether or not it
   * can be met today — the whole point of a catalogue is knowing what to save
   * for — and the button is written out either way, greyed with the reason
   * underneath when it cannot be pressed.
   */
  function orderRow(o: { label: string; note: string; foot?: string; price: number;
                         why: string | null; attr: string; id: string; cta?: string }){
    const cta = `${o.cta ?? 'Order'} · ${money(o.price)}`;
    return `<div class="crate${o.why ? ' empty' : ''}">
      <div class="crate-top"><b style="font-weight:400">${o.label}</b>
        <span class="price">${money(o.price)}</span></div>
      <p class="lede" style="margin:0 0 8px">${o.note}</p>
      <div class="row-actions" style="margin-top:0">
        ${o.why ? `<button class="btn sm" disabled>${cta}</button>
                   <span class="lede" style="margin:0">${o.why}</span>`
                : `<button class="btn sm" data-${o.attr}="${o.id}">${cta}</button>`}
      </div>
      ${o.foot ?? ''}
    </div>`;
  }

  const gear = MACHINE_KEYS.map(id => {
    const def = MACHINES[id];
    return orderRow({
      label: def.label.replace(/^./, c => c.toUpperCase()),
      note: def.note, price: def.price, why: economy.whyNotMachine(id),
      attr:'gear', id,
      foot: `<div class="crate-foot"><span>${def.takes} apples the batch</span>
        <span>makes a ${GOODS[def.good].label}</span></div>`,
    });
  }).join('');

  const building = UPGRADE_KEYS.map(id => {
    const def = UPGRADES[id];
    return orderRow({
      label: def.label, note: def.note, price: def.price,
      why: economy.whyNotUpgrade(id), attr:'build', id, cta:'Have it built',
      foot: `<div class="crate-foot"><span>${def.foot}</span>
        <span>${economy.upgradeOwned(id) ? `${storeCap()} of each variety`
          : `${storeCap()} → ${CRATE_CAPACITY + EXTRA_BAY_CAPACITY + SILO_CAPACITY} of each variety`}</span></div>`,
    });
  }).join('');

  const land = PLOT_KEYS.map(id => {
    const def = PLOTS[id];
    return orderRow({
      label: def.label, note: def.note, price: def.price,
      why: economy.whyNotPlot(id), attr:'plot', id, cta:'Buy the deed',
    });
  }).join('');

  body.innerHTML = `
    <div class="stat-grid" style="grid-template-columns:repeat(3,minmax(0,1fr))">
      <div class="stat"><b>${state.purse}</b><span>Shillings</span></div>
      <div class="stat"><b>${storedTotal()}</b><span>In the barrels</span></div>
      <div class="stat"><b>${state.sold}</b><span>Earned this season</span></div>
    </div>

    ${open ? '' : `<p class="lede" style="margin:16px 0 0;color:var(--accent-deep)">
      Orders are written at the desk. Walk into the barn and stand at it to buy or sell.</p>`}

    <h3 class="cat-head">Fruit, sold out of the barrels</h3>
    <p class="lede">Everything standing in the barrels is worth ${money(barrelWorth())} as it is.
      The basket is not counted — tip it in first. The store holds ${storeCap()} of each variety.</p>
    <div class="crates">${apples}</div>

    <h3 class="cat-head">What the barn has made</h3>
    <div class="crates">${goods}</div>

    <h3 class="cat-head">Equipment</h3>
    <p class="lede">Delivered with the morning post, and installed where there is room for it.
      A loaded machine works overnight.</p>
    <div class="crates">${gear}</div>

    <h3 class="cat-head">Nursery stock</h3>
    <div class="crates">
      <div class="crate${economy.canAfford(SAPLING_PRICE) ? '' : ' empty'}">
        <div class="crate-top"><b style="font-weight:400">Bare-rooted sapling</b>
          <span class="price">${money(SAPLING_PRICE)} each</span></div>
        <p class="lede" style="margin:0 0 8px">Two years old and grafted. Plant it where there is
          room and it will be in fruit within the week.</p>
        <div class="row-actions" style="margin-top:0">
          ${[1, 3, 5].map(n => {
            const why = economy.whyNotSaplings(n);
            const cta = `${['','One','Two','Three','Four','Five'][n]} · ${money(SAPLING_PRICE*n)}`;
            return why ? `<button class="btn sm" disabled>${cta}</button>`
                       : `<button class="btn sm" data-sapling="${n}">${cta}</button>`;
          }).join('')}
        </div>
        ${economy.canAfford(SAPLING_PRICE) ? ''
          : `<p class="lede" style="margin:8px 0 0">${economy.whyNotSaplings(1)}</p>`}
        <div class="crate-foot"><span>${state.saplings} waiting to go in</span>
          <span>${state.growing.length} coming on</span></div>
      </div>
    </div>

    <h3 class="cat-head">Building</h3>
    <p class="lede">Ordered today, up by the morning. What the farm can put away grows with it.</p>
    <div class="crates">${building}</div>

    <h3 class="cat-head">Land</h3>
    <div class="crates">${land}</div>`;

  if(!open){
    body.querySelectorAll('button').forEach(b => { b.disabled = true; b.style.opacity = '0.45'; });
    return;
  }

  const redraw = () => emit('barn:render');
  const on = (sel: string, fn: (el: HTMLElement) => void) =>
    body.querySelectorAll<HTMLElement>(sel).forEach(el => el.onclick = () => { fn(el); redraw(); });

  on('[data-sell]', el => {
    const k = el.dataset.sell as keyof typeof state.stored;
    economy.sellApples(k, el.dataset.n === 'all' ? state.stored[k] : 10);
  });
  on('[data-sellgood]', el => {
    const g = el.dataset.sellgood as GoodId;
    economy.sellGood(g, el.dataset.n === 'all' ? state.goods[g] : 10);
  });
  on('[data-gear]',    el => economy.orderMachine(el.dataset.gear as MachineId));
  on('[data-build]',   el => economy.orderUpgrade(el.dataset.build as UpgradeId));
  on('[data-plot]',    el => economy.orderPlot(el.dataset.plot as PlotId));
  on('[data-sapling]', el => economy.orderSaplings(Number(el.dataset.sapling)));

  void basketTotal; void $;
}
