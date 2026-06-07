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
import { PLAYER_COLORS } from '../defs';
import type { IngredientKey, DishDef, CustomerKind } from '../defs';
import { blip, ding, pickupJingle, grumble } from '../sound';
import { saveBest, saveRun, loadRun, clearRun } from '../storage';
import { Net } from '../net';
import type { NetMsg } from '../net';

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

  // co-op (null = singleplayer)
  private net: Net | null = null;
  private cursors = new Map<number, { dot: Phaser.GameObjects.Arc; label: Phaser.GameObjects.Text }>();
  private rosterText!: Phaser.GameObjects.Text;
  private nextPtSend = 0;

  private get isMp(): boolean {
    return this.net !== null;
  }

  /** True when this client simulates the café (solo, or co-op host). */
  private get isSim(): boolean {
    return !this.net || this.net.isHost;
  }

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
    this.net = (this.registry.get('net') as Net | null) ?? null;
    this.cursors.clear();
    this.nextPtSend = 0;

    // continue a saved shift? (set by the menu's CONTINUE option; solo only)
    const resume = !this.isMp && this.registry.get('resume') === true ? loadRun() : null;
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

    // 🚪 escape back to the title — solo shifts autosave (CONTINUE awaits);
    // co-op just leaves the kitchen
    const leave = () => {
      if (this.gameEnded) return;
      if (this.isMp) {
        this.leaveMp();
        return;
      }
      saveRun({ coins: this.coins, day: this.day, strikes: this.strikes });
      this.scene.start('menu');
    };
    const door = this.add
      .text(ARENA_W - 14, 68, '🚪', { fontSize: '28px' })
      .setOrigin(1, 0)
      .setDepth(21)
      .setInteractive({ useHandCursor: true });
    door.on('pointerover', () => door.setScale(1.15));
    door.on('pointerout', () => door.setScale(1));
    door.on('pointerdown', leave);
    this.input.keyboard?.on('keydown-ESC', leave);

    // buttons: clear + serve
    this.makeButton(ARENA_W * (portrait ? 0.2 : 0.3), this.plateY + (portrait ? 90 : 80), '🗑️ CLEAR', '#ff595e', () =>
      this.requestClear(),
    );
    this.makeButton(ARENA_W * (portrait ? 0.74 : 0.7), this.plateY + (portrait ? 90 : 80), '✅ SERVE', '#70e000', () =>
      this.requestServe(),
    );

    this.buildShelf(portrait);
    // drinks come fresh from the machines, flanking the plate
    this.makeStation(ARENA_W * (portrait ? 0.11 : 0.09), this.plateY - 60, 'coffeeMachine', 'coffee', 1800);
    this.makeStation(ARENA_W * (portrait ? 0.89 : 0.91), this.plateY - 60, 'waterStation', 'water', 800);
    this.setupDrag();

    this.rosterText = this.add
      .text(14, 44, '', {
        fontFamily: 'monospace',
        fontSize: '14px',
        stroke: '#000000',
        strokeThickness: 3,
        fontStyle: 'bold',
        lineSpacing: 4,
      })
      .setDepth(20);
    if (this.net) this.setupMp(this.net);

    // the simulating side runs the café; co-op joiners get a 'sync' instead
    if (this.isSim) this.time.delayedCall(400, () => this.startDay());
  }

  update(time: number) {
    if (this.gameEnded) return;

    // co-op: share where my hand is (colored cursor ghosts)
    if (this.isMp && time > this.nextPtSend) {
      const p = this.input.activePointer;
      if (p.x || p.y) {
        this.nextPtSend = time + 80;
        this.net!.send({ t: 'pt', x: Math.round(p.x), y: Math.round(p.y) });
      }
    }

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

    // only the simulating side rules on walk-offs
    if (this.isSim && time > c.deadline) this.angryLeave();
  }

  // ---- day & customer flow ----

  private startDay() {
    if (!this.isMp) {
      // a fresh deploy landed mid-shift? swap to it now — the shift is saved
      // and the menu will offer CONTINUE right where we left off
      if ((window as unknown as { __updateReady?: boolean }).__updateReady) {
        saveRun({ coins: this.coins, day: this.day, strikes: this.strikes });
        window.location.reload();
        return;
      }
      saveRun({ coins: this.coins, day: this.day, strikes: this.strikes });
    }
    this.served = 0;
    this.stormedOff = 0;
    this.net?.send({ t: 'day', day: this.day, coins: this.coins });
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

  /** Host/solo: decide who's next and what they want, then tell everyone. */
  private nextCustomer() {
    if (this.gameEnded || !this.isSim || this.customer) return;
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

    const dayMul = Math.max(0.55, 1 - (this.day - 1) * DAY_PATIENCE_DECAY);
    const patienceTotal = Math.max(
      PATIENCE_FLOOR_MS,
      dish.stack.length * PATIENCE_PER_INGREDIENT_MS * def.patienceMul * dayMul * (mega ? 1.6 : 1),
    );

    this.net?.send({
      t: 'cust',
      k: CUSTOMER_KINDS.indexOf(kind),
      d: mega ? -1 : DISHES.indexOf(dish),
      mega: mega ? 1 : 0,
      remain: patienceTotal,
    });
    this.buildCustomer(kind, dish, mega, patienceTotal, patienceTotal);
  }

  /** Everyone: walk the customer in (shared by the host and 'cust' messages). */
  private buildCustomer(
    kind: CustomerKind,
    dish: DishDef,
    mega: boolean,
    patienceTotal: number,
    remainMs: number,
  ) {
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

    this.customer = {
      kind,
      sprite,
      dish,
      bubble: this.makeOrderBubble(dish, mega),
      patienceTotal,
      deadline: this.time.now + remainMs + 700, // walk-in grace
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
    // coffee & water come from their machines, not the shelf
    const shelfKeys = INGREDIENT_KEYS.filter((k) => k !== 'coffee' && k !== 'water');
    const cols = portrait ? 4 : 6;
    const cellW = ARENA_W / cols;
    const startY = ARENA_H * (portrait ? 0.74 : 0.84);
    const rowH = ARENA_H * (portrait ? 0.085 : 0.075);

    shelfKeys.forEach((key, i) => {
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

  /** A tap-to-make drink machine; the finished drink lands on its tray, draggable. */
  private makeStation(x: number, y: number, machineTex: string, product: IngredientKey, brewMs: number) {
    const machine = this.add
      .image(x, y, machineTex)
      .setDepth(2)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(x, y - 40, INGREDIENTS[product].label, {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#ffe8d6',
        stroke: '#000000',
        strokeThickness: 3,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(2);
    this.add.ellipse(x, y + 50, 44, 12, 0x000000, 0.3).setDepth(1); // tray slot

    let ready: Phaser.GameObjects.Image | null = null;
    let brewing = false;
    machine.on('pointerdown', () => {
      if (this.gameEnded) return;
      if (ready || brewing) {
        // already made / busy — wiggle the goods
        this.tweens.add({ targets: ready ?? machine, angle: { from: -8, to: 8 }, duration: 70, yoyo: true, repeat: 3 });
        return;
      }
      brewing = true;
      blip(product === 'coffee' ? 150 : 800, 0.12, product === 'coffee' ? 'sawtooth' : 'sine', 0.05);
      this.tweens.add({
        targets: machine,
        x: x + 2,
        duration: 70,
        yoyo: true,
        repeat: Math.floor(brewMs / 140),
      });
      const drips = this.time.addEvent({
        delay: 200,
        repeat: Math.floor(brewMs / 200) - 1,
        callback: () => this.burst.explode(2, x, y + 34),
      });
      this.time.delayedCall(brewMs, () => {
        brewing = false;
        drips.remove();
        if (this.gameEnded) return;
        ding();
        const item = this.add.image(x, y + 44, product).setDepth(3).setScale(0);
        this.tweens.add({ targets: item, scale: 1, duration: 220, ease: 'Back.easeOut' });
        item.setInteractive({ draggable: true, useHandCursor: true });
        item.setData('key', product);
        item.setData('tray', true);
        item.setData('onTaken', () => {
          ready = null;
        });
        ready = item;
      });
    });
  }

  private setupDrag() {
    this.input.on(
      'dragstart',
      (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.Image) => {
        const key = obj.getData('key') as IngredientKey | undefined;
        if (!key || this.gameEnded) return;
        if (obj.getData('tray')) obj.setVisible(false); // carrying the actual cup
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
        if (obj.getData('tray')) {
          // the cup is used up — the machine can make another
          (obj.getData('onTaken') as () => void)?.();
          obj.destroy();
        }
        this.requestPlace(key);
      } else {
        // fly back and vanish (tray drinks pop back onto their tray)
        obj.setVisible(true);
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

  /** In co-op the host owns the plate: requests go through it, everyone mirrors. */
  private requestPlace(key: IngredientKey) {
    if (this.isSim) {
      this.placeIngredient(key);
      this.net?.send({ t: 'stack', list: this.stack });
    } else {
      this.net!.send({ t: 'place', k: key });
    }
  }

  private requestClear() {
    if (this.isSim) {
      this.clearPlate(true);
      this.net?.send({ t: 'stack', list: [] });
    } else {
      this.net!.send({ t: 'clearReq' });
    }
  }

  private requestServe() {
    if (this.stack.length === 0 && !this.isSim) {
      this.showBanner('THE PLATE IS EMPTY!', '#ffd166');
      return;
    }
    if (this.isSim) this.serve(this.net?.myId ?? 0);
    else this.net!.send({ t: 'serveReq' });
  }

  /** Mirror the host's authoritative plate. */
  private applyStack(list: IngredientKey[]) {
    const extendsCurrent =
      list.length >= this.stack.length && this.stack.every((k, i) => k === list[i]);
    if (extendsCurrent) {
      for (let i = this.stack.length; i < list.length; i++) this.placeIngredient(list[i]);
    } else {
      this.clearPlate(false);
      for (const k of list) this.placeIngredient(k);
    }
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

  /** Host/solo: rule on a serve attempt (by = the chef who hit SERVE). */
  private serve(by: number) {
    const c = this.customer;
    if (!c || c.fed || this.gameEnded || !this.isSim) return;
    if (this.stack.length === 0) {
      this.showBanner('THE PLATE IS EMPTY!', '#ffd166');
      return;
    }

    const correct =
      this.stack.length === c.dish.stack.length &&
      this.stack.every((k, i) => k === c.dish.stack[i]);

    if (!correct) {
      // wrong order — they grumble and lose patience, you can fix it
      c.deadline -= WRONG_ORDER_PENALTY_MS;
      this.net?.send({ t: 'wrong', remain: Math.max(500, c.deadline - this.time.now) });
      this.handleWrong(c.deadline - this.time.now);
      return;
    }

    // happy customer!
    const frac = Phaser.Math.Clamp((c.deadline - this.time.now) / c.patienceTotal, 0, 1);
    const tip = Math.round(c.dish.price * frac * 0.5);
    const pay = c.dish.price + tip;
    this.coins += pay;
    this.served++;
    if (!this.isMp) {
      saveBest(this.coins, this.day);
      saveRun({ coins: this.coins, day: this.day, strikes: this.strikes });
    }
    this.net?.send({ t: 'served', pay, tip, coins: this.coins, served: this.served, by });
    this.handleServed(pay, tip, by);
    this.time.delayedCall(900, () => this.nextCustomer());
  }

  /** Everyone: wrong-order grumbles (shared by the host and 'wrong' messages). */
  private handleWrong(remainMs: number) {
    const c = this.customer;
    if (!c) return;
    c.deadline = this.time.now + remainMs;
    grumble();
    this.tweens.add({ targets: c.sprite, angle: { from: -12, to: 12 }, duration: 70, yoyo: true, repeat: 5 });
    this.showBanner('GRRR! THAT IS NOT MY ORDER!', '#ff595e');
  }

  /** Everyone: payday fireworks (shared by the host and 'served' messages). */
  private handleServed(pay: number, tip: number, by: number) {
    const c = this.customer;
    this.coinsText.setText(`🪙 ${this.coins}`);
    ding();
    pickupJingle();
    this.burst.explode(18, this.plateX, this.plateY - 30);
    const chef = this.isMp ? this.net!.players.get(by)?.name : null;
    this.showBanner(
      `+🪙${pay}${tip > 0 ? `  (TIP +${tip}!)` : ''}${chef ? `  — ${chef}!` : ''}`,
      '#ffd166',
    );
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
    if (c) {
      c.fed = true;
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
    }
    this.customer = null;
    this.updateQueue();
  }

  /** Host/solo: a customer ran out of patience. */
  private angryLeave() {
    const c = this.customer;
    if (!c || c.fed || !this.isSim) return;
    this.strikes++;
    this.stormedOff++;
    this.net?.send({ t: 'angry', strikes: this.strikes, stormed: this.stormedOff });
    this.handleAngry();

    if (this.strikes >= STRIKES_TO_CLOSE) {
      if (!this.isMp) clearRun(); // closed is closed — no continuing out of it
      this.net?.send({ t: 'over', coins: this.coins, day: this.day });
      this.handleOver();
      return;
    }
    if (!this.isMp) saveRun({ coins: this.coins, day: this.day, strikes: this.strikes });
    this.time.delayedCall(1000, () => this.nextCustomer());
  }

  /** Everyone: the stomp-off scene (shared by the host and 'angry' messages). */
  private handleAngry() {
    const c = this.customer;
    this.updateStrikes();
    grumble();
    this.cameras.main.shake(250, 0.01);
    if (c) {
      c.fed = true;
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
    }
    this.customer = null;
    this.clearPlate(false);
    this.updateQueue();
  }

  /** Everyone: three strikes — the café closes. */
  private handleOver() {
    this.gameEnded = true;
    saveBest(this.coins, this.day);
    this.time.delayedCall(900, () => {
      this.net?.close();
      this.registry.set('net', null);
      this.scene.start('gameover', { coins: this.coins, day: this.day });
    });
  }

  private endDay() {
    const bonus = this.day * 2;
    this.coins += bonus;
    this.coinsText.setText(`🪙 ${this.coins}`);
    if (!this.isMp) saveBest(this.coins, this.day);
    this.net?.send({ t: 'banner', msg: `DAY ${this.day} COMPLETE! +🪙${bonus} BONUS`, color: '#70e000' });
    this.showBanner(`DAY ${this.day} COMPLETE! +🪙${bonus} BONUS`, '#70e000');
    pickupJingle();
    this.burst.explode(40, ARENA_W / 2, ARENA_H * 0.4);
    this.day++;
    this.time.delayedCall(2000, () => this.startDay());
  }

  // ---- co-op wiring ----

  private setupMp(net: Net) {
    net.onMessage = (msg) => this.onNet(msg);
    net.onClosed = () => {
      this.showBanner('CONNECTION LOST!', '#ff595e');
      this.time.delayedCall(1500, () => this.leaveMp());
    };
    this.updateRoster();
    for (const p of net.players.values()) {
      if (p.id !== net.myId) this.ensureCursor(p.id);
    }
    if (net.isHost) {
      this.time.delayedCall(600, () =>
        this.showBanner('KITCHEN OPEN — CHEFS CAN JOIN!', '#70e000'),
      );
    } else {
      // joined mid-shift: ask the host where things stand
      net.send({ t: 'rejoin' });
      this.time.delayedCall(600, () => this.showBanner('KITCHEN JOINED!', '#70e000'));
    }
  }

  private leaveMp() {
    if (this.net) {
      this.net.onMessage = () => {};
      this.net.onClosed = () => {};
      this.net.close();
      this.registry.set('net', null);
    }
    this.scene.start('menu');
  }

  private onNet(msg: NetMsg) {
    switch (msg.t) {
      case 'join': {
        const p = this.net!.players.get(msg.from!) ?? (msg.p as { name: string });
        this.showBanner(`👨‍🍳 ${p?.name ?? 'A CHEF'} JOINED!`, '#70e000');
        this.updateRoster();
        this.ensureCursor((msg.p as { id: number }).id);
        if (this.isSim) this.sendSync();
        break;
      }
      case 'leave': {
        this.removeCursor(msg.id as number);
        this.updateRoster();
        break;
      }
      case 'host':
        this.updateRoster();
        if (this.net?.isHost) {
          this.showBanner("YOU'RE THE HEAD CHEF NOW!", '#ffd166');
          // inherit the kitchen: keep cooking from known state
          if (!this.customer && !this.gameEnded) {
            this.time.delayedCall(1000, () => this.nextCustomer());
          }
        }
        break;
      case 'rejoin':
        if (this.isSim) this.sendSync();
        break;
      case 'sync': {
        if (this.isSim) break;
        this.day = msg.day as number;
        this.coins = msg.coins as number;
        this.strikes = msg.strikes as number;
        this.served = msg.served as number;
        this.stormedOff = msg.stormed as number;
        this.dayText.setText(`DAY ${this.day}`);
        this.coinsText.setText(`🪙 ${this.coins}`);
        this.updateStrikes();
        this.updateQueue();
        this.applyStack(msg.list as IngredientKey[]);
        const cust = msg.cust as { k: number; d: number; mega: number; total: number; remain: number } | null;
        if (cust && !this.customer) {
          this.buildCustomer(
            CUSTOMER_KINDS[cust.k],
            cust.d < 0 ? MEGA_DISH : DISHES[cust.d],
            cust.mega === 1,
            cust.total,
            cust.remain,
          );
        }
        break;
      }
      case 'day': {
        if (this.isSim) break;
        this.day = msg.day as number;
        this.coins = msg.coins as number;
        this.served = 0;
        this.stormedOff = 0;
        this.dayText.setText(`DAY ${this.day}`);
        this.coinsText.setText(`🪙 ${this.coins}`);
        this.showBanner(`DAY ${this.day} — OPEN!`, '#4cc9f0');
        ding();
        this.updateQueue();
        break;
      }
      case 'cust':
        if (!this.isSim && !this.customer) {
          this.buildCustomer(
            CUSTOMER_KINDS[msg.k as number],
            (msg.d as number) < 0 ? MEGA_DISH : DISHES[msg.d as number],
            msg.mega === 1,
            msg.remain as number,
            msg.remain as number,
          );
        }
        break;
      case 'stack':
        if (!this.isSim) this.applyStack(msg.list as IngredientKey[]);
        break;
      case 'place':
        if (this.isSim && !this.gameEnded) {
          this.placeIngredient(msg.k as IngredientKey);
          this.net!.send({ t: 'stack', list: this.stack });
        }
        break;
      case 'clearReq':
        if (this.isSim) {
          this.clearPlate(true);
          this.net!.send({ t: 'stack', list: [] });
        }
        break;
      case 'serveReq':
        if (this.isSim) this.serve(msg.from!);
        break;
      case 'served':
        if (!this.isSim) {
          this.coins = msg.coins as number;
          this.served = msg.served as number;
          this.handleServed(msg.pay as number, msg.tip as number, msg.by as number);
        }
        break;
      case 'wrong':
        if (!this.isSim) this.handleWrong(msg.remain as number);
        break;
      case 'angry':
        if (!this.isSim) {
          this.strikes = msg.strikes as number;
          this.stormedOff = msg.stormed as number;
          this.handleAngry();
        }
        break;
      case 'over':
        if (!this.isSim) {
          this.coins = msg.coins as number;
          this.day = msg.day as number;
          this.handleOver();
        }
        break;
      case 'banner':
        if (!this.isSim) this.showBanner(msg.msg as string, msg.color as string);
        break;
      case 'pt': {
        const cur = this.ensureCursor(msg.from!);
        cur?.dot.setPosition(msg.x as number, msg.y as number);
        cur?.label.setPosition(msg.x as number, (msg.y as number) + 14);
        break;
      }
    }
  }

  /** Host: bring a (re)joining chef up to speed. */
  private sendSync() {
    const c = this.customer;
    this.net!.send({
      t: 'sync',
      day: this.day,
      coins: this.coins,
      strikes: this.strikes,
      served: this.served,
      stormed: this.stormedOff,
      list: this.stack,
      cust:
        c && !c.fed
          ? {
              k: CUSTOMER_KINDS.indexOf(c.kind),
              d: c.mega ? -1 : DISHES.indexOf(c.dish),
              mega: c.mega ? 1 : 0,
              total: c.patienceTotal,
              remain: Math.max(1000, c.deadline - this.time.now),
            }
          : null,
    });
  }

  /** Everyone's names under the coin counter (👑 = head chef). */
  private updateRoster() {
    if (!this.net) return;
    const lines = [...this.net.players.values()]
      .sort((a, b) => a.id - b.id)
      .map((p) => `${p.id === this.net!.hostId ? '👑' : '👨‍🍳'} ${p.name}${p.id === this.net!.myId ? ' (YOU)' : ''}`);
    this.rosterText.setText(lines.join('\n')).setColor('#ffe8d6');
  }

  private ensureCursor(id: number) {
    if (!this.net || id === this.net.myId) return null;
    let cur = this.cursors.get(id);
    if (!cur) {
      const p = this.net.players.get(id);
      if (!p) return null;
      const color = PLAYER_COLORS[p.color]?.value ?? 0xffffff;
      const hex = '#' + color.toString(16).padStart(6, '0');
      cur = {
        dot: this.add.circle(-50, -50, 7, color).setStrokeStyle(2, 0x000000).setDepth(35),
        label: this.add
          .text(-50, -36, p.name, {
            fontFamily: 'monospace',
            fontSize: '11px',
            color: hex,
            stroke: '#000000',
            strokeThickness: 3,
            fontStyle: 'bold',
          })
          .setOrigin(0.5, 0)
          .setDepth(35),
      };
      this.cursors.set(id, cur);
    }
    return cur;
  }

  private removeCursor(id: number) {
    const cur = this.cursors.get(id);
    if (!cur) return;
    cur.dot.destroy();
    cur.label.destroy();
    this.cursors.delete(id);
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
