import { el, haptic, fmt, makeBetRow } from '../ui.js';
import { play } from '../api.js';

const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const SUITS = ['♠','♥','♦','♣'];

export function renderHilo(app){
  const { tg, state, syncTop, toast, show } = app;
  let bet = 10, sid = null, mult = 1, active = false, busy = false;

  const wrap = el('div');
  wrap.innerHTML = `
    <div class="game-head"><button class="back">←</button><div class="gtitle">HI-LO</div><div style="width:40px"></div></div>
    <div class="stage hilo-card">
      <div class="pcard" style="width:96px;height:132px;font-size:34px">—</div>
      <div class="pill" style="margin-top:12px">Множ: <span class="mu">x1</span></div>
      <div class="result-pill" hidden></div>
    </div>
    <div class="choices">
      <button class="chip choice" id="hi">⬆️ Выше</button>
      <button class="chip choice" id="lo">⬇️ Ниже</button>
    </div>`;

  const card = wrap.querySelector('.pcard');
  const mu = wrap.querySelector('.mu');
  const res = wrap.querySelector('.result-pill');
  const stage = wrap.querySelector('.stage');
  const hi = wrap.querySelector('#hi');
  const lo = wrap.querySelector('#lo');

  const bets = makeBetRow(() => state.balance, v => bet = v);
  const go = el('button','cta','Начать');
  wrap.append(bets.el, go);
  wrap.querySelector('.back').onclick = () => show('lobby');

  function showCard(v){
    const s = v % 4;
    card.className = 'pcard' + ((s === 1 || s === 2) ? ' red' : '');
    card.style.cssText = 'width:96px;height:132px;font-size:34px';
    card.textContent = RANKS[v-1] + SUITS[s];
  }

  function reset(){
    active = false; sid = null; mult = 1;
    mu.textContent = 'x1';
    card.className = 'pcard'; card.textContent = '—';
    bets.el.style.display = '';
    go.textContent = 'Начать';
    stage.classList.remove('win','lose');
  }

  const guess = higher => async () => {
    if (!active || busy) return; busy = true; haptic(tg);
    const d = await play(tg, 'hilo_guess', { sid, higher });
    busy = false;
    if (!d.ok) return toast('Ошибка');
    if (!d.win){
      showCard(d.next);
      active = false;
      stage.classList.add('lose');
      res.hidden = false; res.className = 'result-pill lose'; res.textContent = `−${fmt(bet)} 💎`;
      try { tg?.HapticFeedback?.notificationOccurred('error'); } catch {}
      setTimeout(reset, 1600);
      return;
    }
    showCard(d.next);
    mult = d.mult;
    mu.textContent = 'x' + mult;
    go.textContent = `Забрать • ${fmt(Math.floor(bet * mult))} 💎`;
  };
  hi.onclick = guess(true);
  lo.onclick = guess(false);

  go.onclick = async () => {
    if (busy) return;
    if (!active){
      busy = true; haptic(tg, 'medium');
      const d = await play(tg, 'hilo_start', { bet });
      busy = false;
      if (!d.ok) return toast(d.error === 'low_balance' ? 'Не хватает осколков' : 'Ошибка');
      sid = d.sid; active = true;
      state.balance = state.balance - bet; syncTop();
      showCard(d.cur);
      res.hidden = true;
      stage.classList.remove('win','lose');
      bets.el.style.display = 'none';
      go.textContent = 'Забрать';
      return;
    }
    busy = true; haptic(tg, 'medium');
    const d = await play(tg, 'hilo_cash', { sid });
    busy = false;
    if (!d.ok) return toast('Сначала угадай');
    state.balance = d.balance; syncTop();
    stage.classList.add('win');
    res.hidden = false; res.className = 'result-pill win'; res.textContent = `+${fmt(d.payout)} 💎`;
    try { tg?.HapticFeedback?.notificationOccurred('success'); } catch {}
    setTimeout(reset, 1500);
  };

  return wrap;
}
