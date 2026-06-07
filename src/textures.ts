// All game art is generated at runtime with the Graphics API — no asset files.
// The customers are drawn the same as their wackyShooter counterparts: it's
// canonically the same crew, they just wanted lunch.
import Phaser from 'phaser';

export function createTextures(scene: Phaser.Scene) {
  if (scene.textures.exists('plate')) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // ---- the kitchen ----

  // plate
  g.clear();
  g.fillStyle(0xe9ecef);
  g.fillEllipse(60, 13, 120, 26);
  g.fillStyle(0xced4da);
  g.fillEllipse(60, 13, 84, 16);
  g.generateTexture('plate', 120, 26);

  // bun bottom: flat tan slab
  g.clear();
  g.fillStyle(0xe8a05a);
  g.fillRoundedRect(0, 0, 76, 16, { tl: 4, tr: 4, bl: 8, br: 8 });
  g.generateTexture('bunBottom', 76, 16);

  // bun top: sesame dome
  g.clear();
  g.fillStyle(0xe8a05a);
  g.fillRoundedRect(0, 0, 76, 24, { tl: 38, tr: 38, bl: 4, br: 4 });
  g.fillStyle(0xfff1d6);
  g.fillEllipse(20, 10, 5, 3);
  g.fillEllipse(38, 6, 5, 3);
  g.fillEllipse(56, 10, 5, 3);
  g.fillEllipse(29, 16, 5, 3);
  g.fillEllipse(47, 16, 5, 3);
  g.generateTexture('bunTop', 76, 24);

  // patty
  g.clear();
  g.fillStyle(0x7f4f24);
  g.fillRoundedRect(0, 0, 72, 14, 7);
  g.fillStyle(0x936639);
  g.fillEllipse(18, 5, 8, 3);
  g.fillEllipse(40, 8, 8, 3);
  g.fillEllipse(58, 4, 8, 3);
  g.generateTexture('patty', 72, 14);

  // cheese: droopy square
  g.clear();
  g.fillStyle(0xffd23f);
  g.fillTriangle(0, 0, 80, 0, 40, 14);
  g.fillRect(0, 0, 80, 7);
  g.generateTexture('cheese', 80, 14);

  // lettuce: wavy green frill
  g.clear();
  g.fillStyle(0x8ac926);
  g.fillEllipse(14, 7, 26, 12);
  g.fillEllipse(34, 5, 26, 12);
  g.fillEllipse(54, 7, 26, 12);
  g.fillEllipse(70, 5, 22, 12);
  g.generateTexture('lettuce', 82, 14);

  // tomato slice
  g.clear();
  g.fillStyle(0xe63946);
  g.fillEllipse(35, 6, 70, 12);
  g.fillStyle(0xff8089);
  g.fillEllipse(35, 6, 50, 7);
  g.generateTexture('tomatoSlice', 70, 12);

  // sausage
  g.clear();
  g.fillStyle(0xb5532e);
  g.fillRoundedRect(0, 0, 80, 14, 7);
  g.lineStyle(2, 0x8f3e20);
  g.lineBetween(20, 3, 24, 11);
  g.lineBetween(40, 3, 44, 11);
  g.lineBetween(60, 3, 64, 11);
  g.generateTexture('sausage', 80, 14);

  // pancake
  g.clear();
  g.fillStyle(0xd9930d);
  g.fillEllipse(39, 7, 78, 13);
  g.fillStyle(0xf2b134);
  g.fillEllipse(39, 5, 70, 9);
  g.generateTexture('pancake', 78, 14);

  // syrup: glossy amber blob with drips
  g.clear();
  g.fillStyle(0x9c4a00);
  g.fillEllipse(35, 6, 68, 11);
  g.fillRect(12, 6, 6, 8);
  g.fillRect(32, 6, 6, 11);
  g.fillRect(52, 6, 6, 7);
  g.fillStyle(0xc9711a);
  g.fillEllipse(35, 4, 50, 5);
  g.generateTexture('syrup', 70, 18);

  // ice cream scoops
  g.clear();
  g.fillStyle(0xfff3e0);
  g.fillCircle(22, 22, 21);
  g.fillStyle(0xffffff, 0.7);
  g.fillCircle(15, 15, 6);
  g.generateTexture('scoopVanilla', 44, 44);

  g.clear();
  g.fillStyle(0x6f4e37);
  g.fillCircle(22, 22, 21);
  g.fillStyle(0x8a6450, 0.8);
  g.fillCircle(15, 15, 6);
  g.generateTexture('scoopChoc', 44, 44);

  // cherry on top
  g.clear();
  g.lineStyle(2.5, 0x52b788);
  g.beginPath();
  g.arc(16, 6, 8, Math.PI * 1.1, Math.PI * 1.9);
  g.strokePath();
  g.fillStyle(0xd00000);
  g.fillCircle(11, 16, 8);
  g.fillStyle(0xff6b6b, 0.8);
  g.fillCircle(8, 13, 2.5);
  g.generateTexture('cherry', 26, 26);

  // coin (for payout sparkle)
  g.clear();
  g.fillStyle(0xffd166);
  g.fillCircle(9, 9, 9);
  g.fillStyle(0xf4a259);
  g.fillCircle(9, 9, 6);
  g.generateTexture('coin', 18, 18);

  // confetti / particle pixel
  g.clear();
  g.fillStyle(0xffffff);
  g.fillRect(0, 0, 6, 6);
  g.generateTexture('pixel', 6, 6);

  // counter wood grain tile
  g.clear();
  g.fillStyle(0x6e4520);
  g.fillRect(0, 0, 64, 64);
  g.lineStyle(2, 0x5a3719, 0.8);
  g.lineBetween(0, 16, 64, 16);
  g.lineBetween(0, 40, 64, 40);
  g.lineStyle(1, 0x7d5226, 0.6);
  g.lineBetween(0, 28, 64, 28);
  g.lineBetween(0, 54, 64, 54);
  g.generateTexture('wood', 64, 64);

  // ---- the customers (same folks as wackyShooter) ----

  // dancing tomato
  g.clear();
  g.fillStyle(0xe63946);
  g.fillCircle(14, 16, 12);
  g.fillStyle(0x52b788);
  g.fillRect(11, 1, 6, 7); // stem
  g.fillStyle(0xffffff);
  g.fillCircle(10, 13, 3.5);
  g.fillCircle(18, 13, 3.5);
  g.fillStyle(0x000000);
  g.fillCircle(10, 14, 1.7);
  g.fillCircle(18, 14, 1.7);
  g.lineStyle(2, 0x000000);
  g.beginPath();
  g.arc(14, 19, 5, 0.4, Math.PI - 0.4);
  g.strokePath();
  g.generateTexture('tomato', 28, 28);

  // angry toaster
  g.clear();
  g.fillStyle(0x9aa0a6);
  g.fillRoundedRect(0, 4, 36, 24, 6);
  g.fillStyle(0x5f6368);
  g.fillRect(5, 0, 10, 6); // slots
  g.fillRect(21, 0, 10, 6);
  g.fillStyle(0xff4d4d);
  g.fillCircle(11, 14, 3.5); // angry eyes
  g.fillCircle(25, 14, 3.5);
  g.lineStyle(2.5, 0x202124);
  g.lineBetween(6, 9, 14, 12); // angry brows
  g.lineBetween(30, 9, 22, 12);
  g.lineBetween(11, 22, 25, 22); // grim mouth
  g.generateTexture('toaster', 36, 30);

  // wobbly jelly
  g.clear();
  g.fillStyle(0x7ed957, 0.9);
  g.fillEllipse(15, 15, 28, 18);
  g.fillRect(1, 15, 28, 8);
  g.fillStyle(0x000000);
  g.fillCircle(10, 13, 2.2);
  g.fillCircle(20, 13, 2.2);
  g.lineStyle(2, 0x000000);
  g.beginPath();
  g.arc(15, 16, 4, 0.4, Math.PI - 0.4);
  g.strokePath();
  g.generateTexture('jelly', 30, 24);

  // angry broccoli
  g.clear();
  g.fillStyle(0xb5e48c);
  g.fillRect(10, 16, 6, 11);
  g.fillStyle(0x2d6a4f);
  g.fillCircle(8, 10, 7);
  g.fillCircle(18, 10, 7);
  g.fillCircle(13, 5, 7);
  g.fillStyle(0xffffff);
  g.fillCircle(9, 12, 2.5);
  g.fillCircle(17, 12, 2.5);
  g.fillStyle(0x000000);
  g.fillCircle(9, 13, 1.3);
  g.fillCircle(17, 13, 1.3);
  g.generateTexture('broccoli', 26, 28);

  // sneaky sock
  g.clear();
  g.fillStyle(0xf1f1f1);
  g.fillRoundedRect(6, 0, 12, 18, 4);
  g.fillEllipse(11, 22, 18, 11);
  g.fillStyle(0xff595e);
  g.fillRect(6, 2, 12, 3);
  g.fillRect(6, 7, 12, 3);
  g.fillStyle(0xffffff);
  g.fillCircle(9, 20, 2.8);
  g.fillCircle(15, 20, 2.8);
  g.fillStyle(0x000000);
  g.fillCircle(10, 20, 1.4); // eyes looking sideways
  g.fillCircle(16, 20, 1.4);
  g.generateTexture('sock', 22, 28);

  // skeleton
  g.clear();
  g.fillStyle(0xf1f1f1);
  g.fillCircle(12, 8, 7.5); // skull
  g.fillRect(10, 14, 4, 4); // jaw/neck
  g.fillRect(10.5, 17, 3, 11); // spine
  g.fillRect(4, 19, 16, 2.5); // ribs
  g.fillRect(5.5, 23, 13, 2.5);
  g.fillRect(7, 27, 10, 2.5);
  g.fillStyle(0x000000);
  g.fillCircle(9, 7, 2.2); // eye sockets
  g.fillCircle(15, 7, 2.2);
  g.fillTriangle(12, 9.5, 10.8, 11.5, 13.2, 11.5); // nose
  g.lineStyle(1.5, 0x000000);
  g.lineBetween(9, 13, 15, 13); // grin
  g.lineBetween(10.5, 12, 10.5, 14);
  g.lineBetween(12, 12, 12, 14);
  g.lineBetween(13.5, 12, 13.5, 14);
  g.generateTexture('skeleton', 24, 30);

  g.destroy();
}
