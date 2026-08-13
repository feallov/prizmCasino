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

export function makeBetRow(getBalance, onSet){
  let bet = 10;
  const row = el('div','bet-row');
  const chips = el('div','chips');
  const view = el('div','bet-view');
  const set = v => {
    const maxB = Math.max(1, getBalance() || 1);
    bet = Math.max(1, Math.min(v, maxB));
    view.textContent = `${fmt(bet)} ₽`;
    chips.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', +c.dataset.v === bet));
    onSet(bet);
  };
  for (const v of [1,5,10,50]){
    const b = el('button','chip',String(v)); b.dataset.v = v; b.onclick = () => set(v); chips.append(b);
  }
  const all = el('button','chip','Ва-банк'); all.onclick = () => set(getBalance() || 1); chips.append(all);
  row.append(chips, view);
  set(10);
  return { el: row, get: () => bet, set };
}

export async function play(tg, game, payload){
  try{
    const r = await fetch('/api/play', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ initData: tg?.initData ?? '', game, ...payload }),
    });
    const d = await r.json();
    if (!d.ok && d.error) console.error('[play]', game, d.error);
    return d;
  }catch(e){ console.error('[play network]', e); return { error: 'network' }; }
}
