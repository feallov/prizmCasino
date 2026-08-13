import { el, fmt } from '../ui.js';

export function renderTop(app){
  const { tg, show } = app;
  let type = 'balance';

  const wrap = el('div');
  wrap.innerHTML = `
    <div class="game-head"><button class="back">←</button><div class="gtitle">ТОП ИГРОКОВ</div><div style="width:40px"></div></div>
    <div class="choices">
      <button class="chip choice active" data-t="balance">💰 По балансу</button>
      <button class="chip choice" data-t="profit">📈 По прибыли</button>
    </div>
    <div class="top-list"></div>`;

  const list = wrap.querySelector('.top-list');
  const btns = [...wrap.querySelectorAll('.choice')];
  wrap.querySelector('.back').onclick = () => show('lobby');
  btns.forEach(b => b.onclick = () => {
    type = b.dataset.t;
    btns.forEach(x => x.classList.toggle('active', x === b));
    load();
  });

  async function load(){
    list.replaceChildren(el('div','panel','<div style="font-size:24px">⏳</div>'));
    const r = await fetch('/api/top', {
      method:'POST', headers:{'content-type':'application/json'},
      body: JSON.stringify({ initData: tg?.initData ?? '', type })
    });
    const d = await r.json();
    list.replaceChildren();
    if (!d.ok || !d.top?.length){
      list.append(el('div','panel','<div style="font-size:34px">🏆</div><b style="color:var(--text)">Пока никого</b><span>будь первым в топе</span>'));
      return;
    }
    d.top.forEach((u, i) => {
      const row = el('div','top-row glass');
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`;
      const ava = u.photo_url ? `<img src="${u.photo_url}" class="avatar" style="width:42px;height:42px">`
        : `<div class="avatar stub" style="width:42px;height:42px;font-size:18px">👤</div>`;
      const val = type === 'balance'
        ? `${fmt(u.value)} ₽`
        : `${u.value >= 0 ? '+' : ''}${fmt(u.value)} ₽`;
      row.innerHTML = `
        <div class="medal">${medal}</div>
        ${ava}
        <div style="flex:1">
          <b style="color:var(--text)">${u.first_name ?? u.username ?? 'аноним'}</b>${u.isAdmin ? '<span class="admin-badge" style="margin-left:6px">ADMIN</span>' : ''}
          <div style="color:var(--muted);font-size:12px">${u.username ? '@'+u.username : ''}</div>
        </div>
        <div class="profit ${type === 'profit' ? (u.value >= 0 ? 'pos' : 'neg') : ''}">${val}</div>`;
      list.append(row);
    });
  }

  load();
  return wrap;
}
