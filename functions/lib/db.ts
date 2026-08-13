export const START_BALANCE = 1000;

let schemaReady = false;

export async function ensureSchema(db: any) {
  if (schemaReady) return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS users (
    telegram_id INTEGER PRIMARY KEY,
    username TEXT,
    first_name TEXT,
    photo_url TEXT,
    balance INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    last_seen INTEGER NOT NULL
  )`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    reason TEXT NOT NULL,
    game TEXT,
    created_at INTEGER NOT NULL
  )`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    game TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`).run();
  schemaReady = true;
}

export async function getOrCreateUser(db: any, u: any) {
  const now = Date.now();
  const row: any = await db.prepare('SELECT * FROM users WHERE telegram_id = ?').bind(u.id).first();

  if (row) {
    await db.prepare('UPDATE users SET last_seen = ?, username = ?, first_name = ?, photo_url = ? WHERE telegram_id = ?')
      .bind(now, u.username ?? null, u.first_name ?? null, u.photo_url ?? null, u.id).run();
    return row;
  }

  await db.prepare('INSERT INTO users (telegram_id, username, first_name, photo_url, balance, created_at, last_seen) VALUES (?,?,?,?,?,?,?)')
    .bind(u.id, u.username ?? null, u.first_name ?? null, u.photo_url ?? null, START_BALANCE, now, now).run();
  await db.prepare('INSERT INTO ledger (user_id, amount, reason, created_at) VALUES (?,?,?,?)')
    .bind(u.id, START_BALANCE, 'welcome', now).run();

  return {
    telegram_id: u.id, username: u.username ?? null,
    first_name: u.first_name ?? null, photo_url: u.photo_url ?? null,
    balance: START_BALANCE,
  };
}
