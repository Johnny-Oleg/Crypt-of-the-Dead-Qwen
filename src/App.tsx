import { useEffect, useRef, useState } from "react";
import { Game, Phase, HudData, Toast } from "./game/engine";
import { Item, Slot, iconURL, itemStatLines, RARITY_COLOR, SLOT_LABEL } from "./game/items";

const CONTROLS: [string, string][] = [
  ["W A S D", "Move"],
  ["Mouse / Space", "Attack (aim with cursor)"],
  ["E", "Open chests · Descend stairs"],
  ["I / C", "Character & inventory"],
  ["P / Esc", "Pause"],
  ["Right-click", "Drop item from bag"],
];

function Skull({ size = 22, color = "#d8cdb2" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" style={{ imageRendering: "pixelated" }}>
      <g fill={color}>
        <rect x="2" y="1" width="8" height="7" />
        <rect x="1" y="2" width="10" height="5" />
        <rect x="3" y="8" width="6" height="2" />
        <rect x="4" y="10" width="1" height="1" />
        <rect x="7" y="10" width="1" height="1" />
      </g>
      <g fill="#0a0705">
        <rect x="3" y="4" width="2" height="2" />
        <rect x="7" y="4" width="2" height="2" />
        <rect x="5" y="6" width="2" height="1" />
        <rect x="5" y="8" width="1" height="2" />
        <rect x="7" y="8" width="1" height="1" />
      </g>
    </svg>
  );
}

function Divider() {
  return (
    <div className="flex items-center justify-center gap-3 my-3">
      <div className="gold-rule w-24 sm:w-40" />
      <Skull size={20} color="#8a6f3a" />
      <div className="gold-rule w-24 sm:w-40" />
    </div>
  );
}

function ControlsList({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`grid gap-x-6 gap-y-1.5 ${compact ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2"}`}>
      {CONTROLS.map(([k, v]) => (
        <div key={k} className="flex items-center gap-2 text-sm text-[#a89877]">
          <span className="kbd">{k}</span>
          <span>{v}</span>
        </div>
      ))}
    </div>
  );
}

function StatPanel({ hud, inv }: { hud: HudData; inv?: ReturnType<Game["getInv"]> | null }) {
  const atk = inv?.stats.atk ?? hud.atk;
  const def = inv?.stats.def ?? hud.def;
  const crit = inv?.stats.crit ?? hud.crit;
  const maxHp = inv?.stats.maxHp ?? hud.maxHp;
  const hp = inv?.stats.hp ?? hud.hp;
  return (
    <div className="text-[15px] leading-tight">
      <div className="stat-row">
        <span className="text-[#8f8266] uppercase tracking-widest text-xs">Life</span>
        <span className="text-[#ff8a76] font-bold">{hp} / {maxHp}</span>
      </div>
      <div className="h-2 bg-[#1a0806] border border-[#3c2c1a] mb-2 mt-1">
        <div className="h-full" style={{ width: `${(hp / maxHp) * 100}%`, background: "linear-gradient(90deg,#8f1010,#d8352a)" }} />
      </div>
      <div className="stat-row"><span className="text-[#8f8266] uppercase tracking-widest text-xs">Attack</span><span className="text-[#ffd97a] font-bold">{atk}</span></div>
      <div className="stat-row"><span className="text-[#8f8266] uppercase tracking-widest text-xs">Defense</span><span className="text-[#9fc7e8] font-bold">{def}</span></div>
      <div className="stat-row"><span className="text-[#8f8266] uppercase tracking-widest text-xs">Crit</span><span className="text-[#cfc2a2] font-bold">{crit}%</span></div>
      <div className="gold-rule my-2" />
      <div className="stat-row"><span className="text-[#8f8266] uppercase tracking-widest text-xs">Gold</span><span className="text-[#ffd76a] font-bold">{inv?.stats.gold ?? hud.gold}</span></div>
      <div className="stat-row"><span className="text-[#8f8266] uppercase tracking-widest text-xs">Floor</span><span className="text-[#cfc2a2] font-bold">{hud.floor} / 10</span></div>
      <div className="stat-row"><span className="text-[#8f8266] uppercase tracking-widest text-xs">Slain</span><span className="text-[#cfc2a2] font-bold">{hud.kills}</span></div>
    </div>
  );
}

const SILHOUETTE = (
  <svg viewBox="0 0 60 110" className="w-full h-full" style={{ imageRendering: "auto" }}>
    <g fill="#171019" stroke="#3a2f45" strokeWidth="1.4">
      <path d="M30 4 C22 4 18 10 18 17 C18 23 22 27 26 28 L26 32 C16 34 10 40 9 50 L7 74 L15 76 L17 58 L17 80 L15 104 L24 104 L27 78 L33 78 L36 104 L45 104 L43 80 L43 58 L45 76 L53 74 L51 50 C50 40 44 34 34 32 L34 28 C38 27 42 23 42 17 C42 10 38 4 30 4 Z" />
    </g>
    <g fill="#241a2e">
      <rect x="22" y="12" width="16" height="3" />
      <rect x="24" y="40" width="12" height="18" opacity="0.5" />
    </g>
  </svg>
);

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const toastId = useRef(0);
  const [phase, setPhase] = useState<Phase>("title");
  const [hud, setHud] = useState<HudData | null>(null);
  const [toasts, setToasts] = useState<(Toast & { id: number })[]>([]);
  const [hurtKey, setHurtKey] = useState(0);
  const [healKey, setHealKey] = useState(0);
  const [invVer, setInvVer] = useState(0);
  const [tip, setTip] = useState<{ item: Item; x: number; y: number } | null>(null);

  useEffect(() => {
    const g = new Game(canvasRef.current!, {
      onPhase: setPhase,
      onHud: setHud,
      onToast: (t) => {
        const id = ++toastId.current;
        setToasts((ts) => [...ts.slice(-3), { ...t, id }]);
        window.setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 2600);
      },
      onHurt: () => setHurtKey((k) => k + 1),
      onHeal: () => setHealKey((k) => k + 1),
      onInv: () => setInvVer((v) => v + 1),
    });
    gameRef.current = g;
    return () => g.destroy();
  }, []);

  const g = () => gameRef.current!;
  const records = g()?.getRecords() ?? { deepest: 0, wins: 0 };
  const inv = phase === "inventory" ? g().getInv() : null;
  const hpFrac = hud ? hud.hp / hud.maxHp : 1;

  const equipSlot = (slot: Slot, label: string, ghostIcon: string) => {
    const it = inv?.equip[slot];
    return (
      <button
        className="equip-slot"
        title={it ? `${it.name} (click to unequip)` : label}
        onClick={() => it && g().unequip(slot)}
        onContextMenu={(e) => e.preventDefault()}
        onMouseEnter={(e) => it && setTip({ item: it, x: e.clientX, y: e.clientY })}
        onMouseLeave={() => setTip(null)}
      >
        {it ? (
          <img src={iconURL(it.type)} alt={it.name} className="pixelated w-9 h-9" style={{ filter: `drop-shadow(0 0 4px ${RARITY_COLOR[it.rarity]})` }} draggable={false} />
        ) : (
          <span className="ghost flex flex-col items-center">
            <img src={iconURL(ghostIcon)} alt="" className="pixelated w-7 h-7" draggable={false} />
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="w-full h-full flex items-center justify-center bg-[#050302] select-none overflow-hidden">
      <div className="relative" style={{ width: "min(100vw, calc(100vh * 16 / 9))", aspectRatio: "16 / 9" }}>
        <canvas ref={canvasRef} width={960} height={540} className="game-surface w-full h-full" />

        {/* ══ HUD ══ */}
        {(phase === "playing" || phase === "paused" || phase === "inventory" || phase === "dying") && hud && (
          <div className="absolute inset-0 pointer-events-none z-30 font-body">
            {/* floor banner top-left */}
            <div className="absolute top-3 left-4">
              <div className="flex items-center gap-1.5 mb-1.5">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rotate-45 border"
                    style={{
                      background: i < hud.floor ? (i === 9 ? "#c22a1e" : "#e8b84b") : "transparent",
                      borderColor: i < hud.floor ? "#000" : "#4a3a26",
                    }}
                  />
                ))}
              </div>
              <div className="font-display text-xl text-[#e8b84b] leading-none" style={{ textShadow: "0 2px 6px #000" }}>
                Floor {hud.floor} <span className="text-[#8f8266] text-base">— {hud.floorName}</span>
              </div>
            </div>

            {/* kills + atk/def top-right */}
            <div className="absolute top-3 right-4 text-right">
              <div className="flex items-center gap-2 justify-end text-[#cfc2a2]">
                <Skull size={18} color="#8a6f3a" />
                <span className="font-display text-xl leading-none" style={{ textShadow: "0 2px 6px #000" }}>{hud.kills}</span>
              </div>
              <div className="text-xs text-[#8f8266] mt-1 tracking-wide">
                ATK <b className="text-[#ffd97a]">{hud.atk}</b> · DEF <b className="text-[#9fc7e8]">{hud.def}</b> · <span className="kbd">I</span> bag · <span className="kbd">P</span> pause
              </div>
            </div>

            {/* interact prompt */}
            {hud.prompt && phase === "playing" && (
              <div className="absolute left-1/2 -translate-x-1/2 bottom-40 prompt-pulse">
                <div className="font-display text-lg text-[#ffd97a] px-4 py-1 bg-[rgba(10,6,4,0.82)] border border-[#5c451f]" style={{ textShadow: "0 0 10px rgba(232,184,75,0.6)" }}>
                  <span className="kbd mr-2">E</span>{hud.prompt}
                </div>
              </div>
            )}

            {/* HP orb bottom-left */}
            <div className="absolute bottom-4 left-5 flex items-end gap-3">
              <div className={`hp-orb ${hpFrac < 0.3 ? "low-pulse" : ""}`}>
                <div className="fill" style={{ height: `${Math.max(0, hpFrac * 100)}%` }} />
                <div className="glass" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-display text-xl text-white" style={{ textShadow: "0 1px 3px #000, 0 0 8px rgba(0,0,0,0.9)" }}>{hud.hp}</span>
                </div>
              </div>
            </div>

            {/* gold bottom-right */}
            <div className="absolute bottom-6 right-6 text-right">
              <div className="flex items-center gap-2 justify-end">
                <img src={iconURL("gold")} alt="" className="pixelated w-8 h-6" draggable={false} />
                <span className="font-display text-3xl text-[#ffd76a]" style={{ textShadow: "0 2px 8px #000" }}>{hud.gold}</span>
              </div>
              <div className="text-[11px] text-[#8f8266] tracking-widest uppercase mt-0.5">gold</div>
            </div>

            {/* toasts */}
            <div className="absolute top-16 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 w-full px-4">
              {toasts.map((t) => (
                <div key={t.id} className="toast-anim font-display text-lg px-4 py-0.5 bg-[rgba(8,5,3,0.85)] border border-[#3c2c1a]"
                  style={{ color: t.color ?? "#cfc2a2", textShadow: "0 2px 6px #000" }}>
                  {t.msg}
                </div>
              ))}
            </div>

            {/* hurt / heal flashes */}
            {hurtKey > 0 && (
              <div key={`h${hurtKey}`} className="hurt-flash absolute inset-0"
                style={{ background: "radial-gradient(ellipse at center, rgba(160,20,10,0) 40%, rgba(160,20,10,0.55) 100%)" }} />
            )}
            {healKey > 0 && (
              <div key={`g${healKey}`} className="heal-flash absolute inset-0"
                style={{ background: "radial-gradient(ellipse at center, rgba(60,160,70,0) 45%, rgba(80,200,90,0.4) 100%)" }} />
            )}
          </div>
        )}

        {/* ══ TITLE ══ */}
        {phase === "title" && (
          <div className="absolute inset-0 z-40 screen-in flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_center,rgba(20,8,4,0.55)_0%,rgba(5,2,1,0.9)_75%)]">
            <div className="text-center px-4">
              <div className="fade-up text-[#8f8266] tracking-[0.5em] uppercase text-xs sm:text-sm mb-2">Ten floors down · no one comes back</div>
              <h1 className="font-display title-flame leading-[0.86] text-[#e8d9b0]" style={{ fontSize: "clamp(3.4rem, 10vw, 7.5rem)" }}>
                CRYPT<br />
                <span className="text-[#c22a1e]">OF THE DEAD</span>
              </h1>
              <Divider />
              <div className="skull-float flex justify-center mb-4"><Skull size={34} color="#c9b98f" /></div>
              <button className="btn-gothic btn-blood text-2xl px-10" onClick={() => g().newGame()}>
                Descend <span className="text-sm opacity-70 ml-1">[Enter]</span>
              </button>
              <div className="mt-3 text-xs text-[#8f8266] tracking-widest uppercase">
                {records.deepest > 0 && <>Deepest descent — floor {records.deepest} · </>}
                {records.wins > 0 && <>{records.wins} crypt lord{records.wins > 1 ? "s" : ""} slain · </>}
                <span className="blink-slow">a haunting awaits</span>
              </div>
            </div>
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 panel-stone px-6 py-3 max-w-[92%]">
              <ControlsList compact />
              <div className="text-center text-[11px] text-[#6e5f47] mt-2 tracking-wide">Gamepad supported — stick to move, Ⓐ attack, Ⓧ interact, Ⓨ bag, START pause</div>
            </div>
          </div>
        )}

        {/* ══ PAUSE ══ */}
        {phase === "paused" && hud && (
          <div className="absolute inset-0 z-40 screen-in flex items-center justify-center bg-[rgba(3,2,1,0.78)]">
            <div className="panel-stone px-10 py-8 text-center max-w-md w-[92%]">
              <h2 className="font-display text-5xl text-[#e8b84b]" style={{ textShadow: "0 0 20px rgba(232,184,75,0.35)" }}>PAUSED</h2>
              <div className="text-[#8f8266] mt-1 mb-4">Floor {hud.floor} — {hud.floorName}</div>
              <div className="gold-rule mb-5" />
              <div className="flex flex-col gap-3 items-center mb-5">
                <button className="btn-gothic w-56" onClick={() => g().resume()}>Resume</button>
                <button className="btn-gothic btn-blood w-56" onClick={() => g().quitToTitle()}>Abandon Run</button>
              </div>
              <ControlsList />
            </div>
          </div>
        )}

        {/* ══ YOU DIED ══ */}
        {phase === "dead" && hud && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-[radial-gradient(ellipse_at_center,rgba(60,5,3,0.55)_0%,rgba(5,1,1,0.94)_70%)]">
            <div className="text-center px-4">
              <h2 className="died-in font-display text-[#c22a1e]" style={{ fontSize: "clamp(4rem, 12vw, 8.5rem)", textShadow: "0 0 40px rgba(194,42,30,0.6), 0 6px 0 #1a0302" }}>
                YOU DIED
              </h2>
              <div className="fade-up flex justify-center"><Divider /></div>
              <div className="fade-up text-[#a89877] text-lg mb-1" style={{ animationDelay: "0.5s" }}>
                The crypt claims another soul on <b className="text-[#e8b84b]">floor {hud.floor}</b>
              </div>
              <div className="fade-up flex justify-center gap-8 my-4 text-[#cfc2a2]" style={{ animationDelay: "0.7s" }}>
                <div><div className="font-display text-3xl text-[#ffd97a]">{hud.kills}</div><div className="text-xs uppercase tracking-widest text-[#8f8266]">souls slain</div></div>
                <div><div className="font-display text-3xl text-[#ffd76a]">{hud.gold}</div><div className="text-xs uppercase tracking-widest text-[#8f8266]">gold gathered</div></div>
              </div>
              <button className="btn-gothic btn-blood fade-up text-xl" style={{ animationDelay: "0.9s" }} onClick={() => g().newGame()}>
                Rise Again <span className="text-sm opacity-70">[Enter]</span>
              </button>
            </div>
          </div>
        )}

        {/* ══ VICTORY ══ */}
        {phase === "victory" && hud && (
          <div className="absolute inset-0 z-40 screen-in flex items-center justify-center bg-[radial-gradient(ellipse_at_center,rgba(60,45,10,0.5)_0%,rgba(8,5,2,0.94)_72%)]">
            <div className="text-center px-4">
              <div className="fade-up text-[#8f8266] tracking-[0.4em] uppercase text-sm mb-2">The tenth floor falls silent</div>
              <h2 className="font-display title-flame text-[#ffd97a]" style={{ fontSize: "clamp(2.6rem, 7.5vw, 5.5rem)", lineHeight: 0.95 }}>
                THE CRYPT LORD<br />HAS FALLEN
              </h2>
              <Divider />
              <div className="fade-up text-[#cfc2a2] text-lg mb-1" style={{ animationDelay: "0.4s" }}>
                You surface at dawn, pockets heavy with grave gold.
              </div>
              <div className="fade-up flex justify-center gap-8 my-4 text-[#cfc2a2]" style={{ animationDelay: "0.55s" }}>
                <div><div className="font-display text-3xl text-[#ffd97a]">{hud.kills}</div><div className="text-xs uppercase tracking-widest text-[#8f8266]">souls slain</div></div>
                <div><div className="font-display text-3xl text-[#ffd76a]">{hud.gold}</div><div className="text-xs uppercase tracking-widest text-[#8f8266]">gold</div></div>
              </div>
              <button className="btn-gothic fade-up text-xl" style={{ animationDelay: "0.7s" }} onClick={() => g().newGame()}>
                Descend Again <span className="text-sm opacity-70">[Enter]</span>
              </button>
            </div>
          </div>
        )}

        {/* ══ CHARACTER & INVENTORY ══ */}
        {phase === "inventory" && inv && hud && (
          <div className="absolute inset-0 z-40 screen-in bg-[rgba(3,2,1,0.82)] flex items-center justify-center p-3" onContextMenu={(e) => e.preventDefault()}>
            <div className="panel-stone w-full max-w-[1080px] max-h-full overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-5 pt-3 pb-2">
                <h2 className="font-display text-3xl text-[#e8b84b]" style={{ textShadow: "0 0 16px rgba(232,184,75,0.3)" }}>
                  CHARACTER <span className="text-[#8f8266] text-lg">— Floor {hud.floor}, {hud.floorName}</span>
                </h2>
                <button className="btn-gothic text-base px-4 py-1" onClick={() => g().closeInventory()}>Close <span className="opacity-70 text-xs">[I]</span></button>
              </div>
              <div className="gold-rule mx-5 mb-3" />
              <div className="flex flex-wrap gap-5 px-5 pb-4 overflow-y-auto inv-scroll justify-center">
                {/* paper doll */}
                <div className="flex flex-col items-center">
                  <div className="relative" style={{ width: 220, height: 300 }}>
                    <div className="absolute left-1/2 -translate-x-1/2 top-[34px] w-[104px] h-[210px] opacity-90">{SILHOUETTE}</div>
                    <div className="absolute left-1/2 -translate-x-1/2 top-0">{equipSlot("helm", "Helm", "helm")}</div>
                    <div className="absolute left-1/2 -translate-x-1/2 top-[104px]">{equipSlot("armor", "Cuirass", "armor")}</div>
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-0">{equipSlot("boots", "Greaves", "boots")}</div>
                    <div className="absolute left-0 top-[64px]">{equipSlot("weapon", "Weapon", "sword")}</div>
                    <div className="absolute left-0 top-[128px]">{equipSlot("gloves", "Gauntlets", "gloves")}</div>
                    <div className="absolute right-0 top-[96px]">{equipSlot("shield", "Shield", "shield")}</div>
                  </div>
                  <div className="w-52 mt-2"><StatPanel hud={hud} inv={inv} /></div>
                </div>

                {/* bag */}
                <div className="flex flex-col min-w-0">
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="font-display text-xl text-[#cfc2a2]">BACKPACK</span>
                    <span className="text-xs text-[#8f8266]">20 × 20 · click to equip/use · right-click to drop</span>
                  </div>
                  <div className="inv-scroll overflow-auto border border-[#2c2118] bg-[#0a0705] p-1" style={{ maxWidth: "min(560px, 88vw)" }}>
                    <div className="grid" style={{ gridTemplateColumns: "repeat(20, 26px)", gridTemplateRows: "repeat(20, 26px)" }}>
                      {inv.grid.map((row, y) =>
                        row.map((it, x) => (
                          <div
                            key={`${x}-${y}-${invVer}`}
                            className={`inv-cell ${it ? "occupied" : ""}`}
                            onClick={() => it && g().clickItem(it.uid)}
                            onContextMenu={(e) => { e.preventDefault(); if (it) g().dropItem(it.uid); }}
                            onMouseEnter={(e) => { if (it) setTip({ item: it, x: e.clientX, y: e.clientY }); }}
                            onMouseMove={(e) => { if (it) setTip({ item: it, x: e.clientX, y: e.clientY }); }}
                            onMouseLeave={() => setTip(null)}
                          >
                            {it && (
                              <img
                                src={iconURL(it.type)}
                                alt={it.name}
                                className="pixelated w-[22px] h-[22px]"
                                style={{ filter: `drop-shadow(0 0 3px ${RARITY_COLOR[it.rarity]})` }}
                                draggable={false}
                              />
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* tooltip */}
            {tip && (
              <div
                className="fixed z-50 pointer-events-none panel-stone px-3 py-2 w-56"
                style={{ left: Math.min(tip.x + 18, window.innerWidth - 240), top: Math.min(tip.y + 14, window.innerHeight - 160) }}
              >
                <div className="font-display text-lg leading-tight" style={{ color: RARITY_COLOR[tip.item.rarity] }}>{tip.item.name}</div>
                <div className="text-[11px] uppercase tracking-widest text-[#8f8266] mb-1">
                  {SLOT_LABEL[tip.item.slot]}{tip.item.rarity > 0 ? ` · ${tip.item.rarity === 2 ? "Rare" : "Magic"}` : ""} · ilvl {tip.item.ilvl}
                </div>
                {itemStatLines(tip.item).map((l) => (
                  <div key={l} className="text-[13px] text-[#7dd66a] leading-snug">{l}</div>
                ))}
                <div className="text-[11px] text-[#8f8266] mt-1.5 border-t border-[#2c2118] pt-1">
                  {tip.item.kind === "potion" ? "Click to drink" : "Click to equip"} · Right-click to drop
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ CRT dressing ══ */}
        <div className="crt-scanlines" />
        <div className="crt-vignette" />
        <div className="crt-flicker" />
        <div className="crt-roll" />
      </div>
    </div>
  );
}
