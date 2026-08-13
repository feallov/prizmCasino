import { validateInitData } from './lib/auth';
import { ensureSchema, getOrCreateUser } from './lib/db';

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

function randInt(maxInclusive: number): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % (maxInclusive + 1);
}

/* колесо: множитель + вес (EV ~0.88, дом в плюсе) */
const WHEEL = [
  { m: 0,   w: 8 }, { m: 1.2, w: 6 }, { m: 0.3, w: 5 }, { m: 2, w: 3 }, { m: 0.5, w: 6 },
  { m: 3,   w: 2 }, { m: 0.8, w: 5 }, { m: 1.5, w: 5 }, { m: 5, w: 1 }, { m: 0.2, w: 6 },
];
function wheelPick(): number {
  const total = WHEEL.reduce((s, x) => s + x.w, 0);
  let r = randInt(total - 1);
  for (let i = 0; i < WHEEL.length; i++){ r -= WHEEL[i].w; if (r < 0) return i; }
  return WHEEL.length - 1;
}

const GAME_MAX: Record<string, number> = { coinflip: 9000, wheel: 10000 };

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

    /* ---------- /api/me ---------- */
    if (url.pathname === '/api/me') {
      const row: any = await getOrCreateUser(env.DB, tgUser);
      const on: any = await env.DB.prepare('SELECT COUNT(*) AS c FROM users WHERE last_seen > ?').bind(Date.now() - 5*60*1000).first();
      return json({
        user: { id: row.telegram_id, username: row.username, first_name: row.first_name, photo_url: row.photo_url, balance: row.balance },
        online: on?.c ?? 1,
      });
    }

    /* ---------- /api/play ---------- */
    if (url.pathname === '/api/play') {
      const game = String(body.game ?? '');
      const max = GAME_MAX[game];
      if (!max) return json({ error: 'unknown_game' }, 400);
      const bet = Math.floor(Number(body.bet));
      if (!Number.isFinite(bet) || bet < 1 || bet > max) return json({ error: 'bad_bet' }, 400);

      const user: any = await getOrCreateUser(env.DB, tgUser);
      if (user.balance < bet) return json({ error: 'low_balance' }, 400);
      const ded = await env.DB.prepare('UPDATE users SET balance = balance - ? WHERE telegram_id = ? AND balance >= ?').bind(bet, user.telegram_id, bet).run();
      if (!(ded.meta?.changes ?? 0)) return json({ error: 'low_balance' }, 400);

      let mult = 0; const extra: any = {};
      if (game === 'coinflip') {
        const choice = body.choice === 'tails' ? 'tails' : 'heads';
        const winRoll = randInt(999) <= 494;               // 49.5% — дом в плюсе
        const side = winRoll ? choice : (choice === 'heads' ? 'tails' : 'heads');
        extra.side = side;
        mult = side === choice ? 2 : 0;
      } else if (game === 'wheel') {
        const i = wheelPick();
        extra.index = i;
        mult = WHEEL[i].m;
      }

      const payout = Math.floor(bet * mult);
      if (payout > 0)
        await env.DB.prepare('UPDATE users SET balance = balance + ? WHERE telegram_id = ?').bind(payout, user.telegram_id).run();

      const now = Date.now();
      await env.DB.prepare('INSERT INTO ledger (user_id, amount, reason, game, created_at) VALUES (?,?,?,?,?)').bind(user.telegram_id, -bet, 'bet', game, now).run();
      if (payout > 0)
        await env.DB.prepare('INSERT INTO ledger (user_id, amount, reason, game, created_at) VALUES (?,?,?,?,?)').bind(user.telegram_id, payout, 'win', game, now).run();

      const bal: any = await env.DB.prepare('SELECT balance FROM users WHERE telegram_id = ?').bind(user.telegram_id).first();
      return json({ ok: true, mult, payout, balance: bal?.balance ?? 0, ...extra });
    }

    return json({ error: 'not_found' }, 404);
  },
};
