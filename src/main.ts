import Phaser from 'phaser';
import { ARENA_W, ARENA_H, setArenaSize } from './defs';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { GameOverScene } from './scenes/GameOverScene';

// portrait devices get a tall arena instead of a letterboxed wide one
if (window.innerHeight > window.innerWidth) {
  setArenaSize(640, 960);
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: ARENA_W,
  height: ARENA_H,
  backgroundColor: '#2b1c12',
  scale: {
    parent: 'game',
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [MenuScene, GameScene, GameOverScene],
});

// handle for smoke tests / debugging
(window as unknown as { __game: Phaser.Game }).__game = game;

// ---- auto-update ----
// Deploys write a new version.json; the running game polls it and swaps to
// the new version at a safe moment (menu / game over — never mid-shift).
declare const __BUILD_ID__: string;

async function checkForUpdate() {
  try {
    const res = await fetch('./version.json', { cache: 'no-store' });
    if (!res.ok) return;
    const v = (await res.json()) as { buildId?: string };
    if (!v.buildId || v.buildId === __BUILD_ID__) return;
    if (game.scene.isActive('menu') || game.scene.isActive('gameover')) {
      window.location.reload();
    } else {
      // mid-shift: flag it — GameScene reloads between days (run is autosaved)
      (window as unknown as { __updateReady?: boolean }).__updateReady = true;
    }
  } catch {
    // offline or dev server — ignore
  }
}

setInterval(() => void checkForUpdate(), 60_000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') void checkForUpdate();
});
