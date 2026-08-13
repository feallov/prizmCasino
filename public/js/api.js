function dbg(game, d){
  try{
    let t = document.getElementById('dbg');
    if(!t){
      t = document.createElement('div'); t.id = 'dbg';
      t.style.cssText = 'position:fixed;left:8px;bottom:84px;z-index:999;background:#3f1010;border:1px solid #ef4444;color:#ffd7d7;padding:8px 12px;border-radius:12px;font-size:11px;max-width:92vw;word-break:break-word';
      document.body.append(t);
    }
    t.textContent = `${game}: ${d?.msg ?? d?.error ?? 'ошибка'}`;
    clearTimeout(t._h);
    t._h = setTimeout(()=>t.remove(), 8000);
  }catch{}
}

export async function play(tg, game, payload){
  try{
    const r = await fetch('/api/play', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ initData: tg?.initData ?? '', game, ...payload }),
    });
    const d = await r.json();
    if (!d.ok) dbg(game, d);
    return d;
  }catch(e){ dbg(game, { error: 'network', msg: String(e) }); return { error: 'network' }; }
}
