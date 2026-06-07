# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Crazy Café — game #2 on the Wacky Games portal. A drag & stack cooking game where the wackyShooter enemies are the customers. Phaser 3 + TypeScript + Vite, same conventions as the sibling `../wackyShooter` repo (read its CLAUDE.md for the shared patterns: runtime-generated textures, WebAudio synth, mutable `ARENA_W/H` with portrait swap at boot, fraction-based layout, auto-update via `version.json`, scene-restart state reset).

Served at https://wackygames.com.au/cafe/ via the `../wackyGames` portal repo — its `build.sh` builds this repo and copies `dist/` to `dist/cafe/`. Deploy from there: `npx wrangler pages deploy dist --project-name wackygames --branch main`.

## Commands

- `npm run dev` — Vite dev server (port 5173)
- `npm run build` — type-check then bundle to `dist/`
- `npm run typecheck` — type-check only

Phaser is pinned to **v3.x** — a bare `npm install phaser` pulls Phaser 4 (different API); do not upgrade.

## Architecture

Game content is data-driven from `src/defs.ts`: `INGREDIENTS` (with per-item stack `height` in px), `DISHES` (stack bottom→top + price + `fromDay` menu gating), `CUSTOMERS` (patience multipliers + favorite dishes), pacing constants. `MEGA_DISH` is the every-5th-day boss order.

`GameScene` flow: `startDay` → `nextCustomer` (walk-in tween, order bubble, patience deadline) → player drags shelf bins (dragstart spawns a floating copy; drop near the plate calls `placeIngredient`) → `serve` compares `stack` to `dish.stack` exactly → pay + tip scaled by remaining patience, or grumble + patience penalty on a wrong serve. Timeouts call `angryLeave` (strike); `STRIKES_TO_CLOSE` ends the run. One customer at a time; `customer.fed` guards double-handling.

Scene flow: `MenuScene` → `GameScene` → `GameOverScene` (`{coins, day}` via scene data); multiplayer detours through `MultiplayerScene` ('mplobby'), which puts a connected `Net` in the registry as `'net'`. Best coins/day persist in localStorage (`crazyCafe.*`, `src/storage.ts`); solo shifts autosave (`crazyCafe.run`) for CONTINUE and apply pending deploys between days.

## Multiplayer (co-op kitchen)

Backend: `server/` — same Worker code as wackyShooter's, deployed separately as `crazycafe-mp` (own lobby; deploy with `npx wrangler deploy` from `server/`). Client: `src/net.ts`.

Host-authoritative shared shift: `isSim` (solo or host) runs `startDay`/`nextCustomer`/patience timeouts/`serve(by)` and broadcasts `day`/`cust`/`stack`/`served`/`wrong`/`angry`/`over`; non-hosts mirror via shared handlers (`buildCustomer`, `applyStack`, `handleServed`/`handleWrong`/`handleAngry`/`handleOver`) and send requests (`place`/`clearReq`/`serveReq`). Everyone shares ONE plate. Joiners send `rejoin` → host replies `sync` (full state). Cursor ghosts via `pt` messages ~12Hz. Host promotion: new host resumes simulation from mirrored state. No autosave/CONTINUE in co-op; drink machines are per-client but their cups go through the same place pipeline.
