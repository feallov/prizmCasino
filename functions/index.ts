import { validateInitData } from './lib/auth';
import { ensureSchema, getOrCreateUser } from './lib/db';

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/me' && request.method === 'POST') {
      if (!env.BOT_TOKEN) return json({ error: 'no_bot_token' }, 500);

      let initData = '';
      try { initData = (await request.json() as any).initData ?? ''; }
      catch { return json({ error: 'bad_body' }, 400); }

      const tgUser = await validateInitData(initData, env.BOT_TOKEN);
      if (!tgUser) return json({ error: 'unauthorized' }, 401);

      await ensureSchema(env.DB);
      const row: any = await getOrCreateUser(env.DB, tgUser);
      const on: any = await env.DB.prepare('SELECT COUNT(*) AS c FROM users WHERE last_seen > ?').bind(Date.now() - 5*60*1000).first();

      return json({
        user: {
          id: row.telegram_id,
          username: row.username,
          first_name: row.first_name,
          photo_url: row.photo_url,
          balance: row.balance,
        },
        online: on?.c ?? 1,
      });
    }

    return json({ error: 'not_found' }, 404);
  },
};
