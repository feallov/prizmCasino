// Вход без логина/пароля: Telegram сам говорит, кто ты
import { validateInitData } from '../lib/auth';
import { ensureSchema, getOrCreateUser } from '../lib/db';

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

export const onRequestPost: any = async (context: any) => {
  const { env, request } = context;
  if (!env.BOT_TOKEN) return json({ error: 'no_bot_token' }, 500);

  let initData = '';
  try { initData = (await request.json() as any).initData ?? ''; }
  catch { return json({ error: 'bad_body' }, 400); }

  const tgUser = await validateInitData(initData, env.BOT_TOKEN);
  if (!tgUser) return json({ error: 'unauthorized' }, 401);

  await ensureSchema(env.DB);
  const row: any = await getOrCreateUser(env.DB, tgUser);

  return json({
    user: {
      id: row.telegram_id,
      username: row.username,
      first_name: row.first_name,
      photo_url: row.photo_url,
      balance: row.balance,
    },
  });
};
