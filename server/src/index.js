// wackyShooter multiplayer backend.
//
// One Lobby DO (singleton) tracks the public room list; one Room DO per game
// relays WebSocket messages between up to MAX_PLAYERS players. The first
// player in a room is the "host" — their client simulates the enemies; if
// they leave, the next player is promoted.

const MAX_PLAYERS = 4;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    const lobby = env.LOBBY.get(env.LOBBY.idFromName('lobby'));

    // GET /rooms — list public rooms
    if (url.pathname === '/rooms' && request.method === 'GET') {
      return lobby.fetch('https://lobby/list');
    }

    // POST /rooms {name} — create a room, returns {id}
    if (url.pathname === '/rooms' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const name = String(body.name || 'WACKY SERVER').slice(0, 24);
      const id = crypto.randomUUID().slice(0, 8);
      const room = env.ROOM.get(env.ROOM.idFromName(id));
      await room.fetch('https://room/init', {
        method: 'POST',
        body: JSON.stringify({ id, name }),
      });
      return json({ id, name });
    }

    // GET /rooms/:id/ws — join a room over WebSocket (?name=&color=)
    const m = url.pathname.match(/^\/rooms\/([\w-]+)\/ws$/);
    if (m) {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return json({ error: 'expected websocket' }, 426);
      }
      const room = env.ROOM.get(env.ROOM.idFromName(m[1]));
      return room.fetch(request);
    }

    return json({ error: 'not found' }, 404);
  },
};

export class Lobby {
  constructor(state) {
    this.state = state;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const rooms = (await this.state.storage.get('rooms')) || {};

    if (url.pathname === '/list') {
      const now = Date.now();
      let changed = false;
      for (const [id, r] of Object.entries(rooms)) {
        // prune rooms that stopped heartbeating (host closed the tab, etc.)
        if (now - r.t > 75_000) {
          delete rooms[id];
          changed = true;
        }
      }
      if (changed) await this.state.storage.put('rooms', rooms);
      const list = Object.values(rooms)
        .sort((a, b) => b.t - a.t)
        .map((r) => ({ id: r.id, name: r.name, players: r.players, max: MAX_PLAYERS }));
      return json(list);
    }

    if (url.pathname === '/update' && request.method === 'POST') {
      const r = await request.json();
      rooms[r.id] = { ...r, t: Date.now() };
      await this.state.storage.put('rooms', rooms);
      return json({ ok: true });
    }

    if (url.pathname === '/remove' && request.method === 'POST') {
      const { id } = await request.json();
      delete rooms[id];
      await this.state.storage.put('rooms', rooms);
      return json({ ok: true });
    }

    return json({ error: 'not found' }, 404);
  }
}

export class Room {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.clients = new Map(); // ws -> {id, name, color}
    this.nextId = 1;
    this.hostId = 0;
  }

  lobby() {
    return this.env.LOBBY.get(this.env.LOBBY.idFromName('lobby'));
  }

  async meta() {
    return (await this.state.storage.get('meta')) || { id: '?', name: 'WACKY SERVER' };
  }

  async tellLobby() {
    const meta = await this.meta();
    const players = this.clients.size;
    if (players === 0) {
      await this.lobby().fetch('https://lobby/remove', {
        method: 'POST',
        body: JSON.stringify({ id: meta.id }),
      });
      await this.state.storage.deleteAlarm();
    } else {
      await this.lobby().fetch('https://lobby/update', {
        method: 'POST',
        body: JSON.stringify({ id: meta.id, name: meta.name, players }),
      });
      await this.state.storage.setAlarm(Date.now() + 30_000); // heartbeat
    }
  }

  async alarm() {
    await this.tellLobby();
  }

  broadcast(obj, except) {
    const text = JSON.stringify(obj);
    for (const [ws, info] of this.clients) {
      if (info.id === except) continue;
      try {
        ws.send(text);
      } catch {
        // peer is gone; close handler cleans up
      }
    }
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/init' && request.method === 'POST') {
      const meta = await request.json();
      await this.state.storage.put('meta', meta);
      await this.lobby().fetch('https://lobby/update', {
        method: 'POST',
        body: JSON.stringify({ id: meta.id, name: meta.name, players: 0 }),
      });
      return json({ ok: true });
    }

    // WebSocket join
    if (this.clients.size >= MAX_PLAYERS) return json({ error: 'full' }, 409);

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();

    const info = {
      id: this.nextId++,
      name: (url.searchParams.get('name') || 'PLAYER').slice(0, 12),
      color: Number(url.searchParams.get('color')) || 0,
    };
    if (this.clients.size === 0) this.hostId = info.id;
    this.clients.set(server, info);

    server.send(
      JSON.stringify({
        t: 'welcome',
        id: info.id,
        host: this.hostId,
        players: [...this.clients.values()],
      }),
    );
    this.broadcast({ t: 'join', p: info }, info.id);
    await this.tellLobby();

    server.addEventListener('message', (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      msg.from = info.id;
      this.broadcast(msg, info.id);
    });

    const bye = async () => {
      if (!this.clients.has(server)) return;
      this.clients.delete(server);
      this.broadcast({ t: 'leave', id: info.id });
      if (info.id === this.hostId && this.clients.size > 0) {
        this.hostId = [...this.clients.values()][0].id;
        this.broadcast({ t: 'host', id: this.hostId });
      }
      await this.tellLobby();
    };
    server.addEventListener('close', bye);
    server.addEventListener('error', bye);

    return new Response(null, { status: 101, webSocket: client });
  }
}
