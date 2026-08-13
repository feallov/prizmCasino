import { el, fmt } from '../ui.js';

export function renderTop(app){
  const { tg, state, show } = app;
  const wrap = el('div');
  wrap.innerHTML = `
    <div class="game-head"><button class="back">←</button><div class="gtitle">ТОП ИГРОКОВ</div><div style="width:40px"></div></div>
    <div class="panel">
      <div style="font-size:24px">⏳</div>
      <span>загружаем рейтинг...</span>
    </div>`;

  wrap.querySelector('.back').onclick = () => show('lobby');

  fetch('/api/top', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ initData: tg?.initData ?? '' })
  }).then(r => r.json()).then(d => {
    if (!d.ok || !d.top?.length){
      wrap.replaceChildren(
        wrap.querySelector('.game-head'),
        el('div','panel','<div style="font-size:34px">🏆</div><b style="color:var(--text)">Пока никого</b><span>будь первым в топе</span>')
      );
      wrap.querySelector('.back').onclick = () => show('lobby');
      return;
    }
    const list = el('div','top-list');
    d.top.forEach((r, i) => {
      const row = el('div','top-row glass');
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`;
      const ava = r.photo_url ? `<img src="${r.photo_url}" class="avatar" style="width:42px;height:42px">`
        : `<div class="avatar stub" style="width:42px;height:42px;font-size:18px">👤</div>`;
      row.innerHTML = `
        <div class="medal">${medal}</div>
        ${ava}
        <div style="flex:1">
          <b style="color:var(--text)">${r.first_name ?? r.username ?? 'аноним'}</b>
          <div style="color:var(--muted);font-size:12px">${r.username ? '@'+r.username : ''}</div>
        </div>
        <div class="profit ${r.profit >= 0 ? 'pos' : 'neg'}">${r.profit >= 0 ? '+' : ''}${fmt(r.profit)} ₽</div>`;
      list.append(row);
    });
    wrap.replaceChildren(wrap.querySelector('.game-head'), list);
    wrap.querySelector('.back').onclick = () => show('lobby');
  });

  return wrap;
}
