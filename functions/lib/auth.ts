// Проверка подписи Telegram initData — только после неё верим, кто юзер

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length >> 1);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function equal(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}

export async function validateInitData(initData: string, botToken: string): Promise<any | null> {
  if (!initData || !botToken) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;

  // initData старше суток не принимаем
  const authDate = Number(params.get('auth_date') || 0);
  if (!authDate || Date.now() / 1000 - authDate > 86400) return null;

  params.delete('hash');
  const check = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort().join('\n');

  const enc = new TextEncoder();
  const importKey = (raw: any) =>
    crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);

  const secretKey = await importKey(enc.encode('WebAppData'));
  const secret = new Uint8Array(await crypto.subtle.sign('HMAC', secretKey, enc.encode(botToken)));
  const signKey = await importKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', signKey, enc.encode(check)));

  if (!equal(sig, hexToBytes(hash))) return null;

  const userRaw = params.get('user');
  if (!userRaw) return null;
  try { return JSON.parse(userRaw); } catch { return null; }
}
