import Phaser from 'phaser';
import { ARENA_W, ARENA_H } from '../defs';
import { getBestCoins, getBestDay } from '../storage';

export class GameOverScene extends Phaser.Scene {
  private coins = 0;
  private day = 1;

  constructor() {
    super('gameover');
  }

  init(data: { coins?: number; day?: number }) {
    this.coins = data.coins ?? 0;
    this.day = data.day ?? 1;
  }

  create() {
    const title = this.add
      .text(ARENA_W / 2, ARENA_H * 0.3, 'CAFÉ CLOSED!', {
        fontFamily: 'monospace',
        fontSize: ARENA_W < ARENA_H ? '54px' : '68px',
        color: '#ff595e',
        stroke: '#000000',
        strokeThickness: 10,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setScale(0);
    this.tweens.add({ targets: title, scale: 1, duration: 400, ease: 'Back.easeOut' });

    this.add
      .text(ARENA_W / 2, ARENA_H * 0.42, 'Three customers stomped off hungry…', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#ffe8d6',
      })
      .setOrigin(0.5);

    this.add
      .text(ARENA_W / 2, ARENA_H * 0.52, `🪙 ${this.coins}   ·   DAY ${this.day}`, {
        fontFamily: 'monospace',
        fontSize: '36px',
        color: '#ffd166',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 5,
      })
      .setOrigin(0.5);

    const bestCoins = getBestCoins();
    const isRecord = this.coins >= bestCoins && this.coins > 0;
    this.add
      .text(
        ARENA_W / 2,
        ARENA_H * 0.61,
        isRecord ? '🎉 NEW BEST! 🎉' : `BEST  🪙${bestCoins} · DAY ${getBestDay()}`,
        {
          fontFamily: 'monospace',
          fontSize: '24px',
          color: isRecord ? '#ffd166' : '#aaaaaa',
          stroke: '#000000',
          strokeThickness: 4,
          fontStyle: 'bold',
        },
      )
      .setOrigin(0.5);

    const retry = this.add
      .text(ARENA_W / 2, ARENA_H * 0.74, '👨‍🍳 REOPEN THE CAFÉ', {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: '#70e000',
        stroke: '#000000',
        strokeThickness: 5,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.tweens.add({
      targets: retry,
      scale: 1.12,
      duration: 450,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // ✕ back to the title screen
    const closeBtn = this.add
      .text(ARENA_W - 18, 14, '✕', {
        fontFamily: 'monospace',
        fontSize: '36px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 6,
        fontStyle: 'bold',
      })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    closeBtn.on('pointerover', () => closeBtn.setColor('#ff595e'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#ffffff'));

    // small delay so a frantic last-second click doesn't instantly trigger either
    this.time.delayedCall(400, () => {
      closeBtn.on('pointerdown', () => this.scene.start('menu'));
      retry.setInteractive({ useHandCursor: true });
      retry.on('pointerdown', () => this.scene.start('game'));
    });
  }
}
