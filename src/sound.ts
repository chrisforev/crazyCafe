// Tiny WebAudio synth — no audio files needed.
let ctx: AudioContext | null = null;

/** Must be called from a user gesture (browser autoplay policy). */
export function initAudio() {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
}

export function blip(
  freq: number,
  dur = 0.08,
  type: OscillatorType = 'square',
  vol = 0.04,
) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  o.connect(g).connect(ctx.destination);
  o.start();
  o.stop(ctx.currentTime + dur);
}

/** Kitchen bell — order up! */
export function ding() {
  blip(1320, 0.25, 'sine', 0.06);
  setTimeout(() => blip(1760, 0.35, 'sine', 0.05), 90);
}

/** Ascending arpeggio for happy customers / payouts. */
export function pickupJingle() {
  blip(523, 0.07, 'triangle', 0.05);
  setTimeout(() => blip(659, 0.07, 'triangle', 0.05), 70);
  setTimeout(() => blip(784, 0.1, 'triangle', 0.05), 140);
}

/** Grumpy descending buzz for wrong orders / walk-offs. */
export function grumble() {
  blip(220, 0.12, 'sawtooth', 0.06);
  setTimeout(() => blip(160, 0.18, 'sawtooth', 0.06), 110);
}
