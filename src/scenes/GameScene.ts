import Phaser from 'phaser';
import {
  ARENA_W,
  ARENA_H,
  CONFETTI_COLORS,
  INGREDIENTS,
  INGREDIENT_KEYS,
  DISHES,
  MEGA_DISH,
  CUSTOMERS,
  CUSTOMER_KINDS,
  PATIENCE_PER_INGREDIENT_MS,
  PATIENCE_FLOOR_MS,
  DAY_PATIENCE_DECAY,
  STRIKES_TO_CLOSE,
  customersForDay,
  WRONG_ORDER_PENALTY_MS,
} from '../defs';
import type { IngredientKey, DishDef, CustomerKind } from '../defs';
import { blip, ding, pickupJingle, grumble } from '../sound';
import { saveBest, saveRun, loadRun, clearRun } from '../storage';

interface Customer {
  kind: CustomerKind;
  sprite: Phaser.GameObjects.Image;
  dish: DishDef;
  bubble: Phaser.GameObjects.Container;
  patienceTotal: number;
  deadline: number;
  mega: boolean;
  fed: boolean;
  warned: boolean;
}

export class GameScene extends Phaser.Scene {
  private day = 1;
  private coins = 0;
  private strikes = 0;
  private served = 0;
  private stormedOff = 0;
  private customer: Customer | null = null;
  private stack: IngredientKey[] = [];
  private stackImgs: Phaser.GameObjects.Image[] = [];
  private stackHeight = 0;
  private held: Phaser.GameObjects.Image | null = null;
  private gameEnded = false;

  private coinsText!: Phaser.GameObjects.Text;
  private dayText!: Phaser.GameObjects.Text;
  private strikesText!: Phaser.GameObjects.Text;
  private queueText!: Phaser.GameObjects.Text;
  private patienceBar!: Phaser.GameObjects.Graphics;
  private burst!: Phaser.GameObjects.Particles.ParticleEmitter;

  // layout anchors (set in create, used everywhere)
  private custX = 0;
  private custY = 0;
  private plateX = 0;
  private plateY = 0;

  constructor() {
    super('game');
  }

  create() {
    // Scene restarts reuse this instance — reset all run state.
    this.day = 1;
    this.coins = 0;
    this.strikes = 0;
    this.served = 0;
    this.stormedOff = 0;
    this.customer = null;
    this.stack = [];
    this.stackImgs = [];
    this.stackHeight = 0;
    this.held = null;
    this.gameEnded = false;

    // continue a saved shift? (set by the menu's CONTINUE option)
    const resume = this.registry.get('resume') === true ? loadRun() : null;
    this.registry.set('resume', false);
    if (resume) {
      this.coins = resume.coins;
      this.day = resume.day;
      this.strikes = resume.strikes;
    }

    const portrait = ARENA_W < ARENA_H;
    this.custX = ARENA_W * (portrait ? 0.26 : 0.18);
    this.custY = ARENA_H * (portrait ? 0.21 : 0.3);
    this.plateX = ARENA_W * 0.5;
    this.plateY = ARENA_H * (portrait ? 0.56 : 0.66);

    // café backdrop: wooden counter under the customer, tiled floor feel
    this.add
      .tileSprite(0, this.custY + 40, ARENA_W, 70, 'wood')
      .setOrigin(0, 0)
      .setAlpha(0.9);
    this.add.rectangle(ARENA_W / 2, this.custY + 44, ARENA_W, 6, 0x8a5a2b);

    this.burst = this.add
      .particles(0, 0, 'pixel', {
        speed: { min: 80, max: 260 },
        lifespan: 450,
        scale: { start: 1.4, end: 0 },
        tint: CONFETTI_COLORS,
        emitting: false,
      })
      .setDepth(15);

    // plate
    this.add.image(this.plateX, this.plateY, 'plate').setDepth(2);

    // HUD
    this.coinsText = this.add
      .text(14, 10, '🪙 0', {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#ffd166',
        stroke: '#000000',
        strokeThickness: 4,
        fontStyle: 'bold',
      })
      .setDepth(20);
    this.dayText = this.add
      .text(ARENA_W / 2, 10, 'DAY 1', {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#4cc9f0',
        stroke: '#000000',
        strokeThickness: 4,
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0)
      .setDepth(20);
    this.strikesText = this.add
      .text(ARENA_W - 14, 10, '', {
        fontSize: '22px',
      })
      .setOrigin(1, 0)
      .setDepth(20);
    this.queueText = this.add
      .text(ARENA_W - 14, 42, '', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#ffe8d6',
        stroke: '#000000',
        strokeThickness: 3,
        fontStyle: 'bold',
      })
      .setOrigin(1, 0)
      .setDepth(20);
    this.patienceBar = this.add.graphics().setDepth(20);
    this.updateStrikes();

    // 🚪 escape back to the title — the shift autosaves, CONTINUE awaits
    const door = this.add
      .text(ARENA_W - 14, 68, '🚪', { fontSize: '28px' })
      .setOrigin(1, 0)
      .setDepth(21)
      .setInteractive({ useHandCursor: true });
    door.on('pointerover', () => door.setScale(1.15));
    door.on('pointerout', () => door.setScale(1));
    door.on('pointerdown', () => {
      if (this.gameEnded) return;
      saveRun({ coins: this.coins, day: this.day, strikes: this.strikes });
      this.scene.start('menu');
    });
    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.gameEnded) return;
      saveRun({ coins: this.coins, day: this.day, strikes: this.strikes });
      this.scene.start('menu');
    });

    // buttons: clear + serve
    this.makeButton(ARENA_W * (portrait ? 0.2 : 0.3), this.plateY + (portrait ? 90 : 80), '🗑️ CLEAR', '#ff595e', () =>
      this.clearPlate(true),
    );
    this.makeButton(ARENA_W * (portrait ? 0.74 : 0.7), this.plateY + (portrait ? 90 : 80), '✅ SERVE', '#70e000', () =>
      this.serve(),
    );

    this.buildShelf(portrait);
    this.setupDrag();

    this.time.delayedCall(400, () => this.startDay());
  }

  update(time: number) {
    if (this.gameEnded) return;
    const c = this.customer;
    if (!c || c.fed) {
      this.patienceBar.clear();
      return;
    }

    // patience bar above the customer
    const frac = Phaser.Math.Clamp((c.deadline - time) / c.patienceTotal, 0, 1);
    this.patienceBar.clear();
    const w = 90;
    const x = c.sprite.x - w / 2;
    const y = c.sprite.y - (c.mega ? 110 : 70);
    this.patienceBar.fillStyle(0x000000, 0.5);
    this.patienceBar.fillRoundedRect(x, y, w, 12, 6);
    this.patienceBar.fillStyle(frac > 0.5 ? 0x70e000 : frac > 0.25 ? 0xffd166 : 0xff595e);
    if (frac > 0.03) this.patienceBar.fillRoundedRect(x + 2, y + 2, (w - 4) * frac, 8, 4);

    // getting grumpy
    if (frac < 0.25 && !c.warned) {
      c.warned = true;
      c.sprite.setTint(0xffb3b3);
      this.tweens.add({ targets: c.sprite, x: c.sprite.x + 4, duration: 60, yoyo: true, repeat: 11 });
      grumble();
    }

    if (time > c.deadline) this.angryLeave();
  }

  // ---- day & customer flow ----

  private startDay() {
    // a fresh deploy landed mid-shift? swap to it now — the shift is saved
    // and the menu will offer CONTINUE right where we left off
    if ((window as unknown as { __updateReady?: boolean }).__updateReady) {
      saveRun({ coins: this.coins, day: this.day, strikes: this.strikes });
      window.location.reload();
      return;
    }
    saveRun({ coins: this.coins, day: this.day, strikes: this.strikes });
    this.served = 0;
    this.stormedOff = 0;
    this.dayText.setText(`DAY ${this.day}`);
    this.showBanner(`DAY ${this.day} — OPEN!`, '#4cc9f0');
    ding();
    this.updateQueue();
    this.time.delayedCall(1200, () => this.nextCustomer());
  }

  private updateQueue() {
    const left = customersForDay(this.day) - this.served - this.stormedOff;
    this.queueText.setText(`HUNGRY: ${Math.max(0, left)}`);
  }

  private nextCustomer() {
    if (this.gameEnded) return;
    const total = customersForDay(this.day);
    const done = this.served + this.stormedOff;
    if (done >= total) {
      this.endDay();
      return;
    }

    // every 5th day the last customer is the MEGA TOMATO
    const mega = this.day % 5 === 0 && done === total - 1;
    const kind: CustomerKind = mega ? 'tomato' : Phaser.Math.RND.pick(CUSTOMER_KINDS);
    const def = CUSTOMERS[kind];

    // pick a dish from what's on the menu today (favorites lean)
    let dish: DishDef;
    if (mega) {
      dish = MEGA_DISH;
    } else {
      const menu = DISHES.filter((d) => d.fromDay <= this.day);
      const favs = (def.favorites ?? []).map((i) => DISHES[i]).filter((d) => menu.includes(d));
      dish = favs.length && Math.random() < 0.5 ? Phaser.Math.RND.pick(favs) : Phaser.Math.RND.pick(menu);
    }

    const sprite = this.add
      .image(-60, this.custY, kind)
      .setScale(mega ? 5 : 2.4)
      .setDepth(5);
    this.tweens.add({
      targets: sprite,
      x: this.custX,
      duration: 700,
      ease: 'Back.easeOut',
      onComplete: () => {
        if (!sprite.active) return;
        // idle wiggle while waiting
        this.tweens.add({
          targets: sprite,
          angle: { from: -5, to: 5 },
          duration: 420,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      },
    });

    const dayMul = Math.max(0.55, 1 - (this.day - 1) * DAY_PATIENCE_DECAY);
    const patienceTotal = Math.max(
      PATIENCE_FLOOR_MS,
      dish.stack.length * PATIENCE_PER_INGREDIENT_MS * def.patienceMul * dayMul * (mega ? 1.6 : 1),
    );

    this.customer = {
      kind,
      sprite,
      dish,
      bubble: this.makeOrderBubble(dish, mega),
      patienceTotal,
      deadline: this.time.now + patienceTotal + 700, // walk-in grace
      mega,
      fed: false,
      warned: false,
    };

    if (mega) {
      this.showBanner('🍅 THE MEGA TOMATO IS HUNGRY!!', '#ff595e');
      this.cameras.main.shake(300, 0.008);
      blip(60, 0.4, 'sawtooth', 0.09);
    } else {
      blip(700, 0.07, 'triangle', 0.05);
    }
    this.updateQueue();
  }

  /** Speech bubble showing the wanted stack (bottom → top), name and price. */
  private makeOrderBubble(dish: DishDef, mega: boolean): Phaser.GameObjects.Container {
    const portrait = ARENA_W < ARENA_H;
    const x = ARENA_W * (portrait ? 0.68 : 0.58);
    const y = ARENA_H * (portrait ? 0.2 : 0.27);

    const miniScale = dish.stack.length > 5 ? 0.4 : 0.55;
    const items: Phaser.GameObjects.GameObject[] = [];
    let h = 0;
    const heights = dish.stack.map((k) => INGREDIENTS[k].height * miniScale * 1.6);
    const totalH = heights.reduce((a, b) => a + b, 0);
    const bw = portrait ? 200 : 230;
    const bh = Math.max(120, totalH + 76);

    const bg = this.add.graphics();
    bg.fillStyle(0xffffff, 0.95);
    bg.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 16);
    bg.fillTriangle(-bw / 2 - 16, 10, -bw / 2 + 4, -6, -bw / 2 + 4, 22); // tail toward customer
    items.push(bg);

    // the wanted stack, drawn bottom-up
    dish.stack.forEach((k, i) => {
      h += heights[i];
      items.push(
        this.add.image(0, bh / 2 - 46 - h + heights[i] / 2, k).setScale(miniScale),
      );
    });

    items.push(
      this.add
        .text(0, bh / 2 - 30, dish.name, {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: '#2b1c12',
          fontStyle: 'bold',
        })
        .setOrigin(0.5),
      this.add
        .text(0, bh / 2 - 13, `🪙 ${dish.price}`, {
          fontFamily: 'monospace',
          fontSize: '13px',
          color: '#9c6644',
          fontStyle: 'bold',
        })
        .setOrigin(0.5),
    );

    const c = this.add.container(x, y, items).setDepth(10).setScale(0);
    this.tweens.add({ targets: c, scale: 1, duration: 300, ease: 'Back.easeOut', delay: 500 });
    if (mega) c.setScale(0).setDepth(11);
    return c;
  }

  // ---- the shelf & dragging ----

  private buildShelf(portrait: boolean) {
    const cols = portrait ? 5 : 7;
    const cellW = ARENA_W / cols;
    const startY = ARENA_H * (portrait ? 0.74 : 0.84);
    const rowH = ARENA_H * (portrait ? 0.085 : 0.075);

    INGREDIENT_KEYS.forEach((key, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = cellW * (col + 0.5);
      const y = startY + row * rowH;

      this.add
        .rectangle(x, y, cellW - 10, rowH - 8, 0x4a2f1a)
        .setStrokeStyle(2, 0x8a5a2b)
        .setDepth(1);
      const icon = this.add.image(x, y - 6, key).setDepth(2);
      const maxW = cellW - 26;
      if (icon.width > maxW) icon.setScale(maxW / icon.width);
      this.add
        .text(x, y + rowH / 2 - 12, INGREDIENTS[key].label, {
          fontFamily: 'monospace',
          fontSize: '11px',
          color: '#ffe8d6',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setDepth(2);

      icon.setInteractive({ draggable: true, useHandCursor: true });
      icon.setData('key', key);
    });
  }

  private setupDrag() {
    this.input.on(
      'dragstart',
      (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.Image) => {
        const key = obj.getData('key') as IngredientKey | undefined;
        if (!key || this.gameEnded) return;
        this.held = this.add.image(obj.x, obj.y, key).setDepth(30).setAlpha(0.9);
        blip(500, 0.04, 'triangle', 0.04);
      },
    );
    this.input.on('drag', (p: Phaser.Input.Pointer) => {
      this.held?.setPosition(p.x, p.y);
    });
    this.input.on('dragend', (p: Phaser.Input.Pointer, obj: Phaser.GameObjects.Image) => {
      if (!this.held) return;
      const key = obj.getData('key') as IngredientKey;
      const held = this.held;
      this.held = null;
      const overPlate =
        Math.abs(p.x - this.plateX) < 130 && p.y < this.plateY + 50 && p.y > this.plateY - 240;
      if (overPlate && !this.gameEnded) {
        held.destroy();
        this.placeIngredient(key);
      } else {
        // fly back to the shelf and vanish
        this.tweens.add({
          targets: held,
          x: obj.x,
          y: obj.y,
          alpha: 0,
          duration: 220,
          onComplete: () => held.destroy(),
        });
      }
    });
  }

  private placeIngredient(key: IngredientKey) {
    const def = INGREDIENTS[key];
    const y = this.plateY - 10 - this.stackHeight - def.height / 2;
    const img = this.add.image(this.plateX, y - 26, key).setDepth(3).setAlpha(0);
    this.stack.push(key);
    this.stackImgs.push(img);
    this.stackHeight += def.height;
    // drop in with a bounce
    this.tweens.add({ targets: img, y, alpha: 1, duration: 180, ease: 'Bounce.easeOut' });
    blip(420 + this.stack.length * 60, 0.06, 'triangle', 0.05);
  }

  private clearPlate(noisy: boolean) {
    if (noisy && this.stack.length) blip(240, 0.1, 'square', 0.05);
    for (const img of this.stackImgs) {
      this.tweens.add({
        targets: img,
        y: img.y + 60,
        alpha: 0,
        angle: Phaser.Math.Between(-60, 60),
        duration: 250,
        onComplete: () => img.destroy(),
      });
    }
    this.stack = [];
    this.stackImgs = [];
    this.stackHeight = 0;
  }

  // ---- serving ----

  private serve() {
    const c = this.customer;
    if (!c || c.fed || this.gameEnded) return;
    if (this.stack.length === 0) {
      this.showBanner('THE PLATE IS EMPTY!', '#ffd166');
      return;
    }

    const correct =
      this.stack.length === c.dish.stack.length &&
      this.stack.every((k, i) => k === c.dish.stack[i]);

    if (!correct) {
      // wrong order — they grumble and lose patience, you can fix it
      grumble();
      c.deadline -= WRONG_ORDER_PENALTY_MS;
      this.tweens.add({ targets: c.sprite, angle: { from: -12, to: 12 }, duration: 70, yoyo: true, repeat: 5 });
      this.showBanner('GRRR! THAT IS NOT MY ORDER!', '#ff595e');
      return;
    }

    // happy customer!
    c.fed = true;
    const frac = Phaser.Math.Clamp((c.deadline - this.time.now) / c.patienceTotal, 0, 1);
    const tip = Math.round(c.dish.price * frac * 0.5);
    const pay = c.dish.price + tip;
    this.coins += pay;
    this.coinsText.setText(`🪙 ${this.coins}`);
    this.served++;
    saveBest(this.coins, this.day);
    saveRun({ coins: this.coins, day: this.day, strikes: this.strikes });

    ding();
    pickupJingle();
    this.burst.explode(18, this.plateX, this.plateY - 30);
    this.showBanner(tip > 0 ? `+🪙${pay}  (TIP +${tip}!)` : `+🪙${pay}`, '#ffd166');
    // coins fly to the counter
    for (let i = 0; i < Math.min(8, pay); i++) {
      const coin = this.add.image(this.plateX, this.plateY - 40, 'coin').setDepth(25);
      this.tweens.add({
        targets: coin,
        x: 40 + i * 12,
        y: 22,
        duration: 450 + i * 60,
        ease: 'Cubic.easeIn',
        onComplete: () => coin.destroy(),
      });
    }

    this.clearPlate(false);
    this.patienceBar.clear();
    c.bubble.destroy();
    this.tweens.killTweensOf(c.sprite);
    // happy hop, then bounce out the door
    this.tweens.add({
      targets: c.sprite,
      y: c.sprite.y - 30,
      duration: 160,
      yoyo: true,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: c.sprite,
          x: ARENA_W + 80,
          angle: 360,
          duration: 600,
          onComplete: () => c.sprite.destroy(),
        });
      },
    });
    this.customer = null;
    this.updateQueue();
    this.time.delayedCall(900, () => this.nextCustomer());
  }

  private angryLeave() {
    const c = this.customer;
    if (!c || c.fed) return;
    c.fed = true;
    this.strikes++;
    this.stormedOff++;
    this.updateStrikes();
    grumble();
    this.cameras.main.shake(250, 0.01);
    this.showBanner(`${CUSTOMERS[c.kind].name} STOMPED OFF! ${'❌'.repeat(this.strikes)}`, '#ff595e');

    c.bubble.destroy();
    this.patienceBar.clear();
    this.tweens.killTweensOf(c.sprite);
    c.sprite.setTint(0xff6666);
    this.tweens.add({
      targets: c.sprite,
      x: -80,
      angle: -25,
      duration: 500,
      onComplete: () => c.sprite.destroy(),
    });
    this.customer = null;
    this.clearPlate(false);
    this.updateQueue();

    if (this.strikes >= STRIKES_TO_CLOSE) {
      this.gameEnded = true;
      saveBest(this.coins, this.day);
      clearRun(); // closed is closed — no continuing out of it
      this.time.delayedCall(900, () =>
        this.scene.start('gameover', { coins: this.coins, day: this.day }),
      );
      return;
    }
    saveRun({ coins: this.coins, day: this.day, strikes: this.strikes });
    this.time.delayedCall(1000, () => this.nextCustomer());
  }

  private endDay() {
    const bonus = this.day * 2;
    this.coins += bonus;
    this.coinsText.setText(`🪙 ${this.coins}`);
    saveBest(this.coins, this.day);
    this.showBanner(`DAY ${this.day} COMPLETE! +🪙${bonus} BONUS`, '#70e000');
    pickupJingle();
    this.burst.explode(40, ARENA_W / 2, ARENA_H * 0.4);
    this.day++;
    this.time.delayedCall(2000, () => this.startDay());
  }

  // ---- little helpers ----

  private updateStrikes() {
    this.strikesText.setText(
      '❌'.repeat(this.strikes) + '⬜'.repeat(Math.max(0, STRIKES_TO_CLOSE - this.strikes)),
    );
  }

  private makeButton(x: number, y: number, label: string, color: string, onClick: () => void) {
    const b = this.add
      .text(x, y, label, {
        fontFamily: 'monospace',
        fontSize: '19px',
        color,
        stroke: '#000000',
        strokeThickness: 4,
        fontStyle: 'bold',
        backgroundColor: '#00000055',
        padding: { x: 7, y: 4 },
      })
      .setOrigin(0.5)
      .setDepth(20)
      .setInteractive({ useHandCursor: true });
    b.on('pointerover', () => b.setScale(1.08));
    b.on('pointerout', () => b.setScale(1));
    b.on('pointerdown', onClick);
    return b;
  }

  private showBanner(msg: string, color: string) {
    const t = this.add
      .text(ARENA_W / 2, ARENA_H * 0.42, msg, {
        fontFamily: 'monospace',
        fontSize: ARENA_W < ARENA_H ? '26px' : '32px',
        color,
        stroke: '#000000',
        strokeThickness: 6,
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: ARENA_W - 60 },
      })
      .setOrigin(0.5)
      .setDepth(40)
      .setScale(0);
    this.tweens.add({ targets: t, scale: 1, duration: 250, ease: 'Back.easeOut' });
    this.tweens.add({
      targets: t,
      alpha: 0,
      y: t.y - 40,
      delay: 1100,
      duration: 400,
      onComplete: () => t.destroy(),
    });
  }
}
