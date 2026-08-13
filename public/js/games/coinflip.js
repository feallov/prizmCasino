import { el, haptic, fmt, makeBetRow } from '../ui.js';
import { play } from '../api.js';

export function renderCoinflip(app){
  const { tg, state, syncTop, toast, show } = app;
  let choice = 'heads', bet = 10, busy = false, base = 0, off = 0;

  const wrap = el('div');
  wrap.innerHTML = `
    <div class="game-head">
      <button class="back">←</button>
      <div class="gtitle">COINFLIP</div>
      <div style="width:40px"></div>
    </div>
    <div class="stage">
      <div class="coin">
        <div class="face heads">🦅</div>
        <div class="face tails">👑</div>
      </div>
      <div class="result-pill" hidden></div>
    </div>
    <div class="choices">
      <button class="chip choice active">🦅 Орёл</button>
      <button class="chip choice">👑 Решка</button>
    </div>`;

  const stage = wrap.querySelector('.stage');
  const coin = wrap.querySelector('.coin');
  const res = wrap.querySelector('.result-pill');
  const ch = [...wrap.querySelectorAll('.choice')];
  ch[0].onclick = () => { if(!busy){ choice = 'heads'; ch[0].classList.add('active'); ch[1].classList.remove('active'); haptic(tg); } };
  ch[1].onclick = () => { if(!busy){ choice = 'tails'; ch[1].classList.add('active'); ch[0].classList.remove('active'); haptic(tg); } };

  const bets = makeBetRow(() => state.balance, v => bet = v);
  const go = el('button','cta','Бросить • x2');
  wrap.append(bets.el, go);
  wrap.querySelector('.back').onclick = () => show('lobby');

  go.onclick = async () => {
    if (busy) return; busy = true; go.disabled = true; res.hidden = true;
    bets.el.style.display = 'none';
    ch.forEach(c => c.disabled = true);
    stage.classList.remove('win','lose');
    haptic(tg, 'medium');

    const d = await play(tg, 'coinflip', { bet, choice });
    if (!d.ok){
      busy = false; go.disabled = false;
      bets.el.style.display = '';
      ch.forEach(c => c.disabled = false);
      toast(d.error === 'low_balance' ? 'Не хватает рублей' : 'Ошибка');
      return;
    }

    const from = base + off;
    base += 1800;
    off = d.side === 'tails' ? 180 : 0;
    const to = base + off;
    const anim = coin.animate(
      [{ transform: `rotateY(${from}deg)` }, { transform: `rotateY(${to}deg)` }],
      { duration: 1400, easing: 'cubic-bezier(.2,.75,.25,1)' });

    anim.onfinish = () => {
      coin.style.transform = `rotateY(${to}deg)`;
      const win = d.side === choice;
      state.balance = d.balance; syncTop();
      res.hidden = false;
      res.className = `result-pill ${win ? 'win' : 'lose'}`;
      const profit = d.payout - bet;
      res.textContent = win ? `+${fmt(profit)} ₽` : `−${fmt(bet)} ₽`;
      stage.classList.add(win ? 'win' : 'lose');
      try { tg?.HapticFeedback?.notificationOccurred(win ? 'success' : 'error'); } catch {}
      busy = false; go.disabled = false;
      bets.el.style.display = '';
      ch.forEach(c => c.disabled = false);
    };
  };

  return wrap;
}
