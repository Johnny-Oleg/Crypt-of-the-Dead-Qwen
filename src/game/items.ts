// ─── Loot: weapons, armor, vials ─────────────────────────────────────────────
import { SPR } from "./sprites";

export type WeaponType = "sword" | "axe" | "mace" | "spear";
export type ArmorSlot = "helm" | "armor" | "gloves" | "boots" | "shield";
export type Slot = ArmorSlot | "weapon";
export type ItemKind = "weapon" | "armor" | "potion";
export type Rarity = 0 | 1 | 2; // normal / magic / rare

export interface Item {
  uid: number;
  kind: ItemKind;
  type: WeaponType | ArmorSlot | "vial";
  slot: Slot;
  name: string;
  rarity: Rarity;
  atk: number;
  def: number;
  hp: number;
  crit: number;
  leech: number;
  heal: number;
  speed: number; // weapon cooldown seconds
  range: number; // weapon extra reach
  twoHand: boolean;
  value: number;
  ilvl: number;
}

let UID = 1;

export const RARITY_COLOR = ["#cfc2a2", "#6f9fe8", "#f0c94c"];
export const RARITY_NAME = ["", "Magic", "Rare"];

const PREFIX = ["Grim", "Blood", "Ancient", "Cursed", "Hollow", "Iron", "Cold", "Wretched", "Pale", "Dire"];
const SUFFIX = ["of the Crypt", "of Rot", "of Wrath", "of the Fallen", "of Embers", "of Sorrow", "of the Deep"];
const RARE_PREFIX = ["Malgrath's", "Saintly", "Doomforged", "Graveborn", "Emberlit"];

const WEAPON_BASE: Record<WeaponType, { atk: [number, number]; speed: number; range: number; twoHand: boolean; label: string }> = {
  sword: { atk: [4, 6], speed: 0.42, range: 0, twoHand: false, label: "Sword" },
  mace: { atk: [6, 9], speed: 0.58, range: 0, twoHand: false, label: "Mace" },
  axe: { atk: [9, 13], speed: 0.7, range: 2, twoHand: true, label: "Greataxe" },
  spear: { atk: [6, 10], speed: 0.52, range: 16, twoHand: true, label: "Spear" },
};
const ARMOR_BASE: Record<ArmorSlot, { def: [number, number]; label: string }> = {
  helm: { def: [1, 3], label: "Helm" },
  armor: { def: [2, 5], label: "Cuirass" },
  gloves: { def: [1, 2], label: "Gauntlets" },
  boots: { def: [1, 2], label: "Greaves" },
  shield: { def: [2, 4], label: "Shield" },
};
const TYPE_NAMES: Record<string, string[]> = {
  sword: ["Short Sword", "Broad Blade", "Falchion", "Arming Sword"],
  mace: ["Club", "Flanged Mace", "Morning Star", "War Hammer"],
  axe: ["Cleaver", "Battle Axe", "Grave Axe", " Headsplitter"],
  spear: ["Boar Spear", "Partisan", "War Spear", "Pike"],
  helm: ["Skullcap", "Iron Helm", "Great Helm", "Bascinet"],
  armor: ["Padded Vest", "Chain Hauberk", "Breastplate", "Gravemail"],
  gloves: ["Leather Gloves", "Iron Gauntlets", "War Grips", "Embalmed Wraps"],
  boots: ["Worn Boots", "Iron Greaves", "Pilgrim's Treads", "Gravewalkers"],
  shield: ["Buckler", "Oak Kite Shield", "Tower Shield", "Sepulcher Ward"],
  vial: ["Blood Vial"],
};

function ri(a: number, b: number) { return a + Math.floor(Math.random() * (b - a + 1)); }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

export function slotOf(item: Item): Slot { return item.slot; }

export function genWeapon(floor: number, forceRarity?: Rarity): Item {
  const type = pick<WeaponType>(["sword", "sword", "mace", "axe", "spear"]);
  return buildItem("weapon", type, floor, forceRarity);
}
export function genArmor(floor: number, forceRarity?: Rarity): Item {
  const type = pick<ArmorSlot>(["helm", "armor", "gloves", "boots", "shield", "shield"]);
  return buildItem("armor", type, floor, forceRarity);
}

export function buildItem(kind: ItemKind, type: string, floor: number, forceRarity?: Rarity): Item {
  let rarity: Rarity = 0;
  const r = Math.random();
  if (forceRarity !== undefined) rarity = forceRarity;
  else if (r < Math.min(0.05 + floor * 0.018, 0.22)) rarity = 2;
  else if (r < Math.min(0.24 + floor * 0.045, 0.6)) rarity = 1;

  const item: Item = {
    uid: UID++,
    kind,
    type: type as Item["type"],
    slot: kind === "weapon" ? "weapon" : (type as Slot),
    name: "",
    rarity,
    atk: 0, def: 0, hp: 0, crit: 0, leech: 0, heal: 0,
    speed: 0.5, range: 0, twoHand: false,
    value: 0, ilvl: floor,
  };

  if (kind === "weapon") {
    const base = WEAPON_BASE[type as WeaponType];
    item.atk = ri(base.atk[0], base.atk[1]) + Math.floor(floor * 1.3);
    item.speed = base.speed;
    item.range = base.range;
    item.twoHand = base.twoHand;
    item.name = pick(TYPE_NAMES[type]);
  } else if (kind === "armor") {
    const base = ARMOR_BASE[type as ArmorSlot];
    item.def = ri(base.def[0], base.def[1]) + Math.floor(floor * 0.7);
    item.name = pick(TYPE_NAMES[type]);
  } else {
    item.heal = 28 + floor * 6;
    item.name = "Blood Vial";
    item.value = 15;
    return item;
  }

  // rarity affixes
  if (rarity >= 1) {
    if (kind === "weapon") {
      item.atk += ri(1, 2 + floor);
      if (Math.random() < 0.5) item.crit += ri(2, 5);
      if (Math.random() < 0.35) item.leech += ri(1, 2 + Math.floor(floor / 3));
      item.speed = Math.max(0.28, item.speed - 0.04);
    } else {
      item.def += ri(1, 1 + Math.floor(floor / 2));
      if (Math.random() < 0.5) item.hp += ri(4, 8 + floor * 2);
      if (type === "gloves" && Math.random() < 0.6) item.atk += ri(1, 2);
    }
    item.name = `${pick(PREFIX)} ${item.name}`;
  }
  if (rarity === 2) {
    if (kind === "weapon") {
      item.atk += ri(2, 4 + floor);
      item.crit += ri(3, 7);
    } else {
      item.def += ri(1, 3);
      item.hp += ri(5, 10 + floor);
    }
    item.name = `${pick(RARE_PREFIX)} ${item.name} ${pick(SUFFIX)}`;
  }
  item.value = (item.atk * 6 + item.def * 5 + item.hp + item.crit * 3) * (rarity + 1) + 5;
  return item;
}

export function genPotion(floor: number): Item {
  return buildItem("potion", "vial", floor, 0);
}

export function genLoot(floor: number, luck = 0): Item {
  const r = Math.random() - luck;
  if (r < 0.18) return genPotion(floor);
  if (r < 0.6) return genWeapon(floor);
  return genArmor(floor);
}

// ─── icon data URLs for the DOM inventory ───────────────────────────────────
const urlCache = new Map<string, string>();
export function iconURL(type: string): string {
  let u = urlCache.get(type);
  if (!u) {
    const src = SPR.icons[type] ?? SPR.icons.gold;
    const c = document.createElement("canvas");
    c.width = src.width * 2;
    c.height = src.height * 2;
    const g = c.getContext("2d")!;
    g.imageSmoothingEnabled = false;
    g.drawImage(src, 0, 0, c.width, c.height);
    u = c.toDataURL();
    urlCache.set(type, u);
  }
  return u;
}

export const SLOT_LABEL: Record<Slot, string> = {
  weapon: "Weapon",
  shield: "Shield",
  helm: "Helm",
  armor: "Cuirass",
  gloves: "Gauntlets",
  boots: "Greaves",
};

export function itemStatLines(it: Item): string[] {
  const lines: string[] = [];
  if (it.atk > 0) lines.push(`+${it.atk} Attack`);
  if (it.def > 0) lines.push(`+${it.def} Defense`);
  if (it.hp > 0) lines.push(`+${it.hp} Max HP`);
  if (it.crit > 0) lines.push(`+${it.crit}% Crit`);
  if (it.leech > 0) lines.push(`+${it.leech}% Life Leech`);
  if (it.heal > 0) lines.push(`Restores ${it.heal} HP`);
  if (it.kind === "weapon") {
    lines.push(`Speed ${it.speed.toFixed(2)}s`);
    if (it.range > 0) lines.push(`Extended reach`);
    if (it.twoHand) lines.push(`Two-Handed`);
  }
  return lines;
}
