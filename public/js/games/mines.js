import { el, haptic, fmt, makeBetRow } from '../ui.js';
import { play } from '../api.js';

export function renderMines(app){
  const { tg, state, syncTop, toast, show } = app;
  let bet = 10, mc = 5, sid = null, mult = 1, busy = false, active = false;

  const wrap = el('div');
  wrap.innerHTML = `
    <div class="game-head"><button class="back">←</button><div class="gtitle">MINES</div><div style="width:40px"></div></div>
    <div class="stage mines-stage"><div class="mines-grid"></div><div class="result-pill" hidden></div></div>
    <div class="choices">
      <button class="chip choice" data-m="3">3 💣</button>
      <button class="chip choice active" data-m="5">5 💣</button>
      <button class="chip choice" data-m="8">8 💣</button>
    </div>`;

  const grid = wrap.querySelector('.mines-grid');
  const res = wrap.querySelector('.result-pill');
  const countBtns = [...wrap.querySelectorAll('.choice')];
  const cells = [];
  for (let i = 0; i < 25; i++){
    const c = el('button','mcell');
    c.onclick = () => pick(i, c);
    cells.push(c); grid.append(c);
  }

  countBtns.forEach(b => b.onclick = () => {
    if (active) return;
    mc = +b.dataset.m;
    countBtns.forEach(x => x.classList.toggle('active', x === b));
    haptic(tg);
  });

  const bets = makeBetRow(() => state.balance, v => bet = v);
  const go = el('button','cta','Начать');
  wrap.append(bets.el, go);
  wrap.querySelector('.back').onclick = () => show('lobby');

  function reset(){
    active = false; sid = null; mult = 1;
    cells.forEach(c => { c.className = 'mcell'; c.textContent = ''; c.disabled = false; });
    countBtns.forEach(b => b.disabled = false);
    bets.el.style.display = '';
    go.textContent = 'Начать';
    res.hidden = true;
  }

  async function pick(i, c){
    if (!active || busy) return; busy = true; haptic(tg);
    cells.forEach(x => x.disabled = true);
    const d = await play(tg, 'mines_pick', { sid, cell: i });
    busy = false;
    if (!d.ok){ toast('Ошибка'); cells.forEach(x => x.disabled = false); return; }
    if (d.boom){
      c.classList.add('boom'); c.textContent = '💥';
      d.mines.forEach(m => { if (m !== i){ cells[m].classList.add('mine'); cells[m].textContent = '💣'; } });
      cells.forEach(x => x.disabled = true);
      const st = wrap.querySelector('.stage');
      st.classList.add('lose');
      res.hidden = false; res.className = 'result-pill lose'; res.textContent = `−${fmt(bet)} ₽`;
      try { tg?.HapticFeedback?.notificationOccurred('error'); } catch {}
      setTimeout(reset, 1600);
      return;
    }
    c.classList.add('safe'); c.textContent = '💎';
    mult = d.mult;
    go.textContent = `Забрать • x${mult} (${fmt(Math.floor(bet*mult) - bet)} ₽)`;
    cells.forEach(x => x.disabled = false);
  }

  go.onclick = async () => {
    if (busy) return;
    if (!active){
      busy = true; haptic(tg, 'medium');
      const d = await play(tg, 'mines_start', { bet, mines: mc });
      busy = false;
      if (!d.ok){ toast(d.error === 'low_balance' ? 'Не хватает рублей' : 'Ошибка'); return; }
      sid = d.sid; active = true; mult = 1;
      state.balance -= bet; syncTop();
      cells.forEach(c => { c.className = 'mcell'; c.textContent = ''; c.disabled = false; });
      countBtns.forEach(b => b.disabled = true);
      bets.el.style.display = 'none';
      res.hidden = true;
      wrap.querySelector('.stage').classList.remove('win','lose');
      go.textContent = 'Забрать • x1';
      return;
    }
    busy = true; haptic(tg, 'medium');
    cells.forEach(x => x.disabled = true);
    const d = await play(tg, 'mines_cash', { sid });
    busy = false;
    if (!d.ok){ toast('Ошибка'); cells.forEach(x => x.disabled = false); return; }
    state.balance = d.balance; syncTop();
    const st = wrap.querySelector('.stage');
    st.classList.add('win');
    const profit = d.payout - bet;
    res.hidden = false; res.className = 'result-pill win'; res.textContent = `+${fmt(profit)} ₽`;
    try { tg?.HapticFeedback?.notificationOccurred('success'); } catch {}
    cells.forEach(x => x.disabled = true);
    setTimeout(reset, 1400);
  };

  return wrap;
}
