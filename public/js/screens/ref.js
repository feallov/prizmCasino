import { el, haptic } from '../ui.js';

export function renderRef(app){
  const { tg, toast, show } = app;
  const id = tg?.initDataUnsafe?.user?.id ?? app.state.user?.id;
  const link = `https://t.me/prizmCasinoBot?start=ref${id}`;

  const wrap = el('div');
  wrap.innerHTML = `
    <div class="game-head"><button class="back">←</button><div class="gtitle">РЕФЕРАЛКА</div><div style="width:40px"></div></div>
    <div class="panel" style="padding:22px">
      <div style="font-size:48px">🤝</div>
      <b style="color:var(--text);font-size:17px">+50 ₽ тебе и другу</b>
      <span>Друг заходит по ссылке, жмёт START и делает любые 3 ставки — вы оба получаете по 50 ₽.</span>
      <input class="admin-input" readonly style="text-align:center;font-size:11px" value="${link}" />
      <div style="display:flex;gap:10px;width:100%">
        <button class="cta" id="cp">📋 Скопировать</button>
        <button class="cta" id="sh" style="background:linear-gradient(135deg,#3b82f6,#1d4ed8)">📤 Поделиться</button>
      </div>
      <div class="stats-grid" style="width:100%;margin-top:6px">
        <div class="stat-box"><span>Приглашено</span><b id="inv">0</b></div>
        <div class="stat-box"><span>Награда получена</span><b id="rew">0</b></div>
      </div>
    </div>`;

  wrap.querySelector('.back').onclick = () => show('lobby');
  const input = wrap.querySelector('input');
  wrap.querySelector('#cp').onclick = async () => {
    haptic(tg);
    try { await navigator.clipboard.writeText(link); toast('Ссылка скопирована'); }
    catch { input.select(); try { document.execCommand('copy'); } catch {} toast('Ссылка скопирована'); }
  };
  wrap.querySelector('#sh').onclick = () => {
    haptic(tg);
    try { tg?.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('Залетай в PRIZM Casino — стартовые 100 ₽ 💎')}`); } catch {}
  };

  fetch('/api/ref', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ initData: tg?.initData ?? '' }) })
    .then(r => r.json()).then(d => {
      if (!d.ok) return;
      wrap.querySelector('#inv').textContent = d.invited;
      wrap.querySelector('#rew').textContent = d.rewarded;
    });

  return wrap;
}
