import { validateInitData } from './lib/auth';
import { ensureSchema, getOrCreateUser } from './lib/db';

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

function randInt(maxInclusive: number): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % (maxInclusive + 1);
}

const WHEEL = [
  { m: 0, w: 8 }, { m: 1.2, w: 6 }, { m: 0.3, w: 5 }, { m: 2, w: 3 }, { m: 0.5, w: 6 },
  { m: 3, w: 2 }, { m: 0.8, w: 5 }, { m: 1.5, w: 5 }, { m: 5, w: 1 }, { m: 0.2, w: 6 },
];
function wheelPick(): number {
  const total = WHEEL.reduce((s, x) => s + x.w, 0);
  let r = randInt(total - 1);
  for (let i = 0; i < WHEEL.length; i++){ r -= WHEEL[i].w; if (r < 0) return i; }
  return WHEEL.length - 1;
}

const minesMult = (mc: number, picks: number) => {
  let m = 1;
  for (let i = 0; i < picks; i++) m *= (25 - i) / (25 - mc - i);
  return Math.floor(m * 97) / 100;
};
const ladderMult = (k: number) => Math.floor(0.97 * Math.pow(1.5, k) * 100) / 100;
const crashMult = (ms: number) => Math.min(100, Math.exp(ms / 1000 * 0.35));
const genCrash = () => {
  const r = randInt(999) / 1000;
  return Math.max(1, Math.min(100, Math.floor((0.97 / (1 - r)) * 100) / 100));
};

async function deduct(env: any, uid: number, amount: number): Promise<boolean> {
  const d = await env.DB.prepare('UPDATE users SET balance = balance - ? WHERE telegram_id = ? AND balance >= ?').bind(amount, uid, amount).run();
  return (d.meta?.changes ?? 0) > 0;
}
async function credit(env: any, uid: number, amount: number): Promise<number> {
  if (amount > 0) await env.DB.prepare('UPDATE users SET balance = balance + ? WHERE telegram_id = ?').bind(amount, uid).run();
  const r: any = await env.DB.prepare('SELECT balance FROM users WHERE telegram_id = ?').bind(uid).first();
  return r?.balance ?? 0;
}
async function loadSession(env: any, sid: string, uid: number) {
  const row: any = await env.DB.prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?').bind(sid, uid).first();
  if (!row) return null;
  return { data: JSON.parse(row.data) as any };
}
async function saveSession(env: any, sid: string, uid: number, game: string, data: any) {
  await env.DB.prepare('INSERT INTO sessions (id,user_id,game,data,created_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data = excluded.data')
    .bind(sid, uid, game, JSON.stringify(data), Date.now()).run();
}
async function ledger(env: any, uid: number, amount: number, reason: string, game: string) {
  await env.DB.prepare('INSERT INTO ledger (user_id,amount,reason,game,created_at) VALUES (?,?,?,?,?)').bind(uid, amount, reason, game, Date.now()).run();
}

const GAME_MAX: Record<string, number> = { coinflip: 9000, wheel: 10000, mines: 10000, crash: 50000, ladder: 9000, dice: 5000 };
const LADDER_ROWS = 8;

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== 'POST') return json({ error: 'method' }, 405);
    if (!env.BOT_TOKEN) return json({ error: 'no_bot_token' }, 500);

    let body: any = {};
    try { body = await request.json(); } catch { return json({ error: 'bad_body' }, 400); }
    const tgUser = await validateInitData(body.initData ?? '', env.BOT_TOKEN);
    if (!tgUser) return json({ error: 'unauthorized' }, 401);

    await ensureSchema(env.DB);
    const uid = tgUser.id;

    if (url.pathname === '/api/me') {
      const row: any = await getOrCreateUser(env.DB, tgUser);
      const on: any = await env.DB.prepare('SELECT COUNT(*) AS c FROM users WHERE last_seen > ?').bind(Date.now() - 5*60*1000).first();
      return json({
        user: { id: row.telegram_id, username: row.username, first_name: row.first_name, photo_url: row.photo_url, balance: row.balance },
        online: on?.c ?? 1,
      });
    }

    if (url.pathname !== '/api/play') return json({ error: 'not_found' }, 404);

    const game = String(body.game ?? '');
    const max = GAME_MAX[game];
    if (!max) return json({ error: 'unknown_game' }, 400);
    const user: any = await getOrCreateUser(env.DB, tgUser);
    const bet = Math.floor(Number(body.bet));
    const needBet = !['mines_pick','mines_cash','crash_cash','crash_check','ladder_pick','ladder_cash'].includes(game);
    if (needBet && (!Number.isFinite(bet) || bet < 1 || bet > max)) return json({ error: 'bad_bet' }, 400);

    /* ---------- COINFLIP ---------- */
    if (game === 'coinflip') {
      if (user.balance < bet || !(await deduct(env, uid, bet))) return json({ error: 'low_balance' }, 400);
      const choice = body.choice === 'tails' ? 'tails' : 'heads';
      const side = (randInt(999) <= 494) ? choice : (choice === 'heads' ? 'tails' : 'heads');
      const payout = side === choice ? bet * 2 : 0;
      const balance = await credit(env, uid, payout);
      await ledger(env, uid, -bet, 'bet', game);
      if (payout) await ledger(env, uid, payout, 'win', game);
      return json({ ok: true, side, mult: payout ? 2 : 0, payout, balance });
    }

    /* ---------- WHEEL ---------- */
    if (game === 'wheel') {
      if (user.balance < bet || !(await deduct(env, uid, bet))) return json({ error: 'low_balance' }, 400);
      const i = wheelPick();
      const payout = Math.floor(bet * WHEEL[i].m);
      const balance = await credit(env, uid, payout);
      await ledger(env, uid, -bet, 'bet', game);
      if (payout) await ledger(env, uid, payout, 'win', game);
      return json({ ok: true, index: i, mult: WHEEL[i].m, payout, balance });
    }

    /* ---------- DICE ---------- */
    if (game === 'dice') {
      if (user.balance < bet || !(await deduct(env, uid, bet))) return json({ error: 'low_balance' }, 400);
      const target = Math.max(2, Math.min(98, Math.floor(Number(body.target) || 50)));
      const over = !!body.over;
      const chance = over ? 99 - target : target;
      const mult = Math.floor((99 / chance) * 0.97 * 100) / 100;
      const roll = randInt(99);
      const win = over ? roll > target : roll < target;
      const payout = win ? Math.floor(bet * mult) : 0;
      const balance = await credit(env, uid, payout);
      await ledger(env, uid, -bet, 'bet', game);
      if (payout) await ledger(env, uid, payout, 'win', game);
      return json({ ok: true, roll, win, mult, payout, balance });
    }

    /* ---------- MINES ---------- */
    if (game === 'mines_start') {
      if (user.balance < bet || !(await deduct(env, uid, bet))) return json({ error: 'low_balance' }, 400);
      const mc = [3,5,8].includes(Number(body.mines)) ? Number(body.mines) : 5;
      const arr = [...Array(25).keys()];
      for (let i = arr.length - 1; i > 0; i--){ const j = randInt(i); [arr[i], arr[j]] = [arr[j], arr[i]]; }
      const sid = crypto.randomUUID();
      await saveSession(env, sid, uid, 'mines', { bet, mc, mines: arr.slice(0, mc), picked: [], done: false });
      await ledger(env, uid, -bet, 'bet', 'mines');
      return json({ ok: true, sid });
    }
    if (game === 'mines_pick') {
      const s = await loadSession(env, String(body.sid ?? ''), uid);
      if (!s || s.data.done) return json({ error: 'done' }, 400);
      const cell = Math.floor(Number(body.cell));
      if (cell < 0 || cell > 24 || s.data.picked.includes(cell)) return json({ error: 'bad_cell' }, 400);
      if (s.data.mines.includes(cell)) {
        s.data.done = true; await saveSession(env, body.sid, uid, 'mines', s.data);
        return json({ ok: true, boom: true, mines: s.data.mines });
      }
      s.data.picked.push(cell);
      await saveSession(env, body.sid, uid, 'mines', s.data);
      return json({ ok: true, boom: false, mult: minesMult(s.data.mc, s.data.picked.length) });
    }
    if (game === 'mines_cash') {
      const s = await loadSession(env, String(body.sid ?? ''), uid);
      if (!s || s.data.done || !s.data.picked.length) return json({ error: 'done' }, 400);
      const payout = Math.floor(s.data.bet * minesMult(s.data.mc, s.data.picked.length));
      s.data.done = true; await saveSession(env, body.sid, uid, 'mines', s.data);
      const balance = await credit(env, uid, payout);
      await ledger(env, uid, payout, 'win', 'mines');
      return json({ ok: true, payout, balance });
    }

    /* ---------- LADDER ---------- */
    if (game === 'ladder_start') {
      if (user.balance < bet || !(await deduct(env, uid, bet))) return json({ error: 'low_balance' }, 400);
      const mines = Array.from({ length: LADDER_ROWS }, () => randInt(2));
      const sid = crypto.randomUUID();
      await saveSession(env, sid, uid, 'ladder', { bet, mines, step: 0, done: false });
      await ledger(env, uid, -bet, 'bet', 'ladder');
      return json({ ok: true, sid });
    }
    if (game === 'ladder_pick') {
      const s = await loadSession(env, String(body.sid ?? ''), uid);
      if (!s || s.data.done) return json({ error: 'done' }, 400);
      const cell = Math.floor(Number(body.cell));
      if (cell < 0 || cell > 2 || s.data.step >= LADDER_ROWS) return json({ error: 'bad_cell' }, 400);
      const row = s.data.step;
      if (s.data.mines[row] === cell) {
        s.data.done = true; await saveSession(env, body.sid, uid, 'ladder', s.data);
        return json({ ok: true, boom: true, row, mine: s.data.mines[row] });
      }
      s.data.step++;
      const top = s.data.step >= LADDER_ROWS;
      let payout = 0, balance;
      if (top) {
        s.data.done = true;
        payout = Math.floor(s.data.bet * ladderMult(LADDER_ROWS));
        balance = await credit(env, uid, payout);
        await ledger(env, uid, payout, 'win', 'ladder');
      }
      await saveSession(env, body.sid, uid, 'ladder', s.data);
      return json({ ok: true, boom: false, row, step: s.data.step, mult: ladderMult(s.data.step), top, payout, balance });
    }
    if (game === 'ladder_cash') {
      const s = await loadSession(env, String(body.sid ?? ''), uid);
      if (!s || s.data.done || !s.data.step) return json({ error: 'done' }, 400);
      const payout = Math.floor(s.data.bet * ladderMult(s.data.step));
      s.data.done = true; await saveSession(env, body.sid, uid, 'ladder', s.data);
      const balance = await credit(env, uid, payout);
      await ledger(env, uid, payout, 'win', 'ladder');
      return json({ ok: true, payout, balance });
    }

    /* ---------- CRASH ---------- */
    if (game === 'crash_start') {
      if (user.balance < bet || !(await deduct(env, uid, bet))) return json({ error: 'low_balance' }, 400);
      const sid = crypto.randomUUID();
      await saveSession(env, sid, uid, 'crash', { bet, x: genCrash(), t0: Date.now(), done: false });
      await ledger(env, uid, -bet, 'bet', 'crash');
      return json({ ok: true, sid, t0: Date.now() });
    }
    if (game === 'crash_cash') {
      const s = await loadSession(env, String(body.sid ?? ''), uid);
      if (!s || s.data.done) return json({ error: 'done' }, 400);
      const m = crashMult(Date.now() - s.data.t0);
      if (m >= s.data.x) {
        s.data.done = true; await saveSession(env, body.sid, uid, 'crash', s.data);
        return json({ ok: true, crashed: true, x: s.data.x });
      }
      const payout = Math.floor(s.data.bet * m);
      s.data.done = true; await saveSession(env, body.sid, uid, 'crash', s.data);
      const balance = await credit(env, uid, payout);
      await ledger(env, uid, payout, 'win', 'crash');
      return json({ ok: true, crashed: false, cash: Math.floor(m*100)/100, payout, balance });
    }
    if (game === 'crash_check') {
      const s = await loadSession(env, String(body.sid ?? ''), uid);
      if (!s) return json({ error: 'done' }, 400);
      const m = crashMult(Date.now() - s.data.t0);
      if (m >= s.data.x && !s.data.done) {
        s.data.done = true; await saveSession(env, body.sid, uid, 'crash', s.data);
        return json({ ok: true, crashed: true, x: s.data.x });
      }
      return json({ ok: true, crashed: false, m: Math.floor(m*100)/100 });
    }

    return json({ error: 'unknown_game' }, 400);
  },
};
