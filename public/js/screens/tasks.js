import { el, fmt, haptic } from '../ui.js';

export function renderTasks(app){
  const { tg, state, syncTop, toast, show } = app;
  const wrap = el('div');
  wrap.innerHTML = `
    <div class="game-head"><button class="back">←</button><div class="gtitle">ЗАДАНИЯ</div><div style="width:40px"></div></div>
    <div class="daily-box glass">
      <div style="font-size:32px">🎁</div>
      <div style="flex:1">
        <b style="color:var(--text)">Ежедневный бонус</b>
        <div style="color:var(--muted);font-size:12px" class="daily-sub">загружаем...</div>
      </div>
      <button class="chip" id="daily-btn">Забрать</button>
    </div>
    <div class="tasks-list"></div>`;

  const dailySub = wrap.querySelector('.daily-sub');
  const dailyBtn = wrap.querySelector('#daily-btn');
  const list = wrap.querySelector('.tasks-list');

  wrap.querySelector('.back').onclick = () => show('lobby');

  if (state.user?.last_daily && Date.now() - state.user.last_daily < 24*3600*1000){
    const left = 24*3600*1000 - (Date.now() - state.user.last_daily);
    const h = Math.floor(left/3600000), m = Math.floor((left%3600000)/60000);
    dailySub.textContent = `Серия: ${state.user.streak ?? 1} 🔥 • Следующий через ${h}ч ${m}м`;
    dailyBtn.disabled = true;
  } else {
    dailySub.textContent = `Серия: ${state.user.streak ?? 0} 🔥 • +25 ₽ сегодня`;
  }

  dailyBtn.onclick = async () => {
    if (dailyBtn.disabled) return;
    dailyBtn.disabled = true;
    haptic(tg, 'medium');
    const r = await fetch('/api/daily', {
      method:'POST', headers:{'content-type':'application/json'},
      body: JSON.stringify({ initData: tg?.initData ?? '' })
    });
    const d = await r.json();
    if (!d.ok){
      dailyBtn.disabled = false;
      return toast(d.error === 'cooldown' ? 'Подожди до завтра' : 'Ошибка');
    }
    state.balance = d.balance;
    state.user.streak = d.streak;
    state.user.last_daily = Date.now();
    syncTop();
    toast(`+${d.amount}
