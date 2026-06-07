const COINS_KEY = 'crazyCafe.bestCoins';
const DAY_KEY = 'crazyCafe.bestDay';

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
