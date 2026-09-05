/* ============================================================
   ORCHARD HOURS — the numbers the whole orchard is planted from
   ============================================================ */

export interface AppleTypeDef {
  color: number;
  blush: number;
  label: string;
  crate: string;
  shine?: boolean;
  note: string;
}

export const APPLE_TYPES = {
  honeycrisp:  { color:0xC63B2E, blush:0x8E2A22, label:'Honeycrisp',       crate:'#C63B2E',
    note:'Bred in Minnesota in the 1960s and released in 1991. Its cells are unusually large and rupture when bitten, which is why it shatters instead of yielding.' },
  grannysmith: { color:0x8FBF4F, blush:0x6B9A38, label:'Granny Smith',     crate:'#8FBF4F',
    note:'A chance seedling found by Maria Ann Smith in Australia around 1868. It keeps for months in cold storage, which is why it once travelled the world.' },
  golden:      { color:0xE2C452, blush:0xC29A34, label:'Golden Delicious', crate:'#E2C452',
    note:'A parent of more modern varieties than almost any other apple. Thin-skinned, so orchards pick it by hand and never tip it into a bin.' },
  rare:        { color:0xF3C63B, blush:0xD9A020, label:'Amber Russet',     crate:'#F3C63B', shine:true,
    note:'A rough-skinned heirloom that most packing houses reject on looks alone. Growers keep a few trees for themselves; the flavour is nutty and dense.' },
} satisfies Record<string, AppleTypeDef>;

export type AppleType = keyof typeof APPLE_TYPES;

export const TYPE_KEYS = Object.keys(APPLE_TYPES) as AppleType[];
export const TYPE_WEIGHTS: [AppleType, number][] =
  [['honeycrisp',0.34],['grannysmith',0.29],['golden',0.31],['rare',0.06]];

export const BASKET_CAPACITY = 24;
export const BARROW_CAPACITY = 60;

/**
 * How high a bear on the ground can reach, measured from its feet — far enough
 * to draw a limb down and take the fruit in its paw, and no further.
 */
export const REACH_FROM_FEET = 2.5;
/** what the picking pole adds to that; the two together are the old reach */
export const PICKER_BONUS = 4.2;
export const CRATE_CAPACITY  = 60;

/* orchard planting plan — real rows */
export const ROWS = 4, PER_ROW = 5;
export const ROW_SPACING = 13.0;   // between rows (z)
export const TREE_SPACING = 9.0;   // within a row (x)

export const GROUND_SIZE = 170;

/* the ring fence, and so the walkable bounds */
export const FX1 = -32, FX2 = 32, FZ1 = -47, FZ2 = 40;

/* barn footprint, at the head of the rows facing back down them */
export const BARN_X = -5, BARN_Z = -34, BARN_ROT = 0.20;
export const BARN_W = 8.4, BARN_H = 4.2, BARN_D = 11;

export const DAY_LENGTH = 420;

/* ============================================================
   What the work takes out of a bear, and what puts it back.
   Vigour runs 0..1; a full day of steady picking spends most of it.
   ============================================================ */
export const VIG_PICK      = 0.016;   // one apple, taken by hand
export const VIG_PICK_POLE = 0.026;   // overhead, on the end of a pole
export const VIG_THROW     = 0.010;
export const VIG_WALK      = 0.0040;  // per second
export const VIG_RUN       = 0.0160;
export const VIG_CLIMB     = 0.0130;
export const VIG_STAND     = 0.0008;
export const VIG_SIT       = 0.0420;  // sitting gives it back
export const VIG_APPLE     = 0.30;    // and so does eating one

/** below this the bear slows and stoops; below SPENT it will not run at all */
export const TIRED = 0.36, SPENT = 0.13;

/** how hard an apple leaves the paw */
export const THROW_SPEED = 10.5;

/* ============================================================
   The mail-order catalogue — what things fetch, and what they cost.
   Money is only ever created by selling, and fruit is capped by what a
   day's vigour can pick, so the whole economy is bounded by the picking.
   ============================================================ */
export type GoodId    = 'cider' | 'jelly' | 'rings';
export type MachineId = 'press' | 'kettle' | 'rack';
export type PlotId    = 'meadow' | 'westbank' | 'eastpaddock';

/** what the merchant gives for one apple out of the barrels */
export const APPLE_PRICE: Record<AppleType, number> =
  { honeycrisp:4, grannysmith:3, golden:3, rare:12 };

export interface GoodDef { label: string; plural: string; price: number; note: string }
export const GOODS = {
  jelly: { label:'jar of jelly', plural:'jars of jelly', price:40,
    note:'Windfalls and bruised fruit boiled down with sugar. The one thing an orchard can sell in January.' },
  cider: { label:'jug of cider', plural:'jugs of cider', price:84,
    note:'Milled, pressed, and left to itself. Cider is how an orchard turns a glut into something that keeps.' },
  rings: { label:'sack of dried rings', plural:'sacks of dried rings', price:120,
    note:'Cored, sliced and hung in the warm air of the loft until they are leathery. Nothing else keeps so long for so little.' },
} satisfies Record<GoodId, GoodDef>;

export const GOOD_KEYS = Object.keys(GOODS) as GoodId[];

export interface MachineDef {
  label: string; price: number; takes: number; good: GoodId; makes: number; note: string;
}
/** each turns barrelled fruit into something worth more, overnight */
export const MACHINES = {
  kettle: { label:'preserving kettle', price:300, takes:8,  good:'jelly', makes:1,
    note:'A copper kettle and a hearth to stand it on. Eight apples the batch.' },
  rack:   { label:'drying rack', price:380, takes:20, good:'rings', makes:1,
    note:'A frame for the loft, where the warm air collects. Twenty apples the batch, and worth the wait.' },
  press:  { label:'cider press', price:520, takes:12, good:'cider', makes:1,
    note:'Beam, screw and a slotted tub. Twelve apples the pressing, and the best return of anything on this page.' },
} satisfies Record<MachineId, MachineDef>;

export const MACHINE_KEYS = Object.keys(MACHINES) as MachineId[];

/** a press is not fed russets; they are worth more in the barrel */
export const TOO_GOOD_TO_PRESS: AppleType = 'rare';

export const SAPLING_PRICE = 90;
/** mornings from a planted whip to a tree in fruit */
export const SAPLING_STAGES = 4;

export interface PlotDef { label: string; price: number; side: 'x1'|'x2'|'z1'|'z2'; to: number; note: string }
/**
 * Land is sold in full-width strips, so the farm stays a rectangle — the
 * walkable clamp and the drawn plan both depend on that.
 */
export const PLOTS = {
  meadow:      { label:'The Long Meadow', price:500,  side:'z2', to: 54,
    note:'The grass beyond the top fence, mown once a year for hay. Room for a row of new trees.' },
  westbank:    { label:'The West Bank',   price:800,  side:'x1', to:-45,
    note:'A slope of rough pasture on the far side of the west fence.' },
  eastpaddock: { label:'The East Paddock', price:1200, side:'x2', to: 45,
    note:'The old paddock, east of the rows. The soil is the best on the farm.' },
} satisfies Record<PlotId, PlotDef>;

export const PLOT_KEYS = Object.keys(PLOTS) as PlotId[];

/**
 * The walkable farm. Starts at the fence constants above and is pushed out by
 * whatever land has been bought; everything that draws or clamps the edge of
 * the world reads this rather than the constants.
 */
export const bounds = { x1: FX1, x2: FX2, z1: FZ1, z2: FZ2 };

export function applyPlots(owned: readonly string[]){
  bounds.x1 = FX1; bounds.x2 = FX2; bounds.z1 = FZ1; bounds.z2 = FZ2;
  for(const id of owned){
    const p = PLOTS[id as PlotId];
    if(p) bounds[p.side] = p.to;
  }
}
