import Phaser from 'phaser';
import { ARENA_W, ARENA_H, PLAYER_COLORS } from '../defs';
import { blip, pickupJingle } from '../sound';
import { listRooms, createRoom, loadProfile, saveProfile, Net } from '../net';
import type { Profile } from '../net';

/**
 * Co-op lobby: pick your chef name + color, then browse/join/create kitchens.
 * On a successful join the connected Net goes into the registry as 'net' and
 * GameScene starts in co-op mode.
 */
export class MultiplayerScene extends Phaser.Scene {
  private profile!: Profile;
  private nameInput?: HTMLInputElement;
  private busy = false;

  constructor() {
    super('mplobby');
  }

  create() {
    this.profile = loadProfile();
    this.busy = false;
    this.events.once('shutdown', () => this.removeNameInput());
    this.showProfile();
  }

  /** Swap lobby phases by destroying everything currently on screen. */
  private clearAll() {
    for (const obj of [...this.children.list]) obj.destroy();
  }

  // ---- phase 1: who's cooking? ----

  private showProfile() {
    this.clearAll();
    this.addTitle('👨‍🍳 CO-OP KITCHEN');

    this.add
      .text(ARENA_W / 2, ARENA_H * 0.26, 'CHEF NAME:', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.makeNameInput(ARENA_H * 0.33);

    this.add
      .text(ARENA_W / 2, ARENA_H * 0.45, 'PICK YOUR COLOR:', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    const portrait = ARENA_W < ARENA_H;
    const perRow = portrait ? 4 : 8;
    const gap = portrait ? 110 : 100;
    const rings: Phaser.GameObjects.Arc[] = [];
    PLAYER_COLORS.forEach((c, i) => {
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      const rowCount = Math.min(perRow, PLAYER_COLORS.length - row * perRow);
      const x = ARENA_W / 2 + (col - (rowCount - 1) / 2) * gap;
      const y = ARENA_H * (portrait ? 0.53 : 0.55) + row * 100;
      const ring = this.add.circle(x, y, 36, 0x000000, 0).setStrokeStyle(4, 0xffffff, 0);
      rings.push(ring);
      const swatch = this.add.circle(x, y, 28, c.value).setInteractive({ useHandCursor: true });
      const hat = this.add.text(x, y - 2, '👨‍🍳', { fontSize: '26px' }).setOrigin(0.5);
      this.tweens.add({
        targets: hat,
        angle: { from: -8, to: 8 },
        duration: 400 + i * 40,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      swatch.on('pointerdown', () => {
        this.profile.color = i;
        blip(500 + i * 60, 0.05, 'triangle', 0.05);
        rings.forEach((r, j) => r.setStrokeStyle(4, 0xffffff, j === i ? 1 : 0));
      });
    });
    rings[this.profile.color]?.setStrokeStyle(4, 0xffffff, 1);

    this.addButton(ARENA_H * (ARENA_W < ARENA_H ? 0.78 : 0.76), '✅ GO!', '#70e000', () => {
      const name = (this.nameInput?.value || '').trim().toUpperCase().slice(0, 12);
      if (!name) {
        this.toast('TYPE A NAME FIRST!');
        this.nameInput?.focus();
        return;
      }
      this.profile.name = name;
      saveProfile(this.profile);
      this.removeNameInput();
      pickupJingle();
      void this.showServers();
    });
    this.addButton(ARENA_H * 0.87, '← BACK', '#aaaacc', () => {
      this.scene.start('menu');
    });
  }

  /** HTML input overlay — real text entry with the device keyboard. */
  private makeNameInput(gameY: number) {
    this.removeNameInput();
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 12;
    input.placeholder = 'CHEF LIVIA';
    input.value = this.profile.name;
    input.autocomplete = 'off';
    input.spellcheck = false;
    const canvas = this.game.canvas.getBoundingClientRect();
    const scale = canvas.height / ARENA_H;
    Object.assign(input.style, {
      position: 'fixed',
      left: `${canvas.left + canvas.width / 2}px`,
      top: `${canvas.top + gameY * scale}px`,
      transform: 'translate(-50%, -50%)',
      width: `${Math.min(300 * scale, canvas.width * 0.8)}px`,
      padding: '10px 14px',
      fontFamily: 'monospace',
      fontSize: `${Math.max(16, 22 * scale)}px`,
      fontWeight: 'bold',
      textAlign: 'center',
      textTransform: 'uppercase',
      color: '#ffd166',
      background: '#1d1209',
      border: '3px solid #ffffff',
      borderRadius: '10px',
      outline: 'none',
      zIndex: '10',
    });
    document.body.appendChild(input);
    this.nameInput = input;
  }

  private removeNameInput() {
    this.nameInput?.remove();
    this.nameInput = undefined;
  }

  // ---- phase 2: kitchen browser ----

  private async showServers() {
    this.clearAll();
    this.addTitle('🍳 KITCHENS');

    const status = this.add
      .text(ARENA_W / 2, ARENA_H * 0.45, 'LOOKING FOR KITCHENS...', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#aaaacc',
      })
      .setOrigin(0.5);

    this.addButton(ARENA_H * 0.74, '➕ OPEN A KITCHEN', '#70e000', () =>
      this.startGame(null, status),
    );
    this.addButton(ARENA_H * 0.82, '🔄 REFRESH', '#4cc9f0', () => void this.showServers());
    this.addButton(ARENA_H * 0.9, '← BACK', '#aaaacc', () => this.showProfile());

    try {
      const rooms = await listRooms();
      if (!this.scene.isActive()) return;
      if (rooms.length === 0) {
        status.setText('NO KITCHENS YET — OPEN ONE!');
        return;
      }
      status.setText('');
      rooms.slice(0, 5).forEach((room, i) => {
        const y = ARENA_H * 0.28 + i * 54;
        const full = room.players >= room.max;
        const row = this.add
          .text(
            ARENA_W / 2,
            y,
            `${room.name}  👨‍🍳${room.players}/${room.max}  ${full ? 'FULL' : '▶ JOIN'}`,
            {
              fontFamily: 'monospace',
              fontSize: '22px',
              color: full ? '#777799' : '#ffffff',
              stroke: '#000000',
              strokeThickness: 4,
              fontStyle: 'bold',
              backgroundColor: '#3a2415',
              padding: { x: 16, y: 8 },
            },
          )
          .setOrigin(0.5);
        if (!full) {
          row.setInteractive({ useHandCursor: true });
          row.on('pointerover', () => row.setColor('#70e000'));
          row.on('pointerout', () => row.setColor('#ffffff'));
          row.on('pointerdown', () => void this.startGame(room.id, status));
        }
      });
    } catch {
      if (this.scene.isActive()) status.setText('KITCHENS UNREACHABLE — TRY AGAIN?');
    }
  }

  /** Open (roomId null) or join a kitchen, then start co-op. */
  private async startGame(roomId: string | null, status: Phaser.GameObjects.Text) {
    if (this.busy) return;
    this.busy = true;
    status.setText(roomId ? 'JOINING...' : 'OPENING KITCHEN...');
    try {
      const id = roomId ?? (await createRoom(`${this.profile.name}'S KITCHEN`));
      const net = new Net();
      await net.connect(id, this.profile);
      this.registry.set('net', net);
      this.registry.set('resume', false);
      pickupJingle();
      this.scene.start('game');
    } catch (err) {
      this.busy = false;
      status.setText('');
      this.toast(err instanceof Error ? err.message.toUpperCase() : 'SOMETHING WENT WRONG');
    }
  }

  // ---- little UI helpers ----

  private addTitle(text: string) {
    const t = this.add
      .text(ARENA_W / 2, ARENA_H * 0.12, text, {
        fontFamily: 'monospace',
        fontSize: ARENA_W < ARENA_H ? '38px' : '46px',
        color: '#ffd166',
        stroke: '#000000',
        strokeThickness: 8,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.tweens.add({
      targets: t,
      angle: { from: -2, to: 2 },
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private addButton(y: number, label: string, color: string, onClick: () => void) {
    const b = this.add
      .text(ARENA_W / 2, y, label, {
        fontFamily: 'monospace',
        fontSize: '26px',
        color,
        stroke: '#000000',
        strokeThickness: 6,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    b.on('pointerover', () => b.setScale(1.08));
    b.on('pointerout', () => b.setScale(1));
    b.on('pointerdown', onClick);
    return b;
  }

  private toast(msg: string) {
    const t = this.add
      .text(ARENA_W / 2, ARENA_H * 0.65, msg, {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#ff595e',
        stroke: '#000000',
        strokeThickness: 5,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: t, alpha: 0, delay: 1600, duration: 400, onComplete: () => t.destroy() });
  }
}
