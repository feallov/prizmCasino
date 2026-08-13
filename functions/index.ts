import { validateInitData } from './lib/auth';
import { ensureSchema, getOrCreateUser } from './lib/db';

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

function randInt(maxInclusive: number): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % (maxInclusive + 1);
}

const CHANNEL = '@prizmCasino';

/* RTP как в реальном казино: 92–97% */
const WHEEL = [
  { m: 0, w: 8 }, { m: 1.2, w: 6 }, { m: 0.3, w: 5 }, { m: 2, w: 3 }, { m: 0.5, w: 6 },
  { m: 3, w: 2 }, { m: 0.8, w: 5 }, { m: 1.5, w: 5 }, { m: 5, w: 1 }, { m: 0.2, w: 6 },
];
const SLOT_SYM = [
  { w: 6, m: 25 }, { w: 9, m: 15 }, { w: 12, m: 10 }, { w: 18, m: 7 }, { w: 25, m: 5 }, { w: 30, m: 3 },
];
const CASES = [
  { m: 0.1, w: 20 }, { m: 0.4, w: 20 }, { m: 0.7, w: 16 }, { m: 1, w: 14 }, { m: 1.3, w: 10 },
  { m: 1.8, w: 9 }, { m: 2, w: 6 }, { m: 3, w: 3 }, { m: 6, w: 2 },
];
const PLINKO_M = [5, 2, 1.2, 0.8, 0.5, 0.8, 1.2, 2, 5];

function wpick(list: { w: number }[]): number {
  const total = list.reduce((s, x) => s + x.w, 0);
  let r = randInt(total - 1);
  for (let i = 0; i < list.length; i++){ r -= list[i].w; if (r < 0) return i; }
  return list.length - 1;
}

const minesMult = (mc: number, picks: number) => {
  let m = 1;
  for (let i = 0; i < picks; i++) m *= (25 - i) / (25 - mc - i);
  return Math.floor(m * 95) / 100;
};
const ladderMult = (k: number) => Math.floor(0.95 * Math.pow(1.5, k) * 100) / 100;
const crashMult = (ms: number) => Math.min(100, Math.exp(ms / 1000 * 0.35));
const genCrash = () => {
  const r = randInt(999) / 1000;
  return Math.max(1, Math.min(100, Math.floor((0.95 / (1 - r)) * 100) / 100));
};

const drawCard = () => ({ r: 1 + randInt(12), s: randInt(3) });
function handValue(ranks: number[]): number {
  let v = 0, aces = 0;
  for (const r of ranks){ v += r === 1 ? 11 : r >= 11 ? 10 : r; if (r === 1) aces++; }
  while (v > 21 && aces){ v -= 10; aces--; }
  return v;
}

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
    await env.DB.prepare('INSERT OR REPLACE INTO sessions (id,user_id,game,data,created_at) VALUES (?,?,?,?,?)')
    .bind(sid, uid, game, JSON.stringify(data), Date.now()).run();
}
async function ledger(env: any, uid: number, amount: number, reason: string, game: string) {
  await env.DB.prepare('INSERT INTO ledger (user_id,amount,reason,game,created_at) VALUES (?,?,?,?,?)').bind(uid, amount, reason, game, Date.now()).run();
}
const isAdmin = (env: any, uid: number) => String(env.ADMIN_ID ?? '') !== '' && String(uid) === String(env.ADMIN_ID);

const TASKS: { id: string; title: string; reward: number }[] = [
  { id: 'sub',     title: 'Подписаться на канал',      reward: 50 },
  { id: 'first',   title: 'Сыграть первую игру',       reward: 25 },
  { id: 'bets10',  title: 'Сделать 10 ставок',         reward: 50 },
  { id: 'bigwin',  title: 'Выиграть 500 ₽ за раз',     reward: 100 },
  { id: 'profit1k',title: 'Заработать 1 000 ₽ профита',reward: 500 },
];

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    try { return await handle(request, env); }
    catch (e: any) { return json({ error: 'exception', msg: String(e?.message ?? e) }, 500); }
  },
};

async function handle(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== 'POST') return json({ error: 'method' }, 405);
    if (!env.BOT_TOKEN) return json({ error: 'no_bot_token' }, 500);

    let body: any = {};
    try { body = await request.json(); } catch { return json({ error: 'bad_body' }, 400); }
    const tgUser = await validateInitData(body.initData ?? '', env.BOT_TOKEN);
    if (!tgUser) return json({ error: 'unauthorized' }, 401);

    await ensureSchema(env.DB);
    const uid = tgUser.id;
    const user: any = await getOrCreateUser(env.DB, tgUser);

    /* ---------- /api/me ---------- */
    if (url.pathname === '/api/me') {
      const on: any = await env.DB.prepare('SELECT COUNT(*) AS c FROM users WHERE last_seen > ?').bind(Date.now() - 5*60*1000).first();
      const per: any = await env.DB.prepare('SELECT last_game AS g, COUNT(*) AS c FROM users WHERE last_seen > ? AND last_game IS NOT NULL GROUP BY last_game').bind(Date.now() - 5*60*1000).all();
      const st: any = await env.DB.prepare(`SELECT
        COUNT(CASE WHEN amount < 0 THEN 1 END) AS games,
        COALESCE(SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END),0) AS wagered,
        COALESCE(SUM(CASE WHEN amount > 0 AND reason = 'win' THEN amount ELSE 0 END),0) AS won,
        COALESCE(MAX(CASE WHEN reason = 'win' THEN amount ELSE 0 END),0) AS biggest
        FROM ledger WHERE user_id = ?`).bind(uid).first();
      return json({
        user: { id: user.telegram_id, username: user.username, first_name: user.first_name, photo_url: user.photo_url, balance: user.balance, isAdmin: isAdmin(env, uid) },
        online: on?.c ?? 1,
        perGame: Object.fromEntries((per?.results ?? []).map((r: any) => [r.g, r.c])),
        stats: { games: st?.games ?? 0, wagered: st?.wagered ?? 0, won: st?.won ?? 0, biggest: st?.biggest ?? 0, profit: (st?.won ?? 0) - (st?.wagered ?? 0) },
      });
    }
    /* ---------- /api/balance (live) ---------- */
    if (url.pathname === '/api/balance') {
      const r: any = await env.DB.prepare('SELECT balance FROM users WHERE telegram_id = ?').bind(uid).first();
      return json({ ok: true, balance: r?.balance ?? 0 });
    }

    /* ---------- /api/top ---------- */
    if (url.pathname === '/api/top') {
      const rows: any = await env.DB.prepare(`SELECT u.username, u.first_name, u.photo_url,
                (SELECT COALESCE(SUM(l.amount),0) FROM ledger l WHERE l.user_id = u.telegram_id AND l.reason IN ('bet','win')) AS profit
        FROM users u ORDER BY profit DESC LIMIT 20`).all();
      return json({ ok: true, top: rows.results.filter((r: any) => r.profit > 0) });
    }

    /* ---------- /api/daily ---------- */
    if (url.pathname === '/api/daily') {
      const now = Date.now();
      const last = user.last_daily ?? 0;
      if (now - last < 24*3600*1000) return json({ error: 'cooldown', left: 24*3600*1000 - (now - last) });
      const streak = (now - last < 48*3600*1000) ? (user.streak ?? 0) + 1 : 1;
      const amount = Math.min(25 + (streak - 1) * 5, 50);
      await env.DB.prepare('UPDATE users SET last_daily = ?, streak = ? WHERE telegram_id = ?').bind(now, streak, uid).run();
      const balance = await credit(env, uid, amount);
      await ledger(env, uid, amount, 'daily', null);
      return json({ ok: true, amount, streak, balance });
    }

    /* ---------- /api/tasks ---------- */
    if (url.pathname === '/api/tasks') {
      const done: any = await env.DB.prepare('SELECT task_id FROM tasks_done WHERE user_id = ?').bind(uid).all();
      const doneIds = new Set((done.results ?? []).map((r: any) => r.task_id));
      const bets: any = await env.DB.prepare('SELECT COUNT(*) c FROM ledger WHERE user_id = ? AND amount < 0').bind(uid).first();
      const big: any = await env.DB.prepare('SELECT MAX(amount) m FROM ledger WHERE user_id = ? AND reason = \'win\'').bind(uid).first();
      const st: any = await env.DB.prepare('SELECT COALESCE(SUM(amount),0) p FROM ledger WHERE user_id = ?').bind(uid).first();
      let sub = false;
      try {
        const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/getChatMember?chat_id=${encodeURIComponent(CHANNEL)}&user_id=${uid}`);
        const d: any = await r.json();
        sub = ['creator','administrator','member','restricted'].includes(d?.result?.status);
      } catch {}
      const ready: Record<string, boolean> = {
        sub, first: (bets?.c ?? 0) >= 1, bets10: (bets?.c ?? 0) >= 10,
        bigwin: (big?.m ?? 0) >= 500, profit1k: (st?.p ?? 0) >= 1000,
      };
      return json({ ok: true, tasks: TASKS.map(t => ({ ...t, done: doneIds.has(t.id), ready: !!ready[t.id] })) });
    }
    if (url.pathname === '/api/task_claim') {
      const t = TASKS.find(x => x.id === body.task);
      if (!t) return json({ error: 'unknown' }, 400);
      const chk: any = await env.DB.prepare('SELECT 1 x FROM tasks_done WHERE user_id = ? AND task_id = ?').bind(uid, t.id).first();
      if (chk) return json({ error: 'done' }, 400);
      let ok = false;
      if (t.id === 'sub') {
        try {
          const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/getChatMember?chat_id=${encodeURIComponent(CHANNEL)}&user_id=${uid}`);
          const d: any = await r.json();
          ok = ['creator','administrator','member','restricted'].includes(d?.result?.status);
        } catch {}
      } else if (t.id === 'first') {
        const r: any = await env.DB.prepare('SELECT COUNT(*) c FROM ledger WHERE user_id = ? AND amount < 0').bind(uid).first();
        ok = (r?.c ?? 0) >= 1;
      } else if (t.id === 'bets10') {
        const r: any = await env.DB.prepare('SELECT COUNT(*) c FROM ledger WHERE user_id = ? AND amount < 0').bind(uid).first();
        ok = (r?.c ?? 0) >= 10;
      } else if (t.id === 'bigwin') {
        const r: any = await env.DB.prepare('SELECT MAX(amount) m FROM ledger WHERE user_id = ? AND reason = \'win\'').bind(uid).first();
        ok = (r?.m ?? 0) >= 500;
      } else if (t.id === 'profit1k') {
        const r: any = await env.DB.prepare('SELECT COALESCE(SUM(amount),0) p FROM ledger WHERE user_id = ?').bind(uid).first();
        ok = (r?.p ?? 0) >= 1000;
      }
      if (!ok) return json({ error: 'not_ready' }, 400);
      await env.DB.prepare('INSERT INTO tasks_done (task_id, user_id) VALUES (?,?)').bind(t.id, uid).run();
      const balance = await credit(env, uid, t.reward);
      await ledger(env, uid, t.reward, 'task', t.id);
      return json({ ok: true, reward: t.reward, balance });
    }

    /* ---------- промокоды ---------- */
    if (url.pathname === '/api/promo') {
      const code = String(body.code ?? '').trim().toUpperCase();
      if (!code) return json({ error: 'bad' }, 400);
      const p: any = await env.DB.prepare('SELECT * FROM promos WHERE code = ?').bind(code).first();
      if (!p || p.uses >= p.max_uses) return json({ error: 'not_found' }, 400);
      const used: any = await env.DB.prepare('SELECT 1 x FROM promo_used WHERE code = ? AND user_id = ?').bind(code, uid).first();
      if (used) return json({ error: 'used' }, 400);
      await env.DB.prepare('INSERT INTO promo_used (code, user_id) VALUES (?,?)').bind(code, uid).run();
      await env.DB.prepare('UPDATE promos SET uses = uses + 1 WHERE code = ?').bind(code).run();
      const balance = await credit(env, uid, p.amount);
      await ledger(env, uid, p.amount, 'promo', code);
      return json({ ok: true, amount: p.amount, balance });
    }

    /* ---------- админка ---------- */
    if (url.pathname.startsWith('/api/admin')) {
      if (!isAdmin(env, uid)) return json({ error: 'forbidden' }, 403);
      if (url.pathname === '/api/admin/users') {
        const rows: any = await env.DB.prepare('SELECT telegram_id, username, first_name, balance, last_seen FROM users ORDER BY last_seen DESC LIMIT 100').all();
        return json({ ok: true, users: rows.results });
      }
      if (url.pathname === '/api/admin/add') {
        const target = Number(body.uid), amount = Math.floor(Number(body.amount));
        if (!Number.isFinite(target) || !Number.isFinite(amount) || amount === 0) return json({ error: 'bad' }, 400);
        const balance = amount > 0 ? await credit(env, target, amount)
          : await (async () => { await env.DB.prepare('UPDATE users SET balance = MAX(0, balance + ?) WHERE telegram_id = ?').bind(amount, target).run();
              const r: any = await env.DB.prepare('SELECT balance FROM users WHERE telegram_id = ?').bind(target).first(); return r?.balance ?? 0; })();
        await ledger(env, target, amount, 'admin', null);
        return json({ ok: true, balance });
      }
      if (url.pathname === '/api/admin/promo_create') {
        const code = String(body.code ?? '').trim().toUpperCase();
        const amount = Math.floor(Number(body.amount)), maxUses = Math.floor(Number(body.max_uses) || 1);
        if (!code || !Number.isFinite(amount) || amount < 1) return json({ error: 'bad' }, 400);
        await env.DB.prepare('INSERT INTO promos (code, amount, max_uses, uses, created_at) VALUES (?,?,?,?,?) ON CONFLICT(code) DO UPDATE SET amount=excluded.amount, max_uses=excluded.max_uses').bind(code, amount, maxUses, 0, Date.now()).run();
        return json({ ok: true });
      }
      if (url.pathname === '/api/admin/promos') {
        const rows: any = await env.DB.prepare('SELECT * FROM promos ORDER BY created_at DESC LIMIT 50').all();
        return json({ ok: true, promos: rows.results });
      }
      return json({ error: 'unknown' }, 400);
    }

    /* ---------- /api/play ---------- */
    if (url.pathname !== '/api/play') return json({ error: 'not_found' }, 404);

    const game = String(body.game ?? '');
    const base = game.replace(/_(start|pick|cash|check|hit|stand|guess)$/, '');
    const known = ['coinflip','wheel','mines','crash','ladder','dice','slots','roulette','blackjack','cases','rps','plinko','hilo'].includes(base);
    if (!known) return json({ error: 'unknown_game' }, 400);
    const bet = Math.floor(Number(body.bet));
    const noBet = ['mines_pick','mines_cash','crash_cash','crash_check','ladder_pick','ladder_cash','blackjack_hit','blackjack_stand','hilo_guess','hilo_cash'].includes(game);
    if (!noBet && (!Number.isFinite(bet) || bet < 1 || bet > 1_000_000_000)) return json({ error: 'bad_bet' }, 400);
    await env.DB.prepare('UPDATE users SET last_game = ? WHERE telegram_id = ?').bind(base, uid).run();
    const pay = async (p: number, g: string) => {
      await ledger(env, uid, -bet, 'bet', g);
      if (p) await ledger(env, uid, p, 'win', g);
      return await credit(env, uid, p);
    };

    if (game === 'coinflip') {
      if (!(await deduct(env, uid, bet))) return json({ error: 'low_balance' }, 400);
      const choice = body.choice === 'tails' ? 'tails' : 'heads';
      const side = (randInt(999) <= 489) ? choice : (choice === 'heads' ? 'tails' : 'heads');
      const payout = side === choice ? bet * 2 : 0;
      const balance = await pay(payout, game);
      return json({ ok: true, side, mult: payout ? 2 : 0, payout, balance });
    }
    if (game === 'wheel') {
      if (!(await deduct(env, uid, bet))) return json({ error: 'low_balance' }, 400);
      const i = wpick(WHEEL);
      const payout = Math.floor(bet * WHEEL[i].m);
      const balance = await pay(payout, game);
      return json({ ok: true, index: i, mult: WHEEL[i].m, payout, balance });
    }
    if (game === 'dice') {
      if (!(await deduct(env, uid, bet))) return json({ error: 'low_balance' }, 400);
      const target = Math.max(2, Math.min(98, Math.floor(Number(body.target) || 50)));
      const over = !!body.over;
      const chance = over ? 99 - target : target;
      const mult = Math.floor((99 / chance) * 0.96 * 100) / 100;
      const roll = randInt(99);
      const win = over ? roll > target : roll < target;
      const payout = win ? Math.floor(bet * mult) : 0;
      const balance = await pay(payout, game);
      return json({ ok: true, roll, win, mult, payout, balance });
    }
    if (game === 'slots') {
      if (!(await deduct(env, uid, bet))) return json({ error: 'low_balance' }, 400);
      const reels = [wpick(SLOT_SYM), wpick(SLOT_SYM), wpick(SLOT_SYM)];
      const [a, b, c] = reels;
      let mult = 0;
      if (a === b && b === c) mult = SLOT_SYM[a].m;
      else if (a === b || b === c || a === c) mult = 1.5;
      const payout = Math.floor(bet * mult);
      const balance = await pay(payout, game);
      return json({ ok: true, reels, mult, payout, balance });
    }
    if (game === 'roulette') {
      if (!(await deduct(env, uid, bet))) return json({ error: 'low_balance' }, 400);
      const n = randInt(14);
      const color = n === 0 ? 'green' : (n % 2 === 1 ? 'red' : 'black');
      const choice = ['red','black','green'].includes(body.choice) ? body.choice : 'red';
      const mult = choice === color ? (color === 'green' ? 14 : 2) : 0;
      const payout = Math.floor(bet * mult);
      const balance = await pay(payout, game);
      return json({ ok: true, n, color, mult, payout, balance });
    }
    if (game === 'rps') {
      if (!(await deduct(env, uid, bet))) return json({ error: 'low_balance' }, 400);
      const opts = ['rock','paper','scissors'];
      const player = opts.includes(body.choice) ? body.choice : 'rock';
      const cpu = opts[randInt(2)];
      const result = player === cpu ? 'draw'
        : (player === 'rock' && cpu === 'scissors') || (player === 'paper' && cpu === 'rock') || (player === 'scissors' && cpu === 'paper') ? 'win' : 'lose';
      const payout = result === 'win' ? Math.floor(bet * 2.8) : result === 'draw' ? bet : 0;
      const balance = await pay(payout, game);
      return json({ ok: true, player, cpu, result, payout, balance });
    }
    if (game === 'plinko') {
      if (!(await deduct(env, uid, bet))) return json({ error: 'low_balance' }, 400);
      const path = Array.from({ length: 8 }, () => randInt(1));
      const bucket = path.reduce((s, x) => s + x, 0);
      const mult = PLINKO_M[bucket];
      const payout = Math.floor(bet * mult);
      const balance = await pay(payout, game);
      return json({ ok: true, path, bucket, mult, payout, balance });
    }
    if (game === 'cases') {
      if (!(await deduct(env, uid, bet))) return json({ error: 'low_balance' }, 400);
      const i = wpick(CASES);
      const payout = Math.floor(bet * CASES[i].m);
      const balance = await pay(payout, game);
      return json({ ok: true, index: i, mult: CASES[i].m, payout, balance });
    }

    if (game === 'mines_start') {
      if (!(await deduct(env, uid, bet))) return json({ error: 'low_balance' }, 400);
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

    if (game === 'ladder_start') {
      if (!(await deduct(env, uid, bet))) return json({ error: 'low_balance' }, 400);
      const mines = Array.from({ length: 8 }, () => randInt(2));
      const sid = crypto.randomUUID();
      await saveSession(env, sid, uid, 'ladder', { bet, mines, step: 0, done: false });
      await ledger(env, uid, -bet, 'bet', 'ladder');
      return json({ ok: true, sid });
    }
    if (game === 'ladder_pick') {
      const s = await loadSession(env, String(body.sid ?? ''), uid);
      if (!s || s.data.done) return json({ error: 'done' }, 400);
      const cell = Math.floor(Number(body.cell));
      if (cell < 0 || cell > 2 || s.data.step >= 8) return json({ error: 'bad_cell' }, 400);
      const row = s.data.step;
      if (s.data.mines[row] === cell) {
        s.data.done = true; await saveSession(env, body.sid, uid, 'ladder', s.data);
        return json({ ok: true, boom: true, row, mine: s.data.mines[row] });
      }
      s.data.step++;
      const top = s.data.step >= 8;
      let payout = 0, balance;
      if (top) {
        s.data.done = true;
        payout = Math.floor(s.data.bet * ladderMult(8));
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

    if (game === 'crash_start') {
      if (!(await deduct(env, uid, bet))) return json({ error: 'low_balance' }, 400);
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

    if (game === 'blackjack_start') {
      if (!(await deduct(env, uid, bet))) return json({ error: 'low_balance' }, 400);
      const player = [drawCard(), drawCard()];
      const dealer = [drawCard(), drawCard()];
      const sid = crypto.randomUUID();
      const pv = handValue(player.map(c => c.r));
      let done = false, payout = 0, balance;
      if (pv === 21) {
        done = true;
        payout = handValue(dealer.map(c => c.r)) === 21 ? bet : Math.floor(bet * 2.2);
        balance = await credit(env, uid, payout);
        await ledger(env, uid, payout, 'win', 'blackjack');
      }
      await saveSession(env, sid, uid, 'blackjack', { bet, player, dealer, done });
      await ledger(env, uid, -bet, 'bet', 'blackjack');
      return json({ ok: true, sid, player, dealerTop: dealer[0], done, payout, balance });
    }
    if (game === 'blackjack_hit') {
      const s = await loadSession(env, String(body.sid ?? ''), uid);
      if (!s || s.data.done) return json({ error: 'done' }, 400);
      const card = drawCard();
      s.data.player.push(card);
      const v = handValue(s.data.player.map(c => c.r));
      if (v > 21) { s.data.done = true; await saveSession(env, body.sid, uid, 'blackjack', s.data);
        return json({ ok: true, card, v, bust: true, dealer: s.data.dealer }); }
      await saveSession(env, body.sid, uid, 'blackjack', s.data);
      return json({ ok: true, card, v, bust: false });
    }
    if (game === 'blackjack_stand') {
      const s = await loadSession(env, String(body.sid ?? ''), uid);
      if (!s || s.data.done) return json({ error: 'done' }, 400);
      const dealer = s.data.dealer;
      while (handValue(dealer.map(c => c.r)) < 17) dealer.push(drawCard());
      const pv = handValue(s.data.player.map(c => c.r));
      const dv = handValue(dealer.map(c => c.r));
      const result = dv > 21 || pv > dv ? 'win' : pv === dv ? 'push' : 'lose';
      const payout = result === 'win' ? s.data.bet * 2 : result === 'push' ? s.data.bet : 0;
      s.data.done = true; await saveSession(env, body.sid, uid, 'blackjack', s.data);
      const balance = await credit(env, uid, payout);
      if (payout) await ledger(env, uid, payout, 'win', 'blackjack');
      return json({ ok: true, dealer, dv, result, payout, balance });
    }

    if (game === 'hilo_start') {
      if (!(await deduct(env, uid, bet))) return json({ error: 'low_balance' }, 400);
      const first = 1 + randInt(12);
      const sid = crypto.randomUUID();
      await saveSession(env, sid, uid, 'hilo', { bet, cur: first, mult: 1, done: false });
      await ledger(env, uid, -bet, 'bet', 'hilo');
      return json({ ok: true, sid, cur: first });
    }
    if (game === 'hilo_guess') {
      const s = await loadSession(env, String(body.sid ?? ''), uid);
      if (!s || s.data.done) return json({ error: 'done' }, 400);
      const v = s.data.cur;
      const higher = !!body.higher;
      if ((higher && v === 13) || (!higher && v === 1)) return json({ error: 'bad_bet' }, 400);
      let next = 1 + randInt(12);
      while (next === v) next = 1 + randInt(12);
      const okk = higher ? next > v : next < v;
      if (!okk) { s.data.done = true; await saveSession(env, body.sid, uid, 'hilo', s.data);
        return json({ ok: true, win: false, next }); }
      s.data.mult = Math.floor(s.data.mult * (0.94 * 12 / (higher ? 13 - v : v - 1)) * 100) / 100;
      s.data.cur = next;
      await saveSession(env, body.sid, uid, 'hilo', s.data);
      return json({ ok: true, win: true, next, mult: s.data.mult });
    }
    if (game === 'hilo_cash') {
      const s = await loadSession(env, String(body.sid ?? ''), uid);
      if (!s || s.data.done || s.data.mult === 1) return json({ error: 'done' }, 400);
      const payout = Math.floor(s.data.bet * s.data.mult);
      s.data.done = true; await saveSession(env, body.sid, uid, 'hilo', s.data);
      const balance = await credit(env, uid, payout);
      await ledger(env, uid, payout, 'win', 'hilo');
      return json({ ok: true, promos: rows.results });
    }

    return json({ error: 'unknown_game' }, 400);
}
