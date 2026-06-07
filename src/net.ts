// Co-op client: thin WebSocket wrapper around the crazycafe-mp Worker
// (server/). Same protocol as wackyShooter's: rooms of up to 4, the first
// player is the host — their client simulates the café; everyone else
// mirrors it and sends requests (place/clear/serve) through the host.

export const MP_BASE = 'https://crazycafe-mp.liviayangbobba.workers.dev';

export interface RoomInfo {
  id: string;
  name: string;
  players: number;
  max: number;
}

export interface PlayerInfo {
  id: number;
  name: string;
  color: number; // index into PLAYER_COLORS
}

/** Anything that arrives over the wire; `from` is stamped by the server. */
export interface NetMsg {
  t: string;
  from?: number;
  [key: string]: unknown;
}

const PROFILE_KEY = 'crazyCafe.profile';

export interface Profile {
  name: string;
  color: number;
}

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Profile;
      if (typeof p.name === 'string' && typeof p.color === 'number') return p;
    }
  } catch {
    // fall through to default
  }
  return { name: '', color: Math.floor(Math.random() * 8) };
}

export function saveProfile(p: Profile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  } catch {
    // best effort
  }
}

export async function listRooms(): Promise<RoomInfo[]> {
  const res = await fetch(`${MP_BASE}/rooms`);
  if (!res.ok) throw new Error('server list unavailable');
  return res.json();
}

export async function createRoom(name: string): Promise<string> {
  const res = await fetch(`${MP_BASE}/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error('could not create kitchen');
  const { id } = (await res.json()) as { id: string };
  return id;
}

export class Net {
  myId = 0;
  hostId = 0;
  /** Everyone in the kitchen, including me. */
  readonly players = new Map<number, PlayerInfo>();
  onMessage: (msg: NetMsg) => void = () => {};
  onClosed: () => void = () => {};
  private ws!: WebSocket;
  private closedByMe = false;

  get isHost(): boolean {
    return this.myId === this.hostId;
  }

  me(): PlayerInfo {
    return this.players.get(this.myId)!;
  }

  /** Connect to a kitchen; resolves once the server has welcomed us. */
  connect(roomId: string, profile: Profile): Promise<void> {
    const url =
      `${MP_BASE.replace('https://', 'wss://')}/rooms/${roomId}/ws` +
      `?name=${encodeURIComponent(profile.name)}&color=${profile.color}`;
    this.ws = new WebSocket(url);

    return new Promise((resolve, reject) => {
      const fail = () => reject(new Error('could not join — kitchen full or offline'));
      this.ws.onerror = fail;
      this.ws.onclose = fail;
      this.ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data as string) as NetMsg;
        if (msg.t !== 'welcome') return;
        this.myId = msg.id as number;
        this.hostId = msg.host as number;
        for (const p of msg.players as PlayerInfo[]) this.players.set(p.id, p);
        // switch to steady-state handlers
        this.ws.onmessage = (e) => this.handle(JSON.parse(e.data as string) as NetMsg);
        this.ws.onerror = null;
        this.ws.onclose = () => {
          if (!this.closedByMe) this.onClosed();
        };
        resolve();
      };
    });
  }

  private handle(msg: NetMsg) {
    // roster bookkeeping happens here so scenes don't have to
    if (msg.t === 'join') {
      const p = msg.p as PlayerInfo;
      this.players.set(p.id, p);
    } else if (msg.t === 'leave') {
      this.players.delete(msg.id as number);
    } else if (msg.t === 'host') {
      this.hostId = msg.id as number;
    }
    this.onMessage(msg);
  }

  send(msg: NetMsg) {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  close() {
    this.closedByMe = true;
    try {
      this.ws.close();
    } catch {
      // already gone
    }
  }
}
