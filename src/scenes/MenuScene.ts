import Phaser from 'phaser';
import { ARENA_W, ARENA_H, CUSTOMER_KINDS } from '../defs';
import { createTextures } from '../textures';
import { initAudio } from '../sound';
import { getBestCoins, getBestDay, loadRun, clearRun } from '../storage';
import { listRooms } from '../net';

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

    // back at the menu = not in a co-op kitchen; close any lingering connection
    (this.registry.get('net') as { close?: () => void } | null)?.close?.();
    this.registry.set('net', null);

    const begin = (resume: boolean) => {
      initAudio();
      if (!resume) clearRun();
      this.registry.set('resume', resume);
      this.scene.start('game');
    };

    const button = (
      y: number,
      label: string,
      color: string,
      size: number,
      onClick: () => void,
      pulse = false,
    ) => {
      const b = this.add
        .text(ARENA_W / 2, y, label, {
          fontFamily: 'monospace',
          fontSize: `${size}px`,
          color,
          stroke: '#000000',
          strokeThickness: 6,
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      if (pulse) {
        this.tweens.add({
          targets: b,
          scale: 1.08,
          duration: 450,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      } else {
        b.on('pointerover', () => b.setScale(1.08));
        b.on('pointerout', () => b.setScale(1));
      }
      b.on('pointerdown', onClick);
      return b;
    };

    const toLobby = () => {
      initAudio();
      this.scene.start('mplobby');
    };

    const save = loadRun();
    let mpY: number;
    if (save) {
      // a shift is waiting — offer to continue it or start fresh
      button(ARENA_H * 0.7, `▶ CONTINUE  (DAY ${save.day} · 🪙${save.coins})`, '#70e000', 24, () => begin(true), true);
      button(ARENA_H * 0.79, '🎮 SINGLEPLAYER', '#ffffff', 22, () => begin(false));
      mpY = ARENA_H * 0.87;
      button(mpY, '🌐 MULTIPLAYER', '#4cc9f0', 22, toLobby);
    } else {
      button(ARENA_H * 0.73, '🎮 SINGLEPLAYER', '#70e000', 30, () => begin(false), true);
      mpY = ARENA_H * 0.84;
      button(mpY, '🌐 MULTIPLAYER', '#4cc9f0', 26, toLobby);
    }
    this.watchForServers(mpY);
  }

  /** If a kitchen is open, point excitedly at the MULTIPLAYER button. */
  private watchForServers(mpY: number) {
    const callout = this.add
      .text(ARENA_W / 2, mpY - 52, '🎉 Quick! Get on and join! Someone has made a server!', {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#ffd166',
        stroke: '#000000',
        strokeThickness: 4,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setVisible(false);
    const arrow = this.add
      .text(ARENA_W / 2, mpY - 30, '⬇️', { fontSize: '22px' })
      .setOrigin(0.5)
      .setVisible(false);
    this.tweens.add({
      targets: arrow,
      y: mpY - 22,
      duration: 350,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.tweens.add({
      targets: callout,
      scale: 1.05,
      duration: 450,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const check = async () => {
      try {
        const rooms = await listRooms();
        if (!this.scene.isActive()) return;
        const open = rooms.some((r) => r.players > 0 && r.players < r.max);
        callout.setVisible(open);
        arrow.setVisible(open);
      } catch {
        // server list unreachable — keep quiet
      }
    };
    void check();
    this.time.addEvent({ delay: 10000, loop: true, callback: () => void check() });
  }
}
