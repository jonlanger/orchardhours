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
