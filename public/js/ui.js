export const $ = (s, r = document) => r.querySelector(s);

export function el(tag, cls, html){
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html !== undefined) n.innerHTML = html;
  return n;
}

export const fmt = (n) => Number(n || 0).toLocaleString('ru-RU');

export function haptic(tg, type = 'light'){
  try { tg?.HapticFeedback?.impactOccurred(type); } catch {}
}
