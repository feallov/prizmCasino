import { el, haptic } from '../ui.js';

export function renderPromo(app){
  const { tg, state, syncTop, toast, show } = app;
  const wrap = el('div');
  wrap.innerHTML = `
    <div class="game-head"><button class="back">←</button><div class="gtitle">ПРОМОКОД</div><div style="width:40px"></div></div>
    <div class="panel" style="padding:28px">
      <div style="font-size:48px">🎟️</div>
      <b style="color:var(--text);font-size:18px">Введите код</b>
      <input class="admin-input" id="pcode" placeholder="например, WELCOME" style="text-align:center;text-transform:uppercase" />
      <button class="cta" id="psub">Активировать</button>
    </div>`;

  wrap.querySelector('.back').onclick = () => show('profile');
  const input = wrap.querySelector('#pcode');
  const btn = wrap.querySelector('#psub');

  btn.onclick = async () => {
    const code = input.value.trim();
    if (!code) return toast('Введи код');
    btn.disabled = true; haptic(tg, 'medium');
    const r = await fetch('/api/promo', {
      method:'POST', headers:{'content-type':'application/json'},
      body: JSON.stringify({ initData: tg?.initData ?? '', code })
    });
    const d = await r.json();
    btn.disabled = false;
    if (!d.ok){
      if (d.error === 'not_found') return toast('Код не найден');
      if (d.error === 'used') return toast('Уже использован');
      return toast('Ошибка');
    }
    state.balance = d.balance; syncTop();
    toast(`+${d.amount} ₽ 🎉`);
    try { tg?.HapticFeedback?.notificationOccurred('success'); } catch {}
    input.value = '';
  };

  return wrap;
}
