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
    toast(`+${d.amount} ₽ • серия ${d.streak} 🔥`);
    try { tg?.HapticFeedback?.notificationOccurred('success'); } catch {}
    const left = 24*3600*1000;
    const h = 23, m = 59;
    dailySub.textContent = `Серия: ${d.streak} 🔥 • Следующий через ${h}ч ${m}м`;
  };

  fetch('/api/tasks', {
    method:'POST', headers:{'content-type':'application/json'},
    body: JSON.stringify({ initData: tg?.initData ?? '' })
  }).then(r => r.json()).then(d => {
    if (!d.ok) return;
    list.replaceChildren();
    for (const t of d.tasks){
      const row = el('div','task-row glass');
      const stateTxt = t.done ? '✅' : t.ready ? '🎯' : '🔒';
      row.innerHTML = `
        <div style="font-size:22px">${stateTxt}</div>
        <div style="flex:1">
          <b style="color:var(--text)">${t.title}</b>
          <div style="color:var(--gold);font-size:12px;font-weight:800">+${t.reward} ₽</div>
        </div>
        <button class="chip" ${t.done || !t.ready ? 'disabled' : ''}>${t.done ? 'готово' : 'забрать'}</button>`;
      const btn = row.querySelector('button');
      if (!t.done && t.ready){
        btn.onclick = async () => {
          btn.disabled = true; haptic(tg, 'medium');
          const r = await fetch('/api/task_claim', {
            method:'POST', headers:{'content-type':'application/json'},
            body: JSON.stringify({ initData: tg?.initData ?? '', task: t.id })
          });
          const d2 = await r.json();
          if (!d2.ok){ btn.disabled = false; return toast(d2.error === 'not_ready' ? 'Ещё не готово' : 'Ошибка'); }
          state.balance = d2.balance; syncTop();
          toast(`+${d2.reward} ₽`);
          try { tg?.HapticFeedback?.notificationOccurred('success'); } catch {}
          btn.textContent = 'готово'; btn.disabled = true;
          row.querySelector('div[style*="22px"]').textContent = '✅';
        };
      }
      list.append(row);
    }
  });

  return wrap;
}
