import { el, haptic, fmt, makeBetRow } from '../ui.js';
import { play } from '../api.js';

const SYM = ['💎','7️⃣','','⭐','🍒','🍋'];

export function renderSlots(app){
  const { tg, state, syncTop, toast, show } = app;
  let bet = 10, busy = false;

  const wrap = el('div');
  wrap.innerHTML = `
    <div class="game-head"><button class="back">←</button><div class="gtitle">SLOTS</div><div style="width:40px"></div></div>
    <div class="stage">
      <div class="reels">
        <div class="reel">🍋</div><div class="reel">🍒</div><div class="reel">⭐</div>
      </div>
      <div class="result-pill" hidden></div>
    </div>`;

  const reels = [...wrap.querySelectorAll('.reel')];
  const res = wrap.querySelector('.result-pill');
  const stage = wrap.querySelector('.stage');

  const bets = makeBetRow(() => state.balance, v => bet = v);
  const go = el('button','cta','Крутить');
  wrap.append(bets.el, go);
  wrap.querySelector('.back').onclick = () => show('lobby');

  go.onclick = async () => {
    if (busy) return; busy = true; go.disabled = true;
    res.hidden = true; stage.classList.remove('win','lose');
    bets.el.style.display = 'none';
    haptic(tg, 'medium');
    const d = await play(tg, 'slots', { bet });
    if (!d.ok){
      busy = false; go.disabled = false;
      bets.el.style.display = '';
      toast(d.error === 'low_balance' ? 'Не хватает рублей' : 'Ошибка');
      return;
    }

    const spinners = reels.map((r, k) => {
      const iv = setInterval(() => { r.textContent = SYM[Math.floor(Math.random()*SYM.length)]; }, 70);
      setTimeout(() => {
        clearInterval(iv);
        r.textContent = SYM[d.reels[k]];
        r.classList.add('stop');
        setTimeout(() => r.classList.remove('stop'), 400);
      }, 700 + k*450);
      return iv;
    });

    setTimeout(() => {
      state.balance = d.balance; syncTop();
      const win = d.payout > 0;
      res.hidden = false;
      res.className = `result-pill ${win ? 'win' : 'lose'}`;
      const profit = d.payout - bet;
      res.textContent = win ? `x${d.mult} • +${fmt(profit)} ₽` : `−${fmt(bet)} ₽`;
      stage.classList.add(win ? 'win' : 'lose');
      try { tg?.HapticFeedback?.notificationOccurred(win ? 'success' : 'error'); } catch {}
      busy = false; go.disabled = false;
      bets.el.style.display = '';
    }, 700 + 2*450 + 350);
  };

  return wrap;
}
