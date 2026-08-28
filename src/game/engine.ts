// ─── CRYPT OF THE DEAD — game engine ────────────────────────────────────────
import { ART, TILE, WALL_EXTRA, SPR, floorTiles, wallBody, wallParapet, whiteOf } from "./sprites";
import { Item, Slot, genWeapon, genLoot, genPotion, iconURL } from "./items";
import { sfx } from "./audio";

export type Phase = "title" | "playing" | "paused" | "inventory" | "dying" | "dead" | "victory";

export interface HudData {
  hp: number; maxHp: number; gold: number; floor: number; floorName: string;
  kills: number; atk: number; def: number; crit: number; prompt: string;
}
export interface Toast { msg: string; color?: string }
export interface Callbacks {
  onPhase: (p: Phase) => void;
  onHud: (h: HudData) => void;
  onToast: (t: Toast) => void;
  onHurt: () => void;
  onHeal: () => void;
  onInv: () => void;
}

const VIEW_W = 960, VIEW_H = 540;
const MAP_W = 44, MAP_H = 44;
const GRID = 20;

const FLOOR_NAMES = [
  "The Mossy Threshold", "Halls of Whispers", "The Bone Gallery", "Flooded Ossuary",
  "Chapel of Ash", "The Wailing Dark", "Gardens of Rot", "The Iron Sepulcher",
  "Veins of the Deep", "Throne of the Crypt Lord",
];

type EnemyType = "skeleton" | "zombie" | "wraith" | "boss";
interface Enemy {
  type: EnemyType; x: number; y: number; r: number;
  hp: number; maxHp: number; atk: number; def: number; speed: number;
  aggroR: number; range: number; attackCdBase: number;
  state: "wander" | "chase" | "windup" | "recover";
  stateT: number; cd: number; wanderA: number; wanderT: number;
  flash: number; kvx: number; kvy: number; aggro: boolean; elite: boolean;
  scale: number; anim: number; faceR: boolean; seed: number;
}
interface Chest { x: number; y: number; opened: boolean; glow: number }
interface GItem { x: number; y: number; item: Item; t: number }
interface GGold { x: number; y: number; value: number; t: number; vx: number; vy: number }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; grav: number; add: boolean }
interface FText { x: number; y: number; txt: string; color: string; life: number; size: number }

const ENEMY_DEFS: Record<EnemyType, { hp: number; atk: number; speed: number; aggroR: number; range: number; cd: number; r: number; def: number }> = {
  skeleton: { hp: 16, atk: 6, speed: 66, aggroR: 155, range: 30, cd: 1.15, r: 11, def: 0 },
  zombie: { hp: 30, atk: 9, speed: 44, aggroR: 125, range: 30, cd: 1.45, r: 12, def: 1 },
  wraith: { hp: 13, atk: 7, speed: 80, aggroR: 185, range: 28, cd: 1.0, r: 11, def: 0 },
  boss: { hp: 380, atk: 18, speed: 62, aggroR: 420, range: 52, cd: 1.35, r: 22, def: 3 },
};

function rnd(a: number, b: number) { return a + Math.random() * (b - a); }
function ri(a: number, b: number) { return Math.floor(rnd(a, b + 1)); }
function dist2(ax: number, ay: number, bx: number, by: number) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
function clamp(v: number, a: number, b: number) { return v < a ? a : v > b ? b : v; }
function hash2(x: number, y: number) { let h = (x * 73856093) ^ (y * 19349663); h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967296; }

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dark: HTMLCanvasElement;
  private darkCtx: CanvasRenderingContext2D;
  private decal: HTMLCanvasElement;
  private decalCtx: CanvasRenderingContext2D;
  private cb: Callbacks;
  private raf = 0;
  private last = 0;
  private t = 0;

  phase: Phase = "title";
  private map = new Uint8Array(MAP_W * MAP_H);
  private torches: { tx: number; ty: number; ph: number }[] = [];
  private stairs = { x: -1, y: -1 };
  private enemies: Enemy[] = [];
  private chests: Chest[] = [];
  private gitems: GItem[] = [];
  private ggold: GGold[] = [];
  private particles: Particle[] = [];
  private texts: FText[] = [];
  private glows: { x: number; y: number; c: string }[] = [];

  private floor = 1;
  private gold = 0;
  private kills = 0;
  private grid: (Item | null)[][] = [];
  private equip: Partial<Record<Slot, Item>> = {};
  private stats = { maxHp: 100, atk: 5, def: 0, crit: 5, speed: 0.5, leech: 0, range: 0 };

  private player = {
    x: 0, y: 0, r: 11, hp: 100,
    facing: "down" as "up" | "down" | "left" | "right",
    aimX: 0, aimY: 1, moving: false, anim: 0, stepT: 0,
    attackAnim: 0, attackCd: 0, swingA: 0, flash: 0, kvx: 0, kvy: 0, invuln: 0,
  };

  private camX = 0; private camY = 0;
  private shakeT = 0; private shakeMag = 0;
  private freezeT = 0;
  private fadeA = 0; private fading: null | { dir: 1 | -1; action?: () => void } = null;
  private deathT = 0; private winT = -1;
  private prompt = "";
  private hudTimer = 0;
  private fullToastT = 0;

  private keys = new Set<string>();
  private mouse = { x: VIEW_W / 2, y: VIEW_H / 2, down: false, active: false };
  private padPrev = { attack: false, interact: false, inv: false, pause: false, start: false };
  private onKeyDown: (e: KeyboardEvent) => void;
  private onKeyUp: (e: KeyboardEvent) => void;
  private onMouseMove: (e: MouseEvent) => void;
  private onMouseDown: (e: MouseEvent) => void;
  private onMouseUp: () => void;
  private onCtx: (e: Event) => void;
  private onBlur: () => void;

  constructor(canvas: HTMLCanvasElement, cb: Callbacks) {
    this.canvas = canvas;
    this.cb = cb;
    this.ctx = canvas.getContext("2d")!;
    this.ctx.imageSmoothingEnabled = false;
    this.dark = document.createElement("canvas");
    this.dark.width = VIEW_W; this.dark.height = VIEW_H;
    this.darkCtx = this.dark.getContext("2d")!;
    this.decal = document.createElement("canvas");
    this.decal.width = MAP_W * TILE; this.decal.height = MAP_H * TILE;
    this.decalCtx = this.decal.getContext("2d")!;
    this.resetInv();

    this.onKeyDown = (e) => {
      if (["Tab", "Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
      this.keys.add(e.code);
      sfx.unlock();
      if (e.code === "Enter" || e.code === "Space") {
        if (this.phase === "title") this.newGame();
        else if (this.phase === "dead" || this.phase === "victory") this.newGame();
      }
      if (this.phase === "playing") {
        if (e.code === "KeyE") this.interact();
        if (e.code === "KeyI" || e.code === "KeyC" || e.code === "Tab") this.openInventory();
        if (e.code === "Escape" || e.code === "KeyP") this.pause();
        if (e.code === "Space" || e.code === "KeyJ") this.tryAttack();
      } else if (this.phase === "inventory") {
        if (e.code === "KeyI" || e.code === "KeyC" || e.code === "Tab" || e.code === "Escape") this.closeInventory();
        else if (e.code === "KeyP") this.closeInventory();
      } else if (this.phase === "paused") {
        if (e.code === "Escape" || e.code === "KeyP") this.resume();
      }
    };
    this.onKeyUp = (e) => this.keys.delete(e.code);
    this.onMouseMove = (e) => {
      const r = this.canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - r.left) / r.width) * VIEW_W;
      this.mouse.y = ((e.clientY - r.top) / r.height) * VIEW_H;
      this.mouse.active = true;
    };
    this.onMouseDown = (e) => {
      sfx.unlock();
      if (e.button === 0) {
        this.mouse.down = true;
        if (this.phase === "playing") this.tryAttack();
      }
    };
    this.onMouseUp = () => { this.mouse.down = false; };
    this.onCtx = (e) => e.preventDefault();
    this.onBlur = () => { if (this.phase === "playing") this.pause(); };

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("mousemove", this.onMouseMove);
    canvas.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    canvas.addEventListener("contextmenu", this.onCtx);
    window.addEventListener("blur", this.onBlur);

    this.genFloor(ri(1, 9)); // attract-mode world behind the title
    this.last = performance.now();
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.t += dt;
      this.tick(dt);
      this.draw();
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("mousemove", this.onMouseMove);
    this.canvas.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
    this.canvas.removeEventListener("contextmenu", this.onCtx);
    window.removeEventListener("blur", this.onBlur);
    sfx.stopMusic();
  }

  // ── phase control ──
  private setPhase(p: Phase) { this.phase = p; this.cb.onPhase(p); }

  newGame() {
    sfx.unlock();
    this.resetInv();
    const starter = genWeapon(1, 0);
    starter.name = "Rusty Sword";
    starter.atk = 3;
    this.equip.weapon = starter;
    this.recalc(true);
    this.player.hp = this.stats.maxHp;
    this.gold = 0; this.kills = 0;
    this.particles = []; this.texts = [];
    this.fadeA = 0; this.fading = null; this.winT = -1;
    this.setPhase("playing");
    this.startFade(() => this.genFloor(1));
    sfx.startMusic();
    this.pushHud();
  }

  pause() { if (this.phase === "playing") { this.setPhase("paused"); sfx.uiOpen(); } }
  resume() { if (this.phase === "paused") { this.setPhase("playing"); sfx.uiClose(); } }
  openInventory() { if (this.phase === "playing") { this.setPhase("inventory"); sfx.uiOpen(); } }
  closeInventory() { if (this.phase === "inventory") { this.setPhase("playing"); sfx.uiClose(); } }

  quitToTitle() {
    sfx.stopMusic();
    this.fadeA = 0;
    this.fading = null;
    this.winT = -1;
    this.genFloor(ri(1, 9));
    this.setPhase("title");
  }

  getRecords() {
    return {
      deepest: Number(localStorage.getItem("crypt.deepest") || 0),
      wins: Number(localStorage.getItem("crypt.wins") || 0),
    };
  }
  private saveRecord() {
    const d = Number(localStorage.getItem("crypt.deepest") || 0);
    if (this.floor > d) localStorage.setItem("crypt.deepest", String(this.floor));
  }

  // ── inventory / items ──
  private resetInv() {
    this.grid = Array.from({ length: GRID }, () => Array<Item | null>(GRID).fill(null));
    this.equip = {};
  }
  private emptyCell(): [number, number] | null {
    for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) if (!this.grid[y][x]) return [x, y];
    return null;
  }
  private invHasSpace() { return this.emptyCell() !== null; }
  private addToInventory(item: Item): boolean {
    const c = this.emptyCell();
    if (!c) return false;
    this.grid[c[1]][c[0]] = item;
    return true;
  }

  private recalc(fullHeal = false) {
    const old = this.stats.maxHp;
    let maxHp = 100, atk = 5, def = 0, crit = 5, leech = 0, range = 0, speed = 0.5;
    Object.values(this.equip).forEach((it) => {
      if (!it) return;
      maxHp += it.hp; atk += it.atk; def += it.def; crit += it.crit; leech += it.leech;
      if (it.kind === "weapon") { speed = it.speed; range = it.range; }
    });
    this.stats = { maxHp, atk, def, crit, speed, leech, range };
    if (fullHeal) this.player.hp = maxHp;
    else if (maxHp > old) this.player.hp = Math.min(maxHp, this.player.hp + (maxHp - old));
    this.player.hp = clamp(this.player.hp, 0, maxHp);
  }

  getInv() {
    return {
      grid: this.grid,
      equip: this.equip,
      stats: { ...this.stats, hp: Math.ceil(this.player.hp), gold: this.gold, floor: this.floor, kills: this.kills },
    };
  }

  clickItem(uid: number) {
    let pos: [number, number] | null = null;
    for (let y = 0; y < GRID && !pos; y++) for (let x = 0; x < GRID && !pos; x++)
      if (this.grid[y][x]?.uid === uid) pos = [x, y];
    if (!pos) return;
    const item = this.grid[pos[1]][pos[0]]!;
    if (item.kind === "potion") {
      if (this.player.hp >= this.stats.maxHp) { this.toast("You are already hale.", "#cfc2a2"); sfx.error(); return; }
      this.grid[pos[1]][pos[0]] = null;
      this.player.hp = clamp(this.player.hp + item.heal, 0, this.stats.maxHp);
      sfx.potion(); this.cb.onHeal();
      this.toast(`+${item.heal} HP`, "#7dd66a");
      this.pushHud(); this.cb.onInv();
      return;
    }
    // equip
    const s = item.slot;
    if (s === "shield" && this.equip.weapon?.twoHand) {
      this.toast("Your two-handed weapon occupies both hands.", "#e8837a"); sfx.error(); return;
    }
    if (s === "weapon" && item.twoHand && this.equip.shield && !this.hasSpareCell(pos)) {
      this.toast("No space to set down your shield.", "#e8837a"); sfx.error(); return;
    }
    const old = this.equip[s];
    this.equip[s] = item;
    this.grid[pos[1]][pos[0]] = old ?? null;
    if (s === "weapon" && item.twoHand && this.equip.shield) {
      const sh = this.equip.shield;
      this.equip.shield = undefined;
      if (!this.grid[pos[1]][pos[0]]) this.grid[pos[1]][pos[0]] = sh;
      else this.addToInventory(sh);
    }
    this.recalc();
    sfx.equipSound();
    this.toast(`Equipped ${item.name}`, "#e8b84b");
    this.pushHud(); this.cb.onInv();
  }

  private hasSpareCell(exclude: [number, number]): boolean {
    for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++)
      if (!this.grid[y][x] && !(x === exclude[0] && y === exclude[1])) return true;
    return false;
  }

  unequip(slot: Slot) {
    const it = this.equip[slot];
    if (!it) return;
    if (!this.invHasSpace()) { this.toast("Inventory is full.", "#e8837a"); sfx.error(); return; }
    this.equip[slot] = undefined;
    this.addToInventory(it);
    this.recalc();
    sfx.equipSound();
    this.pushHud(); this.cb.onInv();
  }

  dropItem(uid: number) {
    for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) {
      if (this.grid[y][x]?.uid === uid) {
        const it = this.grid[y][x]!;
        this.grid[y][x] = null;
        this.gitems.push({ x: this.player.x + rnd(-24, 24), y: this.player.y + rnd(10, 30), item: it, t: 0 });
        sfx.equipSound();
        this.toast(`Dropped ${it.name}`, "#8f8266");
        this.cb.onInv();
        return;
      }
    }
  }

  // ── world generation ──
  private tileAt(tx: number, ty: number) {
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return 1;
    return this.map[ty * MAP_W + tx];
  }
  private solidAt(x: number, y: number, r: number): boolean {
    const x0 = Math.floor((x - r) / TILE), x1 = Math.floor((x + r) / TILE);
    const y0 = Math.floor((y - r) / TILE), y1 = Math.floor((y + r) / TILE);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++)
      if (this.tileAt(tx, ty) === 1) return true;
    return false;
  }
  private los(ax: number, ay: number, bx: number, by: number): boolean {
    const steps = 9;
    for (let i = 1; i < steps; i++) {
      const x = ax + ((bx - ax) * i) / steps, y = ay + ((by - ay) * i) / steps;
      if (this.tileAt(Math.floor(x / TILE), Math.floor(y / TILE)) === 1) return false;
    }
    return true;
  }

  private genFloor(f: number) {
    this.floor = f;
    this.map.fill(1);
    const rooms: { x: number; y: number; w: number; h: number; cx: number; cy: number }[] = [];
    for (let i = 0; i < 110 && rooms.length < 11; i++) {
      const w = ri(4, 8), h = ri(4, 7);
      const x = ri(2, MAP_W - w - 3), y = ri(2, MAP_H - h - 3);
      let ok = true;
      for (const r of rooms)
        if (x < r.x + r.w + 2 && x + w + 2 > r.x && y < r.y + r.h + 2 && y + h + 2 > r.y) { ok = false; break; }
      if (!ok) continue;
      rooms.push({ x, y, w, h, cx: Math.floor(x + w / 2), cy: Math.floor(y + h / 2) });
      for (let ty = y; ty < y + h; ty++) for (let tx = x; tx < x + w; tx++) this.map[ty * MAP_W + tx] = 0;
    }
    if (rooms.length < 2) { this.genFloor(f); return; }
    const carve = (ax: number, ay: number, bx: number, by: number) => {
      let x = ax, y = ay;
      const set = (px: number, py: number) => {
        this.map[py * MAP_W + px] = 0;
        if (px + 1 < MAP_W - 1) this.map[py * MAP_W + px + 1] = 0;
      };
      while (x !== bx) { set(x, y); x += Math.sign(bx - x); }
      while (y !== by) { set(x, y); y += Math.sign(by - y); }
      set(x, y);
    };
    for (let i = 1; i < rooms.length; i++) carve(rooms[i - 1].cx, rooms[i - 1].cy, rooms[i].cx, rooms[i].cy);
    for (let i = 0; i < 2; i++) {
      const a = rooms[ri(0, rooms.length - 1)], b = rooms[ri(0, rooms.length - 1)];
      if (a !== b) carve(a.cx, a.cy, b.cx, b.cy);
    }

    // player start
    const start = rooms[0];
    this.player.x = start.cx * TILE + TILE / 2;
    this.player.y = start.cy * TILE + TILE / 2;
    this.player.kvx = 0; this.player.kvy = 0;

    // farthest room → stairs or boss
    let far = rooms[1], best = -1;
    for (const r of rooms) {
      const d = Math.abs(r.cx - start.cx) + Math.abs(r.cy - start.cy);
      if (d > best) { best = d; far = r; }
    }
    if (f < 10) {
      this.stairs = { x: far.cx * TILE + TILE / 2, y: far.cy * TILE + TILE / 2 };
    } else {
      this.stairs = { x: -1, y: -1 };
    }

    // torches on wall faces above floor
    this.torches = [];
    for (let ty = 1; ty < MAP_H - 1; ty++) for (let tx = 1; tx < MAP_W - 1; tx++) {
      if (this.tileAt(tx, ty) === 1 && this.tileAt(tx, ty + 1) === 0 && hash2(tx, ty + f * 97) < 0.13) {
        if (this.torches.every((o) => Math.abs(o.tx - tx) + Math.abs(o.ty - ty) > 3)) {
          this.torches.push({ tx, ty, ph: Math.random() * 10 });
          if (this.torches.length >= 30) break;
        }
      }
    }

    // chests
    this.chests = [];
    const nChests = ri(2, 3);
    for (let i = 0; i < nChests; i++) {
      const r = rooms[ri(1, rooms.length - 1)];
      const x = (r.x + ri(0, r.w - 1)) * TILE + TILE / 2;
      const y = (r.y + ri(0, r.h - 1)) * TILE + TILE / 2;
      if (dist2(x, y, this.player.x, this.player.y) > 200 * 200) this.chests.push({ x, y, opened: false, glow: 0 });
    }

    // enemies
    this.enemies = [];
    const isBossFloor = f >= 10;
    const floorTilesList: [number, number][] = [];
    for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++)
      if (this.map[ty * MAP_W + tx] === 0) floorTilesList.push([tx, ty]);
    const spawnEnemy = (type: EnemyType, x: number, y: number, elite = false) => {
      const d = ENEMY_DEFS[type];
      const mHp = (d.hp + f * (type === "boss" ? 30 : type === "zombie" ? 12 : type === "skeleton" ? 9 : 7)) * (elite ? 1.7 : 1);
      this.enemies.push({
        type, x, y, r: d.r, hp: mHp, maxHp: mHp,
        atk: (d.atk + f * 1.7) * (elite ? 1.35 : 1), def: d.def + f * 0.35,
        speed: d.speed * (elite ? 1.15 : 1), aggroR: d.aggroR, range: d.range, attackCdBase: d.cd,
        state: "wander", stateT: 0, cd: rnd(0, 0.6), wanderA: rnd(0, 6.3), wanderT: rnd(0.5, 2),
        flash: 0, kvx: 0, kvy: 0, aggro: type === "boss", elite,
        scale: type === "boss" ? 3.1 : elite ? 1.25 : 1, anim: rnd(0, 2), faceR: Math.random() > 0.5, seed: Math.random() * 10,
      });
    };
    if (isBossFloor) {
      spawnEnemy("boss", far.cx * TILE + TILE / 2, far.cy * TILE + TILE / 2);
      for (let i = 0; i < 4; i++) {
        const [tx, ty] = floorTilesList[ri(0, floorTilesList.length - 1)];
        spawnEnemy("skeleton", tx * TILE + TILE / 2, ty * TILE + TILE / 2);
      }
      sfx.bossRoar();
    } else {
      const n = Math.min(24, 5 + f * 2);
      for (let i = 0; i < n; i++) {
        const [tx, ty] = floorTilesList[ri(0, floorTilesList.length - 1)];
        const px = tx * TILE + TILE / 2, py = ty * TILE + TILE / 2;
        if (dist2(px, py, this.player.x, this.player.y) < 260 * 260) continue;
        const roll = Math.random();
        const type: EnemyType = f < 2 ? (roll < 0.7 ? "skeleton" : "zombie")
          : f < 4 ? (roll < 0.5 ? "skeleton" : roll < 0.85 ? "zombie" : "wraith")
          : roll < 0.38 ? "skeleton" : roll < 0.68 ? "zombie" : "wraith";
        spawnEnemy(type, px, py, Math.random() < 0.06 + f * 0.012);
      }
    }

    // scattered gold piles
    this.ggold = [];
    for (let i = 0; i < 6; i++) {
      const [tx, ty] = floorTilesList[ri(0, floorTilesList.length - 1)];
      this.ggold.push({ x: tx * TILE + TILE / 2 + rnd(-8, 8), y: ty * TILE + TILE / 2 + rnd(-8, 8), value: ri(4, 10 + f * 4), t: rnd(0, 3), vx: 0, vy: 0 });
    }
    this.gitems = [];

    // old blood atmosphere + fresh decal layer
    this.decalCtx.clearRect(0, 0, this.decal.width, this.decal.height);
    for (let i = 0; i < 7; i++) {
      const [tx, ty] = floorTilesList[ri(0, floorTilesList.length - 1)];
      this.splat(tx * TILE + TILE / 2, ty * TILE + TILE / 2, rnd(6, 14), 0.25);
    }

    this.camX = clamp(this.player.x - VIEW_W / 2, 0, MAP_W * TILE - VIEW_W);
    this.camY = clamp(this.player.y - VIEW_H / 2, 0, MAP_H * TILE - VIEW_H);
    if (this.phase === "playing") {
      this.toast(`Floor ${f} — ${FLOOR_NAMES[f - 1]}`, "#e8b84b");
      this.player.hp = clamp(this.player.hp + this.stats.maxHp * 0.18, 0, this.stats.maxHp);
    }
    this.pushHud();
  }

  private startFade(action: () => void) {
    this.fading = { dir: 1, action };
  }

  // ── combat ──
  private tryAttack() {
    if (this.phase !== "playing") return;
    const p = this.player;
    if (p.attackCd > 0) return;
    p.attackCd = this.stats.speed;
    p.attackAnim = 0.2;
    // aim direction
    let ax = p.aimX, ay = p.aimY;
    if (this.mouse.active) {
      const sx = p.x - this.camX, sy = p.y - this.camY - 14;
      const dx = this.mouse.x - sx, dy = this.mouse.y - sy;
      const l = Math.hypot(dx, dy);
      if (l > 6) { ax = dx / l; ay = dy / l; }
    }
    p.aimX = ax; p.aimY = ay;
    if (Math.abs(ax) > Math.abs(ay)) p.facing = ax > 0 ? "right" : "left";
    else p.facing = ay > 0 ? "down" : "up";
    p.swingA = Math.atan2(ay, ax);
    sfx.swing();

    const range = 38 + this.stats.range;
    let hitAny = false;
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d > range + e.r) continue;
      const ang = Math.atan2(e.y - p.y, e.x - p.x);
      let diff = Math.abs(ang - p.swingA);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      if (diff < 1.1) { this.damageEnemy(e, ang); hitAny = true; }
    }
    for (const c of this.chests) {
      if (!c.opened && dist2(c.x, c.y, p.x, p.y) < (range + 14) * (range + 14)) {
        const ang = Math.atan2(c.y - p.y, c.x - p.x);
        let diff = Math.abs(ang - p.swingA);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        if (diff < 1.2) this.openChest(c);
      }
    }
    if (!hitAny) return;
  }

  private damageEnemy(e: Enemy, ang: number) {
    const crit = Math.random() * 100 < this.stats.crit;
    let dmg = Math.max(1, Math.round(this.stats.atk * rnd(0.85, 1.2) - e.def));
    if (crit) dmg *= 2;
    e.hp -= dmg;
    e.flash = 0.14;
    e.kvx += Math.cos(ang) * 130; e.kvy += Math.sin(ang) * 130;
    e.aggro = true;
    if (e.state === "wander") e.state = "chase";
    this.blood(e.x, e.y - 10, 6);
    this.splat(e.x, e.y, 4, 0.4);
    this.text(e.x, e.y - 30 * e.scale, String(dmg), crit ? "#ffd97a" : "#f5f0e0", crit ? 20 : 15);
    if (crit) { sfx.crit(); this.shake(4, 0.18); this.freezeT = Math.max(this.freezeT, 0.04); }
    else { sfx.hit(); this.shake(2, 0.1); }
    if (this.stats.leech > 0) {
      this.player.hp = clamp(this.player.hp + (dmg * this.stats.leech) / 100, 0, this.stats.maxHp);
    }
    if (e.hp <= 0) this.killEnemy(e);
  }

  private killEnemy(e: Enemy) {
    this.kills++;
    this.blood(e.x, e.y - 8, 22);
    this.splat(e.x, e.y, 16, 0.75);
    sfx.kill();
    this.shake(5, 0.22);
    this.freezeT = Math.max(this.freezeT, 0.05);
    for (let i = 0; i < 8; i++)
      this.particles.push({ x: e.x, y: e.y - 10, vx: rnd(-90, 90), vy: rnd(-160, -30), life: rnd(0.3, 0.6), max: 0.6, size: rnd(2, 4), color: e.type === "wraith" ? "#6fe3cf" : "#b3a585", grav: 260, add: false });

    // drops
    const luck = e.elite ? 0.2 : 0;
    if (Math.random() < 0.55 + luck) {
      this.ggold.push({ x: e.x + rnd(-10, 10), y: e.y + rnd(-6, 10), value: ri(4, 8 + this.floor * 4) * (e.elite ? 2 : 1), t: 0, vx: rnd(-40, 40), vy: rnd(-60, -20) });
    }
    if (e.type === "boss") {
      for (let i = 0; i < 3; i++) {
        const it = genLoot(this.floor, 0.4);
        it.rarity = i === 0 ? 2 : it.rarity;
        this.gitems.push({ x: e.x + (i - 1) * 34, y: e.y + 20, item: it, t: 0 });
      }
      this.ggold.push({ x: e.x, y: e.y + 30, value: ri(120, 220), t: 0, vx: 0, vy: -30 });
      this.winT = 1.7;
      this.shake(12, 0.6);
      this.blood(e.x, e.y, 40);
    } else if (Math.random() < 0.2 + luck + (e.elite ? 0.3 : 0)) {
      this.gitems.push({ x: e.x + rnd(-8, 8), y: e.y + rnd(0, 12), item: genLoot(this.floor, luck), t: 0 });
    } else if (Math.random() < 0.09) {
      this.gitems.push({ x: e.x, y: e.y + 8, item: genPotion(this.floor), t: 0 });
    }
    this.enemies = this.enemies.filter((x) => x !== e);
    this.pushHud();
  }

  private damagePlayer(raw: number) {
    const p = this.player;
    if (p.invuln > 0 || this.phase !== "playing") return;
    const shield = this.equip.shield;
    if (shield && Math.random() < 0.22 + shield.def * 0.04) {
      this.text(p.x, p.y - 40, "BLOCKED", "#9fc7e8", 15);
      sfx.blocked();
      this.shake(3, 0.12);
      p.invuln = 0.3;
      return;
    }
    const dmg = Math.max(1, Math.round(raw * rnd(0.85, 1.15) - this.stats.def * 0.6));
    p.hp -= dmg;
    p.flash = 0.2;
    p.invuln = 0.55;
    this.text(p.x, p.y - 40, String(dmg), "#ff6a5a", 17);
    this.blood(p.x, p.y - 6, 8);
    this.splat(p.x, p.y, 5, 0.4);
    sfx.hurt();
    this.shake(9, 0.3);
    this.cb.onHurt();
    this.freezeT = Math.max(this.freezeT, 0.025);
    if (p.hp <= 0) {
      p.hp = 0;
      this.die();
    }
    this.pushHud();
  }

  private die() {
    this.splat(this.player.x, this.player.y, 30, 0.9);
    this.blood(this.player.x, this.player.y, 40);
    sfx.deathStinger();
    this.shake(12, 0.5);
    this.deathT = 1.5;
    this.setPhase("dying");
    this.saveRecord();
  }

  // ── world interaction ──
  private interact() {
    if (this.fading) return;
    const p = this.player;
    for (const c of this.chests) {
      if (!c.opened && dist2(c.x, c.y, p.x, p.y) < 52 * 52) { this.openChest(c); return; }
    }
    if (this.stairs.x > 0 && !this.fading && dist2(this.stairs.x, this.stairs.y, p.x, p.y) < 46 * 46) {
      sfx.stairs();
      const nf = this.floor + 1;
      this.startFade(() => this.genFloor(nf));
    }
  }

  private openChest(c: Chest) {
    if (c.opened) return;
    c.opened = true;
    c.glow = 1;
    sfx.chest();
    this.shake(2, 0.12);
    for (let i = 0; i < 14; i++)
      this.particles.push({ x: c.x, y: c.y - 10, vx: rnd(-80, 80), vy: rnd(-170, -50), life: rnd(0.4, 0.8), max: 0.8, size: rnd(2, 3), color: "#ffd76a", grav: 220, add: true });
    const g = ri(12, 30 + this.floor * 14);
    this.ggold.push({ x: c.x, y: c.y + 6, value: g, t: 0, vx: rnd(-30, 30), vy: -50 });
    const nItems = Math.random() < 0.45 ? 2 : 1;
    for (let i = 0; i < nItems; i++)
      this.gitems.push({ x: c.x + (i === 0 ? -14 : 14), y: c.y + 12, item: genLoot(this.floor, 0.18), t: 0 });
    this.toast("You pry open the chest…", "#e8b84b");
  }

  // ── update ──
  private tick(dt: number) {
    // fade
    if (this.fading) {
      this.fadeA += this.fading.dir * dt * 2.4;
      if (this.fading.dir === 1 && this.fadeA >= 1) {
        this.fadeA = 1;
        this.fading.action?.();
        this.fading = { dir: -1 };
      } else if (this.fading.dir === -1 && this.fadeA <= 0) {
        this.fadeA = 0; this.fading = null;
      }
    }
    this.shakeT = Math.max(0, this.shakeT - dt);
    if (this.phase === "title" || this.phase === "inventory" || this.phase === "paused" || this.phase === "dead" || this.phase === "victory") this.pollPadMenu();
    if (this.freezeT > 0) { this.freezeT -= dt; return; }

    if (this.phase === "playing") this.updatePlay(dt);
    else if (this.phase === "dying") {
      this.deathT -= dt;
      this.updateFx(dt);
      if (this.deathT <= 0) this.setPhase("dead");
    } else if (this.phase === "title") this.updateAttract(dt);

    if (this.winT > 0) {
      this.winT -= dt;
      if (this.winT <= 0) {
        this.winT = -1;
        const w = Number(localStorage.getItem("crypt.wins") || 0);
        localStorage.setItem("crypt.wins", String(w + 1));
        this.saveRecord();
        sfx.victoryStinger();
        this.setPhase("victory");
      }
    }

    this.hudTimer -= dt;
    if (this.hudTimer <= 0) { this.hudTimer = 0.15; this.pushHud(); }
  }

  private pollPadMenu() {
    const pads = typeof navigator !== "undefined" && navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of pads) {
      if (!gp) continue;
      const b = (i: number) => !!gp.buttons[i]?.pressed;
      const close = (b(1) || b(3)) && !this.padPrev.inv;
      const start = (b(0) || b(9)) && !this.padPrev.start;
      if (this.phase === "inventory" && (close || b(9) && !this.padPrev.pause)) this.closeInventory();
      else if (this.phase === "paused" && (close || b(9) && !this.padPrev.pause)) this.resume();
      else if ((this.phase === "title" || this.phase === "dead" || this.phase === "victory") && start) this.newGame();
      this.padPrev.inv = b(3) || b(1);
      this.padPrev.pause = b(9);
      this.padPrev.start = b(0) || b(9);
      break;
    }
  }

  private readInput(): { mx: number; my: number; attack: boolean; interact: boolean; inv: boolean; pauseBtn: boolean } {
    let mx = 0, my = 0;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) my -= 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) my += 1;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) mx -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) mx += 1;
    let attack = false, interact = false, inv = false, pauseBtn = false;
    const pads = typeof navigator !== "undefined" && navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of pads) {
      if (!gp) continue;
      const ax = Math.abs(gp.axes[0]) > 0.3 ? gp.axes[0] : 0;
      const ay = Math.abs(gp.axes[1]) > 0.3 ? gp.axes[1] : 0;
      mx += ax; my += ay;
      const b = (i: number) => !!gp.buttons[i]?.pressed;
      if (b(14)) mx -= 1; // d-pad
      if (b(15)) mx += 1;
      if (b(12)) my -= 1;
      if (b(13)) my += 1;
      if (b(0) || b(7)) attack = true;
      if (b(2) && !this.padPrev.interact) interact = true;
      if (b(3) && !this.padPrev.inv) inv = true;
      if (b(9) && !this.padPrev.pause) pauseBtn = true;
      this.padPrev.interact = b(2);
      this.padPrev.inv = b(3);
      this.padPrev.pause = b(9);
      break;
    }
    const l = Math.hypot(mx, my);
    if (l > 1) { mx /= l; my /= l; }
    return { mx, my, attack, interact, inv, pauseBtn };
  }

  private updatePlay(dt: number) {
    const p = this.player;
    const inp = this.readInput();
    if (inp.inv) { this.openInventory(); return; }
    if (inp.pauseBtn) { this.pause(); return; }
    if (inp.interact) this.interact();
    if ((inp.attack || this.mouse.down) && p.attackCd <= 0) this.tryAttack();

    // movement
    const spd = 152;
    let dx = inp.mx * spd * dt + p.kvx * dt;
    let dy = inp.my * spd * dt + p.kvy * dt;
    p.kvx *= Math.pow(0.0008, dt); p.kvy *= Math.pow(0.0008, dt);
    const nx = p.x + dx;
    if (!this.solidAt(nx, p.y, p.r)) p.x = nx;
    const ny = p.y + dy;
    if (!this.solidAt(p.x, ny, p.r)) p.y = ny;
    p.x = clamp(p.x, TILE, MAP_W * TILE - TILE);
    p.y = clamp(p.y, TILE, MAP_H * TILE - TILE);
    p.moving = Math.abs(inp.mx) + Math.abs(inp.my) > 0.1;
    if (p.moving) {
      p.anim += dt;
      if (Math.abs(inp.mx) > Math.abs(inp.my)) p.facing = inp.mx > 0 ? "right" : "left";
      else p.facing = inp.my > 0 ? "down" : "up";
      p.stepT -= dt;
      if (p.stepT <= 0) { p.stepT = 0.3; sfx.footstep(); }
    }
    p.attackCd -= dt;
    p.attackAnim = Math.max(0, p.attackAnim - dt);
    p.flash = Math.max(0, p.flash - dt);
    p.invuln = Math.max(0, p.invuln - dt);

    // camera
    const tx = clamp(p.x - VIEW_W / 2, 0, MAP_W * TILE - VIEW_W);
    const ty = clamp(p.y - VIEW_H / 2, 0, MAP_H * TILE - VIEW_H);
    const k = 1 - Math.pow(0.0001, dt);
    this.camX += (tx - this.camX) * k;
    this.camY += (ty - this.camY) * k;

    this.updateEnemies(dt);
    this.updateLoot(dt);
    this.updateFx(dt);

    // prompt
    let prompt = "";
    for (const c of this.chests)
      if (!c.opened && dist2(c.x, c.y, p.x, p.y) < 52 * 52) prompt = "Open Chest";
    if (!prompt && this.stairs.x > 0 && dist2(this.stairs.x, this.stairs.y, p.x, p.y) < 46 * 46)
      prompt = `Descend to Floor ${this.floor + 1}`;
    this.prompt = prompt;
  }

  private updateEnemies(dt: number) {
    const p = this.player;
    for (const e of this.enemies) {
      e.flash = Math.max(0, e.flash - dt);
      e.cd -= dt;
      e.anim += dt * (e.state === "chase" ? 1.6 : 0.7);
      const dpx = p.x - e.x, dpy = p.y - e.y;
      const d = Math.hypot(dpx, dpy);
      if (!e.aggro && d < e.aggroR && this.los(e.x, e.y, p.x, p.y)) {
        e.aggro = true; e.state = "chase";
        if (e.type === "boss") sfx.bossRoar();
      }
      let mvx = 0, mvy = 0;
      if (e.state === "wander") {
        e.wanderT -= dt;
        if (e.wanderT <= 0) { e.wanderA = rnd(0, 6.3); e.wanderT = rnd(0.8, 2.2); if (Math.random() < 0.3) e.wanderT = 0.4; }
        mvx = Math.cos(e.wanderA) * e.speed * 0.32;
        mvy = Math.sin(e.wanderA) * e.speed * 0.32;
        if (e.aggro && d < e.aggroR * 1.6) e.state = "chase";
      } else if (e.state === "chase") {
        if (d > e.range * 0.85) {
          mvx = (dpx / d) * e.speed;
          mvy = (dpy / d) * e.speed;
        } else if (e.cd <= 0) {
          e.state = "windup";
          e.stateT = e.type === "boss" ? 0.32 : 0.4;
        }
        if (e.aggro && d > e.aggroR * 2.6) { e.aggro = false; e.state = "wander"; }
      } else if (e.state === "windup") {
        e.stateT -= dt;
        e.flash = 0.1 + 0.1 * Math.sin(this.t * 42);
        if (e.stateT <= 0) {
          e.state = "recover";
          e.stateT = 0.3;
          e.cd = e.attackCdBase;
          if (d < e.range * 1.45 + p.r && this.los(e.x, e.y, p.x, p.y)) {
            this.damagePlayer(e.atk);
            const ang = Math.atan2(dpy, dpx);
            p.kvx += Math.cos(ang) * 160; p.kvy += Math.sin(ang) * 160;
          }
        }
      } else if (e.state === "recover") {
        e.stateT -= dt;
        if (e.stateT <= 0) e.state = "chase";
      }
      // separation
      for (const o of this.enemies) {
        if (o === e) continue;
        const ox = e.x - o.x, oy = e.y - o.y;
        const od = Math.hypot(ox, oy);
        const min = e.r + o.r;
        if (od > 0.01 && od < min) { mvx += (ox / od) * 46; mvy += (oy / od) * 46; }
      }
      const ex = e.x + (mvx + e.kvx) * dt;
      if (!this.solidAt(ex, e.y, e.r)) e.x = ex;
      const ey = e.y + (mvy + e.kvy) * dt;
      if (!this.solidAt(e.x, ey, e.r)) e.y = ey;
      e.kvx *= Math.pow(0.001, dt); e.kvy *= Math.pow(0.001, dt);
      if (mvx !== 0 || mvy !== 0) e.faceR = mvx >= 0;
    }
  }

  private updateLoot(dt: number) {
    const p = this.player;
    for (const g of this.ggold) {
      g.t += dt;
      g.x += g.vx * dt; g.y += g.vy * dt;
      g.vy += 260 * dt; g.vx *= Math.pow(0.01, dt);
      if (g.vy > 0 && g.t > 0.25) g.vy = 0;
      const d2 = dist2(g.x, g.y, p.x, p.y);
      if (d2 < 74 * 74) {
        const d = Math.sqrt(d2) || 1;
        g.x += ((p.x - g.x) / d) * 220 * dt;
        g.y += ((p.y - g.y) / d) * 220 * dt;
      }
      if (d2 < 22 * 22) {
        g.t = -999; // mark collected, keep value for the filter pass
      }
    }
    this.ggold = this.ggold.filter((g) => {
      if (g.t <= -900) {
        this.gold += Math.max(1, g.value);
        sfx.gold();
        this.text(p.x, p.y - 34, `+${Math.max(1, g.value)} gold`, "#ffd76a", 13);
        for (let i = 0; i < 5; i++)
          this.particles.push({ x: p.x + rnd(-8, 8), y: p.y - 10, vx: rnd(-40, 40), vy: rnd(-120, -40), life: 0.4, max: 0.4, size: 2, color: "#ffd76a", grav: 200, add: true });
        this.pushHud();
        return false;
      }
      return true;
    });
    for (const it of this.gitems) {
      it.t += dt;
      if (dist2(it.x, it.y, p.x, p.y) < 24 * 24) {
        if (this.addToInventory(it.item)) {
          const name = it.item.name;
          const color = it.item.rarity === 2 ? "#f0c94c" : it.item.rarity === 1 ? "#6f9fe8" : "#cfc2a2";
          it.item = null as unknown as Item;
          sfx.itemPickup();
          this.toast(`Picked up ${name}`, color);
        } else if (this.t - this.fullToastT > 1.2) {
          this.fullToastT = this.t;
          this.toast("Your pack is full!", "#e8837a");
          sfx.error();
        }
      }
    }
    this.gitems = this.gitems.filter((i) => i.item !== null);
  }

  private updateFx(dt: number) {
    for (const pt of this.particles) {
      pt.life -= dt;
      pt.x += pt.vx * dt; pt.y += pt.vy * dt;
      pt.vy += pt.grav * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const tx of this.texts) { tx.life -= dt; tx.y -= 34 * dt; }
    this.texts = this.texts.filter((t) => t.life > 0);
    for (const c of this.chests) c.glow = Math.max(0, c.glow - dt * 0.8);
  }

  private updateAttract(dt: number) {
    // slow cinematic drift over the crypt
    const cx = (MAP_W * TILE - VIEW_W) / 2 + Math.sin(this.t * 0.11) * (MAP_W * TILE - VIEW_W) / 2.4;
    const cy = (MAP_H * TILE - VIEW_H) / 2 + Math.cos(this.t * 0.07) * (MAP_H * TILE - VIEW_H) / 2.6;
    this.camX = clamp(cx, 0, MAP_W * TILE - VIEW_W);
    this.camY = clamp(cy, 0, MAP_H * TILE - VIEW_H);
    for (const e of this.enemies) {
      e.anim += dt * 0.7;
      e.wanderT -= dt;
      if (e.wanderT <= 0) { e.wanderA = rnd(0, 6.3); e.wanderT = rnd(1, 2.4); }
      const mvx = Math.cos(e.wanderA) * e.speed * 0.3, mvy = Math.sin(e.wanderA) * e.speed * 0.3;
      const ex = e.x + mvx * dt;
      if (!this.solidAt(ex, e.y, e.r)) e.x = ex; else e.wanderA += 2.4;
      const ey = e.y + mvy * dt;
      if (!this.solidAt(e.x, ey, e.r)) e.y = ey; else e.wanderA += 2.4;
      if (mvx !== 0) e.faceR = mvx >= 0;
    }
    this.updateFx(dt);
  }

  // ── fx helpers ──
  private shake(mag: number, t: number) { this.shakeMag = mag; this.shakeT = t; }
  private text(x: number, y: number, txt: string, color: string, size: number) {
    if (this.texts.length > 34) this.texts.shift();
    this.texts.push({ x: x + rnd(-6, 6), y, txt, color, life: 0.9, size });
  }
  private toast(msg: string, color?: string) { this.cb.onToast({ msg, color }); }
  private blood(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++)
      this.particles.push({
        x: x + rnd(-6, 6), y: y + rnd(-6, 6), vx: rnd(-130, 130), vy: rnd(-190, -20),
        life: rnd(0.25, 0.55), max: 0.55, size: rnd(2, 4),
        color: ["#8a1414", "#6e0f0f", "#a32020", "#c22a1e"][ri(0, 3)], grav: 420, add: false,
      });
  }
  private splat(x: number, y: number, n: number, alpha: number) {
    const g = this.decalCtx;
    for (let i = 0; i < n; i++) {
      const a = rnd(0, 6.3), r = rnd(0, 16);
      g.fillStyle = ["rgba(110,15,15,", "rgba(80,10,10,", "rgba(140,20,20,"][ri(0, 2)] + (alpha * rnd(0.4, 1)).toFixed(2) + ")";
      g.beginPath();
      g.ellipse(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.6, rnd(1.5, 5), rnd(1, 3.4), rnd(0, 3), 0, 7);
      g.fill();
    }
  }

  private pushHud() {
    this.cb.onHud({
      hp: Math.ceil(this.player.hp), maxHp: this.stats.maxHp, gold: this.gold,
      floor: this.floor, floorName: FLOOR_NAMES[this.floor - 1], kills: this.kills,
      atk: this.stats.atk, def: this.stats.def, crit: this.stats.crit, prompt: this.prompt,
    });
  }

  // ── draw ──
  private draw() {
    const ctx = this.ctx;
    ctx.fillStyle = "#070403";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    let sx = 0, sy = 0;
    if (this.shakeT > 0) {
      sx = rnd(-this.shakeMag, this.shakeMag) * (this.shakeT * 3);
      sy = rnd(-this.shakeMag, this.shakeMag) * (this.shakeT * 3);
    }
    const camX = Math.round(this.camX + sx), camY = Math.round(this.camY + sy);
    ctx.save();
    ctx.translate(-camX, -camY);

    const tx0 = Math.max(0, Math.floor(camX / TILE) - 1), tx1 = Math.min(MAP_W - 1, Math.floor((camX + VIEW_W) / TILE) + 1);
    const ty0 = Math.max(0, Math.floor(camY / TILE) - 1), ty1 = Math.min(MAP_H - 1, Math.floor((camY + VIEW_H) / TILE) + 2);

    // floor
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (this.map[ty * MAP_W + tx] === 0) {
        ctx.drawImage(floorTiles[Math.floor(hash2(tx, ty) * 4) % 4], tx * TILE, ty * TILE);
      }
    }
    // stairs pit
    if (this.stairs.x > 0) this.drawStairs(this.stairs.x, this.stairs.y);

    // blood decals
    ctx.drawImage(this.decal, 0, 0);

    // ground gold + items
    for (const g of this.ggold) {
      if (g.x < camX - 40 || g.x > camX + VIEW_W + 40 || g.y < camY - 40 || g.y > camY + VIEW_H + 40) continue;
      const bob = Math.sin(g.t * 4) * 1.5;
      ctx.drawImage(SPR.icons.gold, Math.round(g.x - 12), Math.round(g.y - 8 + bob), 24, 16);
    }
    for (const it of this.gitems) {
      if (it.x < camX - 40 || it.x > camX + VIEW_W + 40) continue;
      const bob = Math.sin(it.t * 3.4) * 2.5;
      const ic = SPR.icons[it.item.type] ?? SPR.icons.gold;
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath(); ctx.ellipse(it.x, it.y + 8, 9, 4, 0, 0, 7); ctx.fill();
      const pulse = 0.25 + 0.15 * Math.sin(it.t * 5);
      ctx.fillStyle = it.item.rarity === 2 ? `rgba(240,201,76,${pulse})` : it.item.rarity === 1 ? `rgba(111,159,232,${pulse})` : `rgba(216,205,178,${pulse * 0.6})`;
      ctx.beginPath(); ctx.ellipse(it.x, it.y + bob - 2, 13, 13, 0, 0, 7); ctx.fill();
      ctx.drawImage(ic, Math.round(it.x - ic.width), Math.round(it.y - ic.height + bob), ic.width * 2, ic.height * 2);
    }

    // y-sorted drawables: wall faces + entities
    type Drawable = { y: number; fn: () => void };
    const draws: Drawable[] = [];
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (this.map[ty * MAP_W + tx] === 1) {
        const x = tx * TILE, y = ty * TILE;
        draws.push({
          y: (ty + 1) * TILE,
          fn: () => {
            ctx.drawImage(wallBody, x, y);
            if (this.tileAt(tx, ty - 1) === 0) ctx.drawImage(wallParapet, x, y - WALL_EXTRA);
          },
        });
      }
    }
    for (const c of this.chests) {
      draws.push({
        y: c.y + 10,
        fn: () => {
          const spr = c.opened ? SPR.chestOpen : SPR.chestClosed;
          ctx.fillStyle = "rgba(0,0,0,0.4)";
          ctx.beginPath(); ctx.ellipse(c.x, c.y + 10, 15, 5, 0, 0, 7); ctx.fill();
          ctx.drawImage(spr, Math.round(c.x - 16), Math.round(c.y - 14), 32, 26);
          if (!c.opened) {
            const gl = 0.2 + 0.12 * Math.sin(this.t * 3 + c.x);
            ctx.fillStyle = `rgba(255,215,106,${gl})`;
            ctx.fillRect(Math.round(c.x - 3), Math.round(c.y - 4), 6, 4);
          }
        },
      });
    }
    for (const e of this.enemies) {
      if (e.x < camX - 80 || e.x > camX + VIEW_W + 80 || e.y < camY - 100 || e.y > camY + VIEW_H + 80) continue;
      draws.push({ y: e.y + e.r, fn: () => this.drawEnemy(e) });
    }
    if (this.phase !== "title" && this.phase !== "dead" && this.phase !== "victory" && this.player.hp > 0) {
      const p = this.player;
      draws.push({ y: p.y + p.r, fn: () => this.drawPlayer() });
    }
    draws.sort((a, b) => a.y - b.y);
    for (const d of draws) d.fn();

    ctx.restore();

    // ── darkness + lights ──
    this.drawLighting(camX, camY);

    // ── things that glow above the dark ──
    ctx.save();
    ctx.translate(-camX, -camY);
    this.drawFlames(camX, camY);
    // enemy eye glints
    for (const gl of this.glows) {
      ctx.fillStyle = gl.c;
      ctx.fillRect(Math.round(gl.x), Math.round(gl.y), 3, 3);
    }
    this.glows = [];
    // slash arc
    const p = this.player;
    if (p.attackAnim > 0 && this.phase !== "title") {
      const pr = 1 - p.attackAnim / 0.2;
      const a = p.swingA - 1.15 + 2.3 * (1 - Math.pow(1 - pr, 2));
      ctx.strokeStyle = `rgba(255,240,200,${0.75 * (1 - pr)})`;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(p.x, p.y - 10, 34 + this.stats.range, a - 0.5, a + 0.15);
      ctx.stroke();
      // weapon icon swept in hand
      const w = this.equip.weapon;
      if (w) {
        const ic = SPR.icons[w.type];
        ctx.save();
        ctx.translate(p.x + Math.cos(a) * 24, p.y - 12 + Math.sin(a) * 24);
        ctx.rotate(a + Math.PI / 4);
        ctx.globalAlpha = 0.95;
        ctx.drawImage(ic, -14, -14, 28, 28);
        ctx.restore();
      }
    }
    // particles
    for (const pt of this.particles) {
      const a = clamp(pt.life / pt.max, 0, 1);
      ctx.globalAlpha = a;
      if (pt.add) ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = pt.color;
      ctx.fillRect(Math.round(pt.x), Math.round(pt.y), pt.size, pt.size);
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.globalAlpha = 1;
    // floating texts
    for (const tx of this.texts) {
      ctx.font = `${tx.size}px "Pirata One", Georgia, serif`;
      ctx.textAlign = "center";
      ctx.globalAlpha = clamp(tx.life / 0.4, 0, 1);
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0,0,0,0.85)";
      ctx.strokeText(tx.txt, tx.x, tx.y);
      ctx.fillStyle = tx.color;
      ctx.fillText(tx.txt, tx.x, tx.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // boss bar
    const boss = this.enemies.find((e) => e.type === "boss");
    if (boss && this.phase !== "title") {
      const bw = 380, bx = VIEW_W / 2 - bw / 2, by = 26;
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.fillRect(bx - 4, by - 4, bw + 8, 20);
      ctx.strokeStyle = "#5c451f";
      ctx.strokeRect(bx - 4, by - 4, bw + 8, 20);
      ctx.fillStyle = "#5c0909";
      ctx.fillRect(bx, by, bw, 12);
      ctx.fillStyle = "#c22a1e";
      ctx.fillRect(bx, by, bw * clamp(boss.hp / boss.maxHp, 0, 1), 12);
      ctx.font = '15px "Pirata One", Georgia, serif';
      ctx.textAlign = "center";
      ctx.fillStyle = "#e8b84b";
      ctx.fillText("MALGRATH — THE CRYPT LORD", VIEW_W / 2, by - 9);
    }

    // fade
    if (this.fadeA > 0) {
      ctx.fillStyle = `rgba(0,0,0,${clamp(this.fadeA, 0, 1)})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }

  private drawStairs(x: number, y: number) {
    const ctx = this.ctx;
    const s = 44;
    ctx.fillStyle = "#0d0906";
    ctx.fillRect(x - s / 2, y - s / 2, s, s);
    const shades = ["#1c1613", "#251d18", "#31281f", "#3d3227"];
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = shades[i];
      const inset = i * 5;
      ctx.fillRect(x - s / 2 + inset, y - s / 2 + i * 10, s - inset * 2, 10);
    }
    ctx.strokeStyle = "#4a3a26";
    ctx.strokeRect(x - s / 2 + 0.5, y - s / 2 + 0.5, s - 1, s - 1);
    const gl = 0.25 + 0.15 * Math.sin(this.t * 2.4);
    ctx.fillStyle = `rgba(232,184,75,${gl * 0.25})`;
    ctx.beginPath(); ctx.ellipse(x, y, s / 2 + 8, s / 2 + 8, 0, 0, 7); ctx.fill();
  }

  private drawPlayer() {
    const ctx = this.ctx;
    const p = this.player;
    const set = p.facing === "up" ? SPR.playerBack : p.facing === "down" ? SPR.playerFront : SPR.playerSide;
    const frame = p.moving ? Math.floor(p.anim * 8) % 2 : 0;
    const spr = set[frame];
    const bob = p.moving ? Math.sin(p.anim * 16) * 1.6 : 0;
    // lunge during attack
    let lx = 0, ly = 0;
    if (p.attackAnim > 0) {
      const pr = p.attackAnim / 0.2;
      lx = Math.cos(p.swingA) * 7 * pr;
      ly = Math.sin(p.swingA) * 7 * pr;
    }
    const flip = p.facing === "left";
    const dx = Math.round(p.x - spr.width + lx);
    const dy = Math.round(p.y - spr.height * 2 + 12 + bob + ly);
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath(); ctx.ellipse(p.x, p.y + 8, 11, 4.5, 0, 0, 7); ctx.fill();
    ctx.save();
    if (p.invuln > 0 && Math.floor(this.t * 18) % 2 === 0) ctx.globalAlpha = 0.55;
    if (flip) {
      ctx.translate(Math.round(p.x + lx), dy);
      ctx.scale(-1, 1);
      ctx.drawImage(spr, -spr.width, 0, spr.width * 2, spr.height * 2);
    } else {
      ctx.drawImage(spr, dx, dy, spr.width * 2, spr.height * 2);
    }
    ctx.restore();
    if (p.flash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = clamp(p.flash * 4, 0, 1);
      if (flip) {
        ctx.translate(Math.round(p.x), dy);
        ctx.scale(-1, 1);
        ctx.drawImage(whiteOf(spr), -spr.width, 0, spr.width * 2, spr.height * 2);
      } else {
        ctx.drawImage(whiteOf(spr), dx, dy, spr.width * 2, spr.height * 2);
      }
      ctx.restore();
    }
  }

  private drawEnemy(e: Enemy) {
    const ctx = this.ctx;
    const set = e.type === "skeleton" || e.type === "boss" ? SPR.skeleton : e.type === "zombie" ? SPR.zombie : SPR.wraith;
    const frame = Math.floor(e.anim * 5) % 2;
    const spr = set[frame];
    const s = e.scale * ART;
    const w = spr.width * s, h = spr.height * s;
    const floaty = e.type === "wraith" ? Math.sin(this.t * 3 + e.seed) * 3 : 0;
    const windupGrow = e.state === "windup" ? 1.06 : 1;
    ctx.fillStyle = e.elite ? "rgba(232,184,75,0.22)" : "rgba(0,0,0,0.4)";
    ctx.beginPath(); ctx.ellipse(e.x, e.y + e.r * 0.7, e.r, e.r * 0.38, 0, 0, 7); ctx.fill();
    const dx = Math.round(e.x - w / 2), dy = Math.round(e.y - h + e.r * 0.7 + floaty);
    ctx.save();
    if (!e.faceR) {
      ctx.translate(Math.round(e.x), dy);
      ctx.scale(-1, 1);
      ctx.drawImage(spr, -w / 2, 0, w * windupGrow, h * windupGrow);
    } else {
      ctx.drawImage(spr, dx, dy, w * windupGrow, h * windupGrow);
    }
    ctx.restore();
    // boss crown
    if (e.type === "boss") {
      ctx.fillStyle = "#e8c05a";
      const cx = Math.round(e.x), cy = dy + 4;
      ctx.fillRect(cx - 12, cy, 24, 5);
      ctx.fillRect(cx - 12, cy - 5, 4, 5);
      ctx.fillRect(cx - 2, cy - 7, 4, 7);
      ctx.fillRect(cx + 8, cy - 5, 4, 5);
    }
    // hit flash
    if (e.flash > 0.02) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = clamp(e.flash * 5, 0, 1);
      ctx.drawImage(whiteOf(spr), dx, dy, w, h);
      ctx.restore();
    }
    // eye glints (recorded, drawn above darkness)
    const eyeY = dy + h * (e.type === "boss" ? 0.12 : 0.18);
    const eyeC = e.type === "wraith" ? "#6fe3cf" : e.type === "boss" ? "#ff4a3a" : e.aggro ? "#ff5a3a" : "#8dff5e";
    this.glows.push({ x: e.x - 4, y: eyeY, c: eyeC });
    this.glows.push({ x: e.x + 2, y: eyeY, c: eyeC });
    // hp bar
    if (e.hp < e.maxHp && e.type !== "boss") {
      const bw = 30;
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(e.x - bw / 2 - 1, dy - 7, bw + 2, 5);
      ctx.fillStyle = "#5c0909";
      ctx.fillRect(e.x - bw / 2, dy - 6, bw, 3);
      ctx.fillStyle = e.elite ? "#e8b84b" : "#c22a1e";
      ctx.fillRect(e.x - bw / 2, dy - 6, bw * clamp(e.hp / e.maxHp, 0, 1), 3);
    }
  }

  private drawFlames(camX: number, camY: number) {
    const ctx = this.ctx;
    for (const tc of this.torches) {
      const x = tc.tx * TILE + TILE / 2, y = tc.ty * TILE + TILE - 8;
      if (x < camX - 60 || x > camX + VIEW_W + 60 || y < camY - 60 || y > camY + VIEW_H + 60) continue;
      // bracket
      ctx.fillStyle = "#241a12";
      ctx.fillRect(x - 2, y - 4, 4, 10);
      ctx.fillStyle = "#3d2c1a";
      ctx.fillRect(x - 4, y - 6, 8, 3);
      // flame — living pixels
      const f = this.t * 14 + tc.ph * 7;
      const h1 = 7 + Math.sin(f) * 2 + Math.sin(f * 2.7) * 1.5;
      const h2 = 4 + Math.sin(f * 1.7 + 2) * 1.5;
      ctx.fillStyle = "#ff7a1a";
      ctx.fillRect(x - 3, y - 6 - h1, 6, h1);
      ctx.fillStyle = "#ffb830";
      ctx.fillRect(x - 2, y - 6 - h1 + 2, 4, h1 - 2);
      ctx.fillStyle = "#ffe08a";
      ctx.fillRect(x - 1, y - 5 - h2, 2, h2);
      // embers
      if (this.particles.length < 340 && Math.random() < 0.06)
        this.particles.push({ x: x + rnd(-2, 2), y: y - 10, vx: rnd(-8, 8), vy: rnd(-46, -22), life: rnd(0.4, 0.9), max: 0.9, size: 2, color: "#ffb830", grav: -14, add: true });
    }
  }

  private drawLighting(camX: number, camY: number) {
    const d = this.darkCtx;
    const darkA = this.phase === "title" ? 0.955 : 0.93;
    d.globalCompositeOperation = "source-over";
    d.clearRect(0, 0, VIEW_W, VIEW_H);
    d.fillStyle = `rgba(5,2,10,${darkA})`;
    d.fillRect(0, 0, VIEW_W, VIEW_H);
    d.globalCompositeOperation = "destination-out";
    const punch = (wx: number, wy: number, r: number, strength: number) => {
      const x = wx - camX, y = wy - camY;
      if (x < -r || x > VIEW_W + r || y < -r || y > VIEW_H + r) return;
      const g = d.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(255,255,255,${strength})`);
      g.addColorStop(0.55, `rgba(255,255,255,${strength * 0.55})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      d.fillStyle = g;
      d.beginPath(); d.arc(x, y, r, 0, 7); d.fill();
    };
    for (const tc of this.torches) {
      const fl = 118 + Math.sin(this.t * 9 + tc.ph * 5) * 10 + Math.sin(this.t * 23 + tc.ph) * 5;
      punch(tc.tx * TILE + TILE / 2, tc.ty * TILE + TILE - 12, fl, 0.95);
    }
    if (this.phase !== "title" && this.phase !== "dead") {
      const fl = 168 + Math.sin(this.t * 11) * 7 + Math.sin(this.t * 29) * 3;
      punch(this.player.x, this.player.y - 12, fl, 1);
    }
    for (const c of this.chests) if (c.glow > 0) punch(c.x, c.y, 70 * c.glow + 20, 0.8 * c.glow);
    if (this.stairs.x > 0) punch(this.stairs.x, this.stairs.y, 60, 0.5);
    this.ctx.drawImage(this.dark, 0, 0);
    // warm additive glow
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const tc of this.torches) {
      const x = tc.tx * TILE + TILE / 2 - camX, y = tc.ty * TILE + TILE - 12 - camY;
      if (x < -100 || x > VIEW_W + 100 || y < -100 || y > VIEW_H + 100) continue;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 80);
      g.addColorStop(0, "rgba(255,140,40,0.13)");
      g.addColorStop(1, "rgba(255,140,40,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, 80, 0, 7); ctx.fill();
    }
    ctx.restore();
  }
}
