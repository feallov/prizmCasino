import { el, haptic, fmt, makeBetRow } from '../ui.js';
import { play } from '../api.js';

const ROWS = 8;
const multOf = k => Math.floor(0.97 * Math.pow(1.5, k) * 100) / 100;

export function renderLadder(app){
  const { tg, state, syncTop, toast, show } = app;
  let bet = 10, sid = null, step = 0, busy = false, active = false;

  const wrap = el('div');
  wrap.innerHTML = `
    <div class="game-head"><button class="back">←</button><div class="gtitle">LADDER</div><div style="width:40px"></div></div>
    <div class="stage"><div class="ladder"></div><div class="result-pill" hidden></div></div>`;

  const ladder = wrap.querySelector('.ladder');
  const res = wrap.querySelector('.result-pill');
  const rowEls = [];
  for (let r = ROWS - 1; r >= 0; r--){
    const row = el('div','lrow'); row.dataset.row = r;
    row.append(el('div','lmult',`x${multOf(r+1)}`));
    for (let c = 0; c < 3; c++){
      const b = el('button','mcell');
      b.onclick = () => pick(r, c, b);
      row.append(b);
    }
    rowEls[r] = row; ladder.append(row);
  }

  const bets = makeBetRow(() => state.balance, v => bet = v);
  const go = el('button','cta','Начать');
  wrap.append(bets.el, go);
  wrap.querySelector('.back').onclick = () => show('lobby');

  const markCur = () => rowEls.forEach((rw,i) => rw.classList.toggle('cur', active && i === step));

  function reset(){
    active = false; sid = null; step = 0;
    rowEls.forEach(rw => rw.querySelectorAll('.mcell').forEach(c => { c.className = 'mcell'; c.textContent = ''; }));
    bets.el.style.display = '';
    go.textContent = 'Начать';
    markCur();
  }
  reset();

  async function pick(r, c, b){
    if (!active || busy || r !== step) return;
    busy = true; haptic(tg);
    const d = await play(tg, 'ladder_pick', { sid, cell: c });
    busy = false;
    if (!d.ok) return toast('Ошибка');
    if (d.boom){
      b.classList.add('boom'); b.textContent = '❌';
      const mineCell = rowEls[r].querySelectorAll('.mcell')[d.mine];
      if (d.mine !== c){ mineCell.classList.add('mine'); mineCell.textContent = '💣'; }
      const st = wrap.querySelector('.stage');
      st.classList.add('lose');
      res.hidden = false; res.className = 'result-pill lose'; res.textContent = `−${fmt(bet)} 💎`;
      try { tg?.HapticFeedback?.notificationOccurred('error'); } catch {}
      setTimeout(reset, 1600);
      return;
    }
    b.classList.add('safe'); b.textContent = '✅';
    step = d.step;
    if (d.top){
      state.balance = d.balance; syncTop();
      wrap.querySelector('.stage').classList.add('win');
      res.hidden = false; res.className = 'result-pill win'; res.textContent = `ВЕРХ! +${fmt(d.payout)} 💎`;
      try { tg?.HapticFeedback?.notificationOccurred('success'); } catch {}
      setTimeout(reset, 1800);
      return;
    }
    go.textContent = `Забрать • x${d.mult}`;
    markCur();
  }

  go.onclick = async () => {
    if (busy) return;
    if (!active){
      busy = true; haptic(tg, 'medium');
      const d = await play(tg, 'ladder_start', { bet });
      busy = false;
      if (!d.ok) return toast(d.error === 'low_balance' ? 'Не хватает осколков' : 'Ошибка');
      sid = d.sid; active = true; step = 0;
      state.balance = state.balance - bet; syncTop();
      rowEls.forEach(rw => rw.querySelectorAll('.mcell').forEach(c => { c.className = 'mcell'; c.textContent = ''; }));
      res.hidden = true;
      wrap.querySelector('.stage').classList.remove('win','lose');
      bets.el.style.display = 'none';
      go.textContent = 'Забрать • x1';
      markCur();
      return;
    }
    busy = true; haptic(tg, 'medium');
    const d = await play(tg, 'ladder_cash', { sid });
    busy = false;
    if (!d.ok) return toast('Ошибка');
    state.balance = d.balance; syncTop();
    wrap.querySelector('.stage').classList.add('win');
    res.hidden = false; res.className = 'result-pill win'; res.textContent = `+${fmt(d.payout)} 💎`;
    try { tg?.HapticFeedback?.notificationOccurred('success'); } catch {}
    setTimeout(reset, 1400);
  };

  return wrap;
}
