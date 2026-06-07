import Phaser from 'phaser';
import { ARENA_W, ARENA_H, CUSTOMER_KINDS } from '../defs';
import { createTextures } from '../textures';
import { initAudio } from '../sound';
import { getBestCoins, getBestDay, loadRun, clearRun } from '../storage';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('menu');
  }

  create() {
    createTextures(this);

    // escape hatch to the Wacky Games portal (works embedded at /cafe/ or standalone)
    const portalUrl = window.location.pathname.includes('/cafe')
      ? '../'
      : 'https://wackygames.com.au/';
    const more = this.add
      .text(14, 12, '🕹️ MORE GAMES', {
        fontFamily: 'monospace',
        fontSize: '17px',
        color: '#ffe8d6',
        stroke: '#000000',
        strokeThickness: 4,
        fontStyle: 'bold',
      })
      .setInteractive({ useHandCursor: true });
    more.on('pointerover', () => more.setColor('#ffd166'));
    more.on('pointerout', () => more.setColor('#ffe8d6'));
    more.on('pointerdown', () => {
      window.location.href = portalUrl;
    });

    const title = this.add
      .text(ARENA_W / 2, ARENA_H * 0.2, '🍔 CRAZY CAFÉ', {
        fontFamily: 'monospace',
        fontSize: ARENA_W < ARENA_H ? '52px' : '64px',
        color: '#ffd166',
        stroke: '#000000',
        strokeThickness: 10,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.tweens.add({
      targets: title,
      angle: { from: -3, to: 3 },
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // the lunch rush queue
    CUSTOMER_KINDS.forEach((key, i) => {
      const img = this.add
        .image(ARENA_W / 2 + (i - (CUSTOMER_KINDS.length - 1) / 2) * 90, ARENA_H * 0.36, key)
        .setScale(2.2);
      this.tweens.add({
        targets: img,
        y: ARENA_H * 0.36 - 10,
        angle: { from: -8, to: 8 },
        duration: 350 + i * 60,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });

    this.add
      .text(
        ARENA_W / 2,
        ARENA_H * 0.52,
        'The wackyShooter gang is HUNGRY.\nDrag ingredients onto the plate, stack the order,\nhit SERVE before they stomp off!',
        {
          fontFamily: 'monospace',
          fontSize: '17px',
          color: '#ffffff',
          align: 'center',
        },
      )
      .setOrigin(0.5);

    const bestCoins = getBestCoins();
    if (bestCoins > 0) {
      this.add
        .text(ARENA_W / 2, ARENA_H * 0.63, `BEST  🪙${bestCoins}  ·  DAY ${getBestDay()}`, {
          fontFamily: 'monospace',
          fontSize: '22px',
          color: '#ffd166',
          stroke: '#000000',
          strokeThickness: 4,
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
    }

    const begin = (resume: boolean) => {
      initAudio();
      if (!resume) clearRun();
      this.registry.set('resume', resume);
      this.scene.start('game');
    };

    const save = loadRun();
    if (save) {
      // a shift is waiting — offer to continue it or start fresh
      const cont = this.add
        .text(ARENA_W / 2, ARENA_H * 0.73, `▶ CONTINUE  (DAY ${save.day} · 🪙${save.coins})`, {
          fontFamily: 'monospace',
          fontSize: '26px',
          color: '#70e000',
          stroke: '#000000',
          strokeThickness: 6,
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      this.tweens.add({
        targets: cont,
        scale: 1.08,
        duration: 450,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      cont.on('pointerdown', () => begin(true));

      const fresh = this.add
        .text(ARENA_W / 2, ARENA_H * 0.84, '✨ NEW CAFÉ', {
          fontFamily: 'monospace',
          fontSize: '22px',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 5,
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      fresh.on('pointerdown', () => begin(false));
    } else {
      const start = this.add
        .text(ARENA_W / 2, ARENA_H * 0.76, '👨‍🍳 OPEN THE CAFÉ', {
          fontFamily: 'monospace',
          fontSize: '30px',
          color: '#70e000',
          stroke: '#000000',
          strokeThickness: 6,
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      this.tweens.add({
        targets: start,
        scale: 1.12,
        duration: 450,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      this.input.once('pointerdown', () => begin(false));
    }
  }
}
