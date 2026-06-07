const COINS_KEY = 'crazyCafe.bestCoins';
const DAY_KEY = 'crazyCafe.bestDay';
const RUN_KEY = 'crazyCafe.run';

/** Snapshot of an in-progress shift, autosaved so updates/new tabs can continue it. */
export interface RunSave {
  coins: number;
  day: number;
  strikes: number;
}

export function saveRun(run: RunSave) {
  try {
    localStorage.setItem(RUN_KEY, JSON.stringify(run));
  } catch {
    // storage unavailable — best effort only
  }
}

export function loadRun(): RunSave | null {
  try {
    const raw = localStorage.getItem(RUN_KEY);
    if (!raw) return null;
    const run = JSON.parse(raw) as RunSave;
    return typeof run.coins === 'number' && typeof run.day === 'number' ? run : null;
  } catch {
    return null;
  }
}

export function clearRun() {
  try {
    localStorage.removeItem(RUN_KEY);
  } catch {
    // ignore
  }
}

export function getBestCoins(): number {
  try {
    return Number(localStorage.getItem(COINS_KEY)) || 0;
  } catch {
    return 0;
  }
}

export function getBestDay(): number {
  try {
    return Number(localStorage.getItem(DAY_KEY)) || 0;
  } catch {
    return 0;
  }
}

export function saveBest(coins: number, day: number) {
  try {
    if (coins > getBestCoins()) localStorage.setItem(COINS_KEY, String(coins));
    if (day > getBestDay()) localStorage.setItem(DAY_KEY, String(day));
  } catch {
    // private browsing / storage disabled — best effort only
  }
}
