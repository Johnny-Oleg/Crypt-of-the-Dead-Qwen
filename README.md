# ⚰️ CRYPT OF THE DEAD

A 16-bit, Diablo-inspired roguelike descent — hand-authored pixel art, torchlit
2.5D dungeons, melee-only combat, loot, and a crypt lord waiting on floor 10.

Built with **React + TypeScript + Vite**, rendered on a single `<canvas>`,
with 100% procedural WebAudio (no image or sound assets — every sprite is a
character-grid bitmap drawn in code).

## Features

- **10-floor roguelike descent** through procedurally generated crypts
- **Melee combat** — swing arcs, crits, life leech, two-handed weapons vs. shields
- **Enemies with AI** — wander → aggro → chase → telegraphed attack (skeletons,
  zombies, wraiths, elites, and the Crypt Lord boss)
- **Loot** — swords / maces / greataxes / spears, helms / cuirasses / gauntlets /
  greaves / shields, blood vials; normal / magic / rare rarities with affixes
- **Treasure chests** bursting with gold and gear
- **Persistent blood decals**, flickering torchlight, screen shake, hit-stop,
  floating damage numbers
- **CRT dressing** — scanlines, vignette, flicker, roll bar
- **Full screens** — title, pause, character/inventory (20×20 grid + paper doll),
  YOU DIED, victory
- **Haunted ambient music** and procedural SFX (WebAudio)
- **Keyboard + mouse and gamepad** support

## Controls

| Input | Action |
| --- | --- |
| `W A S D` / arrows / left stick | Move |
| Mouse / `Space` / Ⓐ | Attack (aim with cursor) |
| `E` / Ⓧ | Open chests · descend stairs |
| `I` / `C` / Ⓨ | Character & inventory |
| `P` / `Esc` / START | Pause |
| Right-click (in bag) | Drop item |

## Run locally

```bash
npm install
npm run dev        # → http://localhost:3000
```

## Publish to GitHub Pages

The repo ships with a ready-made workflow (`.github/workflows/deploy.yml`).
It builds with `vite build --base=./` so all asset URLs are **relative** —
required because Pages serves the game from `https://<user>.github.io/<repo>/`,
not from the domain root.

1. Create a new repository on GitHub (any name, e.g. `crypt-of-the-dead`).
2. Push this project:

   ```bash
   git init
   git add .
   git commit -m "Crypt of the Dead"
   git branch -M main
   git remote add origin https://github.com/<your-user>/<repo>.git
   git push -u origin main
   ```

3. In the repository on GitHub: **Settings → Pages → Build and deployment →
   Source** — select **GitHub Actions**.
4. The workflow runs on every push to `main` (you can watch it under
   **Actions**). When it finishes, the game is live at:

   ```
   https://<your-user>.github.io/<repo>/
   ```

> **Tip:** if your default branch is `master`, the workflow already triggers on
> it too. To re-deploy manually, use **Actions → Deploy to GitHub Pages →
> Run workflow**.

## Project layout

```
src/
  App.tsx            # screens, HUD, inventory UI, CRT layers
  game/
    engine.ts        # loop, world gen, combat, lighting, input
    sprites.ts       # all pixel art (character grids → canvases)
    items.ts         # loot generation, rarities, icon data-URLs
    audio.ts         # procedural SFX + haunted ambience (WebAudio)
```

Descend. Loot. Don't die. 🕯️
