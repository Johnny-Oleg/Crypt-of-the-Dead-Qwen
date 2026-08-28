// ─── Pixel art factory for CRYPT OF THE DEAD ────────────────────────────────
// Every sprite is authored as a grid of characters → 1 character = 1 art pixel.
// Art is rendered at 2× on the 960×540 internal canvas (TILE = 32 screen px).

export const ART = 2; // art pixel → screen pixel scale
export const TILE = 32; // screen px per tile
export const WALL_EXTRA = 22; // parapet height above a wall tile

function mk(rows: string[], pal: Record<string, string>): HTMLCanvasElement {
  const w = Math.max(...rows.map((r) => r.length));
  const h = rows.length;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const col = pal[row[x]];
      if (col) {
        g.fillStyle = col;
        g.fillRect(x, y, 1, 1);
      }
    }
  });
  return c;
}

const P_K = "#16100c";

// ─── The knight (player) ─────────────────────────────────────────────────────
const knightPal: Record<string, string> = {
  K: P_K,
  P: "#b03024",
  H: "#b7c0cf",
  h: "#8591a3",
  d: "#5f6b80",
  S: "#d9a066",
  A: "#93a0b4",
  L: "#6f4d2e",
  B: "#3b2b1d",
  R: "#7d1d16",
};

const sideIdle = [
  ".....KKKKK......",
  "....KPPPPPK.....",
  "....KHHHHHK.....",
  "...KHHHHHHHK....",
  "...KHhHHHHhK....",
  "...KHHHHHHHK....",
  "...KKKKKKKKK....",
  "....KSSSSSK.....",
  "....KSKKSSK.....",
  "..KKKAAAAKKK....",
  ".KAAAKAAAAKAAK..",
  ".KAdAKAAAAKAdAK.",
  ".KAAKALLAKAAK...",
  "..KKKALLAKKK....",
  "....KALLLLAK....",
  "....KALLLLAK....",
  "....KAALLAAK....",
  ".....KLLLLK.....",
  "....KLLLLLLK....",
  "....KLLK.KLLK...",
  "....KBBK.KBBK...",
  "...KBBBK..KBBBK.",
];
const sideWalk = sideIdle
  .slice(0, 18)
  .concat([
    "....KLLLLLLK....",
    "...KLLK...KLLK..",
    "..KBBK.....KBBK.",
    "..KKK.......KKK.",
  ]);
const frontIdle = [
  "......KKKK......",
  ".....KPPPPK.....",
  "....KHHHHHHK....",
  "....KHhHHhHK....",
  "....KHHHHHHK....",
  "....KKKKKKKK....",
  ".....KSSSSK.....",
  "..KK.AAAAAA.KK..",
  ".KAAKAAAAAAKAAK.",
  ".KAdKAAKKAAKdAK.",
  ".KAAKAAKKAAKAAK.",
  "..KKKAAAAAAKKK..",
  "....KAALLAAK....",
  "....KALLLLAK....",
  "....KALLLLAK....",
  "....KAALLAAK....",
  ".....KLLLLK.....",
  "....KLLLLLLK....",
  "....KLLKKLLK....",
  "....KBBKKBBK....",
  "...KBBK..KBBK...",
  "...KBBK..KBBK...",
];
const frontWalk = frontIdle
  .slice(0, 18)
  .concat([
    "....KLLKKLLK....",
    "...KBBK..KBBK...",
    "..KBBK....KBBK..",
    "..KKK......KKK..",
  ]);
const backIdle = [
  "......KKKK......",
  ".....KPPPPK.....",
  "....KHHHHHHK....",
  "....KHhHHhHK....",
  "....KHHHHHHK....",
  "....KKKKKKKK....",
  ".....KhhhhK.....",
  "..KK.AAAAAA.KK..",
  ".KAAKAAAAAAKAAK.",
  ".KAdKAAAAAAKdAK.",
  ".KAAKAAAAAAKAAK.",
  "..KKKAAAAAAKKK..",
  "....KARRRRAK....",
  "....KRRRRRRK....",
  "....KRRRRRRK....",
  "....KARRRRAK....",
  ".....KRRRRK.....",
  "....KLLLLLLK....",
  "....KLLKKLLK....",
  "....KBBKKBBK....",
  "...KBBK..KBBK...",
  "...KBBK..KBBK...",
];
const backWalk = backIdle
  .slice(0, 18)
  .concat([
    "....KLLKKLLK....",
    "...KBBK..KBBK...",
    "..KBBK....KBBK..",
    "..KKK......KKK..",
  ]);

// ─── Skeleton ────────────────────────────────────────────────────────────────
const skelPal: Record<string, string> = {
  K: P_K,
  n: "#e2d8ba",
  m: "#b3a585",
  o: "#6f6350",
  G: "#8dff5e",
  W: "#c8bfa8",
};
const skelIdle = [
  "....KKKKKK....",
  "...KnnnnnnK...",
  "..KnnnnnnnnK..",
  "..KnnGnnnnnK..",
  "..KnnnnnnnnK..",
  "...KKKKKKKK...",
  "......nn......",
  "..K..nnnn..K..",
  ".KnK.nnnn.KWK.",
  ".KnK.nnnn.KWK.",
  "..K..nnnn..WK.",
  ".....mnnm..WK.",
  ".....nnnn..WK.",
  ".....Kn.nK.WK.",
  ".....Kn.nK..K.",
  ".....nn.nn....",
  ".....nn.nn....",
  "....Km...mK...",
  "....KK...KK...",
];
const skelWalk = skelIdle
  .slice(0, 15)
  .concat([
    "....nn..nn....",
    "....nn..nn....",
    "...Km....mK...",
    "...KK....KK...",
  ]);

// ─── Zombie ──────────────────────────────────────────────────────────────────
const zomPal: Record<string, string> = {
  K: P_K,
  g: "#7d9455",
  G: "#55693a",
  E: "#e04040",
  B: "#7a1414",
};
const zomIdle = [
  "....KKKKKK....",
  "...KggggggK...",
  "..KggggggggK..",
  "..KgEggggEgK..",
  "..KgggKKgggK..",
  "...KggggggK...",
  ".....KggK.....",
  "..KKKggggKKK..",
  ".KgggKgggKggK.",
  ".KggKgggggKggK",
  ".KggKgggggKggK",
  "..KKKggggKKKK.",
  "....KgBBggK...",
  "....KgggggK...",
  "....KgggggK...",
  "....Kgg.ggK...",
  "....Kg...gK...",
  "...KBK...KBK..",
  "...KK.....KK..",
];
const zomWalk = zomIdle
  .slice(0, 15)
  .concat([
    "...Kgg...gK...",
    "...Kg.....gK..",
    "..KBK.....KBK.",
    "..KK.......KK.",
  ]);

// ─── Wraith ──────────────────────────────────────────────────────────────────
const wraPal: Record<string, string> = {
  K: P_K,
  W: "#23343c",
  t: "#3d6b66",
  T: "#6fe3cf",
};
const wraithIdle = [
  ".....KKKKKK.....",
  "....KWWWWWWK....",
  "...KWWWWWWWWK...",
  "..KWWWWWWWWWWK..",
  "..KWKWWWWWWKWK..",
  "..KWWTTWWTTWWK..",
  "..KWWWWWWWWWWK..",
  "...KKWWWWWWKK...",
  "...KttTTTTttK...",
  "..KttttttttttK..",
  "..KtTttttttTtK..",
  ".KttttttttttttK.",
  ".KttTttttttTttK.",
  ".KttttttttttttK.",
  "..KttttttttttK..",
  "..KttKttttKttK..",
  "...KtK.tt.KtK...",
  "...KK..tt..KK...",
];
const wraithFloat = [
  "................",
  ".....KKKKKK.....",
  "....KWWWWWWK....",
  "...KWWWWWWWWK...",
  "..KWWWWWWWWWWK..",
  "..KWKWWWWWWKWK..",
  "..KWWTTWWTTWWK..",
  "..KWWWWWWWWWWK..",
  "...KKWWWWWWKK...",
  "...KttTTTTttK...",
  "..KttttttttttK..",
  "..KtTttttttTtK..",
  ".KttttttttttttK.",
  ".KttTttttttTttK.",
  ".KttttttttttttK.",
  "..KttttttttttK..",
  "...KtKttttKtK...",
  ".....K.tt.K.....",
];

// ─── Chests ──────────────────────────────────────────────────────────────────
const chestPal: Record<string, string> = {
  K: P_K,
  W: "#7a5228",
  w: "#59391d",
  G: "#d9a63f",
  L: "#f0d070",
  g: "#ffd76a",
};
const chestClosed = [
  ".KKKKKKKKKKKKKK.",
  "KWWWWWWWWWWWWWWK",
  "KwWWWWWWWWWWWWwK",
  "KWwWWWWWWWWWWwWK",
  "KKKKKKKKKKKKKKKK",
  "KGGGKWLLLLKWGGGK",
  "KWWWWKWLLWKWWWWK",
  "KwWWWKWLLWKWWWwK",
  "KWWWWKWWWWKWWWWK",
  "KKKKKKKKKKKKKKKK",
  "KWWWWWWWWWWWWWWK",
  "KwWWWWWWWWWWWWwK",
  "KKKKKKKKKKKKKKKK",
];
const chestOpen = [
  ".KKKKKKKKKKKKKK.",
  "KwwwwwwwwwwwwwwK",
  "KwWWWWWWWWWWWWwK",
  "KKKKKKKKKKKKKKKK",
  "KKKKKKKKKKKKKKKK",
  "KGGGKKggggKKGGGK",
  "KWWWWKggggKWWWWK",
  "KwWWWKWWWWKWWWwK",
  "KWWWWKWWWWKWWWWK",
  "KKKKKKKKKKKKKKKK",
  "KWWWWWWWWWWWWWWK",
  "KwWWWWWWWWWWWWwK",
  "KKKKKKKKKKKKKKKK",
];

// ─── Item icons (16×16-ish, inventory) ──────────────────────────────────────
const iconPal: Record<string, string> = {
  K: P_K,
  s: "#c4ccd8",
  S: "#8b95a6",
  h: "#7a4f2a",
  H: "#6f4d2e",
  g: "#e8c05a",
  r: "#c22a1e",
  w: "#cfe4e8",
};
const icoSword = [
  ".......KK.......",
  "......KssK......",
  "......KssK......",
  "......KssK......",
  "......KssK......",
  "......KssK......",
  "......KssK......",
  "......KssK......",
  "......KssK......",
  "....KKKssKKK....",
  "...KhhKssKhhK...",
  ".......KhK......",
  ".......KhK......",
  ".......KhK......",
  "......KggK......",
  ".......KK.......",
];
const icoAxe = [
  "......KKKK......",
  "....KKssssKK....",
  "...KssssssssK...",
  "...KsSssssSsK...",
  "...KKssssssKK...",
  ".....KKKKhhK....",
  ".........KhK....",
  ".........KhK....",
  ".........KhK....",
  ".........KhK....",
  ".........KhK....",
  ".........KhK....",
  ".........KhK....",
  ".........KhK....",
  "........KggK....",
  ".........KK.....",
];
const icoMace = [
  "......KKKK......",
  ".....KssssK.....",
  "....KsSssSsK....",
  "...KKssssssKK...",
  "..KsKssssssKsK..",
  "...KKssssssKK...",
  "....KsSssSsK....",
  ".....KssssK.....",
  "......KhhK......",
  "......KhhK......",
  "......KhhK......",
  "......KhhK......",
  "......KhhK......",
  "......KhhK......",
  ".....KgggK......",
  "......KKK.......",
];
const icoSpear = [
  ".......KK.......",
  "......KssK......",
  ".....KssssK.....",
  ".....KssssK.....",
  "......KssK......",
  "......KggK......",
  "......KhK.......",
  "......KhK.......",
  "......KhK.......",
  "......KhK.......",
  "......KhK.......",
  "......KhK.......",
  "......KhK.......",
  "......KhK.......",
  "......KhK.......",
  "......KK........",
];
const icoShield = [
  "....KKKKKKKK....",
  "...KssssssssK...",
  "..KsSsssssSssK..",
  "..KsssggggsssK..",
  "..KsssgrrgsssK..",
  "..KsssgrrgsssK..",
  "..KsssggggsssK..",
  "..KsSsssssSssK..",
  "...KssssssssK...",
  "....KssssssK....",
  ".....KssssK.....",
  "......KssK......",
  ".......KK.......",
];
const icoHelm = [
  "....KKKKKKKK....",
  "...KssssssssK...",
  "..KssssssssssK..",
  "..KssssssssssK..",
  "..KKKKKKKKKKKK..",
  "..KsKKssssKKsK..",
  "..KsKKssssKKsK..",
  "..KssssssssssK..",
  "..KsSssssssSsK..",
  "...KKKKKKKKKK...",
];
const icoArmor = [
  "..KK........KK..",
  ".KssK......KssK.",
  ".KsssKKKKKKsssK.",
  "..KssssssssssK..",
  "..KsSssssssSsK..",
  "..KssssggssssK..",
  "..KssssggssssK..",
  "..KsSsssssSsSK..",
  "...KssssssssK...",
  "....KKKKKKKK....",
];
const icoBoots = [
  "....KKKK........",
  "...KHHHHK.......",
  "...KHHHHK.......",
  "...KHHHHK.......",
  "...KHHHHKKK.....",
  "...KHHHHHHHK....",
  "...KHHHHHHHHK...",
  "..KKKKKKKKKKK...",
];
const icoGloves = [
  "...KKKKK........",
  "..KsssssK.......",
  "..KsSsssK.......",
  "..KsssssKKK.....",
  "..KssssssK......",
  "..KssssssK......",
  "...KKKKKK.......",
];
const icoVial = [
  "......KK........",
  ".....KhhK.......",
  ".....KhhK.......",
  "....KwwwwK......",
  "...KwrrrrwK.....",
  "...KwrrrrwK.....",
  "...KwrrrrwK.....",
  "....KwwwwK......",
  ".....KKKK.......",
];
const icoGold = [
  "....KKKK........",
  "..KKggggKK......",
  ".KggggggggK.....",
  "KgggKgKggggK....",
  "KgggggggKggK....",
  ".KggKgKgggK.....",
  "..KKKKKKKK......",
];

// ─── Exported sprite book ────────────────────────────────────────────────────
export const SPR = {
  playerSide: [mk(sideIdle, knightPal), mk(sideWalk, knightPal)],
  playerFront: [mk(frontIdle, knightPal), mk(frontWalk, knightPal)],
  playerBack: [mk(backIdle, knightPal), mk(backWalk, knightPal)],
  skeleton: [mk(skelIdle, skelPal), mk(skelWalk, skelPal)],
  zombie: [mk(zomIdle, zomPal), mk(zomWalk, zomPal)],
  wraith: [mk(wraithIdle, wraPal), mk(wraithFloat, wraPal)],
  chestClosed: mk(chestClosed, chestPal),
  chestOpen: mk(chestOpen, chestPal),
  icons: {
    sword: mk(icoSword, iconPal),
    axe: mk(icoAxe, iconPal),
    mace: mk(icoMace, iconPal),
    spear: mk(icoSpear, iconPal),
    shield: mk(icoShield, iconPal),
    helm: mk(icoHelm, iconPal),
    armor: mk(icoArmor, iconPal),
    boots: mk(icoBoots, iconPal),
    gloves: mk(icoGloves, iconPal),
    vial: mk(icoVial, iconPal),
    gold: mk(icoGold, iconPal),
  } as Record<string, HTMLCanvasElement>,
};

// ─── Procedural floor / wall tiles ──────────────────────────────────────────
function seededRand(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const FLOOR_BASES = ["#2e2620", "#322a22", "#2a221c", "#302820", "#292119"];

function makeFloorTile(variant: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = TILE;
  c.height = TILE;
  const g = c.getContext("2d")!;
  const rnd = seededRand(97 + variant * 131);
  // two flagstones per tile (16px each)
  for (let sy = 0; sy < 2; sy++) {
    for (let sx = 0; sx < 2; sx++) {
      g.fillStyle = FLOOR_BASES[Math.floor(rnd() * FLOOR_BASES.length)];
      g.fillRect(sx * 16, sy * 16, 16, 16);
      // speckle
      for (let i = 0; i < 9; i++) {
        g.fillStyle = rnd() > 0.5 ? "rgba(0,0,0,0.22)" : "rgba(216,205,178,0.06)";
        g.fillRect(sx * 16 + 1 + Math.floor(rnd() * 14), sy * 16 + 1 + Math.floor(rnd() * 14), 2, 2);
      }
    }
  }
  // mortar
  g.fillStyle = "#1c1613";
  g.fillRect(0, 0, TILE, 2);
  g.fillRect(0, 0, 2, TILE);
  g.fillRect(15, 0, 2, TILE);
  g.fillRect(0, 15, TILE, 2);
  // variant dressing
  if (variant === 1) {
    for (let i = 0; i < 5; i++) {
      g.fillStyle = i % 2 ? "#44522f" : "#3b4a2c";
      g.fillRect(Math.floor(rnd() * 28), Math.floor(rnd() * 28), 3 + Math.floor(rnd() * 3), 2);
    }
  } else if (variant === 2) {
    g.strokeStyle = "rgba(10,7,5,0.8)";
    g.lineWidth = 1;
    g.beginPath();
    let x = 4 + rnd() * 8, y = 2;
    g.moveTo(x, y);
    for (let i = 0; i < 4; i++) { x += rnd() * 8 - 4; y += 7; g.lineTo(x, y); }
    g.stroke();
  } else if (variant === 3) {
    g.fillStyle = "#8a7f66";
    for (let i = 0; i < 4; i++) g.fillRect(3 + Math.floor(rnd() * 26), 3 + Math.floor(rnd() * 26), 2, 1);
    g.fillStyle = "rgba(110,15,15,0.28)";
    g.beginPath();
    g.ellipse(8 + rnd() * 14, 8 + rnd() * 14, 4 + rnd() * 3, 3 + rnd() * 2, 0, 0, 7);
    g.fill();
  }
  return c;
}

export const floorTiles = [0, 1, 2, 3].map(makeFloorTile);

function makeWallBody(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = TILE;
  c.height = TILE;
  const g = c.getContext("2d")!;
  const rnd = seededRand(4242);
  g.fillStyle = "#463a30";
  g.fillRect(0, 0, TILE, TILE);
  // brick courses
  for (let row = 0; row < 4; row++) {
    const y = row * 8;
    const off = row % 2 === 0 ? 0 : 8;
    for (let bx = -1; bx < 3; bx++) {
      const x = bx * 16 + off;
      g.fillStyle = ["#4d4038", "#443830", "#51443a", "#3f342c"][Math.floor(rnd() * 4)];
      g.fillRect(x + 1, y + 1, 14, 6);
      if (rnd() > 0.6) {
        g.fillStyle = "rgba(0,0,0,0.25)";
        g.fillRect(x + 2 + Math.floor(rnd() * 10), y + 2, 3, 2);
      }
    }
  }
  g.fillStyle = "rgba(0,0,0,0.35)";
  g.fillRect(0, TILE - 3, TILE, 3);
  return c;
}

function makeWallParapet(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = TILE;
  c.height = WALL_EXTRA;
  const g = c.getContext("2d")!;
  g.fillStyle = "#574a3d";
  g.fillRect(0, 4, TILE, WALL_EXTRA - 4);
  g.fillStyle = "#6e5d4a";
  g.fillRect(0, 0, TILE, 4);
  g.fillStyle = "#8a755c";
  g.fillRect(0, 0, TILE, 1);
  for (let x = 2; x < TILE; x += 8) {
    g.fillStyle = "rgba(0,0,0,0.22)";
    g.fillRect(x, 5, 1, WALL_EXTRA - 6);
  }
  g.fillStyle = "rgba(0,0,0,0.3)";
  g.fillRect(0, WALL_EXTRA - 2, TILE, 2);
  return c;
}

export const wallBody = makeWallBody();
export const wallParapet = makeWallParapet();

// ─── white silhouette cache (hit flash) ─────────────────────────────────────
const whiteCache = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
export function whiteOf(src: HTMLCanvasElement): HTMLCanvasElement {
  let w = whiteCache.get(src);
  if (!w) {
    w = document.createElement("canvas");
    w.width = src.width;
    w.height = src.height;
    const g = w.getContext("2d")!;
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = "source-in";
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, w.width, w.height);
    whiteCache.set(src, w);
  }
  return w;
}
