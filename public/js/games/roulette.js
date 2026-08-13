import { el, haptic, fmt, makeBetRow } from '../ui.js';
import { play } from '../api.js';

const colorOf = n => n === 0 ? 'green' : (n % 2 === 1 ? 'red' : 'black');
const SEG = Array.from({ length: 15 }, (_, n) =>
  colorOf(n) === 'green' ? '#22c55e' : colorOf(n) === 'red' ? '#ef4444' : '#26282e');

export function renderRoulette(app){
  const { tg, state, syncTop, toast, show } = app;
  let bet = 10, choice = 'red', busy = false, rot = 0;

  const wrap = el('div');
  wrap.innerHTML = `
    <div class="game-head"><button class="back">←</button><div class="gtitle">ROULETTE</div><div style="width:40px"></div></div>
    <div class="stage">
      <div class="wheel-wrap">
        <div class="pointer"></div>
        <div class="wheel"></div>
        <div class="hub">🎯</div>
      </div>
      <div class="result-pill" hidden></div>
    </div>
    <div class="choices">
      <button class="chip rchoice red active">🔴 x2.1</button>
      <button class="chip rchoice black">⚫ x2.1</button>
      <button class="chip rchoice green">🟢 x14</button>
    </div>`;

  const wheel = wrap.querySelector('.wheel');
  const res = wrap.querySelector('.result-pill');
  const stage = wrap.querySelector('.stage');
  wheel.style.background = `conic-gradient(${SEG.map((c,i) => `${c} ${i*24}deg ${(i+1)*24}deg`).join(',')})`;

  const btns = [...wrap.querySelectorAll('.rchoice')];
  const map = ['red','black','green'];
  btns.forEach((b,i) => b.onclick = () => {
    choice = map[i];
    btns.forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    haptic(tg);
  });

  const bets = makeBetRow(() => state.balance, v => bet = v);
  const go = el('button','cta','Крутить');
  wrap.append(bets.el, go);
  wrap.querySelector('.back').onclick = () => show('lobby');

  go.onclick = async () => {
    if (busy) return; busy = true; go.disabled = true; res.hidden = true;
    stage.classList.remove('win','lose');
    haptic(tg, 'medium');
    const d = await play(tg, 'roulette', { bet, choice });
    if (!d.ok){
      busy = false; go.disabled = false;
      return toast(d.error === 'low_balance' ? 'Не хватает осколков' : 'Ошибка');
    }
    state.balance = d.balance; syncTop();

    const desired = (360 - (d.n*24 + 12)) % 360;
    const delta = (desired - (rot % 360) + 360) % 360;
    rot += 360*4 + delta;
    wheel.style.transform = `rotate(${rot}deg)`;

    setTimeout(() => {
      const win = d.mult > 0;
      res.hidden = false;
      res.className = `result-pill ${win ? 'win' : 'lose'}`;
      res.textContent = `${d.n} • ${d.color === 'red' ? 'красное' : d.color === 'black' ? 'чёрное' : 'зеро'} • ${win ? '+'+fmt(d.payout) : '−'+fmt(bet)} 💎`;
      stage.classList.add(win ? 'win' : 'lose');
      try { tg?.HapticFeedback?.notificationOccurred(win ? 'success' : 'error'); } catch {}
      busy = false; go.disabled = false;
    }, 3300);
  };

  return wrap;
}
