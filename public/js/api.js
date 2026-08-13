export async function play(tg, game, payload){
  try{
    const r = await fetch('/api/play', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ initData: tg?.initData ?? '', game, ...payload }),
    });
    return await r.json();
  }catch{ return { error: 'network' }; }
}
