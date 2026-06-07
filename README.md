# Crazy Café 🍔☕

A wacky drag & stack cooking game — game #2 on [Wacky Games](https://wackygames.com.au). The wackyShooter enemies were hungry all along: dancing tomatoes, angry toasters, wobbly jellies and skeletons queue up at your counter.

**▶️ Play: https://wackygames.com.au/cafe/**

## How to play

- **🎮 Singleplayer** or **🌐 Multiplayer co-op**: up to 4 chefs in one kitchen, building on the **same plate together** — you drop the bun, your friend drops the patty, anyone can serve. You see each other's colored cursors, and coins/strikes/days are shared.
- A customer walks up and shows their order — a **stack** of ingredients
- ☕💧 Coffee and water come from the **machines** beside the plate — tap to brew/fill, then drag the fresh cup over
- **Drag** ingredients from the shelf onto the plate, in the right order, bottom to top
- Hit **✅ SERVE** before their patience runs out — faster service = bigger tips 🪙
- **🗑️ CLEAR** the plate if you mess up (a wrong serve makes them grumpy and costs patience)
- 3 customers stomping off hungry = **CAFÉ CLOSED**
- Endless days, each busier and less patient; new dishes join the menu as days pass
- Every 5th day the **MEGA TOMATO** arrives and orders THE MEGA BURGER (8 layers, 🪙50!)

## Customers

Toasters are famously impatient. Jellies have a sweet tooth. Skeletons are in no hurry — the dead have time.

## Develop

```bash
npm install
npm run dev    # http://localhost:5173
npm run build  # type-check + bundle to dist/
```

Same stack and conventions as [wackyShooter](https://github.com/chrisforev/wackyShooter): Phaser **3** (pinned — do not upgrade to 4), TypeScript, Vite, all art generated at runtime, WebAudio synth sounds, portrait + landscape arenas, auto-update via `version.json`.
