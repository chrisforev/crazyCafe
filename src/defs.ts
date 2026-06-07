// Arena size is chosen at boot: landscape 960x640, portrait 640x960
// (kids hold tablets vertical). ESM live bindings keep scene imports current.
export let ARENA_W = 960;
export let ARENA_H = 640;

export function setArenaSize(w: number, h: number) {
  ARENA_W = w;
  ARENA_H = h;
}

export const CONFETTI_COLORS = [
  0xff595e, 0xffca3a, 0x8ac926, 0x1982c4, 0x6a4c93, 0xff9f1c, 0x4cc9f0,
];

// ---- Ingredients (drag & stack onto the plate) ----

export interface IngredientDef {
  label: string;
  /** Pixels of stack height this ingredient adds on the plate. */
  height: number;
}

export const INGREDIENTS = {
  bunBottom: { label: 'BUN', height: 13 },
  patty: { label: 'PATTY', height: 11 },
  cheese: { label: 'CHEESE', height: 7 },
  lettuce: { label: 'LETTUCE', height: 8 },
  tomatoSlice: { label: 'TOMATO', height: 7 },
  sausage: { label: 'SAUSAGE', height: 11 },
  bunTop: { label: 'BUN TOP', height: 18 },
  pancake: { label: 'PANCAKE', height: 10 },
  syrup: { label: 'SYRUP', height: 9 },
  scoopVanilla: { label: 'VANILLA', height: 17 },
  scoopChoc: { label: 'CHOCO', height: 17 },
  cherry: { label: 'CHERRY', height: 12 },
} as const satisfies Record<string, IngredientDef>;

export type IngredientKey = keyof typeof INGREDIENTS;
export const INGREDIENT_KEYS = Object.keys(INGREDIENTS) as IngredientKey[];

// ---- Dishes (stack order is bottom → top) ----

export interface DishDef {
  name: string;
  stack: IngredientKey[];
  price: number;
  /** Earliest day this dish appears on the menu. */
  fromDay: number;
}

export const DISHES: DishDef[] = [
  { name: 'HOT DOG', stack: ['bunBottom', 'sausage', 'bunTop'], price: 6, fromDay: 1 },
  { name: 'BURGER', stack: ['bunBottom', 'patty', 'cheese', 'bunTop'], price: 10, fromDay: 1 },
  { name: 'VEGGIE BURGER', stack: ['bunBottom', 'lettuce', 'tomatoSlice', 'bunTop'], price: 9, fromDay: 2 },
  { name: 'SUNDAE', stack: ['scoopVanilla', 'scoopChoc', 'cherry'], price: 8, fromDay: 2 },
  { name: 'PANCAKE TOWER', stack: ['pancake', 'pancake', 'pancake', 'syrup'], price: 12, fromDay: 3 },
  {
    name: 'DOUBLE TROUBLE',
    stack: ['bunBottom', 'patty', 'cheese', 'patty', 'cheese', 'bunTop'],
    price: 16,
    fromDay: 4,
  },
];

/** The MEGA TOMATO's order — every 5th day, big stack, big payday. */
export const MEGA_DISH: DishDef = {
  name: 'THE MEGA BURGER',
  stack: ['bunBottom', 'patty', 'cheese', 'lettuce', 'tomatoSlice', 'patty', 'cheese', 'bunTop'],
  price: 50,
  fromDay: 5,
};

// ---- Customers (the wackyShooter crew, here for lunch) ----

export type CustomerKind = 'tomato' | 'toaster' | 'jelly' | 'broccoli' | 'sock' | 'skeleton';

export interface CustomerDef {
  name: string;
  /** Multiplies base patience — toasters are famously impatient. */
  patienceMul: number;
  /** Dish indices (into DISHES) this customer leans toward. */
  favorites?: number[];
}

export const CUSTOMERS: Record<CustomerKind, CustomerDef> = {
  tomato: { name: 'DANCING TOMATO', patienceMul: 1 },
  toaster: { name: 'ANGRY TOASTER', patienceMul: 0.7 },
  jelly: { name: 'WOBBLY JELLY', patienceMul: 1.1, favorites: [3, 4] }, // sweet tooth
  broccoli: { name: 'ANGRY BROCCOLI', patienceMul: 0.9, favorites: [2] }, // veggie, obviously
  sock: { name: 'SNEAKY SOCK', patienceMul: 1.2 },
  skeleton: { name: 'SKELETON', patienceMul: 1.4 }, // the dead are in no hurry
};

export const CUSTOMER_KINDS = Object.keys(CUSTOMERS) as CustomerKind[];

// ---- Pacing ----

/** Base thinking time per ingredient in the order, scaled by customer + day. */
export const PATIENCE_PER_INGREDIENT_MS = 9000;
export const PATIENCE_FLOOR_MS = 14000;
/** Patience shrinks a little every day: max(0.55, 1 - (day-1) * 0.05). */
export const DAY_PATIENCE_DECAY = 0.05;
export const STRIKES_TO_CLOSE = 3;
/** Customers on day N. */
export const customersForDay = (day: number) => 3 + day;
/** Serving a wrong order costs this much patience. */
export const WRONG_ORDER_PENALTY_MS = 5000;
