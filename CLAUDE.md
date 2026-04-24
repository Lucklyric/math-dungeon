# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager: **yarn** (see `packageManager` field in `package.json`). The README and CI use `npm`; either works. There are no lint or test scripts configured.

```sh
yarn install        # install deps
yarn dev            # Vite dev server (http://localhost:5173)
yarn build          # production build → dist/
yarn preview        # serve the built bundle locally
```

Environment: copy `.env.example` to `.env.local` to override the Supabase values baked into `src/lib/supabase.js`. The `VITE_SUPABASE_PUBLISHABLE_KEY` fallback is also read from `VITE_SUPABASE_ANON_KEY`.

Deployment: `.github/workflows/deploy.yml` runs on push to `main`, builds with the Supabase env vars set inline, and publishes `dist/` to GitHub Pages. `vite.config.js` switches `base` to `/math-dungeon/` when `GITHUB_ACTIONS` is set — keep this in sync with the repo name if it changes.

## Architecture

Single-page React 19 + Vite + Tailwind app. The entire game lives in **`src/App.jsx`** (~2000 lines) as one default-exported component, `MathDungeon`, with many small helper/presentational components colocated in the same file. Expect to edit App.jsx for most changes; resist splitting it unless the user asks.

### Game data model

Static catalogs defined at the top of `App.jsx` drive everything:

- `COLORS`, `DECORATIONS` (per-slot item type lists), `SLOT_INFO`/`SLOT_ORDER` (7 equipment slots: hat, face, shirt, pants, cape, aura, tool), `RARITIES`, `MOTIFS`, `FINISHES`, `ENEMIES`.
- Reward generation: `getRarityForEnemy` / `getSlotForEnemy` bias drops by enemy HP, then `makeRewardItem` rolls a concrete item (type + color + motif + finish + rarity). `weightedPick` handles weighted randomness.
- Questions: `genQuestion` produces simple add/sub problems with multiple-choice options.

### Persistence (dual-track)

Save state = `{ inventory, equipped, nextId }` (`DEFAULT_SAVE`). Persisted two ways:

1. **localStorage** under `STORAGE_KEY = 'math-dungeon-v1'` via `loadGame` / `saveGame` — always active, works offline and for guests.
2. **Supabase** `public.game_saves` table (schema in `supabase/migrations/`, RLS keyed to `auth.uid() = user_id`) via `src/lib/supabase.js`. Auth is email magic link (`signInWithOtp`).

The sync effect (around `App.jsx:1115`) runs when `loaded && authReady && user` change: on login it loads the cloud row if present, otherwise upserts the local save to the cloud. Every state mutation goes through `save(inv, eq, id)` which writes localStorage first and then upserts to Supabase if signed in. `isSupabaseConfigured` lets the app degrade gracefully to guest-only mode when env vars are absent.

`normalizeSave` is the single source of truth for shape coercion — use it whenever ingesting save data from an untrusted source (localStorage, cloud, imported JSON).

### UI flow

`mode` state switches between `'home'` / `'battle'` / `'inventory'` screens (`HomeScreen`, `BattleScreen`, and inline inventory rendering). Battle loop: pick enemy → `genQuestion` → `answerQuestion` mutates HP with animation timeouts → on enemy defeat, `makeRewardItem` drops loot and opens the reward box overlay (`newItem` / `boxOpened`). `FancyBackdrop`, `DungeonBg`, and the many `Hat`/`Shirt`/`Cape`/etc. SVG components are pure presentational — edit them for visual changes without touching game logic.

### Conventions specific to this repo

- Styling is Tailwind utility classes inline plus a tiny `src/index.css` (only `@tailwind` directives + a handful of resets). No CSS modules, no component library.
- Avatars and items are hand-authored inline SVG — when adding a new decoration, extend the relevant `DECORATIONS[slot]` array **and** add a rendering branch to the matching SVG component (e.g. a new hat needs a case in `Hat`).
- If you add a new equipment slot, update `SLOT_INFO`, `SLOT_ORDER`, `DECORATIONS`, `getSlotForEnemy`, and the `Avatar` composition — these are the coupling points.
- Schema changes to `game_saves` must be reflected in `normalizeSave`, the `upsert` payloads, and `supabase/migrations/`. RLS policies are required — don't remove them.
